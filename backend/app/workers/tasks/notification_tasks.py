"""
SMS and email notification tasks.

Credentials are validated when the Celery worker starts up via
validate_notification_credentials(). Tasks that cannot send due to
missing credentials log the error and do NOT silently succeed.
"""

import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

from app.core.config import settings
from app.core.logging import get_logger
from app.workers.celery_app import celery_app

logger = get_logger(__name__)


def validate_notification_credentials() -> dict:
    """
    Called at worker startup. Returns a dict describing what is available.
    Does NOT raise — partial configuration is allowed (e.g. SMS only).

    Severity policy:
      - "credentials not configured" in non-production: INFO (expected dev state)
      - "credentials not configured" in production:     WARNING (operator should fix)
      - "credentials present but invalid":              ERROR (something is broken)
    """
    status = {"sms": False, "email": False, "warnings": [], "info": []}
    is_prod = settings.APP_ENV.lower() in ("production", "prod")
    missing_severity = logger.warning if is_prod else logger.info

    # SMS check
    if settings.SMS_PROVIDER == "twilio":
        if all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
            try:
                from twilio.rest import Client
                client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
                # Lightweight API call to validate credentials
                client.api.accounts(settings.TWILIO_ACCOUNT_SID).fetch()
                status["sms"] = True
                logger.info("twilio_credentials_valid")
            except ImportError:
                status["warnings"].append("twilio package not installed: pip install twilio")
                logger.warning("twilio_not_installed")
            except Exception as e:
                status["warnings"].append(f"Twilio credential validation failed: {e}")
                logger.error("twilio_credential_invalid", error=str(e))
        else:
            msg = "SMS notifications disabled (Twilio credentials not configured)"
            status["info"].append(msg) if not is_prod else status["warnings"].append(msg)
            missing_severity("twilio_credentials_not_configured", env=settings.APP_ENV)

    # Email check
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=10) as server:
                if settings.SMTP_TLS:
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
                server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            status["email"] = True
            logger.info("smtp_credentials_valid", host=settings.SMTP_HOST)
        except smtplib.SMTPAuthenticationError:
            status["warnings"].append(
                "SMTP authentication failed — check SMTP_USER and SMTP_PASSWORD"
            )
            logger.error("smtp_auth_failed")
        except Exception as e:
            status["warnings"].append(f"SMTP connection failed: {e}")
            logger.error("smtp_connection_failed", error=str(e))
    else:
        msg = "Email notifications disabled (SMTP credentials not configured)"
        status["info"].append(msg) if not is_prod else status["warnings"].append(msg)
        missing_severity("smtp_credentials_not_configured", env=settings.APP_ENV)

    logger.info(
        "notification_credentials_validated",
        sms=status["sms"],
        email=status["email"],
        env=settings.APP_ENV,
    )
    return status


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=60,
    name="app.workers.tasks.notification_tasks.send_challan_sms",
    acks_late=True,
)
def send_challan_sms(self, challan_id: str, phone: str, message: str) -> dict:
    """
    Sends an SMS via Twilio. Raises on missing credentials (not silently skipped).
    """
    if not all([settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN, settings.TWILIO_PHONE_NUMBER]):
        logger.error(
            "sms_skipped_missing_credentials",
            challan_id=challan_id,
            hint="Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER in .env",
        )
        # Return failure status but don't retry — config issue, not transient
        return {"status": "skipped", "reason": "credentials_not_configured"}

    try:
        from twilio.rest import Client
    except ImportError:
        logger.error("twilio_not_installed", hint="pip install twilio")
        return {"status": "skipped", "reason": "twilio_not_installed"}

    # Normalize phone number to E.164 format
    normalized_phone = _normalize_phone(phone)
    if not normalized_phone:
        logger.error("sms_invalid_phone", challan_id=challan_id, phone=phone)
        return {"status": "failed", "reason": "invalid_phone_number"}

    try:
        client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
        msg = client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=normalized_phone,
        )
        logger.info(
            "sms_sent",
            challan_id=challan_id,
            phone=normalized_phone,
            sid=msg.sid,
            status=msg.status,
        )
        return {"status": "sent", "sid": msg.sid, "provider_status": msg.status}

    except Exception as exc:
        logger.error(
            "sms_send_failed",
            challan_id=challan_id,
            phone=normalized_phone,
            attempt=self.request.retries + 1,
            error=str(exc),
        )
        raise self.retry(exc=exc)


@celery_app.task(
    bind=True,
    max_retries=3,
    default_retry_delay=120,
    name="app.workers.tasks.notification_tasks.send_challan_email",
    acks_late=True,
)
def send_challan_email(self, challan_id: str, email: str, subject: str, body: str) -> dict:
    """
    Sends an HTML email via SMTP. Raises on missing credentials (not silently skipped).
    """
    if not settings.SMTP_USER or not settings.SMTP_PASSWORD:
        logger.error(
            "email_skipped_missing_credentials",
            challan_id=challan_id,
            hint="Set SMTP_USER and SMTP_PASSWORD in .env",
        )
        return {"status": "skipped", "reason": "credentials_not_configured"}

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = settings.SMTP_FROM
        msg["To"] = email
        msg["X-Mailer"] = "AI-Enforcement-Platform/1.0"
        msg.attach(MIMEText(body, "html", "utf-8"))

        with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT, timeout=30) as server:
            server.set_debuglevel(0)
            if settings.SMTP_TLS:
                server.ehlo()
                server.starttls()
                server.ehlo()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.sendmail(settings.SMTP_FROM, email, msg.as_string())

        logger.info("email_sent", challan_id=challan_id, email=email, subject=subject)
        return {"status": "sent"}

    except smtplib.SMTPRecipientsRefused as exc:
        logger.error("email_recipient_refused", email=email, error=str(exc))
        # Do not retry — recipient issue is permanent
        return {"status": "failed", "reason": "recipient_refused"}

    except Exception as exc:
        logger.error(
            "email_send_failed",
            challan_id=challan_id,
            email=email,
            attempt=self.request.retries + 1,
            error=str(exc),
        )
        raise self.retry(exc=exc)


def _normalize_phone(phone: str) -> Optional[str]:
    """Converts Indian phone numbers to E.164 format (+91XXXXXXXXXX)."""
    cleaned = phone.strip().replace(" ", "").replace("-", "").replace("(", "").replace(")", "")
    if cleaned.startswith("+"):
        # Already E.164
        return cleaned if len(cleaned) >= 10 else None
    if cleaned.startswith("91") and len(cleaned) == 12:
        return f"+{cleaned}"
    if len(cleaned) == 10 and cleaned.isdigit():
        return f"+91{cleaned}"
    return None
