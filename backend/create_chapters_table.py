#!/usr/bin/env python3
"""
创建chapters表的脚本
"""

import asyncio
import asyncpg
import logging
import os
from config import get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

async def create_chapters_table():
    """创建chapters表"""
    try:
        # 获取数据库连接信息
        settings = get_settings()
        db_url = settings.database.url
        
        logger.info(f"连接到数据库: {db_url}")
        
        # 创建连接池
        pool = await asyncpg.create_pool(db_url, min_size=1, max_size=5)
        
        async with pool.acquire() as conn:
            # 检查表是否已存在
            table_exists = await conn.fetchval(
                "SELECT to_regclass('public.chapters')"
            )
            
            if table_exists:
                logger.info("chapters表已存在，检查列结构...")
                
                # 检查现有列
                columns = await conn.fetch(
                    """
                    SELECT column_name, data_type, column_default, is_nullable
                    FROM information_schema.columns 
                    WHERE table_name = 'chapters'
                    ORDER BY ordinal_position
                    """
                )
                
                existing_columns = {col['column_name']: col for col in columns}
                logger.info(f"现有列: {list(existing_columns.keys())}")
                
                # 检查并添加缺失的列
                required_columns = {
                    'file_mtime': ('REAL', '0'),
                    'file_size': ('INTEGER', '0'),
                    'status': ("TEXT", "'active'")
                }
                
                for col_name, (col_type, default_val) in required_columns.items():
                    if col_name not in existing_columns:
                        logger.info(f"添加缺失的列: {col_name}")
                        await conn.execute(f"""
                            ALTER TABLE chapters 
                            ADD COLUMN {col_name} {col_type} DEFAULT {default_val}
                        """)
                        
                        # 为status列添加CHECK约束
                        if col_name == 'status':
                            await conn.execute(f"""
                                ALTER TABLE chapters 
                                ADD CONSTRAINT check_chapters_status 
                                CHECK (status IN ('active', 'missing'))
                            """)
                
                # 检查索引
                index_exists = await conn.fetchval(
                    "SELECT to_regclass('public.idx_chapters_project_status')"
                )
                
                if not index_exists:
                    logger.info("创建索引: idx_chapters_project_status")
                    await conn.execute("""
                        CREATE INDEX idx_chapters_project_status 
                        ON chapters(project_id, status)
                    """)
                    
            else:
                logger.info("创建chapters表...")
                
                # 创建表
                await conn.execute("""
                    CREATE TABLE chapters (
                        id VARCHAR(20) PRIMARY KEY,
                        project_id VARCHAR(100) NOT NULL,
                        chapter_number INTEGER NOT NULL,
                        title VARCHAR(500) NOT NULL,
                        summary TEXT DEFAULT '',
                        word_count INTEGER DEFAULT 0,
                        tags JSONB DEFAULT '[]',
                        notes TEXT DEFAULT '',
                        display_order INTEGER NOT NULL,
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                        file_mtime REAL DEFAULT 0,
                        file_size INTEGER DEFAULT 0,
                        status TEXT DEFAULT 'active' CHECK (status IN ('active', 'missing'))
                    )
                """)
                
                logger.info("创建索引...")
                # 创建索引
                await conn.execute("""
                    CREATE INDEX idx_chapters_project_id ON chapters(project_id)
                """)
                
                await conn.execute("""
                    CREATE INDEX idx_chapters_project_number ON chapters(project_id, chapter_number)
                """)
                
                await conn.execute("""
                    CREATE INDEX idx_chapters_project_status ON chapters(project_id, status)
                """)
                
                logger.info("chapters表创建完成")
            
            # 验证表结构
            final_columns = await conn.fetch(
                """
                SELECT column_name, data_type, column_default, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'chapters'
                ORDER BY ordinal_position
                """
            )
            
            logger.info("最终表结构:")
            for col in final_columns:
                logger.info(f"  {col['column_name']}: {col['data_type']} {col['is_nullable']} default: {col['column_default']}")
            
            # 验证索引
            indexes = await conn.fetch("""
                SELECT indexname, indexdef 
                FROM pg_indexes 
                WHERE tablename = 'chapters'
            """)
            
            logger.info("索引:")
            for idx in indexes:
                logger.info(f"  {idx['indexname']}")
        
        await pool.close()
        logger.info("数据库连接池已关闭")
        
    except Exception as e:
        logger.error(f"创建chapters表时出错: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(create_chapters_table())