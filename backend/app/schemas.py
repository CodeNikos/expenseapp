from datetime import date, datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class UserCreate(BaseModel):
    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)


class AdminUserCreate(BaseModel):
    """Alta de usuario desde panel admin (permite rol)."""

    email: EmailStr
    full_name: str = Field(min_length=2, max_length=255)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["user", "admin"] = "user"


class UserLogin(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str = Field(min_length=10, max_length=500)
    password: str = Field(min_length=8, max_length=128)


class MessageResponse(BaseModel):
    message: str


class UserLanguageUpdate(BaseModel):
    language: Literal["es", "en"]


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    is_active: bool
    role: str
    language: str
    created_at: datetime


class AdminUserListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str
    role: str
    has_mistral_api_key: bool = False
    has_odoo_api_key: bool = False


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead


class IntegrationSettingsBase(BaseModel):
    mistral_api_key: str = ""
    odoo_url: str = ""
    odoo_db: str = ""
    odoo_login: str = ""
    odoo_api_key: str = ""
    odoo_expense_model: str = "hr.expense"
    odoo_employee_id: int | None = None
    odoo_expense_product_id: int | None = None

    @field_validator("odoo_employee_id", "odoo_expense_product_id", mode="before")
    @classmethod
    def empty_optional_odoo_int(cls, value):
        if value in ("", None):
            return None
        return value


class IntegrationSettingsUpdate(IntegrationSettingsBase):
    pass


class IntegrationSettingsRead(IntegrationSettingsBase):
    has_mistral_api_key: bool = False
    has_odoo_api_key: bool = False


class ExpenseDraft(BaseModel):
    vendor_name: str | None = None
    invoice_number: str | None = None
    invoice_date: date | None = None
    currency: str | None = "PAB"
    total_amount: Decimal | None = None
    tax_amount: Decimal | None = None
    notes: str | None = None

    @field_validator("vendor_name", "invoice_number", "notes", mode="before")
    @classmethod
    def empty_strings_to_none(cls, value):
        if value == "":
            return None
        return value

    @field_validator("invoice_date", mode="before")
    @classmethod
    def normalize_date(cls, value):
        if value in ("", None):
            return None
        return value

    @field_validator("total_amount", "tax_amount", mode="before")
    @classmethod
    def normalize_decimals(cls, value):
        if value in ("", None):
            return None
        return value

    @field_validator("currency", mode="before")
    @classmethod
    def normalize_currency(cls, value):
        if value in ("", None):
            return "PAB"
        return str(value).upper()


class ExpenseRead(ExpenseDraft):
    model_config = ConfigDict(from_attributes=True)

    id: int
    raw_ocr_text: str | None = None
    odoo_synced: bool
    odoo_id: int | None = None
    odoo_error: str | None = None
    created_at: datetime


class ExpenseProcessPayload(BaseModel):
    process_only: bool = False
    expense: ExpenseDraft = Field(default_factory=ExpenseDraft)


class OCRResult(BaseModel):
    raw_text: str
    extracted_expense: ExpenseDraft


class ExpenseProcessResponse(BaseModel):
    message: str
    extracted_expense: ExpenseDraft
    expense: ExpenseRead | None = None
    raw_text: str


class ExpenseActionResponse(BaseModel):
    message: str
    expense: ExpenseRead | None = None


class OdooConnectionTestResponse(BaseModel):
    detail: str
    uid: int | None = None
