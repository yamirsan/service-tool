from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from contextlib import asynccontextmanager
import re
import io
import pandas as pd
import os

from database import get_db, create_tables, Part as PartModel, Formula as FormulaModel, User as UserModel, ensure_schema, SamsungModel as SamsungModelORM, engine
from models import (
    Part, PartCreate, PartUpdate, PartSearch,
    Formula, FormulaCreate, FormulaUpdate,
    User, UserCreate, Token,
    PriceCalculation, PriceResult, ExcelUploadResponse,
    SamsungModel, SamsungModelCreate, SamsungModelUpdate,
    UserUpdate
)
from auth import authenticate_user, create_access_token, get_current_user, get_password_hash
from auth import get_current_admin_user
from sqlalchemy import or_

# Helper: infer Samsung category directly from arbitrary text/code based on user's rules
# Returns one of: 'highend', 'midend', 'lowend', 'wearable', 'tab', or None
_DEF_SERIES_RE = re.compile(r"\b(?:GALAXY\s*)?(S\d{1,2}|NOTE\s*\d{1,2}|Z\s*(?:FOLD|FLIP)\b)", re.IGNORECASE)


# --- Permissions helpers ---

def _parse_permissions(csv: Optional[str]) -> set:
    if not csv:
        return set()
    return {p.strip() for p in str(csv).split(',') if p and str(p).strip()}


def require_permission(current_user: UserModel, perm: str):
    role = getattr(current_user, 'role', None)
    if str(role or '').lower() == 'admin':
        return
    perms = _parse_permissions(getattr(current_user, 'permissions', None))
    if perm not in perms:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not enough permissions")


def _norm(s: Optional[str]) -> str:
    return (s or "").upper().replace("-", "").replace(".", "").replace("/", "").replace(" ", "")


# --- Samsung categorization helpers (fix missing definitions) ---

def categorize_samsung_text(text: Optional[str]) -> Optional[str]:
    """Heuristically categorize Samsung device family from arbitrary text/code.
    Returns: 'highend' | 'midend' | 'lowend' | 'wearable' | 'tab' | None
    """
    t = (text or "").strip()
    if not t:
        return None
    tl = t.lower()
    tn = _norm(t)

    # Tablets
    if any(k in tl for k in ["galaxy tab", "tab s", "tab a", "tab active"]) or re.search(r"\bSM-(?:T|X)\w+", t, re.I):
        return "tab"

    # Wearables: watches/buds
    if any(k in tl for k in ["galaxy watch", "gear s", "buds"]) or re.search(r"\bSM-(?:R|L)\w+", t, re.I):
        return "wearable"

    # High-end: S/Note/Z series
    if _DEF_SERIES_RE.search(t) or re.search(r"\bSM-(?:S9|S92|F9|N9)\w*", t, re.I):
        return "highend"

    # A-series split: A0-A2 low, A3-A9 mid
    m = re.search(r"\bA(\d{1,2})\b", tn, re.I)
    if m:
        try:
            num = int(m.group(1))
            return "lowend" if num <= 2 else "midend"
        except Exception:
            pass

    # M / F series usually budget
    if re.search(r"\b(?:M\d{1,2}|F\d{1,2})\b", tn, re.I) or any(k in tl for k in ["xcover", "core"]):
        return "lowend"

    return None


def reconcile_category(inferred: Optional[str], matched: Optional[str]) -> Optional[str]:
    """Combine text-inferred category with DB-matched category.
    Prefer explicit DB match; otherwise fallback to inferred. If they disagree
    with highend involved, keep highend.
    """
    if matched and inferred:
        if matched == inferred:
            return matched
        # If any says highend, prefer highend
        if matched == 'highend' or inferred == 'highend':
            return 'highend'
        # Prefer tab/wearable when present
        if matched in ('tab', 'wearable'):
            return matched
        if inferred in ('tab', 'wearable'):
            return inferred
        # Otherwise default to matched
        return matched
    return matched or inferred


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    create_tables()
    ensure_schema()
    # Seed default admin if configured via environment (no hardcoded demo credentials)
    from sqlalchemy.orm import sessionmaker
    SessionLocal = sessionmaker(bind=engine) if 'engine' in globals() else None
    try:
        db: Session = next(get_db()) if SessionLocal is None else SessionLocal()
        try:
            admin_username = os.getenv('ADMIN_USERNAME')
            admin_password = os.getenv('ADMIN_PASSWORD')
            required = {'manage_users','manage_parts','manage_formulas','manage_samsung_models','upload_excel'}

            if admin_username and admin_password:
                admin_user = db.query(UserModel).filter(UserModel.username == admin_username).first()
                if not admin_user:
                    db.add(UserModel(
                        username=admin_username,
                        password=get_password_hash(admin_password),
                        is_active='Active',
                        role='admin',
                        permissions=','.join(sorted(required))
                    ))
                    db.commit()
                else:
                    changed = False
                    if str(getattr(admin_user, 'role', None) or '').lower() != 'admin':
                        admin_user.role = 'admin'
                        changed = True
                    perms = set((admin_user.permissions or '').split(','))
                    merged = ','.join(sorted(p.strip() for p in (perms | required) if p.strip()))
                    if admin_user.permissions != merged:
                        admin_user.permissions = merged
                        changed = True
                    if getattr(admin_user, 'is_active', None) != 'Active':
                        admin_user.is_active = 'Active'
                        changed = True
                    if changed:
                        db.commit()
            else:
                # No env-provided admin; skip seeding to avoid demo credentials
                print("[startup] ADMIN_USERNAME/ADMIN_PASSWORD not set; skipping admin seeding.")
        finally:
            try:
                db.close()
            except Exception:
                pass
    except Exception:
        # Seeding is best-effort
        pass
    yield
    # Shutdown (nothing required)

