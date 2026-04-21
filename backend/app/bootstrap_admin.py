import logging

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from .auth import get_password_hash
from .config import get_settings
from .database import SessionLocal
from .models import User

logger = logging.getLogger(__name__)


async def ensure_bootstrap_admin() -> None:
    """Crea un usuario administrador inicial si esta configurado y aun no existe."""
    settings = get_settings()
    if not settings.bootstrap_admin_enabled:
        return
    password = (settings.bootstrap_admin_password or "").strip()
    if not password:
        return
    email = (settings.bootstrap_admin_email or "").strip().lower()
    if not email:
        return
    full_name = (settings.bootstrap_admin_full_name or "Administrador").strip() or "Administrador"

    async with SessionLocal() as session:
        result = await session.execute(select(User).where(func.lower(User.email) == email))
        if result.scalar_one_or_none() is not None:
            return
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            is_active=True,
            role="admin",
            language="es",
        )
        session.add(user)
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            return
        logger.info("Usuario administrador inicial creado (email=%s). Cambia la contrasena tras el primer acceso.", email)
