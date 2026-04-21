from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Expense OCR API"
    database_url: str = Field(..., alias="DATABASE_URL")
    jwt_secret_key: str = Field(..., alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    access_token_expire_minutes: int = Field(60 * 12, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    cors_origins_raw: str = Field(
        "http://web-1drint8y5f1s-service",
        alias="CORS_ORIGINS",
    )
    allow_open_registration: bool = Field(True, alias="ALLOW_OPEN_REGISTRATION")
    mistral_ocr_url: str = Field("https://api.mistral.ai/v1/ocr", alias="MISTRAL_OCR_URL")
    mistral_ocr_model: str = Field("mistral-ocr-latest", alias="MISTRAL_OCR_MODEL")
    initial_admin_emails_raw: str = Field("", alias="INITIAL_ADMIN_EMAILS")
    secrets_encryption_keys_raw: str = Field("", alias="SECRETS_ENCRYPTION_KEYS")
    public_frontend_url: str = Field("https://web-1drint8y5f1s.up-de-fra1-k8s-1.apps.run-on-seenode.com/", alias="PUBLIC_FRONTEND_URL")
    password_reset_ttl_minutes: int = Field(60, alias="PASSWORD_RESET_TTL_MINUTES", ge=5, le=10080)
    smtp_host: str = Field("", alias="SMTP_HOST")
    smtp_port: int = Field(587, alias="SMTP_PORT", ge=1, le=65535)
    smtp_user: str = Field("", alias="SMTP_USER")
    smtp_password: str = Field("", alias="SMTP_PASSWORD")
    smtp_from: str = Field("", alias="SMTP_FROM")
    smtp_use_tls: bool = Field(True, alias="SMTP_USE_TLS")
    # Carpeta con el build de Vite (index.html, assets/). Vacio = no servir SPA desde la API.
    static_files_dir: str = Field("", alias="STATIC_FILES_DIR")
    # Usuario admin creado al arrancar si no existe (primer deploy). Desactivar en prod tras configurar.
    bootstrap_admin_enabled: bool = Field(True, alias="BOOTSTRAP_ADMIN_ENABLED")
    bootstrap_admin_email: str = Field("admin01@expenseapp.local", alias="BOOTSTRAP_ADMIN_EMAIL")
    bootstrap_admin_password: str = Field("admin001", alias="BOOTSTRAP_ADMIN_PASSWORD")
    bootstrap_admin_full_name: str = Field("Administrador", alias="BOOTSTRAP_ADMIN_FULL_NAME")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins_raw.split(",") if origin.strip()]

    @property
    def initial_admin_emails(self) -> list[str]:
        raw = (self.initial_admin_emails_raw or "").strip()
        if not raw:
            return []
        return [part.strip().lower() for part in raw.split(",") if part.strip()]

    @property
    def secrets_encryption_key_materials(self) -> list[str]:
        """Claves Fernet (url-safe base64, 32 bytes). La primera se usa para cifrar; al descifrar se prueba cada una."""
        raw = (self.secrets_encryption_keys_raw or "").strip()
        if not raw:
            return []
        return [part.strip() for part in raw.split(",") if part.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
