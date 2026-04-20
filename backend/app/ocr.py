import base64
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
import httpx
from fastapi import HTTPException, status

from .config import get_settings
from .schemas import ExpenseDraft

TOTAL_PATTERNS = (
    r"total",
    r"Total",
    r"importe total",
    r"amount due",
    r"grand total",
)
DATE_PATTERNS = ("%d/%m/%Y", "%d-%m-%Y", "%Y-%m-%d", "%m/%d/%Y")


def _normalize_image_content_type(content_type: str | None) -> str:
    normalized = (content_type or "").split(";", maxsplit=1)[0].strip().lower()
    if normalized.startswith("image/"):
        return normalized
    return "image/jpeg"


def _extract_mistral_error_message(response: httpx.Response) -> str | None:
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        for key in ("detail", "message", "error"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
            if isinstance(value, dict):
                nested = value.get("message") or value.get("detail")
                if isinstance(nested, str) and nested.strip():
                    return nested.strip()

    text = response.text.strip()
    return text or None


async def extract_text_from_image(
    file_bytes: bytes,
    filename: str,
    content_type: str,
    api_key: str,
) -> str:
    settings = get_settings()
    mime_type = _normalize_image_content_type(content_type)
    encoded_file = base64.b64encode(file_bytes).decode("ascii")
    payload = {
        "model": settings.mistral_ocr_model,
        "document": {
            "type": "image_url",
            "image_url": f"data:{mime_type};base64,{encoded_file}",
        },
        "include_image_base64": False,
    }

    async with httpx.AsyncClient(timeout=60) as client:
        response = await client.post(
            settings.mistral_ocr_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
        )

    if response.status_code >= 400:
        message = _extract_mistral_error_message(response)
        detail = "Mistral devolvio un error al procesar la imagen."
        if message:
            detail = f"{detail} {message}"
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
        )

    response_data = response.json()
    pages = response_data.get("pages") or []
    text = "\n\n".join(page.get("markdown", "") for page in pages if isinstance(page, dict)).strip()

    if not text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="No se pudo extraer texto de la imagen.",
        )

    return text


def _parse_decimal(raw_value: str | None) -> Decimal | None:
    if not raw_value:
        return None

    cleaned = raw_value.replace("PAB", "").replace("$", "").replace(" ", "").strip()

    if cleaned.count(",") == 1 and cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif cleaned.count(",") == 1 and cleaned.count(".") == 0:
        cleaned = cleaned.replace(",", ".")
    elif cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "")

    try:
        return Decimal(cleaned)
    except InvalidOperation:
        return None


def _extract_total(text: str) -> Decimal | None:
    for line in text.splitlines():
        lower_line = line.lower()
        if any(pattern in lower_line for pattern in TOTAL_PATTERNS):
            match = re.search(r"(-?\d[\d.,]+)", line)
            value = _parse_decimal(match.group(1) if match else None)
            if value is not None:
                return value

    numbers = re.findall(r"(-?\d[\d.,]+)", text)
    parsed = [_parse_decimal(number) for number in numbers]
    parsed = [value for value in parsed if value is not None]
    return max(parsed) if parsed else None


def _extract_date(text: str):
    for match in re.findall(r"\b\d{2}[/-]\d{2}[/-]\d{4}\b|\b\d{4}-\d{2}-\d{2}\b", text):
        for pattern in DATE_PATTERNS:
            try:
                return datetime.strptime(match, pattern).date()
            except ValueError:
                continue
    return None


# Textos que suelen ir tras «Factura» pero no son el numero (p. ej. «Factura electronica»).
_INVOICE_CAPTURE_NOISE = frozenset(
    {
        "electronica",
        "electrónica",
        "electronico",
        "electrónico",
        "electronic",
        "einvoice",
        "digital",
        "original",
        "duplicado",
        "simplificada",
        "rectificativa",
        "verifactu",
    }
)


def _is_spurious_invoice_number_capture(candidate: str) -> bool:
    if not candidate or not str(candidate).strip():
        return True
    t = str(candidate).strip().lower()
    if t in _INVOICE_CAPTURE_NOISE:
        return True
    if re.fullmatch(r"electr[oó]nic[oa]", t):
        return True
    return False


def _extract_invoice_number(text: str) -> str | None:
    """Numero de factura: Numero/Número, Nro, factura/ticket, etc. Ignora etiquetas tipo «factura electronica»."""
    patterns = [
        r"(?:factura numero|invoice|ticket|receipt)[\s#:.-]*([A-Za-z0-9/-]+)",
        r"(?:numero|n[úu]mero|nro|nr\.?|n[º°])[\s#:.-]*([A-Za-z0-9/-]+)",
        r"(?:num|no)[\s#:.-]*([A-Za-z0-9/-]+)",
    ]

    for pattern in patterns:
        for match in re.finditer(pattern, text, flags=re.IGNORECASE):
            candidate = match.group(1)
            if _is_spurious_invoice_number_capture(candidate):
                continue
            return candidate

    return None


def _extract_vendor(text: str) -> str | None:
    """Proveedor: prioriza el bloque donde aparece la palabra «emisor» (facturas Verifactu / electrónicas)."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if not lines:
        return None

    skip_prefixes = ("nif", "cif", "vat", "tel", "tfno", "fax", "email", "e-mail", "web", "www", "c/")

    for i, line in enumerate(lines):
        if not re.search(r"(?i)\bemisor\b", line):
            continue
        same = re.search(r"(?i)\bemisor\b\s*[:\s.-]*(.+)$", line)
        if same:
            after = same.group(1).strip()
            if after and len(after) >= 2 and not re.fullmatch(r"[\d\s.,\-/]+", after):
                return after[:255]
        for j in range(i + 1, min(i + 6, len(lines))):
            nxt = lines[j]
            if len(nxt) < 2:
                continue
            low = nxt.lower()
            if low.startswith(skip_prefixes):
                continue
            if re.fullmatch(r"[\d\s.,\-/]+", nxt):
                continue
            return nxt[:255]

    first_line = lines[0]
    if len(first_line) < 3 and len(lines) > 1:
        return lines[1]
    return first_line[:255]


def _extract_tax(text: str) -> Decimal | None:
    match = re.search(r"(?:iva|tax)[^\d]*(\d[\d.,]+)", text, flags=re.IGNORECASE)
    return _parse_decimal(match.group(1) if match else None)


def parse_receipt_text(text: str) -> ExpenseDraft:
    return ExpenseDraft(
        vendor_name=_extract_vendor(text),
        invoice_number=_extract_invoice_number(text),
        invoice_date=_extract_date(text),
        currency="PAB",
        total_amount=_extract_total(text),
        tax_amount=_extract_tax(text),
        notes="OCR generado automaticamente. Revisar antes de guardar.",
    )
