import json
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI, File, Form, HTTPException, Query, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import desc, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from . import models  # noqa: F401
from .auth import authenticate_user, create_access_token, get_current_admin, get_current_user, get_password_hash
from .bootstrap_admin import ensure_bootstrap_admin
from .config import get_settings
from .database import get_db, init_db
from .secrets_crypto import decrypt_secret, secret_is_set, warm_encryption_config
from .models import Expense, IntegrationSettings, User
from .ocr import extract_text_from_image, parse_receipt_text
from .odoo_client import authenticate_odoo, create_odoo_expense
from .password_reset_service import request_password_reset, reset_password_with_token
from .schemas import (
    AdminUserCreate,
    AdminUserListItem,
    ExpenseActionResponse,
    ExpenseProcessPayload,
    ExpenseProcessResponse,
    ExpenseRead,
    IntegrationSettingsRead,
    IntegrationSettingsUpdate,
    MessageResponse,
    OdooConnectionTestResponse,
    OCRResult,
    PasswordResetConfirm,
    PasswordResetRequest,
    TokenResponse,
    UserCreate,
    UserLanguageUpdate,
    UserLogin,
    UserRead,
)
from .settings_service import ensure_odoo_ready, ensure_ocr_ready, get_or_create_settings, read_settings, upsert_settings

logger = logging.getLogger(__name__)

settings = get_settings()


def _resolve_static_root() -> Path | None:
    """Directorio con index.html del frontend (build Vite). None = solo API."""
    raw = (settings.static_files_dir or "").strip()
    candidates: list[Path] = []
    if raw:
        candidates.append(Path(raw))
    candidates.append(Path(__file__).resolve().parent.parent / "static")
    for p in candidates:
        try:
            resolved = p.resolve()
            if resolved.is_dir() and (resolved / "index.html").is_file():
                return resolved
        except OSError:
            continue
    return None


STATIC_ROOT = _resolve_static_root()


def _safe_file_under_dir(base: Path, relative: str) -> Path | None:
    """Devuelve ruta a archivo bajo base si existe y no hay path traversal."""
    if not relative or ".." in Path(relative).parts:
        return None
    candidate = (base / relative).resolve()
    try:
        candidate.relative_to(base.resolve())
    except ValueError:
        return None
    return candidate if candidate.is_file() else None


@asynccontextmanager
async def lifespan(_: FastAPI):
    if STATIC_ROOT is not None:
        logger.info("Sirviendo SPA desde %s", STATIC_ROOT)
    else:
        logger.warning(
            "No hay build del frontend (falta static/index.html). "
            "Copia el contenido de frontend/dist a backend/static o define STATIC_FILES_DIR. "
            "GET / seguira respondiendo JSON hasta entonces."
        )
    await init_db()
    await ensure_bootstrap_admin()
    warm_encryption_config()
    yield


app = FastAPI(title=settings.app_name, lifespan=lifespan)
# CORS: lista desde .env + regex para dev (Vite en cualquier puerto, localhost vs 127.0.0.1).
# En produccion incluye el origen publico del frontend en CORS_ORIGINS (https://..., sin barra final).
# Sin esto el navegador puede mostrar error CORS aunque el backend responda.
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def merge_expense_payload(extracted, overrides):
    base = extracted.model_dump()
    for key, value in overrides.model_dump(exclude_none=True).items():
        if value not in ("", None):
            base[key] = value
    return base


def build_runtime_settings(stored: IntegrationSettings, payload: IntegrationSettingsUpdate) -> IntegrationSettings:
    employee_id = payload.odoo_employee_id
    if employee_id is None:
        employee_id = stored.odoo_employee_id
    product_id = payload.odoo_expense_product_id
    if product_id is None:
        product_id = stored.odoo_expense_product_id
    mistral_plain = payload.mistral_api_key.strip() or (decrypt_secret(stored.mistral_api_key) or "")
    odoo_key_plain = payload.odoo_api_key.strip() or (decrypt_secret(stored.odoo_api_key) or "")
    return IntegrationSettings(
        user_id=stored.user_id,
        mistral_api_key=mistral_plain,
        odoo_url=payload.odoo_url.strip() or stored.odoo_url,
        odoo_db=payload.odoo_db.strip() or stored.odoo_db,
        odoo_login=payload.odoo_login.strip() or stored.odoo_login,
        odoo_api_key=odoo_key_plain,
        odoo_expense_model=payload.odoo_expense_model.strip() or stored.odoo_expense_model,
        odoo_employee_id=employee_id,
        odoo_expense_product_id=product_id,
    )


