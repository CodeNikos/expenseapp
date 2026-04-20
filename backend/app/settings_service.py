from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import IntegrationSettings, User
from .schemas import IntegrationSettingsRead, IntegrationSettingsUpdate
from .secrets_crypto import decrypt_secret, encrypt_secret, secret_is_set


async def get_or_create_settings(session: AsyncSession, user: User) -> IntegrationSettings:
    result = await session.execute(select(IntegrationSettings).where(IntegrationSettings.user_id == user.id))
    settings = result.scalar_one_or_none()

    if settings:
        return settings

    settings = IntegrationSettings(user_id=user.id, odoo_expense_model="hr.expense")
    session.add(settings)
    await session.flush()
    return settings


async def read_settings(session: AsyncSession, user: User) -> IntegrationSettingsRead:
    settings = await get_or_create_settings(session, user)
    return IntegrationSettingsRead(
        mistral_api_key="",
        odoo_url=settings.odoo_url or "",
        odoo_db=settings.odoo_db or "",
        odoo_login=settings.odoo_login or "",
        odoo_api_key="",
        odoo_expense_model=settings.odoo_expense_model or "hr.expense",
        odoo_employee_id=settings.odoo_employee_id,
        odoo_expense_product_id=settings.odoo_expense_product_id,
        has_mistral_api_key=secret_is_set(settings.mistral_api_key),
        has_odoo_api_key=secret_is_set(settings.odoo_api_key),
    )


async def upsert_settings(
    session: AsyncSession,
    user: User,
    payload: IntegrationSettingsUpdate,
) -> IntegrationSettingsRead:
    settings = await get_or_create_settings(session, user)

    new_mistral = (payload.mistral_api_key or "").strip()
    if new_mistral:
        settings.mistral_api_key = encrypt_secret(new_mistral)

    settings.odoo_url = payload.odoo_url.strip() or settings.odoo_url
    settings.odoo_db = payload.odoo_db.strip() or settings.odoo_db
    settings.odoo_login = payload.odoo_login.strip() or settings.odoo_login

    new_odoo_key = (payload.odoo_api_key or "").strip()
    if new_odoo_key:
        settings.odoo_api_key = encrypt_secret(new_odoo_key)

    settings.odoo_expense_model = payload.odoo_expense_model.strip() or "hr.expense"
    settings.odoo_employee_id = payload.odoo_employee_id
    settings.odoo_expense_product_id = payload.odoo_expense_product_id

    await session.commit()
    await session.refresh(settings)

    return await read_settings(session, user)


def ensure_ocr_ready(settings: IntegrationSettings) -> None:
    if not (decrypt_secret(settings.mistral_api_key) or "").strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debes configurar la API de Mistral antes de procesar facturas.",
        )


def ensure_odoo_ready(settings: IntegrationSettings) -> None:
    def norm(v: str | None) -> str:
        return (v or "").strip()

    missing = [
        field_name
        for field_name, value in {
            "odoo_url": norm(settings.odoo_url),
            "odoo_db": norm(settings.odoo_db),
            "odoo_login": norm(settings.odoo_login),
            "odoo_api_key": norm(decrypt_secret(settings.odoo_api_key)),
        }.items()
        if not value
    ]

    if missing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Faltan credenciales de Odoo: {', '.join(missing)}.",
        )
