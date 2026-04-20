"""Cifrado simétrico por campo (Fernet) para secretos en integration_settings."""

from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status

FERNET_FIELD_PREFIX = "f1:"


@lru_cache
def _fernets() -> list[Fernet]:
    from .config import get_settings

    materials = get_settings().secrets_encryption_key_materials
    fernets: list[Fernet] = []
    for key_str in materials:
        try:
            fernets.append(Fernet(key_str.encode("ascii")))
        except (ValueError, TypeError) as exc:
            raise ValueError(
                "SECRETS_ENCRYPTION_KEYS debe contener una o mas claves Fernet validas "
                "(genera con: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\")",
            ) from exc
    return fernets


def secret_is_set(stored: str | None) -> bool:
    return bool(stored and str(stored).strip())


def encrypt_secret(plain: str | None) -> str | None:
    if plain is None:
        return None
    cleaned = plain.strip()
    if not cleaned:
        return None
    fernets = _fernets()
    if not fernets:
        return cleaned
    token = fernets[0].encrypt(cleaned.encode("utf-8"))
    return FERNET_FIELD_PREFIX + token.decode("ascii")


def decrypt_secret(stored: str | None) -> str | None:
    if stored is None:
        return None
    raw = str(stored).strip()
    if not raw:
        return None
    if not raw.startswith(FERNET_FIELD_PREFIX):
        return raw
    token_b = raw[len(FERNET_FIELD_PREFIX) :].encode("ascii")
    fernets = _fernets()
    if not fernets:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Hay credenciales cifradas en base de datos pero SECRETS_ENCRYPTION_KEYS no esta configurada.",
        )
    last_error: InvalidToken | None = None
    for f in fernets:
        try:
            return f.decrypt(token_b).decode("utf-8")
        except InvalidToken as exc:
            last_error = exc
            continue
    raise HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail="No se pudo descifrar una credencial (clave de cifrado incorrecta o datos corruptos).",
    ) from last_error


def warm_encryption_config() -> None:
    """Valida SECRETS_ENCRYPTION_KEYS al arranque si esta definida (falla rapido con clave invalida)."""
    from .config import get_settings

    if not get_settings().secrets_encryption_key_materials:
        return
    _fernets.cache_clear()
    _fernets()
