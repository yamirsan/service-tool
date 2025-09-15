import pandas as pd
from sqlalchemy.orm import Session
from database import engine, create_tables, Part, Formula, User, SessionLocal
from passlib.context import CryptContext
import os

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def import_excel_to_database(excel_file_path: str):
    """
    Import Excel data into SQLite database without dropping tables.
    Handles headers like: Code, Desc., MAP, Status, N, Diff., S.QTY, GR QTY, GR $
    Also supports alternative layouts with headers such as:
    PARTS_CODE, PARTS_DESC, STOCK_QTY, WH_STOCK_Q*, ENG_STOCK_*, MO_AVG_PRICE, MO_AVG_AMOUNT

    Note: When a part already exists, its Description will not be overwritten.
    The description is only set if the existing value is empty or null.
    """
    print("Creating database tables...")
    create_tables()

    print(f"Reading Excel file: {excel_file_path}")

    try:
        xls = pd.ExcelFile(excel_file_path)
        # Read parts data (prefer 'Parts' sheet else first sheet)
        sheet_name = 'Parts' if 'Parts' in xls.sheet_names else 0
        parts_df = pd.read_excel(
            excel_file_path,
            sheet_name=sheet_name,
            na_values=["#N/A", "N/A", "NA", "-", "—", "#REF!", "#NULL!"],
            keep_default_na=True
        )
        print(f"Found {len(parts_df)} parts to import")

        # Clean column names (normalize whitespace and punctuation)
        parts_df.columns = (
            parts_df.columns
                .str.strip()
                .str.lower()
                .str.replace(r"\s+", "_", regex=True)
                .str.replace(r"[\\./-]+", "_", regex=True)
        )

        # Map common column variations
        column_mapping = {
            'part_code': 'code',
            'part_number': 'code',
            'part_no': 'code',
            'parts_no': 'code',
            'p_no': 'code',
            'p_no_': 'code',
            'p_no__': 'code',
            'item_code': 'code',
            'material': 'code',
            'material_code': 'code',
            'code': 'code',
            # New headers from provided Excel
            'parts_code': 'code',
            'parts_desc': 'description',
            'mo_avg_price': 'map_price',
            'mo_avg_amount': 'gr_usd',
            # Existing variations
            'desc': 'description',
            'desc_': 'description',
            'description': 'description',
            'part_description': 'description',
            'item_desc': 'description',
            'name': 'description',
            'map': 'map_price',
            'map_price': 'map_price',
            'status': 'status',
            'n': 'net_price',
            'net': 'net_price',
            'net_price': 'net_price',
            'diff': 'diff',
            'diff_': 'diff',
            's_qty': 'stock_qty',
            's_qty_': 'stock_qty',
            'stock_quantity': 'stock_qty',
            'stock_qty': 'stock_qty',
            # Warehouse/engineering stock columns (capture if main stock_qty missing)
            'wh_stock_q': 'wh_stock_qty',
            'wh_stock_qty': 'wh_stock_qty',
            'eng_stock_q': 'eng_stock_qty',
            'eng_stock_qty': 'eng_stock_qty',
            'gr_qty': 'gr_qty',
            'gr_$': 'gr_usd',
            'gr_usd': 'gr_usd'
        }
        rename_dict = {c: column_mapping[c] for c in parts_df.columns if c in column_mapping}
        parts_df = parts_df.rename(columns=rename_dict)

        # Heuristic fallback if 'code' is still missing: pick a likely column
        if 'code' not in parts_df.columns:
            candidates = [
                c for c in parts_df.columns
                if (
                    'code' in c or c in ['p_no', 'p_no_', 'p_no__', 'material', 'material_code', 'item_code', 'part', 'parts']
                ) and 'desc' not in c and 'description' not in c
            ]
            if candidates:
                parts_df = parts_df.rename(columns={candidates[0]: 'code'})

        # If stock_qty not present, try to build it from warehouse/engineering stock columns
        if 'stock_qty' not in parts_df.columns:
            for aux_col in ['wh_stock_qty', 'eng_stock_qty']:
                if aux_col in parts_df.columns:
                    parts_df[aux_col] = pd.to_numeric(parts_df[aux_col], errors='coerce')
            qty_cols = [c for c in ['stock_qty', 'wh_stock_qty', 'eng_stock_qty'] if c in parts_df.columns]
            if qty_cols:
                parts_df['stock_qty'] = parts_df[qty_cols].sum(axis=1, min_count=1)

        keep_cols = ['code','description','map_price','status','net_price','diff','stock_qty','gr_qty','gr_usd']
        parts_df = parts_df[[c for c in keep_cols if c in parts_df.columns]]

        # Clean text / defaults
        if 'code' in parts_df.columns:
            parts_df['code'] = parts_df['code'].astype(str).str.strip()
            # Drop obvious empty codes
            parts_df = parts_df[parts_df['code'].str.len() > 0]
            parts_df = parts_df[parts_df['code'].str.lower() != 'nan']
        if 'description' in parts_df.columns:
            parts_df['description'] = parts_df['description'].astype(str).str.strip().str.replace(r';+$','', regex=True)
        if 'status' in parts_df.columns:
            parts_df['status'] = parts_df['status'].fillna('Active')

        # Coerce numerics
        for num_col in ['map_price','net_price','diff','stock_qty','gr_qty','gr_usd']:
            if num_col in parts_df.columns:
                parts_df[num_col] = pd.to_numeric(parts_df[num_col], errors='coerce')

        parts_df = parts_df.where(pd.notnull(parts_df), None)

        # Upsert via ORM (preserve table schema, incl. id)
        print("Importing parts data (upsert by code)...")
        session: Session = SessionLocal()
        try:
            imported = 0
            for _, row in parts_df.iterrows():
                code = row.get('code')
                if not code:
                    continue
                existing = session.query(Part).filter(Part.code == code).first()
                fields = {k: row.get(k) for k in keep_cols if k in parts_df.columns}
                if existing:
                    for k, v in fields.items():
                        if k != 'code' and v is not None:
                            if k == 'description':
                                # Do not overwrite an existing non-empty description
                                current_desc = getattr(existing, 'description', None)
                                if current_desc is None or str(current_desc).strip() == '':
                                    setattr(existing, 'description', v)
                                else:
                                    # Keep existing description
                                    pass
                            else:
                                setattr(existing, k, v)
                else:
                    session.add(Part(**fields))
                imported += 1
            session.commit()
            print(f"Imported/updated {imported} parts")
        finally:
            session.close()

        # Read formulas data if available
        try:
            if 'Formulas' in xls.sheet_names:
                formulas_df = pd.read_excel(excel_file_path, sheet_name='Formulas')
                formulas_df.columns = formulas_df.columns.str.strip().str.lower().str.replace(r"\s+", "_", regex=True).str.replace(r"[\\./-]+", "_", regex=True)
                formula_mapping = {
                    'class': 'class_name',
                    'class_name': 'class_name',
                    'labor_1': 'labor_lvl1',
                    'labor_lvl1': 'labor_lvl1',
                    'labor_2': 'labor_lvl2',
                    'labor_lvl2': 'labor_lvl2',
                    'labor_3': 'labor_lvl3',
                    'labor_lvl3': 'labor_lvl3',
                    'labor_lvl2_major': 'labor_lvl2_major',
                    'labor_lvl2_minor': 'labor_lvl2_minor',
                    'major': 'labor_lvl2_major',
                    'minor': 'labor_lvl2_minor',
                    'margin': 'margin',
                    'total_map': 'total_map',
                    'exchange': 'exchange_rate',
                    'exchange_rate': 'exchange_rate',
                    'final': 'final_price',
                    'final_price': 'final_price'
                }
                formulas_df = formulas_df.rename(columns={c: formula_mapping[c] for c in formulas_df.columns if c in formula_mapping})
                for c in ['labor_lvl1','labor_lvl2','labor_lvl3','labor_lvl2_major','labor_lvl2_minor','exchange_rate','final_price','margin','total_map']:
                    if c in formulas_df.columns:
                        formulas_df[c] = pd.to_numeric(formulas_df[c], errors='coerce')
                # Normalize margin: if <= 1, treat as fraction and convert to percent value
                if 'margin' in formulas_df.columns:
                    formulas_df['margin'] = formulas_df['margin'].apply(lambda x: (x * 100.0) if pd.notnull(x) and x <= 1 else x)
                formulas_df = formulas_df.where(pd.notnull(formulas_df), None)

                session = SessionLocal()
                try:
                    fimps = 0
                    for _, row in formulas_df.iterrows():
                        cls = row.get('class_name')
                        if not cls:
                            continue
                        existing = session.query(Formula).filter(Formula.class_name == cls).first()
                        payload_keys = ['class_name','labor_lvl1','labor_lvl2','labor_lvl3','labor_lvl2_major','labor_lvl2_minor','margin','total_map','exchange_rate','final_price']
                        payload = {k: row.get(k) for k in payload_keys if k in formulas_df.columns}
                        if existing:
                            for k, v in payload.items():
                                if k != 'class_name' and v is not None:
                                    setattr(existing, k, v)
                        else:
                            session.add(Formula(**payload))
                        fimps += 1
                    session.commit()
                    print(f"Imported/updated {fimps} formulas")
                finally:
                    session.close()
        except Exception as e:
            print(f"No formulas sheet found or error importing formulas: {e}")

        # Ensure default admin user exists
        print("Ensuring default admin user exists...")
        session = SessionLocal()
        try:
            existing_user = session.query(User).filter(User.username == "admin").first()
            if not existing_user:
                session.add(User(username="admin", password=hash_password("admin123"), is_active="Active"))
                session.commit()
                print("Created admin user (username: admin, password: admin123)")
            else:
                print("Admin user already exists")
        finally:
            session.close()

        print("✅ Excel import completed successfully!")
        print("📊 Database: service_tool.db")

    except FileNotFoundError:
        print(f"❌ Excel file not found: {excel_file_path}")
        print("No changes have been made to the database.")
        return
    except Exception as e:
        print(f"❌ Error importing Excel: {str(e)}")
        print("No changes have been made to the database due to the error.")
        return


