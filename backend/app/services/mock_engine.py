import random

class MockScamEngine:
    """Provides simulated transcript chunks and fallback analysis for live offline demos."""
    
    DEMO_SCRIPTS = [
        {"chunk": "Hello, I am Inspector Sharma from Cyber Crime Branch Mumbai.", "phase": 2, "risk": "MEDIUM"},
        {"chunk": "Your Aadhaar card was used in a multi-crore money laundering case in Delhi.", "phase": 3, "risk": "HIGH"},
        {"chunk": "An immediate non-bailable arrest warrant has been issued under your name.", "phase": 4, "risk": "CRITICAL"},
        {"chunk": "Disconnect all family members. Go to a separate quiet room right now and face the wall.", "phase": 5, "risk": "CRITICAL"},
    ]

    @staticmethod
    def get_random_chunk():
        return random.choice(MockScamEngine.DEMO_SCRIPTS)