def format_http_exception_detail(detail: object) -> str:
    if isinstance(detail, str):
        return detail
    if isinstance(detail, list):
        parts = []
        for item in detail:
            if isinstance(item, dict) and item.get("msg"):
                parts.append(str(item["msg"]))
            else:
                parts.append(str(item))
        return "; ".join(parts)
    return str(detail)


async def get_user_expense_or_404(session: AsyncSession, user_id: int, expense_id: int) -> Expense:
    expense = await session.get(Expense, expense_id)
    if not expense or expense.user_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontro el gasto solicitado.")
    return expense


async def get_target_user_or_404(session: AsyncSession, user_id: int) -> User:
    result = await session.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No se encontro el usuario solicitado.")
    return target


if STATIC_ROOT is None:

    @app.get("/")
    async def root():
        """Sin build del frontend: respuesta JSON en la raiz (probes, etc.)."""
        return {
            "service": settings.app_name,
            "health": "/api/health",
            "docs": "/docs",
        }


@app.get("/api/health")
async def healthcheck():
    return {"status": "ok"}


@app.post("/api/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: UserCreate, session: AsyncSession = Depends(get_db)):
    if not settings.allow_open_registration:
        count_result = await session.execute(select(func.count(User.id)))
        total_users = count_result.scalar_one()
        if total_users > 0:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="El registro abierto esta deshabilitado.",
            )

    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        is_active=True,
        role="user",
        language="es",
    )
    session.add(user)

    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo.",
        ) from exc

    await session.refresh(user)
    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=user)


@app.post("/api/auth/login", response_model=TokenResponse)
async def login(payload: UserLogin, session: AsyncSession = Depends(get_db)):
    user = await authenticate_user(session, payload.email.lower(), payload.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales invalidas.",
        )

    token = create_access_token(str(user.id))
    return TokenResponse(access_token=token, user=user)


@app.get("/api/auth/me", response_model=UserRead)
async def me(current_user: User = Depends(get_current_user)):
    return current_user


