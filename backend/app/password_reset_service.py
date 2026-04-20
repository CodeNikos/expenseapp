import hashlib
import logging
import secrets
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from .config import get_settings
from .email_service import send_password_reset_email
from .models import PasswordResetToken, User

logger = logging.getLogger(__name__)

PASSWORD_RESET_GENERIC_OK = (
    "Si el correo esta registrado, recibiras un enlace para restablecer la contrasena."
)
PASSWORD_RESET_SUCCESS = "Contrasena actualizada correctamente. Ya puedes iniciar sesion."
PASSWORD_RESET_INVALID = "Enlace invalido o expirado."


def _hash_token(plain_token: str) -> str:
    return hashlib.sha256(plain_token.encode("utf-8")).hexdigest()


def _reset_link(plain_token: str) -> str:
    settings = get_settings()
    base = settings.public_frontend_url.strip().rstrip("/")
    return f"{base}/reset-password?token={quote(plain_token, safe='')}"


async def create_and_send_reset(session: AsyncSession, user: User) -> None:
    settings = get_settings()
    await session.execute(
        delete(PasswordResetToken).where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.used_at.is_(None),
        )
    )
    plain = secrets.token_urlsafe(32)
    token_hash = _hash_token(plain)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.password_reset_ttl_minutes)
    row = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=expires_at,
    )
    session.add(row)
    await session.flush()
    reset_url = _reset_link(plain)
    try:
        await send_password_reset_email(user.email, reset_url)
    except Exception:
        await session.rollback()
        logger.exception("Fallo al enviar correo de recuperacion de contrasena")
        return
    await session.commit()


async def request_password_reset(session: AsyncSession, email: str) -> str:
    result = await session.execute(select(User).where(User.email == email.lower().strip()))
    user = result.scalar_one_or_none()
    if user and user.is_active:
        await create_and_send_reset(session, user)
    else:
        # Misma respuesta que si existiera (anti enumeracion); no revelar estado.
        pass
    return PASSWORD_RESET_GENERIC_OK


async def reset_password_with_token(session: AsyncSession, plain_token: str, new_password: str) -> str:
    if not plain_token.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSWORD_RESET_INVALID)
    token_hash = _hash_token(plain_token.strip())
    result = await session.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    row = result.scalars().first()
    now = datetime.now(timezone.utc)
    if (
        row is None
        or row.used_at is not None
        or row.expires_at <= now
    ):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSWORD_RESET_INVALID)

    user_result = await session.execute(select(User).where(User.id == row.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=PASSWORD_RESET_INVALID)

    from .auth import get_password_hash

    user.hashed_password = get_password_hash(new_password)
    row.used_at = now
    await session.commit()
    return PASSWORD_RESET_SUCCESS
