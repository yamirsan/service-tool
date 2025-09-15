from typing import List, Tuple
from datetime import datetime, timezone
from database import SessionLocal, SamsungModel as SamsungModelORM, ensure_schema, create_tables

# Curated list of Samsung PHONE models (2014 and newer)
# Categories: highend (S, Note, Z), midend (A3–A9), lowend (A0–A2, M, F, Xcover)
CURATED_MODELS: List[Tuple[str, str]] = [
    # 2014
    ("Galaxy S5", "highend"), ("Galaxy Note4", "highend"), ("Galaxy Note Edge", "highend"),
    ("Galaxy A3", "midend"), ("Galaxy A5", "midend"), ("Galaxy A7", "midend"),
    # 2015
    ("Galaxy S6", "highend"), ("Galaxy S6 edge", "highend"), ("Galaxy S6 edge+", "highend"),
    ("Galaxy Note5", "highend"), ("Galaxy A8", "midend"), ("Galaxy Xcover 3", "lowend"),
    # 2016
    ("Galaxy S7", "highend"), ("Galaxy S7 edge", "highend"), ("Galaxy Note7", "highend"),
    ("Galaxy A3 (2016)", "midend"), ("Galaxy A5 (2016)", "midend"), ("Galaxy A7 (2016)", "midend"),
    # 2017
    ("Galaxy S8", "highend"), ("Galaxy S8+", "highend"), ("Galaxy Note8", "highend"),
    ("Galaxy A3 (2017)", "midend"), ("Galaxy A5 (2017)", "midend"), ("Galaxy A7 (2017)", "midend"), ("Galaxy Xcover 4", "lowend"),
    # 2018
    ("Galaxy S9", "highend"), ("Galaxy S9+", "highend"), ("Galaxy Note9", "highend"),
    ("Galaxy A6", "midend"), ("Galaxy A6+", "midend"), ("Galaxy A7 (2018)", "midend"),
    ("Galaxy A8 (2018)", "midend"), ("Galaxy A8+ (2018)", "midend"), ("Galaxy A9 (2018)", "midend"),
    # 2019
    ("Galaxy S10e", "highend"), ("Galaxy S10", "highend"), ("Galaxy S10+", "highend"), ("Galaxy S10 5G", "highend"),
    ("Galaxy Note10", "highend"), ("Galaxy Note10+", "highend"),
    ("Galaxy Fold", "highend"),
    ("Galaxy A10", "lowend"), ("Galaxy A20", "lowend"), ("Galaxy A30", "midend"), ("Galaxy A40", "midend"),
    ("Galaxy A50", "midend"), ("Galaxy A60", "midend"), ("Galaxy A70", "midend"), ("Galaxy A80", "midend"), ("Galaxy A90 5G", "midend"),
    ("Galaxy M10", "lowend"), ("Galaxy M20", "lowend"), ("Galaxy M30", "lowend"), ("Galaxy M40", "lowend"),
    # 2020
    ("Galaxy S20", "highend"), ("Galaxy S20+", "highend"), ("Galaxy S20 Ultra", "highend"), ("Galaxy S20 FE", "highend"),
    ("Galaxy Note20", "highend"), ("Galaxy Note20 Ultra", "highend"),
    ("Galaxy Z Flip", "highend"), ("Galaxy Z Fold2", "highend"),
    ("Galaxy A01", "lowend"), ("Galaxy A11", "lowend"), ("Galaxy A21", "lowend"), ("Galaxy A21s", "lowend"),
    ("Galaxy A31", "midend"), ("Galaxy A41", "midend"), ("Galaxy A51", "midend"), ("Galaxy A71", "midend"),
    ("Galaxy M01", "lowend"), ("Galaxy M11", "lowend"), ("Galaxy M21", "lowend"), ("Galaxy M31", "lowend"), ("Galaxy M51", "lowend"),
    ("Galaxy F41", "lowend"), ("Galaxy Xcover Pro", "lowend"),
    # 2021
    ("Galaxy S21", "highend"), ("Galaxy S21+", "highend"), ("Galaxy S21 Ultra", "highend"),
    ("Galaxy Z Flip3", "highend"), ("Galaxy Z Fold3", "highend"),
    ("Galaxy A12", "lowend"), ("Galaxy A22", "lowend"), ("Galaxy A32", "midend"), ("Galaxy A42 5G", "midend"),
    ("Galaxy A52", "midend"), ("Galaxy A52s 5G", "midend"), ("Galaxy A72", "midend"),
    ("Galaxy M12", "lowend"), ("Galaxy M22", "lowend"), ("Galaxy M32", "lowend"), ("Galaxy M52 5G", "lowend"),
    ("Galaxy F12", "lowend"), ("Galaxy F22", "lowend"), ("Galaxy F42 5G", "lowend"), ("Galaxy F62", "lowend"),
    ("Galaxy Xcover 5", "lowend"),
    # 2022
    ("Galaxy S22", "highend"), ("Galaxy S22+", "highend"), ("Galaxy S22 Ultra", "highend"), ("Galaxy S21 FE", "highend"),
    ("Galaxy Z Flip4", "highend"), ("Galaxy Z Fold4", "highend"),
    ("Galaxy A13", "lowend"), ("Galaxy A23", "lowend"), ("Galaxy A33 5G", "midend"), ("Galaxy A53 5G", "midend"), ("Galaxy A73 5G", "midend"),
    ("Galaxy M13", "lowend"), ("Galaxy M23 5G", "lowend"), ("Galaxy M33 5G", "lowend"), ("Galaxy M53 5G", "lowend"),
    ("Galaxy F13", "lowend"), ("Galaxy F23 5G", "lowend"), ("Galaxy Xcover6 Pro", "lowend"),
    # 2023
    ("Galaxy S23", "highend"), ("Galaxy S23+", "highend"), ("Galaxy S23 Ultra", "highend"), ("Galaxy S23 FE", "highend"),
    ("Galaxy Z Flip5", "highend"), ("Galaxy Z Fold5", "highend"),
    ("Galaxy A14", "lowend"), ("Galaxy A24", "lowend"), ("Galaxy A34 5G", "midend"), ("Galaxy A54 5G", "midend"),
    ("Galaxy M14", "lowend"), ("Galaxy M34 5G", "lowend"), ("Galaxy M54 5G", "lowend"),
    ("Galaxy F14 5G", "lowend"), ("Galaxy F34 5G", "lowend"), ("Galaxy F54 5G", "lowend"),
    # 2024
    ("Galaxy S24", "highend"), ("Galaxy S24+", "highend"), ("Galaxy S24 Ultra", "highend"),
    ("Galaxy Z Flip6", "highend"), ("Galaxy Z Fold6", "highend"),
    ("Galaxy A15 5G", "lowend"), ("Galaxy A25 5G", "lowend"), ("Galaxy A35 5G", "midend"), ("Galaxy A55 5G", "midend"),
    ("Galaxy M15 5G", "lowend"), ("Galaxy M35 5G", "lowend"), ("Galaxy M55 5G", "lowend"),
    ("Galaxy F15 5G", "lowend"), ("Galaxy F55 5G", "lowend"), ("Galaxy Xcover7", "lowend"),
    # 2025
    ("Galaxy S25", "highend"), ("Galaxy S25+", "highend"), ("Galaxy S25 Ultra", "highend"),
    ("Galaxy Z Flip7", "highend"), ("Galaxy Z Fold7", "highend"),
    ("Galaxy A16 5G", "lowend"), ("Galaxy A26 5G", "lowend"), ("Galaxy A36 5G", "midend"), ("Galaxy A56 5G", "midend"),
    ("Galaxy A16", "lowend"),
    ("Galaxy M16 5G", "lowend"), ("Galaxy M36 5G", "lowend"), ("Galaxy M56 5G", "lowend"),
    ("Galaxy F16 5G", "lowend"), ("Galaxy F56 5G", "lowend"),
]

