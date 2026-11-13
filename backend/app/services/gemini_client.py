import os
import json
import logging
import google.generativeai as genai
from app.core.config import settings
from app.core.prompts import COERCION_STATE_MACHINE_PROMPT

logger = logging.getLogger(__name__)

api_key = settings.GEMINI_API_KEY or os.getenv("GEMINI_API_KEY")
if api_key:
    genai.configure(api_key=api_key)

model = genai.GenerativeModel('gemini-1.5-flash')

async def analyze_transcript_chunk(text: str) -> dict:
    if not text.strip():
        return {"detected_phase": 0, "risk_level": "LOW", "trigger_phrases": [], "coercion_fingerprint": "Empty chunk"}

    try:
        response = model.generate_content(f"{COERCION_STATE_MACHINE_PROMPT}\n\nTranscript:\n{text}")
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(clean_json)
    except json.JSONDecodeError:
        logger.error("Gemini returned non-JSON format.")
        return {"error": "JSON parse error", "detected_phase": 0, "risk_level": "UNKNOWN"}
    except Exception as e:
        logger.error(f"Gemini Exception: {e}")
        return {"error": str(e), "detected_phase": 0, "risk_level": "ERROR"}