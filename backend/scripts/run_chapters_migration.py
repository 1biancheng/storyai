"""
Run migration to create the 'chapters' table (migrations/004_create_chapters_table.sql)

This script uses SQLAlchemy Async Engine with asyncpg to execute the SQL statements
and verifies that the 'chapters' table exists afterwards.

Usage:
  python backend/scripts/run_chapters_migration.py
"""
import asyncio
import sys
from pathlib import Path
from typing import List

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text

try:
    # Try to import settings from backend/config.py when run from project root or backend dir
    from config import get_settings
except Exception:
    # Fallback: ensure backend root is on sys.path
    base_dir = Path(__file__).resolve().parent.parent
    if str(base_dir) not in sys.path:
        sys.path.insert(0, str(base_dir))
    from config import get_settings  # type: ignore


def _split_sql_statements(sql: str) -> List[str]:
    """Split SQL content by semicolons while skipping comments and empty lines.
    This is a simple splitter suitable for CREATE/INDEX/COMMENT statements (no functions).
    """
    statements: List[str] = []
    current: List[str] = []
    for raw_line in sql.splitlines():
        line = raw_line.strip()
        # Skip SQL comments (--) and empty lines
        if not line or line.startswith('--'):
            continue
        current.append(raw_line)
        if line.endswith(';'):
            stmt = '\n'.join(current).strip()
            if stmt:
                statements.append(stmt)
            current = []
    # Any trailing content without semicolon (shouldn't happen here)
    tail = '\n'.join(current).strip()
    if tail:
        statements.append(tail)
    return statements


async def run_migration() -> bool:
    settings = get_settings()
    if not settings.database.enabled:
        print("❌ Database is disabled in config")
        return False

    # Resolve migration file path relative to backend directory
    backend_dir = Path(__file__).resolve().parent.parent
    migration_file = backend_dir / "migrations" / "004_create_chapters_table.sql"
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False

    sql = migration_file.read_text(encoding="utf-8")
    statements = _split_sql_statements(sql)
    print(f"📄 Loaded {migration_file.name} with {len(statements)} statements")

    # Create async engine (asyncpg)
    db_url = settings.database.url.replace('postgresql://', 'postgresql+asyncpg://')
    print(f"🔌 Connecting to database: {settings.database.host}:{settings.database.port}/{settings.database.name}")
    engine = create_async_engine(db_url, echo=False)

    try:
        async with engine.begin() as conn:
            # Verify connection
            version = (await conn.execute(text("SELECT version()"))).scalar()
            print(f"✅ PostgreSQL connected: {str(version)[:50]}...")

            print("🚀 Executing chapters migration...")
            executed = 0
            for i, stmt in enumerate(statements, 1):
                stmt = stmt.strip()
                if not stmt:
                    continue
                try:
                    await conn.execute(text(stmt))
                    executed += 1
                    if i % 5 == 0 or i == len(statements):
                        print(f"   ✅ Executed {i}/{len(statements)} statements")
                except Exception as e:
                    msg = str(e)
                    # Tolerate benign existence-related errors
                    if 'already exists' in msg or 'IF NOT EXISTS' in stmt:
                        print(f"   ⚠️  Ignored benign error on statement {i}: {msg}")
                        continue
                    print(f"   ❌ Error executing statement {i}: {msg}")
                    raise

        # Verify table existence
        async with engine.connect() as conn:
            exists = (await conn.execute(
                text("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'public' AND table_name = 'chapters'
                    )
                """))
            ).scalar()
            if not bool(exists):
                print("❌ MIGRATION_FAILED_CHAPTERS_NOT_CREATED")
                return False

            # Optional: row count
            count = (await conn.execute(text("SELECT COUNT(*) FROM chapters"))).scalar()
            print(f"✅ MIGRATION_SUCCESS_CHAPTERS_CREATED (rows={count})")
            return True
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        await engine.dispose()


if __name__ == "__main__":
    success = asyncio.run(run_migration())
    sys.exit(0 if success else 1)