# Curated list of Samsung TABLETS (2014 and newer)
CURATED_TABS: List[Tuple[str, str]] = [
    # 2014
    ("Galaxy Tab S 10.5", "tab"), ("Galaxy Tab S 8.4", "tab"), ("Galaxy Tab Active", "tab"),
    # 2015
    ("Galaxy Tab A 8.0 (2015)", "tab"), ("Galaxy Tab A 9.7 (2015)", "tab"), ("Galaxy Tab S2 8.0 (2015)", "tab"), ("Galaxy Tab S2 9.7 (2015)", "tab"),
    # 2016
    ("Galaxy Tab A 10.1 (2016)", "tab"), ("Galaxy Tab A 8.0 (2016)", "tab"),
    # 2017
    ("Galaxy Tab S3", "tab"), ("Galaxy Tab A 8.0 (2017)", "tab"), ("Galaxy Tab Active2", "tab"),
    # 2018
    ("Galaxy Tab S4", "tab"), ("Galaxy Tab A 10.5 (2018)", "tab"), ("Galaxy Tab A 8.0 (2018)", "tab"),
    # 2019
    ("Galaxy Tab S5e", "tab"), ("Galaxy Tab S6", "tab"), ("Galaxy Tab A 8.0 (2019)", "tab"), ("Galaxy Tab A 10.1 (2019)", "tab"), ("Galaxy Tab Active Pro", "tab"),
    # 2020
    ("Galaxy Tab S6 Lite (2020)", "tab"), ("Galaxy Tab S7", "tab"), ("Galaxy Tab S7+", "tab"), ("Galaxy Tab A7 10.4 (2020)", "tab"), ("Galaxy Tab Active3", "tab"),
    # 2021
    ("Galaxy Tab S7 FE", "tab"), ("Galaxy Tab A7 Lite", "tab"),
    # 2022
    ("Galaxy Tab S8", "tab"), ("Galaxy Tab S8+", "tab"), ("Galaxy Tab S8 Ultra", "tab"), ("Galaxy Tab A8 (10.5)", "tab"), ("Galaxy Tab Active4 Pro", "tab"),
    # 2023
    ("Galaxy Tab S9", "tab"), ("Galaxy Tab S9+", "tab"), ("Galaxy Tab S9 Ultra", "tab"), ("Galaxy Tab S9 FE", "tab"), ("Galaxy Tab S9 FE+", "tab"), ("Galaxy Tab A9", "tab"), ("Galaxy Tab A9+", "tab"),
    # 2024
    ("Galaxy Tab S6 Lite (2024)", "tab"), ("Galaxy Tab Active5", "tab"),
]

