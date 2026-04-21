from collections.abc import AsyncGenerator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
engine = create_async_engine(settings.database_url, future=True, echo=False)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    import logging
    logger = logging.getLogger(__name__)
    settings = get_settings()
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

        # --- Migraciones tabla users ---
        await connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true")
        )
        await connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(32) NOT NULL DEFAULT 'user'")
        )
        await connection.execute(
            text("ALTER TABLE users ADD COLUMN IF NOT EXISTS language VARCHAR(8) NOT NULL DEFAULT 'es'")
        )
        await connection.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            )
        )
        await connection.execute(
            text(
                "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
                "updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()"
            )
        )
        for email in settings.initial_admin_emails:
            await connection.execute(
                text("UPDATE users SET role = 'admin' WHERE lower(email) = lower(:email)"),
                {"email": email},
            )
        # Migracion ligera sin Alembic: nueva columna para la clave de Mistral
        # y copia del valor legado cuando exista.
        await connection.execute(
            text(
                "ALTER TABLE integration_settings "
                "ADD COLUMN IF NOT EXISTS mistral_api_key VARCHAR(255)"
            )
        )
        await connection.execute(
            text(
                "DO $$ "
                "BEGIN "
                "IF EXISTS ("
                "    SELECT 1 "
                "    FROM information_schema.columns "
                "    WHERE table_name = 'integration_settings' "
                "    AND column_name = 'ocr_space_api_key'"
                ") THEN "
                "    UPDATE integration_settings "
                "    SET mistral_api_key = COALESCE(NULLIF(mistral_api_key, ''), ocr_space_api_key) "
                "    WHERE COALESCE(NULLIF(mistral_api_key, ''), '') = '' "
                "    AND COALESCE(NULLIF(ocr_space_api_key, ''), '') <> ''; "
                "END IF; "
                "END $$;"
            )
        )
        # Bases creadas antes de anadir odoo_employee_id: asegurar columna sin Alembic
        await connection.execute(
            text(
                "ALTER TABLE integration_settings "
                "ADD COLUMN IF NOT EXISTS odoo_employee_id INTEGER"
            )
        )
        await connection.execute(
            text(
                "ALTER TABLE integration_settings "
                "ADD COLUMN IF NOT EXISTS odoo_expense_product_id INTEGER"
            )
        )
        await connection.execute(
            text("ALTER TABLE integration_settings ALTER COLUMN mistral_api_key TYPE TEXT")
        )
        await connection.execute(
            text("ALTER TABLE integration_settings ALTER COLUMN odoo_api_key TYPE TEXT")
        )
        await connection.execute(
            text(
                """
                CREATE TABLE IF NOT EXISTS password_reset_tokens (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    token_hash VARCHAR(64) NOT NULL,
                    expires_at TIMESTAMPTZ NOT NULL,
                    used_at TIMESTAMPTZ,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
                """
            )
        )
        await connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_user_id "
                "ON password_reset_tokens (user_id)"
            )
        )
        await connection.execute(
            text(
                "CREATE INDEX IF NOT EXISTS ix_password_reset_tokens_token_hash "
                "ON password_reset_tokens (token_hash)"
            )
        )
