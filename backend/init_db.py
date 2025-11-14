"""
数据库初始化脚本
创建数据库表和pgvector扩展
"""

import asyncio
import logging
from typing import Optional
import asyncpg
from config import get_settings

logger = logging.getLogger(__name__)

async def create_database_if_not_exists():
    """创建数据库（如果不存在）"""
    settings = get_settings()
    
    # 连接到默认的postgres数据库
    conn = await asyncpg.connect(
        host=settings.database.host,
        port=settings.database.port,
        user=settings.database.username,
        password=settings.database.password,
        database='postgres'  # 连接到默认数据库
    )
    
    try:
        # 检查数据库是否存在
        result = await conn.fetchval(
            "SELECT 1 FROM pg_database WHERE datname = $1",
            settings.database.name
        )
        
        if not result:
            logger.info(f"创建数据库: {settings.database.name}")
            await conn.execute(f'CREATE DATABASE "{settings.database.name}"')
        else:
            logger.info(f"数据库已存在: {settings.database.name}")
            
    finally:
        await conn.close()

async def init_database():
    """初始化数据库和表结构"""
    settings = get_settings()
    
    # 首先创建数据库
    await create_database_if_not_exists()
    
    # 连接到目标数据库
    conn = await asyncpg.connect(
        host=settings.database.host,
        port=settings.database.port,
        user=settings.database.username,
        password=settings.database.password,
        database=settings.database.name
    )
    
    try:
        logger.info("开始初始化数据库...")
        
        # 启用pgvector扩展
        logger.info("启用pgvector扩展...")
        await conn.execute("CREATE EXTENSION IF NOT EXISTS vector")
        
        # 创建documents表
        logger.info("创建documents表...")
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS documents (
                id SERIAL PRIMARY KEY,
                title VARCHAR(500) NOT NULL,
                content TEXT NOT NULL,
                content_type VARCHAR(50) DEFAULT 'text',
                source VARCHAR(200),
                doc_metadata JSONB DEFAULT '{}',
                embedding vector(1536),
                embedding_model VARCHAR(100) DEFAULT 'text-embedding-ada-002',
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # 创建索引
        logger.info("创建索引...")
        
        # 向量相似度索引
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS documents_embedding_idx 
            ON documents USING hnsw (embedding vector_cosine_ops) 
            WITH (m = 16, ef_construction = 64)
        """)
        
        # 文本搜索索引
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS documents_content_idx 
            ON documents USING gin(to_tsvector('english', left(content, 300000)))
        """)
        
        # 标题索引
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS documents_title_idx 
            ON documents (title)
        """)
        
        # 元数据索引
        await conn.execute("""
            CREATE INDEX IF NOT EXISTS documents_metadata_idx 
            ON documents USING gin(doc_metadata)
        """)
        
        # 创建更新时间触发器函数
        await conn.execute("""
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql'
        """)
        
        # 创建触发器
        await conn.execute("""
            DROP TRIGGER IF EXISTS update_documents_updated_at ON documents
        """)
        
        await conn.execute("""
            CREATE TRIGGER update_documents_updated_at 
                BEFORE UPDATE ON documents 
                FOR EACH ROW 
                EXECUTE FUNCTION update_updated_at_column()
        """)
        
        # 插入示例数据
        logger.info("插入示例数据...")
        await conn.execute("""
            INSERT INTO documents (title, content, doc_metadata) 
            VALUES 
                ('示例文档1', '这是一个用于测试智能拼接功能的示例文档。', '{"category": "test", "priority": "high"}'),
                ('示例文档2', '另一个具有不同内容的示例文档，用于向量相似度测试。', '{"category": "test", "priority": "medium"}')
            ON CONFLICT DO NOTHING
        """)
        
        logger.info("数据库初始化完成！")
        
    except Exception as e:
        logger.error(f"数据库初始化失败: {e}")
        raise
    finally:
        await conn.close()

async def test_database_connection():
    """测试数据库连接"""
    settings = get_settings()
    
    try:
        conn = await asyncpg.connect(
            host=settings.database.host,
            port=settings.database.port,
            user=settings.database.username,
            password=settings.database.password,
            database=settings.database.name
        )
        
        # 测试查询
        result = await conn.fetchval("SELECT COUNT(*) FROM documents")
        logger.info(f"数据库连接成功！文档表中有 {result} 条记录")
        
        # 测试pgvector扩展
        version = await conn.fetchval("SELECT extversion FROM pg_extension WHERE extname = 'vector'")
        if version:
            logger.info(f"pgvector扩展版本: {version}")
        else:
            logger.warning("pgvector扩展未安装")
            
        await conn.close()
        return True
        
    except Exception as e:
        logger.error(f"数据库连接测试失败: {e}")
        return False

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    
    async def main():
        try:
            await init_database()
            await test_database_connection()
        except Exception as e:
            logger.error(f"初始化过程失败: {e}")
            return False
        return True
    
    success = asyncio.run(main())
    if success:
        print("✅ 数据库初始化成功！")
    else:
        print("❌ 数据库初始化失败！")