# Initialize FastAPI app
app = FastAPI(
    title="Service Tool API",
    description="Parts management system with Excel import and pricing calculations",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# OAuth2 setup
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Authentication endpoints
@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

# New: get current user profile
@app.get("/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# Admin-only: list users
@app.get("/admin/users", response_model=List[User])
async def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_users')
    users = db.query(UserModel).all()
    id_to_username = {u.id: u.username for u in users}
    # Project ORM objects to dicts that include creator info for API response
    result = []
    for u in users:
        cid = getattr(u, 'created_by_id', None)
        result.append({
            'id': u.id,
            'username': u.username,
            'is_active': u.is_active,
            'role': getattr(u, 'role', None),
            'permissions': getattr(u, 'permissions', None),
            'created_at': u.created_at,
            'created_by_id': cid,
            'created_by_username': id_to_username.get(cid)
        })
    return result

# Admin-only: create user (with optional role/permissions)
@app.post("/admin/users", response_model=User)
async def admin_create_user(payload: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_users')
    existing = db.query(UserModel).filter(UserModel.username == payload.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already registered")
    hashed = get_password_hash(payload.password)
    role = payload.role or 'user'
    perms = payload.permissions
    db_user = UserModel(username=payload.username, password=hashed, role=role, permissions=perms, is_active='Active', created_by_id=getattr(current_user, 'id', None))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Admin-only: update user (role, permissions, password, is_active)
@app.put("/admin/users/{user_id}", response_model=User)
async def admin_update_user(user_id: int, updates: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_users')
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    data = updates.dict(exclude_unset=True)
    # Handle password update
    if 'password' in data and data['password']:
        user.password = get_password_hash(data.pop('password'))
    for k, v in data.items():
        setattr(user, k, v)
    db.commit()
    db.refresh(user)
    return user

# Admin-only: delete user
@app.delete("/admin/users/{user_id}", status_code=204)
async def admin_delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_users')
    user = db.query(UserModel).filter(UserModel.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return None

# Keep legacy basic user creation but restrict to admins only now
@app.post("/users/", response_model=User)
async def create_user(user: UserCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_users')
    db_user = db.query(UserModel).filter(UserModel.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    hashed_password = get_password_hash(user.password)
    db_user = UserModel(username=user.username, password=hashed_password, role=user.role or 'user', permissions=user.permissions, created_by_id=getattr(current_user, 'id', None))
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

# Parts endpoints
@app.get("/parts/", response_model=List[Part])
async def get_parts(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    in_stock: Optional[bool] = Query(None),
    device: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(PartModel)
    
    # Apply filters
    if search:
        s = (search or "").strip()
        filters = []
        # Direct case-insensitive match on code/description
        filters.append(PartModel.code.ilike(f"%{s}%"))
        filters.append(PartModel.description.ilike(f"%{s}%"))
        # Normalized variant without punctuation, uppercased
        s_norm = re.sub(r"[^A-Za-z0-9]+", "", s).upper()
        if s_norm and s_norm != s:
            filters.append(PartModel.code.ilike(f"%{s_norm}%"))
            filters.append(PartModel.description.ilike(f"%{s_norm}%"))
        # Numeric-tail fallback: for queries like 's928' also match '928'
        for m in re.finditer(r"\d{3,4}", s):
            tail = m.group(0)
            filters.append(PartModel.code.ilike(f"%{tail}%"))
            filters.append(PartModel.description.ilike(f"%{tail}%"))
        # Also try lead-letter + tail pattern (e.g., S928)
        lm = re.search(r"([A-Za-z])(\d{3,4})", s_norm or s)
        if lm:
            lead = lm.group(1).upper()
            body = lm.group(2)
            pattern = f"%{lead}{body}%"
            filters.append(PartModel.code.ilike(pattern))
            filters.append(PartModel.description.ilike(pattern))
        query = query.filter(or_(*filters))
    
    if status:
        query = query.filter(PartModel.status == status)
    
    if min_price is not None:
        query = query.filter(PartModel.map_price >= min_price)
    
    if max_price is not None:
        query = query.filter(PartModel.map_price <= max_price)
    
    if in_stock is not None:
        if in_stock:
            query = query.filter(PartModel.stock_qty > 0)
        else:
            query = query.filter(PartModel.stock_qty == 0)
    
    # When filtering by device, we must enrich all matching rows first, then paginate
    if device:
        parts = query.all()
    else:
        parts = query.offset(skip).limit(limit).all()

    # Enrich with Samsung model/category detection
    sams = db.query(SamsungModelORM).all()

    def base_code(code: Optional[str]) -> Optional[str]:
        if not code:
            return None
        c = code.split('/')[0]
        m = re.match(r"^([A-Z]{2}-[A-Z0-9]*?\d+)", c, re.IGNORECASE)
        return m.group(1).upper() if m else c.upper()

    code_entries = []  # (pattern_lower, model)
    name_entries = []  # (name_lower, model)
    tail_to_models = {}  # e.g., '928' -> [model, ...]

    def add_tail_map(key: str, model):
        if not key:
            return
        tail_to_models.setdefault(key, []).append(model)

    for mobj in sams:
        if mobj.model_code:
            c_full = mobj.model_code.upper()
            # direct
            code_entries.append((c_full.lower(), mobj))
            # base (strip region and trailing letter segment)
            b = base_code(c_full)
            if b and b.lower() != c_full.lower():
                code_entries.append((b.lower(), mobj))
            # also versions without SM-
            c_no_region = c_full.split('/')[0]
            c_no_sm = c_no_region.replace('SM-', '')
            if c_no_sm and c_no_sm.lower() not in [p for p, _ in code_entries]:
                code_entries.append((c_no_sm.lower(), mobj))
            # remove last trailing letter (e.g., S928B -> S928)
            m2 = re.match(r"^[A-Z]{1,2}-(\w+)$", c_no_region)
            code_body = m2.group(1) if m2 else c_no_region
            code_body_nosuf = re.sub(r"[A-Z]$", "", code_body)
            if code_body_nosuf and code_body_nosuf.lower() not in [p for p, _ in code_entries]:
                code_entries.append((code_body_nosuf.lower(), mobj))
            # map numeric tail (e.g., S928B -> 928)
            mnum = re.search(r"(\d{3,4})", code_body)
            if mnum:
                add_tail_map(mnum.group(1), mobj)
        if mobj.model_name:
            name_entries.append((mobj.model_name.strip().lower(), mobj))

    def detect_for_text(text: str):
        t = (text or "").lower()
        # Prefer code matches (longest first)
        for pat, sm in sorted(code_entries, key=lambda x: len(x[0]), reverse=True):
            if pat and pat in t:
                return sm
        # Fallback to name matches (longest first)
        for nm, sm in sorted(name_entries, key=lambda x: len(x[0]), reverse=True):
            if nm and nm in t:
                return sm
        # Numeric-tail fallback: detect 3-4 digit sequences like '928' in 'oled928'
        for mnd in re.finditer(r"\d{3,4}", t):
            num = mnd.group(0)
            cands = tail_to_models.get(num)
            if not cands:
                continue
            if len(cands) == 1:
                return cands[0]
            # Disambiguate by preceding letter in text (a/s/m/x/p/t/r/l/e, etc.)
            idx = mnd.start()
            prev = t[idx - 1] if idx - 1 >= 0 else ''
            if prev and prev.isalpha():
                for cand in cands:
                    cc = (cand.model_code or '').upper().split('/')[0]
                    mlead = re.match(r"^(?:SM-)?([A-Z])", cc)
                    lead = mlead.group(1).lower() if mlead else ''
                    if lead and lead == prev:
                        return cand
            # If still ambiguous, prefer categories in this priority: highend > tab > wearable > midend > lowend
            priority = {"highend": 4, "tab": 3, "wearable": 2, "midend": 1, "lowend": 0}
            cands_sorted = sorted(cands, key=lambda x: priority.get(getattr(x, 'category', None) or '', 0), reverse=True)
            return cands_sorted[0]
        return None

    enriched = []
    for p in parts:
        base_text = f"{p.code} {p.description}"
        smatch = detect_for_text(base_text)
        # Category inference from raw text
        inferred = categorize_samsung_text(base_text)
        # If we matched a Samsung model, also add its fields into the inference text for better signals
        if smatch:
            inferred = categorize_samsung_text(f"{base_text} {getattr(smatch, 'model_code', '')} {getattr(smatch, 'model_name', '')}") or inferred
        final_cat = reconcile_category(inferred, getattr(smatch, 'category', None))
        item = {
            'id': p.id,
            'code': p.code,
            'description': p.description,
            'map_price': p.map_price,
            'status': p.status,
            'net_price': p.net_price,
            'diff': p.diff,
            'stock_qty': p.stock_qty,
            'gr_qty': p.gr_qty,
            'gr_usd': p.gr_usd,
            'created_at': p.created_at,
            'updated_at': p.updated_at,
            'samsung_match_name': getattr(smatch, 'model_name', None),
            'samsung_match_code': getattr(smatch, 'model_code', None),
            'samsung_category': final_cat,
        }
        enriched.append(item)

    # If device filter provided, filter enriched results and then paginate
    if device:
        dev = (device or '').strip().lower()
        def dev_key(itm: dict) -> str:
            name = (itm.get('samsung_match_name') or '').strip()
            code = (itm.get('samsung_match_code') or '').strip()
            return f"{name}||{code}".lower()
        filtered = [e for e in enriched if dev_key(e) == dev]
        enriched = filtered[skip: skip + max(0, limit)] if limit is not None else filtered[skip:]

    return enriched


@app.get("/parts/count")
async def get_parts_count(
    search: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    min_price: Optional[float] = Query(None),
    max_price: Optional[float] = Query(None),
    in_stock: Optional[bool] = Query(None),
    device: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    """Return total count of parts matching filters (for pagination)."""
    query = db.query(PartModel)

    if search:
        s = (search or "").strip()
        filters = []
        filters.append(PartModel.code.ilike(f"%{s}%"))
        filters.append(PartModel.description.ilike(f"%{s}%"))
        s_norm = re.sub(r"[^A-Za-z0-9]+", "", s).upper()
        if s_norm and s_norm != s:
            filters.append(PartModel.code.ilike(f"%{s_norm}%"))
            filters.append(PartModel.description.ilike(f"%{s_norm}%"))
        for m in re.finditer(r"\d{3,4}", s):
            tail = m.group(0)
            filters.append(PartModel.code.ilike(f"%{tail}%"))
            filters.append(PartModel.description.ilike(f"%{tail}%"))
        lm = re.search(r"([A-Za-z])(\d{3,4})", s_norm or s)
        if lm:
            lead = lm.group(1).upper()
            body = lm.group(2)
            pattern = f"%{lead}{body}%"
            filters.append(PartModel.code.ilike(pattern))
            filters.append(PartModel.description.ilike(pattern))
        query = query.filter(or_(*filters))

    if status:
        query = query.filter(PartModel.status == status)

    if min_price is not None:
        query = query.filter(PartModel.map_price >= min_price)

    if max_price is not None:
        query = query.filter(PartModel.map_price <= max_price)

    if in_stock is not None:
        if in_stock:
            query = query.filter(PartModel.stock_qty > 0)
        else:
            query = query.filter(PartModel.stock_qty == 0)

    if not device:
        total = query.count()
        return {"total": int(total)}

    # With device filter, need to enrich and count only matches
    sams = db.query(SamsungModelORM).all()

    def base_code(code: Optional[str]) -> Optional[str]:
        if not code:
            return None
        c = code.split('/')[0]
        m = re.match(r"^([A-Z]{2}-[A-Z0-9]*?\d+)", c, re.IGNORECASE)
        return m.group(1).upper() if m else c.upper()

    code_entries = []
    name_entries = []
    tail_to_models = {}

    def add_tail_map(key: str, model):
        if not key:
            return
        tail_to_models.setdefault(key, []).append(model)

    for mobj in sams:
        if mobj.model_code:
            c_full = mobj.model_code.upper()
            code_entries.append((c_full.lower(), mobj))
            b = base_code(c_full)
            if b and b.lower() != c_full.lower():
                code_entries.append((b.lower(), mobj))
            c_no_region = c_full.split('/')[0]
            c_no_sm = c_no_region.replace('SM-', '')
            if c_no_sm:
                code_entries.append((c_no_sm.lower(), mobj))
            m2 = re.match(r"^[A-Z]{1,2}-(\w+)$", c_no_region)
            code_body = m2.group(1) if m2 else c_no_region
            code_body_nosuf = re.sub(r"[A-Z]$", "", code_body)
            if code_body_nosuf:
                code_entries.append((code_body_nosuf.lower(), mobj))
            mnum = re.search(r"(\d{3,4})", code_body)
            if mnum:
                add_tail_map(mnum.group(1), mobj)
        if mobj.model_name:
            name_entries.append((mobj.model_name.strip().lower(), mobj))

    def detect_for_text(text: str):
        t = (text or "").lower()
        for pat, sm in sorted(code_entries, key=lambda x: len(x[0]), reverse=True):
            if pat and pat in t:
                return sm
        for nm, sm in sorted(name_entries, key=lambda x: len(x[0]), reverse=True):
            if nm and nm in t:
                return sm
        for mnd in re.finditer(r"\d{3,4}", t):
            num = mnd.group(0)
            cands = tail_to_models.get(num)
            if not cands:
                continue
            if len(cands) == 1:
                return cands[0]
            idx = mnd.start()
            prev = t[idx - 1] if idx - 1 >= 0 else ''
            if prev and prev.isalpha():
                for cand in cands:
                    cc = (cand.model_code or '').upper().split('/')[0]
                    mlead = re.match(r"^(?:SM-)?([A-Z])", cc)
                    lead = mlead.group(1).lower() if mlead else ''
                    if lead and lead == prev:
                        return cand
            priority = {"highend": 4, "tab": 3, "wearable": 2, "midend": 1, "lowend": 0}
            cands_sorted = sorted(cands, key=lambda x: priority.get(getattr(x, 'category', None) or '', 0), reverse=True)
            return cands_sorted[0]
        return None

    dev = (device or '').strip().lower()
    total = 0
    for p in query.all():
        base_text = f"{p.code} {p.description}"
        smatch = detect_for_text(base_text)
        name = (getattr(smatch, 'model_name', None) or '').strip()
        code = (getattr(smatch, 'model_code', None) or '').strip()
        key = f"{name}||{code}".lower()
        if key == dev:
            total += 1

    return {"total": int(total)}


@app.get("/detect-samsung")
async def detect_samsung(text: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """
    Detect Samsung model and category from arbitrary text (e.g., part description/code).
    Returns a simple JSON payload: { model_name, model_code, category } or all None if not found.
    """
    sams = db.query(SamsungModelORM).all()

    def base_code(code: Optional[str]) -> Optional[str]:
        if not code:
            return None
        c = code.split('/')[0]
        m = re.match(r"^([A-Z]{2}-[A-Z0-9]*?\d+)", c, re.IGNORECASE)
        return m.group(1).upper() if m else c.upper()

    code_entries = []
    name_entries = []
    tail_to_models = {}

    def add_tail_map(key: str, model):
        if not key:
            return
        tail_to_models.setdefault(key, []).append(model)

    for mobj in sams:
        if mobj.model_code:
            c_full = mobj.model_code.upper()
            code_entries.append((c_full.lower(), mobj))
            b = base_code(c_full)
            if b and b.lower() != c_full.lower():
                code_entries.append((b.lower(), mobj))
            c_no_region = c_full.split('/')[0]
            c_no_sm = c_no_region.replace('SM-', '')
            if c_no_sm:
                code_entries.append((c_no_sm.lower(), mobj))
            m2 = re.match(r"^[A-Z]{1,2}-(\w+)$", c_no_region)
            code_body = m2.group(1) if m2 else c_no_region
            code_body_nosuf = re.sub(r"[A-Z]$", "", code_body)
            if code_body_nosuf:
                code_entries.append((code_body_nosuf.lower(), mobj))
            mnum = re.search(r"(\d{3,4})", code_body)
            if mnum:
                add_tail_map(mnum.group(1), mobj)
        if mobj.model_name:
            name_entries.append((mobj.model_name.strip().lower(), mobj))

    def detect_for_text(t: str):
        s = (t or "").lower()
        # Prefer code matches (longest first)
        for pat, sm in sorted(code_entries, key=lambda x: len(x[0]), reverse=True):
            if pat and pat in s:
                return sm
        # Fallback to name matches (longest first)
        for nm, sm in sorted(name_entries, key=lambda x: len(x[0]), reverse=True):
            if nm and nm in s:
                return sm
        # Numeric-tail fallback: detect 3-4 digit sequences like '928' in 'oled928'
        for mnd in re.finditer(r"\d{3,4}", s):
            num = mnd.group(0)
            cands = tail_to_models.get(num)
            if not cands:
                continue
            if len(cands) == 1:
                return cands[0]
            # Disambiguate by preceding letter in text (a/s/m/x/p/t/r/l/e, etc.)
            idx = mnd.start()
            prev = s[idx - 1] if idx - 1 >= 0 else ''
            if prev and prev.isalpha():
                for cand in cands:
                    cc = (cand.model_code or '').upper().split('/')[0]
                    mlead = re.match(r"^(?:SM-)?([A-Z])", cc)
                    lead = mlead.group(1).lower() if mlead else ''
                    if lead and lead == prev:
                        return cand
            # If still ambiguous, prefer categories in this priority: highend > tab > wearable > midend > lowend
            priority = {"highend": 4, "tab": 3, "wearable": 2, "midend": 1, "lowend": 0}
            cands_sorted = sorted(cands, key=lambda x: priority.get(getattr(x, 'category', None) or '', 0), reverse=True)
            return cands_sorted[0]
        return None

    smatch = detect_for_text(text)
    inferred = categorize_samsung_text(text)
    if smatch:
        inferred = categorize_samsung_text(f"{text} {getattr(smatch, 'model_code', '')} {getattr(smatch, 'model_name', '')}") or inferred
    final_cat = reconcile_category(inferred, getattr(smatch, 'category', None))
    return {
        "model_name": getattr(smatch, 'model_name', None),
        "model_code": getattr(smatch, 'model_code', None),
        "category": final_cat,
    }


@app.get("/parts/{part_id}", response_model=Part)
async def get_part(part_id: int, db: Session = Depends(get_db)):
    part = db.query(PartModel).filter(PartModel.id == part_id).first()
    if part is None:
        raise HTTPException(status_code=404, detail="Part not found")

    sams = db.query(SamsungModelORM).all()
    def base_code(code: Optional[str]) -> Optional[str]:
        if not code:
            return None
        c = code.split('/')[0]
        m = re.match(r"^([A-Z]{2}-[A-Z0-9]*?\d+)", c, re.IGNORECASE)
        return m.group(1).upper() if m else c.upper()

    code_entries = []
    name_entries = []
    tail_to_models = {}

    def add_tail_map(key: str, model):
        if not key:
            return
        tail_to_models.setdefault(key, []).append(model)

    for mobj in sams:
        if mobj.model_code:
            cf = mobj.model_code.upper()
            code_entries.append((cf.lower(), mobj))
            b = base_code(cf)
            if b and b.lower() != cf.lower():
                code_entries.append((b.lower(), mobj))
            c_no_region = cf.split('/')[0]
            c_no_sm = c_no_region.replace('SM-', '')
            code_entries.append((c_no_sm.lower(), mobj))
            m2 = re.match(r"^[A-Z]{1,2}-(\w+)$", c_no_region)
            code_body = m2.group(1) if m2 else c_no_region
            code_body_nosuf = re.sub(r"[A-Z]$", "", code_body)
            code_entries.append((code_body_nosuf.lower(), mobj))
            mnum = re.search(r"(\d{3,4})", code_body)
            if mnum:
                add_tail_map(mnum.group(1), mobj)
        if mobj.model_name:
            name_entries.append((mobj.model_name.strip().lower(), mobj))

    def detect_for_text(text: str):
        t = (text or "").lower()
        for pat, sm in sorted(code_entries, key=lambda x: len(x[0]), reverse=True):
            if pat and pat in t:
                return sm
        for nm, sm in sorted(name_entries, key=lambda x: len(x[0]), reverse=True):
            if nm and nm in t:
                return sm
        for mnd in re.finditer(r"\d{3,4}", t):
            num = mnd.group(0)
            cands = tail_to_models.get(num)
            if not cands:
                continue
            if len(cands) == 1:
                return cands[0]
            idx = mnd.start()
            prev = t[idx - 1] if idx - 1 >= 0 else ''
            if prev and prev.isalpha():
                for cand in cands:
                    cc = (cand.model_code or '').upper().split('/')[0]
                    mlead = re.match(r"^(?:SM-)?([A-Z])", cc)
                    lead = mlead.group(1).lower() if mlead else ''
                    if lead and lead == prev:
                        return cand
            # If still ambiguous, prefer categories in this priority: highend > tab > wearable > midend > lowend
            priority = {"highend": 4, "tab": 3, "wearable": 2, "midend": 1, "lowend": 0}
            cands_sorted = sorted(cands, key=lambda x: priority.get(getattr(x, 'category', None) or '', 0), reverse=True)
            return cands_sorted[0]
        return None

    smatch = detect_for_text(part.code)
    inferred = categorize_samsung_text(part.code)
    if smatch:
        inferred = categorize_samsung_text(f"{part.code} {getattr(smatch, 'model_code', '')} {getattr(smatch, 'model_name', '')}") or inferred
    final_cat = reconcile_category(inferred, getattr(smatch, 'category', None))
    return {
        'id': part.id,
        'code': part.code,
        'description': part.description,
        'map_price': part.map_price,
        'status': part.status,
        'net_price': part.net_price,
        'diff': part.diff,
        'stock_qty': part.stock_qty,
        'gr_qty': part.gr_qty,
        'gr_usd': part.gr_usd,
        'created_at': part.created_at,
        'updated_at': part.updated_at,
        'samsung_match_name': getattr(smatch, 'model_name', None),
        'samsung_match_code': getattr(smatch, 'model_code', None),
        'samsung_category': final_cat,
    }


@app.post("/parts/", response_model=Part)
async def create_part(part: PartCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    # Admin-only: remove permission-based access for parts management
    db_part = PartModel(
        code=part.code,
        description=part.description,
        map_price=part.map_price,
        status=part.status,
        net_price=part.net_price,
        diff=part.diff,
        stock_qty=part.stock_qty,
        gr_qty=part.gr_qty,
        gr_usd=part.gr_usd,
    )
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part


@app.put("/parts/{part_id}", response_model=Part)
async def update_part(part_id: int, updates: PartUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    # Admin-only: remove permission-based access for parts management
    part = db.query(PartModel).filter(PartModel.id == part_id).first()
    if part is None:
        raise HTTPException(status_code=404, detail="Part not found")

    # Update fields
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(part, field, value)

    db.commit()
    db.refresh(part)
    return part


@app.delete("/parts/{part_id}", status_code=204)
async def delete_part(part_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    # Admin-only: remove permission-based access for parts management
    part = db.query(PartModel).filter(PartModel.id == part_id).first()
    if part is None:
        raise HTTPException(status_code=404, detail="Part not found")
    db.delete(part)
    db.commit()
    return None


@app.post("/upload-excel", response_model=ExcelUploadResponse)
async def upload_excel(file: UploadFile = File(...), db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'upload_excel')
    # Accept .xlsx or .xls
    fname = (file.filename or "").lower()
    if not (fname.endswith(".xlsx") or fname.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Invalid file type, only .xls/.xlsx allowed")

    content = await file.read()

    # Helper: normalize columns
    def norm_cols(df: pd.DataFrame) -> pd.DataFrame:
        df.columns = (
            df.columns
            .str.strip()
            .str.lower()
            .str.replace(r"\s+", "_", regex=True)
            .str.replace(r"[\\./-]+", "_", regex=True)
        )
        return df

    # Read parts sheet (prefer 'Parts' else first sheet)
    try:
        xls = pd.ExcelFile(io.BytesIO(content))
        sheet_name = 'Parts' if 'Parts' in xls.sheet_names else 0
        parts_df = pd.read_excel(
            io.BytesIO(content),
            sheet_name=sheet_name,
            na_values=["#N/A", "N/A", "NA", "-", "—", "#REF!", "#NULL!"],
            keep_default_na=True
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read Excel file: {e}")

    parts_df = norm_cols(parts_df)

    column_mapping = {
        'part_code': 'code', 'part_number': 'code', 'part_no': 'code', 'parts_no': 'code',
        'p_no': 'code', 'p_no_': 'code', 'p_no__': 'code', 'item_code': 'code', 'material': 'code',
        'material_code': 'code', 'code': 'code', 'parts_code': 'code',
        'parts_desc': 'description', 'desc': 'description', 'desc_': 'description',
        'description': 'description', 'part_description': 'description', 'item_desc': 'description', 'name': 'description',
        'map': 'map_price', 'map_price': 'map_price',
        'status': 'status',
        'n': 'net_price', 'net': 'net_price', 'net_price': 'net_price',
        'diff': 'diff', 'diff_': 'diff',
        's_qty': 'stock_qty', 's_qty_': 'stock_qty', 'stock_quantity': 'stock_qty', 'stock_qty': 'stock_qty',
        'wh_stock_q': 'wh_stock_qty', 'wh_stock_qty': 'wh_stock_qty',
        'eng_stock_q': 'eng_stock_qty', 'eng_stock_qty': 'eng_stock_qty',
        'gr_qty': 'gr_qty', 'gr_$': 'gr_usd', 'gr_usd': 'gr_usd',
        # Newer provided headers
        'mo_avg_price': 'map_price', 'mo_avg_amount': 'gr_usd',
    }
    rename_dict = {c: column_mapping[c] for c in parts_df.columns if c in column_mapping}
    parts_df = parts_df.rename(columns=rename_dict)

    # Heuristic fallback for 'code'
    if 'code' not in parts_df.columns:
        candidates = [
            c for c in parts_df.columns
            if (("code" in c) or c in ['p_no', 'p_no_', 'p_no__', 'material', 'material_code', 'item_code', 'part', 'parts'])
            and 'desc' not in c and 'description' not in c
        ]
        if candidates:
            parts_df = parts_df.rename(columns={candidates[0]: 'code'})

    # If stock_qty missing, build from aux columns
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

    # Upsert parts
    parts_imported = 0
    for _, row in parts_df.iterrows():
        code = row.get('code')
        if not code:
            continue
        existing = db.query(PartModel).filter(PartModel.code == code).first()
        fields = {k: row.get(k) for k in keep_cols if k in parts_df.columns}
        if existing:
            for k, v in fields.items():
                if k == 'code' or v is None:
                    continue
                if k == 'description':
                    # Do not overwrite an existing non-empty description
                    current_desc = getattr(existing, 'description', None)
                    if current_desc is None or str(current_desc).strip() == '':
                        incoming = str(v).strip()
                        # Treat common placeholders as empty
                        if incoming.lower() in ('nan', 'none', '-', '--', 'n/a', '#n/a'):
                            continue
                        setattr(existing, 'description', incoming)
                    else:
                        # Keep existing description
                        continue
                else:
                    setattr(existing, k, v)
        else:
            # Normalize incoming description to avoid storing placeholders
            if 'description' in fields and fields['description'] is not None:
                incoming = str(fields['description']).strip()
                if incoming.lower() in ('nan', 'none', '-', '--', 'n/a', '#n/a'):
                    fields['description'] = None
                else:
                    fields['description'] = incoming
            db.add(PartModel(**fields))
        parts_imported += 1
    db.commit()

    # Optional: formulas sheet
    formulas_imported = 0
    try:
        if 'Formulas' in xls.sheet_names:
            fdf = pd.read_excel(io.BytesIO(content), sheet_name='Formulas')
            fdf = norm_cols(fdf)
            formula_mapping = {
                'class': 'class_name', 'class_name': 'class_name',
                'labor_1': 'labor_lvl1', 'labor_lvl1': 'labor_lvl1',
                'labor_2': 'labor_lvl2', 'labor_lvl2': 'labor_lvl2',
                'labor_3': 'labor_lvl3', 'labor_lvl3': 'labor_lvl3',
                'labor_lvl2_major': 'labor_lvl2_major', 'labor_lvl2_minor': 'labor_lvl2_minor',
                'major': 'labor_lvl2_major', 'minor': 'labor_lvl2_minor',
                'margin': 'margin', 'total_map': 'total_map',
                'exchange': 'exchange_rate', 'exchange_rate': 'exchange_rate',
                'final': 'final_price', 'final_price': 'final_price'
            }
            fdf = fdf.rename(columns={c: formula_mapping[c] for c in fdf.columns if c in formula_mapping})
            for c in ['labor_lvl1','labor_lvl2','labor_lvl3','labor_lvl2_major','labor_lvl2_minor','exchange_rate','final_price','margin','total_map']:
                if c in fdf.columns:
                    fdf[c] = pd.to_numeric(fdf[c], errors='coerce')
            if 'margin' in fdf.columns:
                fdf['margin'] = fdf['margin'].apply(lambda x: (x * 100.0) if pd.notnull(x) and x < 1 else x)
            fdf = fdf.where(pd.notnull(fdf), None)

            for _, row in fdf.iterrows():
                cls = row.get('class_name')
                if not cls:
                    continue
                existing = db.query(FormulaModel).filter(FormulaModel.class_name == cls).first()
                # Do not import total_map/final_price into formula; those are computed elsewhere
                payload_keys = ['class_name','labor_lvl1','labor_lvl2','labor_lvl3','labor_lvl2_major','labor_lvl2_minor','margin','exchange_rate']
                payload = {k: row.get(k) for k in payload_keys if k in fdf.columns}
                if existing:
                    for k, v in payload.items():
                        if k != 'class_name' and v is not None:
                            setattr(existing, k, v)
                else:
                    db.add(FormulaModel(**payload))
                formulas_imported += 1
            db.commit()
    except Exception:
        # Ignore formulas errors, just report 0
        pass

    return {
        "message": f"Imported {parts_imported} parts and {formulas_imported} formulas from {file.filename}",
        "parts_imported": int(parts_imported),
        "formulas_imported": int(formulas_imported),
    }


@app.get("/samsung-models/", response_model=List[SamsungModel])
async def get_samsung_models(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(SamsungModelORM)
    if search:
        query = query.filter(
            (SamsungModelORM.model_code.contains(search)) | 
            (SamsungModelORM.model_name.contains(search))
        )
    if category:
        query = query.filter(SamsungModelORM.category == category)
    models = query.offset(skip).limit(limit).all()
    return models


@app.post("/samsung-models/", response_model=SamsungModel)
async def create_samsung_model(model: SamsungModelCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_samsung_models')
    db_model = SamsungModelORM(
        model_code=model.model_code,
        model_name=model.model_name,
        category=model.category,
    )
    db.add(db_model)
    db.commit()
    db.refresh(db_model)
    return db_model


@app.put("/samsung-models/{model_id}", response_model=SamsungModel)
async def update_samsung_model(model_id: int, updates: SamsungModelUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_samsung_models')
    model = db.query(SamsungModelORM).filter(SamsungModelORM.id == model_id).first()
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")

    # Update fields
    for field, value in updates.dict(exclude_unset=True).items():
        setattr(model, field, value)

    db.commit()
    db.refresh(model)
    return model


@app.delete("/samsung-models/{model_id}", status_code=204)
async def delete_samsung_model(model_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_samsung_models')
    model = db.query(SamsungModelORM).filter(SamsungModelORM.id == model_id).first()
    if model is None:
        raise HTTPException(status_code=404, detail="Model not found")
    db.delete(model)
    db.commit()
    return None


@app.get("/formulas/", response_model=List[Formula])
async def get_formulas(
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(FormulaModel)
    # Apply filters
    if search:
        # Filter by class_name only (schema has no name/description fields)
        query = query.filter(FormulaModel.class_name.contains(search))
    formulas = query.offset(skip).limit(limit).all()
    return formulas


@app.post("/formulas/", response_model=Formula)
async def create_formula(formula: FormulaCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_formulas')
    # Normalize margin: accept 0.03 or 3 -> store as percent (3)
    margin_val = formula.margin
    if margin_val is not None and margin_val < 1:
        margin_val = margin_val * 100.0
    # Dealer margin normalize
    dealer_margin_val = getattr(formula, 'dealer_margin', None)
    if dealer_margin_val is not None and dealer_margin_val < 1:
        dealer_margin_val = dealer_margin_val * 100.0
    # total_map and final_price are computed per part/use_case, so we do not persist them on the formula
    db_formula = FormulaModel(
        class_name=formula.class_name,
        labor_lvl1=formula.labor_lvl1,
        labor_lvl2=formula.labor_lvl2,
        labor_lvl3=formula.labor_lvl3,
        labor_lvl2_major=formula.labor_lvl2_major,
        labor_lvl2_minor=formula.labor_lvl2_minor,
        margin=margin_val,
        exchange_rate=formula.exchange_rate,
        # Dealer overrides
        dealer_labor_lvl1=getattr(formula, 'dealer_labor_lvl1', None),
        dealer_labor_lvl2_major=getattr(formula, 'dealer_labor_lvl2_major', None),
        dealer_labor_lvl2_minor=getattr(formula, 'dealer_labor_lvl2_minor', None),
        dealer_labor_lvl3=getattr(formula, 'dealer_labor_lvl3', None),
        dealer_margin=dealer_margin_val,
    )
    db.add(db_formula)
    db.commit()
    db.refresh(db_formula)
    return db_formula


@app.put("/formulas/{formula_id}", response_model=Formula)
async def update_formula(formula_id: int, updates: FormulaUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_permission(current_user, 'manage_formulas')
    formula = db.query(FormulaModel).filter(FormulaModel.id == formula_id).first()
    if formula is None:
        raise HTTPException(status_code=404, detail="Formula not found")

    payload = updates.dict(exclude_unset=True)
    # Normalize margin if provided
    if 'margin' in payload and payload['margin'] is not None:
        payload['margin'] = (payload['margin'] * 100.0) if payload['margin'] < 1 else payload['margin']
    if 'dealer_margin' in payload and payload['dealer_margin'] is not None:
        payload['dealer_margin'] = (payload['dealer_margin'] * 100.0) if payload['dealer_margin'] < 1 else payload['dealer_margin']
    # Do not persist fields that are computed elsewhere
    payload.pop('total_map', None)
    payload.pop('final_price', None)

    for field, value in payload.items():
        setattr(formula, field, value)

    db.commit()
    db.refresh(formula)
    return formula


@app.post("/calculate-price", response_model=PriceResult)
async def calculate_price(payload: PriceCalculation, db: Session = Depends(get_db)):
    # Resolve parts or use manual MAP when parts are not available
    part_items = []
    total_map = 0.0
    part_codes = []

    if payload.manual_total_map is not None:
        # Manual entry path
        try:
            total_map = float(payload.manual_total_map) or 0.0
        except Exception:
            total_map = 0.0
        lbl = (getattr(payload, 'manual_label', None) or 'Manual').strip() or 'Manual'
        part_codes = [lbl]
    else:
        # Existing logic: support single or multiple parts
        if payload.parts:
            for psel in payload.parts:
                p = db.query(PartModel).filter(PartModel.id == psel.part_id).first()
                if not p:
                    raise HTTPException(status_code=404, detail=f"Part not found: {psel.part_id}")
                qty = psel.qty or 1
                part_items.append((p, qty))
        else:
            p = db.query(PartModel).filter(PartModel.id == payload.part_id).first()
            if not p:
                raise HTTPException(status_code=404, detail="Part not found")
            part_items.append((p, 1))

        # Sum base price across all parts (MAP fallback to net)
        for p, qty in part_items:
            base = p.map_price if p.map_price is not None else (p.net_price or 0.0)
            total_map += float(base or 0.0) * int(qty)
            part_codes.append(f"{p.code} x{qty}" if qty and qty != 1 else p.code)

    formula = db.query(FormulaModel).filter(FormulaModel.id == payload.formula_id).first()
    if not formula:
        raise HTTPException(status_code=404, detail="Formula not found")

    exchange_rate = float(formula.exchange_rate) if formula.exchange_rate is not None else 1450.0

    # Labor resolution (support dealer overrides if present)
    cust_type = (getattr(payload, 'customer_type', None) or 'customer').lower()
    is_dealer = cust_type == 'dealer'

    labor_level = payload.labor_level
    labor_cost = 0.0
    labor_level_used = ''

    def get_level(formula_obj, level_name, dealer_level_name):
        if is_dealer and getattr(formula_obj, dealer_level_name, None) is not None:
            return float(getattr(formula_obj, dealer_level_name) or 0.0)
        return float(getattr(formula_obj, level_name) or 0.0)

    if labor_level == '1' or labor_level == 1:
        labor_cost = get_level(formula, 'labor_lvl1', 'dealer_labor_lvl1')
        labor_level_used = '1'
    elif labor_level == '2_major':
        labor_cost = get_level(formula, 'labor_lvl2_major', 'dealer_labor_lvl2_major')
        labor_level_used = '2_major'
    elif labor_level == '2_minor':
        labor_cost = get_level(formula, 'labor_lvl2_minor', 'dealer_labor_lvl2_minor')
        labor_level_used = '2_minor'
    elif labor_level == '3' or labor_level == 3:
        labor_cost = get_level(formula, 'labor_lvl3', 'dealer_labor_lvl3')
        labor_level_used = '3'
    else:
        # default choice order
        if (is_dealer and formula.dealer_labor_lvl2_major is not None) or formula.labor_lvl2_major is not None:
            labor_cost = get_level(formula, 'labor_lvl2_major', 'dealer_labor_lvl2_major')
            labor_level_used = '2_major'
        elif (is_dealer and formula.dealer_labor_lvl2_minor is not None) or formula.labor_lvl2_minor is not None:
            labor_cost = get_level(formula, 'labor_lvl2_minor', 'dealer_labor_lvl2_minor')
            labor_level_used = '2_minor'
        elif (is_dealer and formula.dealer_labor_lvl1 is not None) or formula.labor_lvl1 is not None:
            labor_cost = get_level(formula, 'labor_lvl1', 'dealer_labor_lvl1')
            labor_level_used = '1'
        else:
            labor_cost = get_level(formula, 'labor_lvl3', 'dealer_labor_lvl3')
            labor_level_used = '3'

    # Margin percent (treat <1 as fractional), with class defaults when missing
    def default_margin_pct(class_name: Optional[str]) -> float:
        cn = (class_name or '').lower()
        if cn.startswith('low'):
            return 3.0
        if cn.startswith('mid'):
            return 2.0
        if cn.startswith('high'):
            return 1.0
        if cn.startswith('wear'):
            return 1.0
        if cn.startswith('tab'):
            return 2.0
        return 0.0

    margin_pct_raw = None
    if is_dealer and getattr(formula, 'dealer_margin', None) is not None:
        margin_pct_raw = float(formula.dealer_margin)
    else:
        margin_pct_raw = float(formula.margin) if formula.margin is not None else default_margin_pct(formula.class_name)

    margin_pct = float(margin_pct_raw * 100.0) if margin_pct_raw is not None and margin_pct_raw < 1 else float(margin_pct_raw or 0.0)

    # Legacy behavior fallback: if dealer and no dealer_margin set, reduce customer margin by 50%
    if is_dealer and getattr(formula, 'dealer_margin', None) is None:
        margin_pct = margin_pct * 0.5

    margin_amount = total_map * (margin_pct / 100.0)
    final_usd = total_map + labor_cost + margin_amount
    final_iqd = final_usd * exchange_rate

    # Represent a single part code for backward compatibility
    single_part_code = part_items[0][0].code if part_items else (part_codes[0] if part_codes else '')

    return PriceResult(
        part_code=single_part_code,
        part_codes=part_codes,
        base_price=float(total_map),
        labor_cost=float(labor_cost),
        margin=float(margin_amount),
        total_map=float(total_map),
        exchange_rate=float(exchange_rate),
        final_price_usd=float(final_usd),
        final_price_iqd=float(final_iqd),
        formula_class=formula.class_name,
        labor_level_used=labor_level_used or str(payload.labor_level or '')
    )
