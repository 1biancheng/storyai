"""
Simple database migration runner for 003_add_documents_table.sql
"""
import asyncio
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from config import get_settings


async def run_migration():
    """Run database migration script"""
    settings = get_settings()
    
    if not settings.database.enabled:
        print("❌ Database is disabled in config")
        return False
    
    # Read migration script
    migration_file = Path(__file__).parent / "migrations" / "003_add_documents_table.sql"
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    migration_sql = migration_file.read_text(encoding='utf-8')
    print(f"📄 Loaded migration script: {migration_file.name}")
    
    # Create async engine
    db_url = settings.database.url.replace('postgresql://', 'postgresql+asyncpg://')
    print(f"🔌 Connecting to database: {settings.database.host}:{settings.database.port}/{settings.database.name}")
    
    engine = create_async_engine(db_url, echo=False)
    
    try:
        async with engine.connect() as conn:
            # Test connection
            from sqlalchemy import text
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ PostgreSQL connected: {version[:50]}...")
            
            # Execute migration in transaction
            print("🚀 Executing migration script...")
            
            # Split SQL statements by semicolon and execute one by one
            statements = []
            current_stmt = []
            in_function = False
            
            for line in migration_sql.split('\n'):
                stripped = line.strip()
                
                # Detect function definitions
                if 'CREATE OR REPLACE FUNCTION' in line or 'CREATE FUNCTION' in line:
                    in_function = True
                elif in_function and '$$' in line and 'LANGUAGE' in line:
                    in_function = False
                    current_stmt.append(line)
                    statements.append('\n'.join(current_stmt))
                    current_stmt = []
                    continue
                
                # Skip comments and empty lines
                if not stripped or stripped.startswith('--'):
                    continue
                
                current_stmt.append(line)
                
                # End of statement (not in function)
                if not in_function and stripped.endswith(';'):
                    statements.append('\n'.join(current_stmt))
                    current_stmt = []
            
            # Execute statements one by one
            for i, stmt in enumerate(statements, 1):
                stmt = stmt.strip()
                if not stmt:
                    continue
                try:
                    await conn.execute(text(stmt))
                    if i % 10 == 0:
                        print(f"   ✅ Executed {i}/{len(statements)} statements")
                except Exception as e:
                    # Ignore IF NOT EXISTS / IF EXISTS errors
                    if 'already exists' in str(e) or 'does not exist' in str(e):
                        pass
                    else:
                        print(f"   ⚠️ Statement {i} warning: {e}")
            
            await conn.commit()
            print("✅ Migration executed successfully")
            
            # Verify tables created
            result = await conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('documents', 'paragraphs')
                ORDER BY table_name
            """))
            tables = [row[0] for row in result.fetchall()]
            print(f"✅ Verified tables: {', '.join(tables)}")
            
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
"""
Simple database migration runner for 003_add_documents_table.sql
"""
import asyncio
import sys
from pathlib import Path
from sqlalchemy.ext.asyncio import create_async_engine
from config import get_settings


async def run_migration():
    """Run database migration script"""
    settings = get_settings()
    
    if not settings.database.enabled:
        print("❌ Database is disabled in config")
        return False
    
    # Read migration script
    migration_file = Path(__file__).parent / "migrations" / "003_add_documents_table.sql"
    if not migration_file.exists():
        print(f"❌ Migration file not found: {migration_file}")
        return False
    
    migration_sql = migration_file.read_text(encoding='utf-8')
    print(f"📄 Loaded migration script: {migration_file.name}")
    
    # Create async engine
    db_url = settings.database.url.replace('postgresql://', 'postgresql+asyncpg://')
    print(f"🔌 Connecting to database: {settings.database.host}:{settings.database.port}/{settings.database.name}")
    
    engine = create_async_engine(db_url, echo=False)
    
    try:
        async with engine.connect() as conn:
            # Test connection
            from sqlalchemy import text
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ PostgreSQL connected: {version[:50]}...")
            
            # Execute migration in transaction
            print("🚀 Executing migration script...")
            
            # Split SQL statements by semicolon and execute one by one
            statements = []
            current_stmt = []
            in_function = False
            
            for line in migration_sql.split('\n'):
                stripped = line.strip()
                
                # Detect function definitions
                if 'CREATE OR REPLACE FUNCTION' in line or 'CREATE FUNCTION' in line:
                    in_function = True
                elif in_function and '$$' in line and 'LANGUAGE' in line:
                    in_function = False
                    current_stmt.append(line)
                    statements.append('\n'.join(current_stmt))
                    current_stmt = []
                    continue
                
                # Skip comments and empty lines
                if not stripped or stripped.startswith('--'):
                    continue
                
                current_stmt.append(line)
                
                # End of statement (not in function)
                if not in_function and stripped.endswith(';'):
                    statements.append('\n'.join(current_stmt))
                    current_stmt = []
            
            # Execute statements one by one
            for i, stmt in enumerate(statements, 1):
                stmt = stmt.strip()
                if not stmt:
                    continue
                try:
                    await conn.execute(text(stmt))
                    if i % 10 == 0:
                        print(f"   ✅ Executed {i}/{len(statements)} statements")
                except Exception as e:
                    # Ignore IF NOT EXISTS / IF EXISTS errors
                    if 'already exists' in str(e) or 'does not exist' in str(e):
                        pass
                    else:
                        print(f"   ⚠️ Statement {i} warning: {e}")
            
            await conn.commit()
            print("✅ Migration executed successfully")
            
            # Verify tables created
            result = await conn.execute(text("""
                SELECT table_name FROM information_schema.tables 
                WHERE table_schema = 'public' AND table_name IN ('documents', 'paragraphs')
                ORDER BY table_name
            """))
            tables = [row[0] for row in result.fetchall()]
            print(f"✅ Verified tables: {', '.join(tables)}")
            
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
