import aiosqlite
from app.db.database import DB_PATH
import json

async def save_incident(incident_data: dict):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            """
            INSERT INTO incidents (timestamp, highest_phase, isolation_breached, trigger_phrases, fingerprint)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                incident_data.get("timestamp"),
                incident_data.get("current_highest_phase"),
                1 if incident_data.get("isolation_breached") else 0,
                json.dumps(incident_data.get("all_triggers", [])),
                incident_data.get("fingerprint", "")
            )
        )
        await db.commit()

async def fetch_all_incidents() -> list:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT * FROM incidents ORDER BY id DESC") as cursor:
            rows = await cursor.fetchall()
            return [dict(row) for row in rows]