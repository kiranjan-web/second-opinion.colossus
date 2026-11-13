import aiosqlite
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "incidents.db")

async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS incidents (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                highest_phase INTEGER NOT NULL,
                isolation_breached BOOLEAN NOT NULL,
                trigger_phrases TEXT NOT NULL,
                fingerprint TEXT NOT NULL
            )
        """)
        await db.commit()

async def get_db():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db