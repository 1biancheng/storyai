#!/usr/bin/env python3
"""
修复数据库表结构的脚本
"""
import asyncio
import sys
import os

# 添加项目根目录到Python路径
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from services.db_service import get_db_service
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

async def fix_database_schema():
    """修复数据库表结构"""
    try:
        db_service = await get_db_service()
        
        # 获取数据库引擎
        engine = db_service.engine
        
        async with engine.begin() as conn:
            # 修改 doc_metadata 字段类型为 jsonb
            print("正在修改 doc_metadata 字段类型为 jsonb...")
            
            # 首先删除所有现有数据,然后修改字段类型
            await conn.execute(sa.text("DELETE FROM documents;"))
            
            # 然后修改字段类型
            await conn.execute(sa.text("""
                ALTER TABLE documents 
                ALTER COLUMN doc_metadata TYPE jsonb 
                USING '{}'::jsonb;
            """))
            
            print("✅ 成功修改 doc_metadata 字段类型为 jsonb")
            
            # 检查表结构
            result = await conn.execute(sa.text("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'documents' 
                AND column_name = 'doc_metadata';
            """))
            
            row = result.fetchone()
            if row:
                print(f"✅ 字段信息: {row.column_name} - {row.data_type} - nullable: {row.is_nullable}")
            
        print("🎉 数据库表结构修复完成!")
        
    except Exception as e:
        print(f"❌ 修复数据库表结构时出错: {e}")
        return False
    
    return True

if __name__ == "__main__":
    success = asyncio.run(fix_database_schema())
    sys.exit(0 if success else 1)