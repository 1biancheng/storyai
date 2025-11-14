import asyncio
import sys
from pathlib import Path
import os

try:
    import asyncpg
except ImportError as e:
    print("DEPENDENCY_ERROR: asyncpg not available", e)
    sys.exit(3)

BASE_DIR = Path(__file__).resolve().parent.parent
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

# Ensure minimal env for Settings validation (secret_key >= 32 chars)
os.environ.setdefault("SECRET_KEY", "offline-test-secret-key-0123456789abcdef0123456789")
# Normalize DB credentials for offline checks
os.environ["DATABASE__USERNAME"] = "postgres"
os.environ["DATABASE__PASSWORD"] = "1234"
os.environ["DATABASE__HOST"] = "localhost"
os.environ["DATABASE__PORT"] = "5432"
os.environ["DATABASE__NAME"] = "story_ai"

from config import get_settings


async def main() -> int:
    settings = get_settings()
    try:
        conn = await asyncpg.connect(settings.database.url)
    except Exception as e:
        print("DB_CONNECT_FAIL:", e)
        return 1

    try:
        # Check if chapters table exists
        exists = await conn.fetchval("SELECT to_regclass('public.chapters')")
        if exists is None:
            print("CHAPTERS_TABLE_MISSING")
            return 2
        count = await conn.fetchval("SELECT COUNT(*) FROM chapters")
        print("CHAPTERS_TABLE_EXISTS:", count)
        return 0
    finally:
        await conn.close()


if __name__ == "__main__":
    code = asyncio.run(main())
    sys.exit(code)