def create_sample_data():
    """Create sample data using ORM (preserves schema). Note: no longer invoked automatically."""
    create_tables()
    session: Session = SessionLocal()
    try:
        # Clear existing rows (but keep schema)
        session.query(Part).delete()
        session.query(Formula).delete()
        session.commit()

        # Sample parts
        sample_parts = [
            {'code':'GH82-18808A','description':'Samsung Galaxy Display Assembly','map_price':150.0,'status':'Active','net_price':120.0,'diff':30.0,'stock_qty':25,'gr_qty':50,'gr_usd':6000.0},
            {'code':'GH82-18809B','description':'iPhone 12 Screen Replacement','map_price':200.0,'status':'Active','net_price':160.0,'diff':40.0,'stock_qty':15,'gr_qty':30,'gr_usd':4800.0},
            {'code':'GH82-18810C','description':'iPad Battery Replacement Kit','map_price':80.0,'status':'Dead','net_price':65.0,'diff':15.0,'stock_qty':0,'gr_qty':10,'gr_usd':650.0},
        ]
        for p in sample_parts:
            session.add(Part(**p))

        # Sample formulas
        sample_formulas = [
            {'class_name':'LOW End','labor_lvl1':10.0,'labor_lvl2':15.0,'labor_lvl2_major':20.0,'labor_lvl2_minor':12.0,'labor_lvl3':25.0,'margin':3.0,'total_map':10.0,'exchange_rate':1450.0,'final_price':50000.0},
            {'class_name':'Mid End','labor_lvl1':15.0,'labor_lvl2':25.0,'labor_lvl2_major':30.0,'labor_lvl2_minor':18.0,'labor_lvl3':40.0,'margin':2.0,'total_map':12.0,'exchange_rate':1450.0,'final_price':85000.0},
            {'class_name':'High End','labor_lvl1':25.0,'labor_lvl2':40.0,'labor_lvl2_major':50.0,'labor_lvl2_minor':30.0,'labor_lvl3':60.0,'margin':1.0,'total_map':15.0,'exchange_rate':1450.0,'final_price':150000.0},
            {'class_name':'Wearable','labor_lvl1':10.0,'labor_lvl2':20.0,'labor_lvl2_major':20.0,'labor_lvl2_minor':12.0,'labor_lvl3':25.0,'margin':1.0,'total_map':10.0,'exchange_rate':1450.0,'final_price':40000.0},
            {'class_name':'Tab','labor_lvl1':12.0,'labor_lvl2':22.0,'labor_lvl2_major':25.0,'labor_lvl2_minor':20.0,'labor_lvl3':30.0,'margin':2.0,'total_map':10.0,'exchange_rate':1450.0,'final_price':45000.0},
        ]
        for f in sample_formulas:
            session.add(Formula(**f))

        # Ensure admin user
        if not session.query(User).filter(User.username == "admin").first():
            session.add(User(username="admin", password=hash_password("admin123"), is_active="Active"))

        session.commit()
        print("✅ Sample data created successfully!")
    finally:
        session.close()


if __name__ == "__main__":
    import sys

    print("🔄 Service Tool Database Import")
    print("=" * 40)

    # Prefer explicit file path argument; do not import or create samples implicitly
    excel_file = None
    if len(sys.argv) > 1:
        excel_file = sys.argv[1]
    else:
        # Check common folders without modifying DB if not found
        cwd_candidates = [f for f in os.listdir('.') if f.endswith(('.xlsx', '.xls'))]
        if cwd_candidates:
            excel_file = cwd_candidates[0]
        elif os.path.isdir('exel'):
            exel_files = [os.path.join('exel', f) for f in os.listdir('exel') if f.endswith(('.xlsx', '.xls'))]
            excel_file = exel_files[0] if exel_files else None

    if excel_file:
        print(f"Using Excel file: {excel_file}")
        import_excel_to_database(excel_file)
    else:
        print("No Excel file specified or found. Skipping import. To import, run: python import_excel.py <path-to-file.xlsx>")
        sys.exit(0)
