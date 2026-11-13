from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from app.services.gemini_client import analyze_transcript_chunk
from app.services.state_machine import active_call_state
from app.services.telegram_notifier import send_emergency_alert
import json
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

manager = ConnectionManager()

@router.websocket("/ws/protect")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            try:
                analysis = await analyze_transcript_chunk(data)
                if "error" in analysis:
                    raise Exception("Gemini API Error")
            except Exception as e:
                logger.warning(f"AI Engine failed. Fail-safe activated: {e}")
                analysis = {"detected_phase": 5, "risk_level": "CRITICAL", "coercion_fingerprint": "MOCK: Fallback Trigger"}

            current_state = active_call_state.update_state(analysis)
            
            if current_state.get("isolation_breached") and current_state.get("current_highest_phase") == 5:
                triggers = analysis.get("trigger_phrases", ["Isolation order detected"])
                await send_emergency_alert(5, triggers)

            payload = {
                "transcript": data,
                "analysis": analysis,
                "system_state": current_state
            }
            await websocket.send_text(json.dumps(payload))
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected.")