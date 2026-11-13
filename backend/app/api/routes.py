from fastapi import APIRouter, HTTPException
from app.services.state_machine import active_call_state
from pydantic import BaseModel
import datetime

router = APIRouter()

class DemoTriggerRequest(BaseModel):
    detected_phase: int
    risk_level: str
    trigger_phrases: list[str]

@router.get("/status")
async def get_current_status():
    return {
        "highest_phase": active_call_state.highest_phase,
        "is_isolated": active_call_state.is_isolated
    }

@router.post("/demo/trigger-isolation")
async def trigger_demo_isolation(payload: DemoTriggerRequest):
    simulated_analysis = {
        "detected_phase": payload.detected_phase,
        "risk_level": payload.risk_level,
        "trigger_phrases": payload.trigger_phrases,
        "coercion_fingerprint": "STAGE DEMO OVERRIDE"
    }
    state = active_call_state.update_state(simulated_analysis)
    return {"status": "success", "state": state}

@router.post("/generate-report")
async def generate_incident_report():
    if active_call_state.highest_phase < 3:
        return {"message": "Not enough risk data to generate a police report."}
    
    report = {
        "timestamp": datetime.datetime.now().isoformat(),
        "highest_phase_reached": active_call_state.highest_phase,
        "isolation_breached": active_call_state.is_isolated,
        "detected_triggers": active_call_state.all_triggers,
        "recommendation": "IMMEDIATE REVIEW BY CYBER CELL 1930"
    }
    return {"status": "success", "report": report}