@app.put("/api/auth/language", response_model=UserRead)
async def update_user_language(
    payload: UserLanguageUpdate,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    current_user.language = payload.language
    await session.commit()
    await session.refresh(current_user)
    return current_user


@app.post("/api/auth/request-password-reset", response_model=MessageResponse)
async def auth_request_password_reset(
    payload: PasswordResetRequest,
    session: AsyncSession = Depends(get_db),
):
    message = await request_password_reset(session, payload.email)
    return MessageResponse(message=message)


@app.post("/api/auth/reset-password", response_model=MessageResponse)
async def auth_reset_password(
    payload: PasswordResetConfirm,
    session: AsyncSession = Depends(get_db),
):
    message = await reset_password_with_token(session, payload.token, payload.password)
    return MessageResponse(message=message)


@app.get("/api/settings/integrations", response_model=IntegrationSettingsRead)
async def get_integrations(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    return await read_settings(session, current_user)


@app.put("/api/settings/integrations", response_model=IntegrationSettingsRead)
async def save_integrations(
    payload: IntegrationSettingsUpdate,
    admin_user: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    return await upsert_settings(session, admin_user, payload)


@app.post("/api/settings/test-odoo", response_model=OdooConnectionTestResponse)
async def test_odoo(
    payload: IntegrationSettingsUpdate,
    admin_user: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    stored_settings = await get_or_create_settings(session, admin_user)
    runtime_settings = build_runtime_settings(stored_settings, payload)
    ensure_odoo_ready(runtime_settings)
    uid = await authenticate_odoo(runtime_settings)
    return OdooConnectionTestResponse(detail="Conexion con Odoo validada.", uid=uid)


@app.get("/api/admin/users", response_model=list[AdminUserListItem])
async def admin_list_users(
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    try:
        result = await session.execute(
            select(User).options(selectinload(User.integration_settings)).order_by(User.email),
        )
        users = result.scalars().unique().all()
    except Exception as exc:
        logger.exception("Error al listar usuarios: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error interno al obtener usuarios: {exc}",
        ) from exc

    items: list[AdminUserListItem] = []
    for u in users:
        integration = u.integration_settings
        items.append(
            AdminUserListItem(
                id=u.id,
                email=u.email,
                full_name=u.full_name,
                role=u.role,
                has_mistral_api_key=secret_is_set(integration.mistral_api_key) if integration else False,
                has_odoo_api_key=secret_is_set(integration.odoo_api_key) if integration else False,
            ),
        )
    return items


@app.post("/api/admin/users", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def admin_create_user(
    payload: AdminUserCreate,
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    """Crea un usuario con rol user o admin (ignora ALLOW_OPEN_REGISTRATION)."""
    user = User(
        email=payload.email.lower(),
        full_name=payload.full_name.strip(),
        hashed_password=get_password_hash(payload.password),
        is_active=True,
        role=payload.role,
        language="es",
    )
    session.add(user)
    try:
        await session.commit()
    except IntegrityError as exc:
        await session.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese correo.",
        ) from exc
    await session.refresh(user)
    return user


@app.get("/api/admin/users/{user_id}/integrations", response_model=IntegrationSettingsRead)
async def admin_get_user_integrations(
    user_id: int,
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    target = await get_target_user_or_404(session, user_id)
    return await read_settings(session, target)


@app.put("/api/admin/users/{user_id}/integrations", response_model=IntegrationSettingsRead)
async def admin_save_user_integrations(
    user_id: int,
    payload: IntegrationSettingsUpdate,
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    target = await get_target_user_or_404(session, user_id)
    return await upsert_settings(session, target, payload)


@app.post("/api/admin/users/{user_id}/test-odoo", response_model=OdooConnectionTestResponse)
async def admin_test_user_odoo(
    user_id: int,
    payload: IntegrationSettingsUpdate,
    _: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_db),
):
    target = await get_target_user_or_404(session, user_id)
    stored_settings = await get_or_create_settings(session, target)
    runtime_settings = build_runtime_settings(stored_settings, payload)
    ensure_odoo_ready(runtime_settings)
    uid = await authenticate_odoo(runtime_settings)
    return OdooConnectionTestResponse(detail="Conexion con Odoo validada.", uid=uid)


@app.get("/api/expenses", response_model=list[ExpenseRead])
async def list_user_expenses(
    limit: int = Query(100, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    result = await session.execute(
        select(Expense)
        .where(Expense.user_id == current_user.id)
        .order_by(desc(Expense.created_at))
        .limit(limit)
    )
    return list(result.scalars().all())


@app.delete("/api/expenses/{expense_id}", response_model=ExpenseActionResponse)
async def delete_user_expense(
    expense_id: int,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    expense = await get_user_expense_or_404(session, current_user.id, expense_id)
    if expense.odoo_synced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No puedes eliminar un gasto que ya fue sincronizado con Odoo.",
        )

    await session.delete(expense)
    await session.commit()
    return ExpenseActionResponse(message="Registro pendiente eliminado correctamente.")


@app.post("/api/expenses/{expense_id}/sync-odoo", response_model=ExpenseActionResponse)
async def retry_expense_odoo_sync(
    expense_id: int,
    file: UploadFile | None = File(default=None),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    expense = await get_user_expense_or_404(session, current_user.id, expense_id)
    if expense.odoo_synced:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Este gasto ya fue sincronizado con Odoo.",
        )

    file_bytes: bytes | None = None
    if file is not None:
        if not file.content_type or not file.content_type.startswith("image/"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Solo se permiten archivos de imagen.",
            )
        file_bytes = await file.read()
        if len(file_bytes) > 5 * 1024 * 1024:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="La imagen excede el limite de 5 MB.",
            )

    integration_settings = await get_or_create_settings(session, current_user)
    ensure_odoo_ready(integration_settings)

    try:
        odoo_id = await create_odoo_expense(
            integration_settings,
            expense,
            receipt_bytes=file_bytes,
            receipt_filename=file.filename if file and file.filename else "receipt.jpg",
            receipt_content_type=file.content_type if file else None,
        )
        expense.odoo_id = odoo_id
        expense.odoo_synced = True
        expense.odoo_error = None
        message = "Gasto sincronizado correctamente con Odoo."
    except HTTPException as exc:
        expense.odoo_synced = False
        err_text = format_http_exception_detail(exc.detail)
        expense.odoo_error = err_text
        message = f"No se pudo sincronizar el gasto con Odoo. Motivo: {err_text}"

    await session.commit()
    await session.refresh(expense)
    return ExpenseActionResponse(message=message, expense=expense)


@app.post("/api/expenses/process", response_model=ExpenseProcessResponse)
async def process_expense(
    file: UploadFile = File(...),
    payload: str = Form("{}"),
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Solo se permiten archivos de imagen.",
        )

    file_bytes = await file.read()
    if len(file_bytes) > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La imagen excede el limite de 5 MB.",
        )

    try:
        parsed_payload = ExpenseProcessPayload.model_validate(json.loads(payload))
    except (json.JSONDecodeError, ValueError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El campo payload no contiene JSON valido.",
        ) from exc

    integration_settings = await get_or_create_settings(session, current_user)
    ensure_ocr_ready(integration_settings)

    raw_text = await extract_text_from_image(
        file_bytes,
        file.filename or "receipt.jpg",
        file.content_type or "image/jpeg",
        decrypt_secret(integration_settings.mistral_api_key) or "",
    )
    extracted = parse_receipt_text(raw_text)
    merged_expense = merge_expense_payload(extracted, parsed_payload.expense)

    if parsed_payload.process_only:
        return ExpenseProcessResponse(
            message="OCR completado correctamente.",
            extracted_expense=merged_expense,
            raw_text=raw_text,
        )

    expense = Expense(
        user_id=current_user.id,
        raw_ocr_text=raw_text,
        **merged_expense,
    )
    session.add(expense)
    await session.flush()

    message = "Gasto guardado localmente."

    try:
        ensure_odoo_ready(integration_settings)
        odoo_id = await create_odoo_expense(
            integration_settings,
            expense,
            receipt_bytes=file_bytes,
            receipt_filename=file.filename or "receipt.jpg",
            receipt_content_type=file.content_type,
        )
        expense.odoo_id = odoo_id
        expense.odoo_synced = True
        expense.odoo_error = None
        message = "Gasto guardado y sincronizado con Odoo."
    except HTTPException as exc:
        expense.odoo_synced = False
        err_text = format_http_exception_detail(exc.detail)
        expense.odoo_error = err_text
        message = (
            "Gasto guardado localmente, pero la sincronizacion con Odoo fallo. "
            f"Motivo: {err_text}"
        )

    await session.commit()
    await session.refresh(expense)

    return ExpenseProcessResponse(
        message=message,
        extracted_expense=merged_expense,
        expense=expense,
        raw_text=raw_text,
    )


if STATIC_ROOT is not None:
    # /assets lo sirve Vite; el fallback SPA evita 404 en /login, /history, etc. (produccion).
    # Un solo StaticFiles(html=True) en "/" falla a menudo tras proxies o con el orden de rutas.
    _assets = STATIC_ROOT / "assets"
    if _assets.is_dir():
        app.mount("/assets", StaticFiles(directory=str(_assets)), name="vite_assets")

    @app.get("/")
    async def spa_index():
        return FileResponse(STATIC_ROOT / "index.html")

    @app.get("/{full_path:path}")
    async def spa_serve(full_path: str):
        if full_path.startswith("api/") or full_path == "api":
            raise HTTPException(status_code=404, detail="Not Found")
        existing = _safe_file_under_dir(STATIC_ROOT, full_path)
        if existing is not None:
            return FileResponse(existing)
        return FileResponse(STATIC_ROOT / "index.html")
