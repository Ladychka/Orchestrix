"""Tool: send_email — send an email via SMTP. Gated by approval flow."""

import smtplib
from email.mime.text import MIMEText

from app.core.config import settings


def send_email(to: str, subject: str, body: str) -> bool:
    """Send an email using the configured SMTP credentials.

    Args:
        to: Recipient email address.
        subject: Email subject line.
        body: Plain-text email body.

    Returns:
        True if sent successfully, False otherwise.
    """
    if not settings.EMAIL_USER or not settings.EMAIL_PASS:
        print("[send_email] skipped: email credentials not configured")
        return False

    try:
        msg = MIMEText(body, "plain", "utf-8")
        msg["Subject"] = subject
        msg["From"] = settings.EMAIL_USER
        msg["To"] = to

        with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASS)
            server.sendmail(settings.EMAIL_USER, [to], msg.as_string())

        print(f"[send_email] sent to {to}: {subject}")
        return True
    except Exception as exc:
        print(f"[send_email] failed: {exc}")
        return False
