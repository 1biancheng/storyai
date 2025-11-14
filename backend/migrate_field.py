#!/usr/bin/env python3
"""
数据库字段迁移脚本 - 将projects表的metadata字段重命名为extra_data
"""

import asyncio
from services.db_service import get_db_service

async def migrate_field():
    """执行字段重命名迁移"""
    print("开始数据库字段迁移...")
    
    try:
        # 获取数据库服务
        db_service = await get_db_service()
        
        # 执行字段重命名
        async with db_service.engine.begin() as conn:
            import sqlalchemy as sa
            
            # 检查字段是否存在
            result = await conn.execute(sa.text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'projects' AND column_name = 'metadata'
            """))
            
            if result.fetchone():
                # 字段存在,执行重命名
                await conn.execute(sa.text("ALTER TABLE projects RENAME COLUMN metadata TO extra_data"))
                print("✓ 字段 'metadata' 成功重命名为 'extra_data'")
            else:
                print("ℹ 字段 'metadata' 不存在,跳过重命名")
                
            # 检查extra_data字段是否存在
            result = await conn.execute(sa.text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'projects' AND column_name = 'extra_data'
            """))
            
            if not result.fetchone():
                # 如果extra_data也不存在,添加该字段
                await conn.execute(sa.text("ALTER TABLE projects ADD COLUMN extra_data JSONB"))
                print("✓ 添加字段 'extra_data'")
            
        print("数据库字段迁移完成!")
        
    except Exception as e:
        print(f"迁移失败: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(migrate_field())