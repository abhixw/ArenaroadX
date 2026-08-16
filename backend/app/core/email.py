"""Minimal transactional email sending. If SMTP_HOST is unset (e.g. local dev), emails are
logged instead of sent -- see app.core.config.settings for the SMTP_* settings that opt into
real delivery, and validate_production_config, which refuses to boot in production without
them configured.
"""

import logging
import smtplib
from email.message import EmailMessage

from app.core.config import settings

logger = logging.getLogger("tournament_backend.email")


def send_email(*, to: str, subject: str, body: str) -> None:
    if not settings.SMTP_HOST:
        logger.info("SMTP not configured; logging email instead of sending.\nTo: %s\nSubject: %s\n\n%s", to, subject, body)
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL
    message["To"] = to
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as smtp:
        if settings.SMTP_USE_TLS:
            smtp.starttls()
        if settings.SMTP_USERNAME:
            smtp.login(settings.SMTP_USERNAME, settings.SMTP_PASSWORD)
        smtp.send_message(message)
