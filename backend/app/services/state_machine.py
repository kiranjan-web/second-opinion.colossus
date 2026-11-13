import datetime

class CoercionStateMachine:
    def __init__(self):
        self.highest_phase = 0
        self.is_isolated = False
        self.all_triggers = []
        self.coercion_fingerprint = "Normal Activity"
        self.history = []

    def update_state(self, gemini_analysis: dict) -> dict:
        phase = gemini_analysis.get("detected_phase", 0)
        risk = gemini_analysis.get("risk_level", "LOW")
        triggers = gemini_analysis.get("trigger_phrases", [])
        fingerprint = gemini_analysis.get("coercion_fingerprint", "")

        if phase > self.highest_phase:
            self.highest_phase = phase

        if self.highest_phase >= 5:
            self.is_isolated = True

        if triggers:
            self.all_triggers.extend(triggers)
            self.all_triggers = list(dict.fromkeys(self.all_triggers))

        if fingerprint:
            self.coercion_fingerprint = fingerprint

        state_snapshot = {
            "timestamp": datetime.datetime.now().isoformat(),
            "current_highest_phase": self.highest_phase,
            "isolation_breached": self.is_isolated,
            "latest_risk": risk,
            "fingerprint": self.coercion_fingerprint,
            "all_triggers": self.all_triggers
        }
        
        self.history.append(state_snapshot)
        return state_snapshot

active_call_state = CoercionStateMachine()