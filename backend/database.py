from sqlalchemy import create_engine, Column, Integer, String, Text, DECIMAL, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timezone
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./service_tool.db")

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Part(Base):
    __tablename__ = "parts"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    code = Column(String(100), index=True, nullable=False)
    description = Column(Text)
    map_price = Column(DECIMAL(10, 2))
    status = Column(String(20), default="Active")
    net_price = Column(DECIMAL(10, 2))
    diff = Column(DECIMAL(10, 2))
    stock_qty = Column(Integer, default=0)
    gr_qty = Column(Integer, default=0)
    gr_usd = Column(DECIMAL(10, 2))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class Formula(Base):
    __tablename__ = "formulas"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    class_name = Column(String(50), nullable=False)  # LOW End, Mid End, etc.
    labor_lvl2 = Column(DECIMAL(10, 2))
    labor_lvl3 = Column(DECIMAL(10, 2))
    # New extended labor levels and pricing overrides
    labor_lvl1 = Column(DECIMAL(10, 2))
    labor_lvl2_major = Column(DECIMAL(10, 2))
    labor_lvl2_minor = Column(DECIMAL(10, 2))
    margin = Column(DECIMAL(10, 2))
    total_map = Column(DECIMAL(10, 2))
    exchange_rate = Column(DECIMAL(10, 4), default=1450.0)
    final_price = Column(DECIMAL(10, 2))
    # Dealer-specific overrides
    dealer_labor_lvl1 = Column(DECIMAL(10, 2))
    dealer_labor_lvl2_major = Column(DECIMAL(10, 2))
    dealer_labor_lvl2_minor = Column(DECIMAL(10, 2))
    dealer_labor_lvl3 = Column(DECIMAL(10, 2))
    dealer_margin = Column(DECIMAL(10, 2))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password = Column(String(100), nullable=False)  # Hashed password
    is_active = Column(String(10), default="Active")
    # New: role and permissions (CSV string). role in { 'admin', 'user' }
    role = Column(String(20), default="user")
    permissions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

