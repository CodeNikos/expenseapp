import base64
import mimetypes
from decimal import Decimal

import httpx
from fastapi import HTTPException, status

from .models import Expense, IntegrationSettings
from .secrets_crypto import decrypt_secret

DEFAULT_EXPENSE_PRODUCT_CODE = "EXP_GEN"


def _plain_odoo_api_key(settings: IntegrationSettings) -> str:
    return (decrypt_secret(settings.odoo_api_key) or "").strip()


def resolve_odoo_jsonrpc_url(raw: str | None) -> str:
    """Construye la URL JSON-RPC de Odoo. Añade https:// si el usuario solo escribio el dominio."""
    if raw is None or not str(raw).strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Odoo URL vacia. Ejemplo: https://miempresa.odoo.com",
        )
    base = str(raw).strip().rstrip("/")
    if not base.startswith(("http://", "https://")):
        base = f"https://{base}"
    return f"{base}/jsonrpc"


async def _json_rpc(url: str, params: dict) -> dict:
    payload = {
        "jsonrpc": "2.0",
        "method": "call",
        "params": params,
        "id": 1,
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(url, json=payload)
    except httpx.UnsupportedProtocol as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Odoo URL invalida: debe empezar por http:// o https:// (ej. https://miempresa.odoo.com).",
        ) from exc
    except httpx.RequestError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"No se pudo conectar con Odoo: {exc!s}",
        ) from exc

    if response.status_code >= 400:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Odoo no respondio correctamente.",
        )

    data = response.json()

    if data.get("error"):
        detail = _extract_odoo_rpc_error(data["error"])
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )

    return data


def _extract_odoo_rpc_error(error_block: dict) -> str:
    """Extrae un mensaje legible del bloque error de JSON-RPC de Odoo."""
    data = error_block.get("data") or {}
    if isinstance(data, dict):
        if data.get("message"):
            return str(data["message"])
        args = data.get("arguments")
        if args:
            if isinstance(args, (list, tuple)) and args:
                return "; ".join(str(a) for a in args)
            return str(args)
        if data.get("debug") and isinstance(data["debug"], str):
            first = data["debug"].split("\n")[0][:500]
            return first
    msg = error_block.get("message")
    if msg:
        return str(msg)
    return "Error al invocar JSON-RPC en Odoo."


async def authenticate_odoo(settings: IntegrationSettings) -> int:
    jsonrpc_url = resolve_odoo_jsonrpc_url(settings.odoo_url)
    response = await _json_rpc(
        jsonrpc_url,
        {
            "service": "common",
            "method": "authenticate",
            "args": [
                settings.odoo_db,
                settings.odoo_login,
                _plain_odoo_api_key(settings),
                {},
            ],
        },
    )
    uid = response.get("result")

    if not uid:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="No fue posible autenticarse contra Odoo.",
        )

    return uid


async def odoo_execute_kw(
    settings: IntegrationSettings,
    uid: int,
    model: str,
    method: str,
    args: list,
    kwargs: dict | None = None,
) -> object:
    jsonrpc_url = resolve_odoo_jsonrpc_url(settings.odoo_url)
    rpc_args: list = [
        settings.odoo_db,
        uid,
        _plain_odoo_api_key(settings),
        model,
        method,
        args,
        kwargs if kwargs is not None else {},
    ]
    response = await _json_rpc(
        jsonrpc_url,
        {
            "service": "object",
            "method": "execute_kw",
            "args": rpc_args,
        },
    )
    return response.get("result")


def _decimal_to_float(value: Decimal | None) -> float:
    return float(value) if value is not None else 0.0


async def resolve_expense_product_id(settings: IntegrationSettings, uid: int) -> int:
    """product_id en hr.expense: producto gastable [EXP_GEN] Expenses u otro configurado."""
    if settings.odoo_expense_product_id:
        return settings.odoo_expense_product_id

    domain_code = [["default_code", "=", DEFAULT_EXPENSE_PRODUCT_CODE], ["can_be_expensed", "=", True]]
    found = await odoo_execute_kw(
        settings,
        uid,
        "product.product",
        "search",
        [domain_code],
        {"limit": 1},
    )
    if isinstance(found, list) and found:
        return int(found[0])

    domain_name = [["can_be_expensed", "=", True], ["name", "ilike", "Expenses"]]
    found = await odoo_execute_kw(
        settings,
        uid,
        "product.product",
        "search",
        [domain_name],
        {"limit": 1},
    )
    if isinstance(found, list) and found:
        return int(found[0])

    raise HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=(
            f"No se encontro un producto de gasto con referencia interna '{DEFAULT_EXPENSE_PRODUCT_CODE}' "
            "(categoria tipo [EXP_GEN] Expenses). Indica el ID del producto en ajustes (Odoo: Gastos > Configuracion > Categorias de gastos)."
        ),
    )


def build_odoo_vals(expense: Expense, settings: IntegrationSettings, product_id: int) -> dict:
    """Campos minimos para hr.expense (Odoo 19: importe en total_amount, no unit_amount)."""
    description = expense.vendor_name or "Expense OCR"
    name = description
    if expense.invoice_number:
        name = f"{description} — Fact. {expense.invoice_number}"

    vals: dict = {
        "name": name,
        "product_id": product_id,
        "quantity": 1.0,
        "total_amount": _decimal_to_float(expense.total_amount),
    }
    if expense.invoice_date:
        vals["date"] = expense.invoice_date.isoformat()
    if settings.odoo_employee_id:
        vals["employee_id"] = settings.odoo_employee_id
    return vals


async def _attach_receipt_to_expense(
    settings: IntegrationSettings,
    uid: int,
    expense_model: str,
    expense_odoo_id: int,
    image_bytes: bytes,
    filename: str,
    content_type: str | None,
) -> None:
    safe_name = filename.strip() or "receipt.jpg"
    mimetype = content_type or mimetypes.guess_type(safe_name)[0] or "image/jpeg"
    vals = {
        "name": safe_name,
        "type": "binary",
        "datas": base64.b64encode(image_bytes).decode("ascii"),
        "res_model": expense_model,
        "res_id": expense_odoo_id,
        "mimetype": mimetype,
    }
    att_id = await odoo_execute_kw(settings, uid, "ir.attachment", "create", [vals], {})
    if not att_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Odoo no creo el adjunto del recibo.",
        )


async def create_odoo_expense(
    settings: IntegrationSettings,
    expense: Expense,
    *,
    receipt_bytes: bytes | None = None,
    receipt_filename: str = "receipt.jpg",
    receipt_content_type: str | None = None,
) -> int:
    uid = await authenticate_odoo(settings)
    product_id = await resolve_expense_product_id(settings, uid)
    expense_model = settings.odoo_expense_model or "hr.expense"
    vals = build_odoo_vals(expense, settings, product_id)

    expense_id = await odoo_execute_kw(settings, uid, expense_model, "create", [vals], {})

    if not expense_id:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Odoo no devolvio un id de gasto valido.",
        )

    eid = int(expense_id)
    if receipt_bytes:
        await _attach_receipt_to_expense(
            settings,
            uid,
            expense_model,
            eid,
            receipt_bytes,
            receipt_filename,
            receipt_content_type,
        )

    return eid
