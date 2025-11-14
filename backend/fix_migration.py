#!/usr/bin/env python3
"""
修复数据库迁移问题 - 添加缺失的字段
"""
import asyncio
import asyncpg
import os

async def fix_migration():
    """修复数据库表结构"""
    try:
        # 数据库连接URL
        db_url = 'postgresql://postgres:postgres123@localhost:5432/story_ai'
        
        print(f"连接到数据库: {db_url}")
        conn = await asyncpg.connect(db_url)
        
        # 检查当前表结构
        print("\n=== 检查当前chapters表结构 ===")
        result = await conn.fetch("""
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'chapters' 
            ORDER BY ordinal_position
        """)
        
        existing_columns = [row['column_name'] for row in result]
        print(f"现有字段: {existing_columns}")
        
        # 添加缺失的字段
        print("\n=== 添加缺失字段 ===")
        
        # 添加 file_mtime 字段
        if 'file_mtime' not in existing_columns:
            await conn.execute("""
                ALTER TABLE chapters 
                ADD COLUMN file_mtime REAL DEFAULT 0
            """)
            print("✓ 添加 file_mtime 字段")
        else:
            print("✓ file_mtime 字段已存在")
        
        # 添加 file_size 字段
        if 'file_size' not in existing_columns:
            await conn.execute("""
                ALTER TABLE chapters 
                ADD COLUMN file_size INTEGER DEFAULT 0
            """)
            print("✓ 添加 file_size 字段")
        else:
            print("✓ file_size 字段已存在")
        
        # 添加 status 字段
        if 'status' not in existing_columns:
            await conn.execute("""
                ALTER TABLE chapters 
                ADD COLUMN status TEXT DEFAULT 'active'
            """)
            print("✓ 添加 status 字段")
        else:
            print("✓ status 字段已存在")
        
        # 创建索引
        print("\n=== 创建索引 ===")
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS idx_chapters_project_status 
            ON chapters(project_id, status)
        """)
        print("✓ 创建索引 idx_chapters_project_status")
        
        # 验证最终结果
        print("\n=== 验证表结构 ===")
        result = await conn.fetch("""
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'chapters' 
            ORDER BY ordinal_position
        """)
        
        final_columns = [row['column_name'] for row in result]
        print(f"最终字段列表: {final_columns}")
        
        # 检查是否所有需要的字段都存在
        required_fields = ['file_mtime', 'file_size', 'status']
        missing_fields = [field for field in required_fields if field not in final_columns]
        
        if missing_fields:
            print(f"\n❌ 仍然缺失字段: {missing_fields}")
        else:
            print(f"\n✅ 所有必需字段都已添加!")
        
        await conn.close()
        
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(fix_migration())