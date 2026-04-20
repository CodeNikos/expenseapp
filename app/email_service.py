import logging
from email.message import EmailMessage

import aiosmtplib

from .config import get_settings

logger = logging.getLogger(__name__)


async def send_password_reset_email(to_email: str, reset_url: str) -> None:
    settings = get_settings()
    subject = "ExpenseApp: restablecer contrasena"
    text_body = (
        "Has solicitado restablecer tu contrasena en ExpenseApp.\n\n"
        f"Abre este enlace (valido un tiempo limitado):\n{reset_url}\n\n"
        "Si no fuiste tu, ignora este mensaje."
    )
    html_body = (
        "<p>Has solicitado restablecer tu contrasena en <strong>ExpenseApp</strong>.</p>"
        f'<p><a href="{reset_url}">Restablecer contrasena</a></p>'
        "<p>Si no fuiste tu, ignora este mensaje.</p>"
    )

    if not settings.smtp_host.strip():
        logger.warning(
            "SMTP no configurado (SMTP_HOST vacio). Enlace de recuperacion (solo desarrollo): %s",
            reset_url,
        )
        return

    sender = settings.smtp_from.strip() or settings.smtp_user.strip()
    if not sender:
        logger.warning("SMTP_FROM o SMTP_USER requerido para enviar correo. Enlace: %s", reset_url)
        return

    message = EmailMessage()
    message["From"] = sender
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    await aiosmtplib.send(
        message,
        hostname=settings.smtp_host.strip(),
        port=settings.smtp_port,
        username=settings.smtp_user.strip() or None,
        password=settings.smtp_password.strip() or None,
        start_tls=settings.smtp_use_tls,
    )
