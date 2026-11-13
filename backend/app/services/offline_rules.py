import re

class OfflineRuleMatcher:
    """Keyword-based deterministic rule engine for edge fallback safety."""
    
    SCAM_KEYWORDS = {
        5: [r"disconnect", r"separate room", r"tell no one", r"don't cut the call"],
        4: [r"arrest warrant", r"fir", r"police station", r"cbi"],
        3: [r"money laundering", r"illegal parcel", r"customs", r"compromised account"]
    }

    @classmethod
    def evaluate(cls, text: str) -> int:
        text_lower = text.lower()
        for phase, patterns in sorted(cls.SCAM_KEYWORDS.keys(), reverse=True):
            for pattern in patterns:
                if re.search(pattern, text_lower):
                    return phase
        return 0