# Curated list of Samsung WEARABLES (2014 and newer)
CURATED_WEARABLES: List[Tuple[str, str]] = [
    # Watches 2014-2018
    ("Gear S", "wearable"), ("Gear S2", "wearable"), ("Gear S3", "wearable"), ("Gear Sport", "wearable"), ("Galaxy Watch (2018)", "wearable"),
    # Watches 2019+
    ("Galaxy Watch Active", "wearable"), ("Galaxy Watch Active2", "wearable"),
    ("Galaxy Watch3", "wearable"),
    ("Galaxy Watch4", "wearable"), ("Galaxy Watch4 Classic", "wearable"),
    ("Galaxy Watch5", "wearable"), ("Galaxy Watch5 Pro", "wearable"),
    ("Galaxy Watch6", "wearable"), ("Galaxy Watch6 Classic", "wearable"),
    ("Galaxy Watch7", "wearable"), ("Galaxy Watch Ultra", "wearable"),
    # Buds 2019+
    ("Galaxy Buds", "wearable"), ("Galaxy Buds+", "wearable"), ("Galaxy Buds Live", "wearable"),
    ("Galaxy Buds Pro", "wearable"), ("Galaxy Buds2", "wearable"), ("Galaxy Buds2 Pro", "wearable"),
    ("Galaxy Buds FE", "wearable"), ("Galaxy Buds3", "wearable"), ("Galaxy Buds3 Pro", "wearable"),
]

