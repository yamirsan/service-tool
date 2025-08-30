from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# Part Models
class PartBase(BaseModel):
    code: str
    description: Optional[str] = None
    map_price: Optional[float] = None
    status: str = "Active"
    net_price: Optional[float] = None
    diff: Optional[float] = None
    stock_qty: Optional[int] = None
    gr_qty: Optional[int] = None
    gr_usd: Optional[float] = None

class PartCreate(PartBase):
    pass

class PartUpdate(BaseModel):
    code: Optional[str] = None
    description: Optional[str] = None
    map_price: Optional[float] = None
    status: Optional[str] = None
    net_price: Optional[float] = None
    diff: Optional[float] = None
    stock_qty: Optional[int] = None
    gr_qty: Optional[int] = None
    gr_usd: Optional[float] = None

class Part(PartBase):
    id: int
    created_at: datetime
    updated_at: datetime
    # Computed fields (not persisted): Samsung model linkage
    samsung_match_name: Optional[str] = None
    samsung_match_code: Optional[str] = None
    samsung_category: Optional[str] = None  # highend | lowend | tab | wearable
    
    class Config:
        from_attributes = True

# Formula Models
class FormulaBase(BaseModel):
    class_name: str
    labor_lvl2: Optional[float] = None
    labor_lvl3: Optional[float] = None
    # New extended fields
    labor_lvl1: Optional[float] = None
    labor_lvl2_major: Optional[float] = None
    labor_lvl2_minor: Optional[float] = None
    margin: Optional[float] = None
    total_map: Optional[float] = None
    exchange_rate: float = 1450.0
    final_price: Optional[float] = None
    # Dealer-specific overrides
    dealer_labor_lvl1: Optional[float] = None
    dealer_labor_lvl2_major: Optional[float] = None
    dealer_labor_lvl2_minor: Optional[float] = None
    dealer_labor_lvl3: Optional[float] = None
    dealer_margin: Optional[float] = None

class FormulaCreate(FormulaBase):
    pass

class FormulaUpdate(BaseModel):
    class_name: Optional[str] = None
    labor_lvl2: Optional[float] = None
    labor_lvl3: Optional[float] = None
    labor_lvl1: Optional[float] = None
    labor_lvl2_major: Optional[float] = None
    labor_lvl2_minor: Optional[float] = None
    margin: Optional[float] = None
    total_map: Optional[float] = None
    exchange_rate: Optional[float] = None
    final_price: Optional[float] = None
    # Dealer-specific overrides
    dealer_labor_lvl1: Optional[float] = None
    dealer_labor_lvl2_major: Optional[float] = None
    dealer_labor_lvl2_minor: Optional[float] = None
    dealer_labor_lvl3: Optional[float] = None
    dealer_margin: Optional[float] = None

class Formula(FormulaBase):
    id: int
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

# New Samsung models
class SamsungModelBase(BaseModel):
    model_name: str
    category: Optional[str] = None  # highend | lowend | tab | wearable
    model_code: Optional[str] = None

class SamsungModelCreate(SamsungModelBase):
    pass

class SamsungModelUpdate(BaseModel):
    model_name: Optional[str] = None
    category: Optional[str] = None
    model_code: Optional[str] = None

class SamsungModel(SamsungModelBase):
    id: int
    brand: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

# User Models
class UserBase(BaseModel):
    username: str

class UserCreate(UserBase):
    password: str
    # Optional: allow setting role/permissions at creation (admin endpoints only)
    role: Optional[str] = None
    permissions: Optional[str] = None

class UserUpdate(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[str] = None
    role: Optional[str] = None
    permissions: Optional[str] = None

class User(UserBase):
    id: int
    is_active: str
    role: Optional[str] = None
    permissions: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True

# Authentication Models
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# Search and Filter Models
class PartSearch(BaseModel):
    search: Optional[str] = None
    status: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    in_stock: Optional[bool] = None

# Price calculation model
class PartSelection(BaseModel):
    part_id: int
    qty: Optional[int] = 1

class PriceCalculation(BaseModel):
    part_id: Optional[int] = None
    formula_id: int
    parts: Optional[list[PartSelection]] = None
    # labor selection now supports: 1, 2, 3, '2_major', '2_minor'
    labor_level: Optional[str] = None  # None uses default selection rules
    # New: optional customer type for pricing adjustments ('customer'|'dealer')
    customer_type: Optional[str] = None
    # New: allow manual MAP total when parts are not available
    manual_total_map: Optional[float] = None
    manual_label: Optional[str] = None
    
class PriceResult(BaseModel):
    part_code: str
    part_codes: Optional[list[str]] = None
    base_price: float
    labor_cost: float
    margin: float
    total_map: float
    exchange_rate: float
    final_price_usd: float
    final_price_iqd: float
    formula_class: str
    labor_level_used: str

# File upload model
class ExcelUploadResponse(BaseModel):
    message: str
    parts_imported: int
    formulas_imported: int = 0
