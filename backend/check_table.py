#!/usr/bin/env python3
import asyncio
import asyncpg
import os

async def check_table_structure():
    """检查数据库表结构"""
    try:
        # 从环境变量或配置文件获取数据库URL
        db_url = os.getenv('DATABASE_URL', 'postgresql://postgres:postgres123@localhost:5432/story_ai')
        
        print(f"连接到数据库: {db_url}")
        conn = await asyncpg.connect(db_url)
        
        # 检查chapters表结构
        result = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'chapters' 
            ORDER BY ordinal_position
        """)
        
        print("\n=== chapters表结构 ===")
        if result:
            for row in result:
                print(f"  {row['column_name']} ({row['data_type']}) - nullable: {row['is_nullable']}, default: {row['column_default']}")
        else:
            print("  chapters表不存在!")
        
        # 检查所有表
        tables = await conn.fetch("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public'
        """)
        
        print("\n=== 所有表 ===")
        for table in tables:
            print(f"  - {table['table_name']}")
        
        await conn.close()
        
    except Exception as e:
        print(f"错误: {e}")

if __name__ == "__main__":
    asyncio.run(check_table_structure())