# Optional add-on: map of model_name -> model_code
MODEL_CODES = {
    # Legacy High-end S / Note (2014-2018)
    "Galaxy S5": "SM-G900F",
    "Galaxy Note4": "SM-N910F",
    "Galaxy Note Edge": "SM-N915F",
    "Galaxy S6": "SM-G920F",
    "Galaxy S6 edge": "SM-G925F",
    "Galaxy S6 edge+": "SM-G928F",
    "Galaxy Note5": "SM-N920C",
    "Galaxy S7": "SM-G930F",
    "Galaxy S7 edge": "SM-G935F",
    "Galaxy Note7": "SM-N930F",
    "Galaxy S8": "SM-G950F",
    "Galaxy S8+": "SM-G955F",
    "Galaxy Note8": "SM-N950F",
    "Galaxy S9": "SM-G960F",
    "Galaxy S9+": "SM-G965F",
    "Galaxy Note9": "SM-N960F",

    # Legacy A-series / Xcover (2014-2018)
    "Galaxy A3": "SM-A300F",
    "Galaxy A5": "SM-A500F",
    "Galaxy A7": "SM-A700F",
    "Galaxy A8": "SM-A800F",
    "Galaxy Xcover 3": "SM-G388F",
    "Galaxy A3 (2016)": "SM-A310F",
    "Galaxy A5 (2016)": "SM-A510F",
    "Galaxy A7 (2016)": "SM-A710F",
    "Galaxy A3 (2017)": "SM-A320F",
    "Galaxy A5 (2017)": "SM-A520F",
    "Galaxy A7 (2017)": "SM-A720F",
    "Galaxy Xcover 4": "SM-G390F",
    "Galaxy A6": "SM-A600F/DS",
    "Galaxy A6+": "SM-A605F/DS",
    "Galaxy A7 (2018)": "SM-A750F/DS",
    "Galaxy A8 (2018)": "SM-A530F",
    "Galaxy A8+ (2018)": "SM-A730F",
    "Galaxy A9 (2018)": "SM-A920F",

    # High-end S / Note / Z (2019+)
    "Galaxy S10e": "SM-G970F/DS",
    "Galaxy S10": "SM-G973F/DS",
    "Galaxy S10+": "SM-G975F/DS",
    "Galaxy S10 5G": "SM-G977B",
    "Galaxy Note10": "SM-N970F/DS",
    "Galaxy Note10+": "SM-N975F/DS",
    "Galaxy Fold": "SM-F900F",
    "Galaxy S20": "SM-G981B/DS",
    "Galaxy S20+": "SM-G986B/DS",
    "Galaxy S20 Ultra": "SM-G988B/DS",
    "Galaxy S20 FE": "SM-G780F/DS",
    "Galaxy Note20": "SM-N981B/DS",
    "Galaxy Note20 Ultra": "SM-N986B/DS",
    "Galaxy Z Flip": "SM-F700F",
    "Galaxy Z Fold2": "SM-F916B",
    "Galaxy S21": "SM-G991B/DS",
    "Galaxy S21+": "SM-G996B/DS",
    "Galaxy S21 Ultra": "SM-G998B/DS",
    "Galaxy Z Flip3": "SM-F711B",
    "Galaxy Z Fold3": "SM-F926B",
    "Galaxy S21 FE": "SM-G990B/DS",
    "Galaxy S22": "SM-S901B/DS",
    "Galaxy S22+": "SM-S906B/DS",
    "Galaxy S22 Ultra": "SM-S908B/DS",
    "Galaxy Z Flip4": "SM-F721B",
    "Galaxy Z Fold4": "SM-F936B",
    "Galaxy S23": "SM-S911B/DS",
    "Galaxy S23+": "SM-S916B/DS",
    "Galaxy S23 Ultra": "SM-S918B/DS",
    "Galaxy Z Flip5": "SM-F731B",
    "Galaxy Z Fold5": "SM-F946B",
    "Galaxy S23 FE": "SM-S711B/DS",
    "Galaxy S24": "SM-S921B/DS",
    "Galaxy S24+": "SM-S926B/DS",
    "Galaxy S24 Ultra": "SM-S928B/DS",
    "Galaxy Z Flip6": "SM-F741B",
    "Galaxy Z Fold6": "SM-F956B",
    # 2025 S-series
    "Galaxy S25": "SM-S931B/DS",
    "Galaxy S25+": "SM-S936B/DS",
    "Galaxy S25 Ultra": "SM-S938B/DS",
    # 2025 Z-series
    "Galaxy Z Flip7": "SM-F766B",
    "Galaxy Z Fold7": "SM-F966B",

    # 2025 A/M/F series (codes provided)
    "Galaxy A16 5G": "SM-A166E/DS",
    "Galaxy A26 5G": "SM-A266E/DS",
    "Galaxy A36 5G": "SM-A366E/DS",
    "Galaxy A56 5G": "SM-A566E/DS",
    "Galaxy A16": "SM-A165F/DS",
    "Galaxy M16 5G": "SM-M166E/DS",
    "Galaxy M36 5G": "SM-M366E/DS",
    "Galaxy M56 5G": "SM-M566E/DS",
    "Galaxy F16 5G": "SM-E166E/DS",
    "Galaxy F56 5G": "SM-E566E/DS",

    # A-series (2019-2024)
    "Galaxy A10": "SM-A105F/DS",
    "Galaxy A20": "SM-A205F/DS",
    "Galaxy A30": "SM-A305F/DS",
    "Galaxy A40": "SM-A405F/DS",
    "Galaxy A50": "SM-A505F/DS",
    "Galaxy A60": "SM-A606",
    "Galaxy A70": "SM-A705F/DS",
    "Galaxy A80": "SM-A805F/DS",
    "Galaxy A90 5G": "SM-A908B",
    "Galaxy A01": "SM-A015F/DS",
    "Galaxy A11": "SM-A115F/DS",
    "Galaxy A21": "SM-A215F/DS",
    "Galaxy A21s": "SM-A217F/DS",
    "Galaxy A31": "SM-A315F/DS",
    "Galaxy A41": "SM-A415F/DS",
    "Galaxy A51": "SM-A515F/DS",
    "Galaxy A71": "SM-A715F/DS",
    "Galaxy A12": "SM-A125F/DS",
    "Galaxy A22": "SM-A225F/DS",
    "Galaxy A32": "SM-A325F/DS",
    "Galaxy A42 5G": "SM-A426B",
    "Galaxy A52": "SM-A525F/DS",
    "Galaxy A52s 5G": "SM-A528B",
    "Galaxy A72": "SM-A725F/DS",
    "Galaxy A13": "SM-A135F/DS",
    "Galaxy A23": "SM-A235F/DS",
    "Galaxy A33 5G": "SM-A336B",
    "Galaxy A53 5G": "SM-A536B",
    "Galaxy A73 5G": "SM-A736B",
    "Galaxy A14": "SM-A146B",
    "Galaxy A24": "SM-A245F/DS",
    "Galaxy A34 5G": "SM-A346B",
    "Galaxy A54 5G": "SM-A546B",
    "Galaxy A15 5G": "SM-A156B",
    "Galaxy A25 5G": "SM-A256B",
    "Galaxy A35 5G": "SM-A356E/DS",
    "Galaxy A55 5G": "SM-A556B/DS",

    # M-series (2019-2024)
    "Galaxy M10": "SM-M105F/DS",
    "Galaxy M20": "SM-M205F/DS",
    "Galaxy M30": "SM-M305F/DS",
    "Galaxy M40": "SM-M405F/DS",
    "Galaxy M01": "SM-M015F/DS",
    "Galaxy M11": "SM-M115F/DS",
    "Galaxy M21": "SM-M215F/DS",
    "Galaxy M31": "SM-M315F/DS",
    "Galaxy M51": "SM-M515F/DS",
    "Galaxy M12": "SM-M127F/DS",
    "Galaxy M22": "SM-M225F/DS",
    "Galaxy M32": "SM-M325F/DS",
    "Galaxy M52 5G": "SM-M526B/DS",
    "Galaxy M13": "SM-M135F/DS",
    "Galaxy M23 5G": "SM-M236B/DS",
    "Galaxy M33 5G": "SM-M336B/DS",
    "Galaxy M53 5G": "SM-M536B/DS",
    "Galaxy M14": "SM-M146B/DS",
    "Galaxy M34 5G": "SM-M346B/DS",
    "Galaxy M54 5G": "SM-M546B/DS",
    "Galaxy M15 5G": "SM-M156B/DS",
    "Galaxy M35 5G": "SM-M356B/DS",
    "Galaxy M55 5G": "SM-M556B/DS",

    # F-series (Flipkart/In): use SM-E*/SM-F* where applicable
    "Galaxy F41": "SM-F415F/DS",
    "Galaxy F12": "SM-F127G/DS",
    "Galaxy F22": "SM-E225F/DS",
    "Galaxy F42 5G": "SM-E426B/DS",
    "Galaxy F62": "SM-E625F/DS",
    "Galaxy F13": "SM-E135F/DS",
    "Galaxy F23 5G": "SM-E236B/DS",
    "Galaxy F14 5G": "SM-E146B/DS",
    "Galaxy F34 5G": "SM-E346B/DS",
    "Galaxy F54 5G": "SM-E546B/DS",
    "Galaxy F15 5G": "SM-E156B/DS",
    "Galaxy F55 5G": "SM-E556B/DS",

    # Xcover (rugged)
    "Galaxy Xcover Pro": "SM-G715F/DS",
    "Galaxy Xcover 5": "SM-G525F/DS",
    "Galaxy Xcover6 Pro": "SM-G736B",
    "Galaxy Xcover7": "SM-G556B",

    # Tablets (SM-T*, SM-X*, SM-P*) 2014+
    "Galaxy Tab S 10.5": "SM-T800",
    "Galaxy Tab S 8.4": "SM-T700",
    "Galaxy Tab Active": "SM-T365",
    "Galaxy Tab A 8.0 (2015)": "SM-T350",
    "Galaxy Tab A 9.7 (2015)": "SM-T550",
    "Galaxy Tab S2 8.0 (2015)": "SM-T710",
    "Galaxy Tab S2 9.7 (2015)": "SM-T810",
    "Galaxy Tab A 10.1 (2016)": "SM-T580",
    "Galaxy Tab A 8.0 (2016)": "SM-T280",
    "Galaxy Tab S3": "SM-T820",
    "Galaxy Tab A 8.0 (2017)": "SM-T380",
    "Galaxy Tab Active2": "SM-T395",
    "Galaxy Tab S4": "SM-T830",
    "Galaxy Tab A 10.5 (2018)": "SM-T590",
    "Galaxy Tab A 8.0 (2018)": "SM-T387",
    "Galaxy Tab S5e": "SM-T720",
    "Galaxy Tab S6": "SM-T860",
    "Galaxy Tab A 8.0 (2019)": "SM-T290",
    "Galaxy Tab A 10.1 (2019)": "SM-T510",
    "Galaxy Tab Active Pro": "SM-T540",
    "Galaxy Tab S6 Lite (2020)": "SM-P610",
    "Galaxy Tab S7": "SM-T870",
    "Galaxy Tab S7+": "SM-T970",
    "Galaxy Tab A7 10.4 (2020)": "SM-T500",
    "Galaxy Tab Active3": "SM-T570",
    "Galaxy Tab S7 FE": "SM-T735",
    "Galaxy Tab A7 Lite": "SM-T220",
    "Galaxy Tab S8": "SM-X700",
    "Galaxy Tab S8+": "SM-X800",
    "Galaxy Tab S8 Ultra": "SM-X900",
    "Galaxy Tab A8 (10.5)": "SM-X200",
    "Galaxy Tab Active4 Pro": "SM-T636",
    "Galaxy Tab S9": "SM-X710",
    "Galaxy Tab S9+": "SM-X810",
    "Galaxy Tab S9 Ultra": "SM-X910",
    "Galaxy Tab S9 FE": "SM-X510",
    "Galaxy Tab S9 FE+": "SM-X610",
    "Galaxy Tab A9": "SM-X110",
    "Galaxy Tab A9+": "SM-X210",
    "Galaxy Tab S6 Lite (2024)": "SM-P620",
    "Galaxy Tab Active5": "SM-X300",

    # Wearables - Watches 2014+
    "Gear S": "SM-R750",
    "Gear S2": "SM-R720",
    "Gear S3": "SM-R760",
    "Gear Sport": "SM-R600",
    "Galaxy Watch (2018)": "SM-R800",
    # Wearables - Watches 2019+
    "Galaxy Watch Active": "SM-R500",
    "Galaxy Watch Active2": "SM-R820",
    "Galaxy Watch3": "SM-R840",
    "Galaxy Watch4": "SM-R870",
    "Galaxy Watch4 Classic": "SM-R890",
    "Galaxy Watch5": "SM-R910",
    "Galaxy Watch5 Pro": "SM-R920",
    "Galaxy Watch6": "SM-R940",
    "Galaxy Watch6 Classic": "SM-R950",
    "Galaxy Watch7": "SM-L305/SM-L315",
    "Galaxy Watch Ultra": "SM-L705",

    # Wearables - Buds
    "Galaxy Buds": "SM-R170",
    "Galaxy Buds+": "SM-R175",
    "Galaxy Buds Live": "SM-R180",
    "Galaxy Buds Pro": "SM-R190",
    "Galaxy Buds2": "SM-R177",
    "Galaxy Buds2 Pro": "SM-R510",
    "Galaxy Buds FE": "SM-R400",
    "Galaxy Buds3": "SM-R530",
    "Galaxy Buds3 Pro": "SM-R630",
}


def seed_models():
    create_tables()
    ensure_schema()
    db = SessionLocal()
    added = 0
    updated = 0
    try:
        # Merge all curated items
        all_items: List[Tuple[str, str]] = []
        all_items.extend(CURATED_MODELS)
        all_items.extend(CURATED_TABS)
        all_items.extend(CURATED_WEARABLES)

        for model_name, category in all_items:
            existing = db.query(SamsungModelORM).filter(SamsungModelORM.model_name == model_name).first()
            now = datetime.now(timezone.utc)
            code = MODEL_CODES.get(model_name)
            if existing:
                # Update category and/or model_code
                changed = False
                if category and existing.category != category:
                    existing.category = category
                    changed = True
                if code and getattr(existing, 'model_code', None) != code:
                    existing.model_code = code
                    changed = True
                if changed:
                    existing.updated_at = now
                    updated += 1
            else:
                obj = SamsungModelORM(brand="Samsung", model_name=model_name, category=category, created_at=now, updated_at=now)
                if code:
                    obj.model_code = code
                db.add(obj)
                added += 1
        db.commit()
        print(f"Samsung models seeding completed. Added: {added}, Updated: {updated}")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_models()
