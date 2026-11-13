import os
import httpx
import logging

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "YOUR_MOCK_TOKEN")
TELEGRAM_CHAT_ID = os.getenv("TELEGRAM_CHAT_ID", "YOUR_FAMILY_GROUP_ID")

async def send_emergency_alert(phase: int, trigger_phrases: list):
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == "YOUR_MOCK_TOKEN":
        logger.warning("Telegram Bot Token not configured. Skipping SOS alert dispatch.")
        return False

    message = (
        "🚨 *SECOND VOICE EMERGENCY ALERT* 🚨\n\n"
        f"Your family member is currently on a high-risk coercive call.\n"
        f"Current Threat Phase: *{phase}/7 (ISOLATION DETECTED)*\n\n"
        f"Detected Threats:\n- " + "\n- ".join(trigger_phrases[:3]) + "\n\n"
        "⚠️ *ACTION REQUIRED:* Call them immediately on an alternate line."
    )

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    payload = {"chat_id": TELEGRAM_CHAT_ID, "text": message, "parse_mode": "Markdown"}

    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
            logger.info("Telegram emergency alert successfully dispatched.")
            return True
    except Exception as e:
        logger.error(f"Failed to send Telegram alert: {e}")
        return False