# New table to manage Samsung models and their categories
class SamsungModel(Base):
    __tablename__ = "samsung_models"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    brand = Column(String(50), default="Samsung", nullable=False)
    model_name = Column(String(100), unique=True, index=True, nullable=False)
    # Allowed values (free-form string for simplicity): highend, lowend, tab, wearable
    category = Column(String(20), nullable=True)
    model_code = Column(String(100), nullable=True, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


def create_tables():
    Base.metadata.create_all(bind=engine)


def ensure_schema():
    """Ensure critical tables have required columns (repair if legacy tables exist)."""
    with engine.begin() as conn:
        # Helper to fetch columns
        def cols(table):
            try:
                res = conn.exec_driver_sql(f"PRAGMA table_info({table})").all()
                return {row[1] for row in res}  # row[1] is 'name'
            except Exception:
                return set()
        
        # Repair parts table if missing id
        pcols = cols('parts')
        if pcols and 'id' not in pcols:
            conn.exec_driver_sql("""
                CREATE TABLE IF NOT EXISTS parts_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    code VARCHAR(100) NOT NULL,
                    description TEXT,
                    map_price NUMERIC,
                    status VARCHAR(20) DEFAULT 'Active',
                    net_price NUMERIC,
                    diff NUMERIC,
                    stock_qty INTEGER DEFAULT 0,
                    gr_qty INTEGER DEFAULT 0,
                    gr_usd NUMERIC,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            # Insert keeping whatever columns exist
            insert_cols = [c for c in ['code','description','map_price','status','net_price','diff','stock_qty','gr_qty','gr_usd'] if c in pcols]
            if insert_cols:
                conn.exec_driver_sql(
                    f"INSERT INTO parts_new ({', '.join(insert_cols)}) SELECT {', '.join(insert_cols)} FROM parts"
                )
            conn.exec_driver_sql("DROP TABLE parts")
            conn.exec_driver_sql("ALTER TABLE parts_new RENAME TO parts")
        
        # Repair formulas table if missing id
        fcols = cols('formulas')
        if fcols and 'id' not in fcols:
            conn.exec_driver_sql("""
                CREATE TABLE IF NOT EXISTS formulas_new (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    class_name VARCHAR(50) NOT NULL,
                    labor_lvl2 NUMERIC,
                    labor_lvl3 NUMERIC,
                    labor_lvl1 NUMERIC,
                    labor_lvl2_major NUMERIC,
                    labor_lvl2_minor NUMERIC,
                    margin NUMERIC,
                    total_map NUMERIC,
                    exchange_rate NUMERIC,
                    final_price NUMERIC,
                    dealer_labor_lvl1 NUMERIC,
                    dealer_labor_lvl2_major NUMERIC,
                    dealer_labor_lvl2_minor NUMERIC,
                    dealer_labor_lvl3 NUMERIC,
                    dealer_margin NUMERIC,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                )
            """)
            insert_cols = [c for c in ['class_name','labor_lvl2','labor_lvl3','labor_lvl1','labor_lvl2_major','labor_lvl2_minor','margin','total_map','exchange_rate','final_price','dealer_labor_lvl1','dealer_labor_lvl2_major','dealer_labor_lvl2_minor','dealer_labor_lvl3','dealer_margin'] if c in fcols]
            if insert_cols:
                conn.exec_driver_sql(
                    f"INSERT INTO formulas_new ({', '.join(insert_cols)}) SELECT {', '.join(insert_cols)} FROM formulas"
                )
            conn.exec_driver_sql("DROP TABLE formulas")
            conn.exec_driver_sql("ALTER TABLE formulas_new RENAME TO formulas")
        else:
            # Ensure new columns exist on existing formulas table
            needed_cols = {
                'labor_lvl1': "NUMERIC",
                'labor_lvl2_major': "NUMERIC",
                'labor_lvl2_minor': "NUMERIC",
                'margin': "NUMERIC",
                'total_map': "NUMERIC",
                # Dealer-specific
                'dealer_labor_lvl1': "NUMERIC",
                'dealer_labor_lvl2_major': "NUMERIC",
                'dealer_labor_lvl2_minor': "NUMERIC",
                'dealer_labor_lvl3': "NUMERIC",
                'dealer_margin': "NUMERIC",
            }
            # Re-fetch after potential table creation
            fcols = cols('formulas')
            for col_name, col_type in needed_cols.items():
                if col_name not in fcols:
                    try:
                        conn.exec_driver_sql(f"ALTER TABLE formulas ADD COLUMN {col_name} {col_type}")
                    except Exception as e:
                        print(f"Warning: could not add column {col_name} to formulas: {e}")

        # Ensure samsung_models table exists (create if missing)
        sm_cols = cols('samsung_models')
        if not sm_cols:
            try:
                conn.exec_driver_sql("""
                    CREATE TABLE IF NOT EXISTS samsung_models (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        brand VARCHAR(50) DEFAULT 'Samsung' NOT NULL,
                        model_name VARCHAR(100) UNIQUE NOT NULL,
                        category VARCHAR(20),
                        model_code VARCHAR(100),
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                """)
            except Exception as e:
                print(f"Warning: could not create samsung_models table: {e}")
        else:
            # Add missing columns if needed
            if 'model_code' not in sm_cols:
                try:
                    conn.exec_driver_sql("ALTER TABLE samsung_models ADD COLUMN model_code VARCHAR(100)")
                except Exception as e:
                    print(f"Warning: could not add model_code to samsung_models: {e}")

        # Ensure users table has role and permissions columns
        ucols = cols('users')
        if ucols:
            if 'role' not in ucols:
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN role VARCHAR(20) DEFAULT 'user'")
                except Exception as e:
                    print(f"Warning: could not add role to users: {e}")
            if 'permissions' not in ucols:
                try:
                    conn.exec_driver_sql("ALTER TABLE users ADD COLUMN permissions TEXT")
                except Exception as e:
                    print(f"Warning: could not add permissions to users: {e}")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
