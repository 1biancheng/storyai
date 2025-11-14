"""
数据库迁移脚本执行工具
用于执行book-division-optimization项目的数据库迁移
"""
import os
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def get_db_connection():
    """获取数据库连接"""
    # 从环境变量或默认配置获取数据库连接
    db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/story_ai')
    
    try:
        conn = psycopg2.connect(db_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return conn
    except Exception as e:
        print(f"⚠️  无法连接数据库: {e}")
        print(f"   请确保数据库正在运行,且连接信息正确")
        return None

def run_migration(cursor, migration_file: str):
    """执行单个迁移脚本"""
    migration_path = Path(__file__).parent / migration_file
    
    if not migration_path.exists():
        print(f"❌ 迁移文件不存在: {migration_path}")
        return False
    
    print(f"📄 读取迁移脚本: {migration_file}")
    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    try:
        print(f"🔄 执行迁移: {migration_file}")
        cursor.execute(sql)
        print(f"✅ 迁移成功: {migration_file}")
        return True
    except Exception as e:
        print(f"❌ 迁移失败: {migration_file}")
        print(f"   错误: {str(e)}")
        return False

def run_all_migrations():
    """执行所有待执行的迁移"""
    migrations = [
        '002_extend_paragraphs_table.sql',
        '003_extend_formulas_table.sql',
    ]
    
    print("=" * 60)
    print("🚀 开始执行数据库迁移")
    print("=" * 60)
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        success_count = 0
        
        for migration in migrations:
            result = run_migration(cursor, migration)
            if result:
                success_count += 1
            print()
        
        cursor.close()
        conn.close()
        
        print("=" * 60)
        print(f"📊 迁移完成: {success_count}/{len(migrations)} 成功")
        print("=" * 60)
        
        return success_count == len(migrations)
    except Exception as e:
        print(f"❌ 迁移过程错误: {e}")
        if conn:
            conn.close()
        return False

if __name__ == "__main__":
    success = run_all_migrations()
    exit(0 if success else 1)
"""
数据库迁移脚本执行工具
用于执行book-division-optimization项目的数据库迁移
"""
import os
from pathlib import Path
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_AUTOCOMMIT

def get_db_connection():
    """获取数据库连接"""
    # 从环境变量或默认配置获取数据库连接
    db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres@localhost:5432/story_ai')
    
    try:
        conn = psycopg2.connect(db_url)
        conn.set_isolation_level(ISOLATION_LEVEL_AUTOCOMMIT)
        return conn
    except Exception as e:
        print(f"⚠️  无法连接数据库: {e}")
        print(f"   请确保数据库正在运行,且连接信息正确")
        return None

def run_migration(cursor, migration_file: str):
    """执行单个迁移脚本"""
    migration_path = Path(__file__).parent / migration_file
    
    if not migration_path.exists():
        print(f"❌ 迁移文件不存在: {migration_path}")
        return False
    
    print(f"📄 读取迁移脚本: {migration_file}")
    with open(migration_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    
    try:
        print(f"🔄 执行迁移: {migration_file}")
        cursor.execute(sql)
        print(f"✅ 迁移成功: {migration_file}")
        return True
    except Exception as e:
        print(f"❌ 迁移失败: {migration_file}")
        print(f"   错误: {str(e)}")
        return False

def run_all_migrations():
    """执行所有待执行的迁移"""
    migrations = [
        '002_extend_paragraphs_table.sql',
        '003_extend_formulas_table.sql',
    ]
    
    print("=" * 60)
    print("🚀 开始执行数据库迁移")
    print("=" * 60)
    
    conn = get_db_connection()
    if not conn:
        return False
    
    try:
        cursor = conn.cursor()
        success_count = 0
        
        for migration in migrations:
            result = run_migration(cursor, migration)
            if result:
                success_count += 1
            print()
        
        cursor.close()
        conn.close()
        
        print("=" * 60)
        print(f"📊 迁移完成: {success_count}/{len(migrations)} 成功")
        print("=" * 60)
        
        return success_count == len(migrations)
    except Exception as e:
        print(f"❌ 迁移过程错误: {e}")
        if conn:
            conn.close()
        return False

if __name__ == "__main__":
    success = run_all_migrations()
    exit(0 if success else 1)
