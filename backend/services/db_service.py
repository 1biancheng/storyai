"""
PostgreSQL + pgvector 数据库服务
支持向量检索和HNSW索引优化
"""

import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
from contextlib import asynccontextmanager
import json
import numpy as np

try:
    import asyncpg
    import sqlalchemy as sa
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    from sqlalchemy.pool import NullPool
    from sqlalchemy.orm import declarative_base
    from sqlalchemy.dialects.postgresql import UUID, ARRAY, JSONB
    from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean
    from sqlalchemy.sql import func
    from pgvector.sqlalchemy import Vector
    DEPENDENCIES_AVAILABLE = True
except ImportError:
    DEPENDENCIES_AVAILABLE = False
    logging.warning("Database dependencies not available. Install: pip install asyncpg sqlalchemy[asyncio] numpy pgvector")

from services.cache_service import get_cache
from config import get_settings

logger = logging.getLogger(__name__)

# 获取配置
settings = get_settings()

# SQLAlchemy Base
Base = declarative_base()

class Document(Base):
    """文档表 - 支持向量检索"""
    __tablename__ = "documents"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(500), nullable=False, index=True)
    content = Column(Text, nullable=False)
    content_type = Column(String(50), default="text", index=True)
    source = Column(String(200), index=True)
    doc_metadata = Column(JSONB)  # JSONB数据
    embedding = Column(Vector(1536), nullable=True)  # 向量嵌入
    embedding_model = Column(String(100), default="text-embedding-ada-002")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    is_active = Column(Boolean, default=True, index=True)

class Paragraph(Base):
    """语义段落表 - 向量段落库"""
    __tablename__ = "paragraphs"

    id = Column(Integer, primary_key=True, index=True)
    book_id = Column(String(100), nullable=True, index=True)
    chapter_index = Column(Integer, nullable=True)
    section_index = Column(Integer, nullable=True)
    paragraph_index = Column(Integer, nullable=True)
    content = Column(Text, nullable=False)
    meta = Column(JSONB)  # 主题/情感/人物等标签
    embedding = Column(Vector(1536), nullable=True)
    embedding_model = Column(String(100), default="text-embedding-3-small")
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class Formula(Base):
    """剧情公式/拼接规则库"""
    __tablename__ = "formulas"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    category = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    expression = Column(Text, nullable=False)  # DSL表达式
    parameters = Column(JSONB)  # 默认参数集
    embedding = Column(Vector(1536), nullable=True)
    embedding_model = Column(String(100), default="text-embedding-3-small")
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class VectorIndex(Base):
    """向量索引管理表"""
    __tablename__ = "vector_indexes"
    
    id = Column(Integer, primary_key=True)
    table_name = Column(String(100), nullable=False)
    column_name = Column(String(100), nullable=False)
    index_type = Column(String(50), default="ivfflat")  # ivfflat, hnsw
    index_params = Column(JSONB)  # JSONB参数
    dimension = Column(Integer, nullable=False)
    distance_metric = Column(String(20), default="cosine")  # cosine, l2, inner_product
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)

class ModelConfig(Base):
    """AI模型配置表"""
    __tablename__ = "model_configs"
    
    id = Column(String(100), primary_key=True)  # 模型配置ID
    name = Column(String(200), nullable=False)  # 显示名称
    model_id = Column(String(200), nullable=False)  # 实际模型ID
    provider = Column(String(50), nullable=False)  # gemini, anthropic, openai等
    base_url = Column(String(500), nullable=False)  # API基础URL
    api_key = Column(String(500), nullable=True)  # API密钥(加密存储)
    model_name = Column(String(200), nullable=True)  # 模型名称
    is_default = Column(Boolean, default=False)  # 是否默认模型
    is_active = Column(Boolean, default=True, index=True)
    config_metadata = Column(JSONB)  # 额外配置参数
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class SystemStats(Base):
    """系统统计表"""
    __tablename__ = "system_stats"
    
    id = Column(Integer, primary_key=True)
    stat_type = Column(String(100), nullable=False, index=True)  # workflow, project, api_call等
    stat_key = Column(String(200), nullable=False, index=True)  # 具体统计项
    stat_value = Column(Float, nullable=False)  # 统计值
    stat_metadata = Column(JSONB)  # 额外元数据
    recorded_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    is_active = Column(Boolean, default=True)

class Project(Base):
    """项目表 - 用于存储项目基本信息"""
    __tablename__ = "projects"
    
    id = Column(String(100), primary_key=True)  # 项目ID (使用nanoid)
    name = Column(String(200), nullable=False)  # 项目名称
    genre = Column(String(100), nullable=True)  # 项目类型/题材
    requirements = Column(Text, nullable=True)  # 项目需求描述
    workflow_id = Column(String(100), nullable=True)  # 关联的工作流ID
    settings = Column(JSONB)  # 项目设置配置
    extra_data = Column(JSONB)  # 扩展数据 (避免使用metadata保留字段)
    is_active = Column(Boolean, default=True, index=True)  # 是否激活
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

class DatabaseService:
    """数据库服务类"""
    
    def __init__(self):
        self.engine = None
        self.session_factory = None
        self._initialized = False
        
    async def initialize(self):
        """初始化数据库连接"""
        if not DEPENDENCIES_AVAILABLE:
            logger.error("Database dependencies not available")
            return False
            
        try:
            # 创建异步引擎 - 使用asyncpg驱动
            database_url = settings.get_database_url()
            # 将postgresql://替换为postgresql+asyncpg://以使用asyncpg驱动
            if database_url.startswith("postgresql://"):
                database_url = database_url.replace("postgresql://", "postgresql+asyncpg://")
            
            self.engine = create_async_engine(
                database_url,
                poolclass=NullPool,  # 使用NullPool避免连接池相关问题
                echo=settings.debug,
                connect_args={
                    "prepared_statement_cache_size": 0,  # 禁用预处理语句缓存
                    "server_settings": {
                        "jit": "off",  # 禁用JIT编译
                        "application_name": "story_ai_backend"
                    }
                }
            )
            
            # 创建会话工厂
            self.session_factory = async_sessionmaker(
                self.engine,
                class_=AsyncSession,
                expire_on_commit=False
            )
            
            # 测试连接
            async with self.engine.begin() as conn:
                await conn.execute(sa.text("SELECT 1"))
                
            # 确保pgvector扩展存在
            await self._ensure_pgvector_extension()
            
            # 创建表
            await self._create_tables()
            
            # 将嵌入列迁移为 pgvector 类型(如果尚未迁移)
            await self._ensure_vector_columns()
            
            # 创建向量索引
            await self._create_vector_indexes()

            # 创建/修复文本搜索索引(确保使用截断以避免 tsvector 1MB 限制)
            await self._ensure_text_indexes()
            
            self._initialized = True
            logger.info("Database service initialized successfully")
            return True
            
        except Exception as e:
            logger.error(f"Failed to initialize database: {str(e)}")
            return False
    
    async def _ensure_pgvector_extension(self):
        """确保pgvector扩展已安装"""
        try:
            async with self.engine.begin() as conn:
                await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
                logger.info("pgvector extension ensured")
        except Exception as e:
            logger.error(f"Failed to create pgvector extension: {str(e)}")
            raise
    
    async def _create_tables(self):
        """创建数据库表"""
        try:
            async with self.engine.begin() as conn:
                await conn.run_sync(Base.metadata.create_all)
                logger.info("Database tables created")
        except Exception as e:
            logger.error(f"Failed to create tables: {str(e)}")
            raise

    async def _ensure_vector_columns(self):
        """确保 embedding 列为 pgvector 类型.如果当前为数组类型,执行一次性迁移."""
        try:
            async with self.engine.begin() as conn:
                # documents.embedding
                result = await conn.execute(sa.text(
                    "SELECT udt_name FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'embedding'"
                ))
                row = result.fetchone()
                if not row or row[0] != 'vector':
                    logger.info("Migrating documents.embedding to vector(1536)")
                    await conn.execute(sa.text(
                        "ALTER TABLE documents ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector"
                    ))

                # paragraphs.embedding
                result = await conn.execute(sa.text(
                    "SELECT udt_name FROM information_schema.columns WHERE table_name = 'paragraphs' AND column_name = 'embedding'"
                ))
                row = result.fetchone()
                if not row or row[0] != 'vector':
                    logger.info("Migrating paragraphs.embedding to vector(1536)")
                    await conn.execute(sa.text(
                        "ALTER TABLE paragraphs ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector"
                    ))

                # formulas.embedding
                result = await conn.execute(sa.text(
                    "SELECT udt_name FROM information_schema.columns WHERE table_name = 'formulas' AND column_name = 'embedding'"
                ))
                row = result.fetchone()
                if row and row[0] != 'vector':
                    logger.info("Migrating formulas.embedding to vector(1536)")
                    await conn.execute(sa.text(
                        "ALTER TABLE formulas ALTER COLUMN embedding TYPE vector(1536) USING embedding::vector"
                    ))
        except Exception as e:
            logger.warning(f"Failed to ensure vector columns: {str(e)}")
    
    async def _create_vector_indexes(self):
        """创建向量索引"""
        try:
            async with self.engine.begin() as conn:
                # 检查是否已存在索引
                result = await conn.execute(sa.text("""
                    SELECT indexname FROM pg_indexes 
                    WHERE tablename = 'documents' AND indexname = 'idx_documents_embedding_hnsw'
                """))
                
                if not result.fetchone():
                    # 创建HNSW索引(推荐用于高维向量)
                    await conn.execute(sa.text("""
                        CREATE INDEX IF NOT EXISTS idx_documents_embedding_hnsw 
                        ON documents USING hnsw (embedding vector_cosine_ops)
                        WITH (m = 16, ef_construction = 64)
                    """))
                    logger.info("HNSW vector index created")
                    
                    # 记录索引信息
                    await self._record_vector_index(
                        conn, "documents", "embedding", "hnsw", 
                        {"m": 16, "ef_construction": 64}, 1536, "cosine"
                    )

                # 为 paragraphs 创建向量索引
                result_p = await conn.execute(sa.text("""
                    SELECT indexname FROM pg_indexes 
                    WHERE tablename = 'paragraphs' AND indexname = 'idx_paragraphs_embedding_hnsw'
                """))
                if not result_p.fetchone():
                    await conn.execute(sa.text("""
                        CREATE INDEX IF NOT EXISTS idx_paragraphs_embedding_hnsw 
                        ON paragraphs USING hnsw (embedding vector_cosine_ops)
                        WITH (m = 16, ef_construction = 64)
                    """))
                    logger.info("HNSW vector index for paragraphs created")
                    await self._record_vector_index(
                        conn, "paragraphs", "embedding", "hnsw",
                        {"m": 16, "ef_construction": 64}, 1536, "cosine"
                    )
                
        except Exception as e:
            logger.warning(f"Failed to create vector indexes: {str(e)}")
            # 尝试创建IVFFlat索引作为备选
            try:
                async with self.engine.begin() as conn:
                    await conn.execute(sa.text("""
                        CREATE INDEX IF NOT EXISTS idx_documents_embedding_ivfflat 
                        ON documents USING ivfflat (embedding vector_cosine_ops)
                        WITH (lists = 100)
                    """))
                    logger.info("IVFFlat vector index created as fallback")
                    # paragraphs 备选索引
                    await conn.execute(sa.text("""
                        CREATE INDEX IF NOT EXISTS idx_paragraphs_embedding_ivfflat 
                        ON paragraphs USING ivfflat (embedding vector_cosine_ops)
                        WITH (lists = 100)
                    """))
                    logger.info("IVFFlat vector index for paragraphs created as fallback")
            except Exception as e2:
                logger.error(f"Failed to create fallback index: {str(e2)}")

    async def _ensure_text_indexes(self):
        """确保文本搜索索引安全:对 content 采用截断,避免 ProgramLimitExceededError.
        规则:documents_content_idx 使用 to_tsvector('english', left(content, 300000))
        若发现旧索引未使用截断表达式,则删除并重建.
        """
        try:
            async with self.engine.begin() as conn:
                # 查询现有索引定义
                res = await conn.execute(sa.text(
                    """
                    SELECT indexname, indexdef
                    FROM pg_indexes
                    WHERE tablename = 'documents' AND indexname = 'documents_content_idx'
                    """
                ))
                row = res.fetchone()
                desired = "to_tsvector('english', left(content, 300000))"
                if row:
                    indexdef = row.indexdef if hasattr(row, 'indexdef') else row[1]
                    if desired not in indexdef:
                        logger.warning("Found legacy documents_content_idx without truncation; rebuilding...")
                        await conn.execute(sa.text("DROP INDEX IF EXISTS documents_content_idx"))
                        await conn.execute(sa.text(
                            """
                            CREATE INDEX documents_content_idx 
                            ON documents USING gin(to_tsvector('english', left(content, 300000)))
                            """
                        ))
                        logger.info("documents_content_idx rebuilt with truncation")
                    else:
                        logger.info("documents_content_idx is up-to-date")
                else:
                    # 不存在则创建
                    await conn.execute(sa.text(
                        """
                        CREATE INDEX IF NOT EXISTS documents_content_idx 
                        ON documents USING gin(to_tsvector('english', left(content, 300000)))
                        """
                    ))
                    logger.info("documents_content_idx created (with truncation)")
        except Exception as e:
            logger.warning(f"Failed to ensure text indexes: {str(e)}")
    
    async def _record_vector_index(self, conn, table_name: str, column_name: str, 
                                 index_type: str, params: Dict, dimension: int, metric: str):
        """记录向量索引信息"""
        await conn.execute(sa.text("""
            INSERT INTO vector_indexes (table_name, column_name, index_type, index_params, dimension, distance_metric)
            VALUES (:table_name, :column_name, :index_type, :params, :dimension, :metric)
            ON CONFLICT DO NOTHING
        """), {
            "table_name": table_name,
            "column_name": column_name,
            "index_type": index_type,
            "params": json.dumps(params),
            "dimension": dimension,
            "metric": metric
        })
    
    @asynccontextmanager
    async def get_session(self):
        """获取数据库会话"""
        if not self._initialized:
            await self.initialize()
        
        # 创建会话
        session = self.session_factory()
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database session error: {str(e)}")
            raise
        finally:
            await session.close()
    
    async def insert_document(self, title: str, content: str, embedding: Optional[List[float]] = None,
                            content_type: str = "text", source: str = None, 
                            doc_metadata: Dict = None) -> int:
        """插入文档"""
        async with self.get_session() as session:
            # {{ logic+clean fix | 来源: PostgreSQL JSONB类型接收字符串表达式错误修复 }}
            # 确保 doc_metadata 是有效的字典类型，避免 PostgreSQL JSONB 类型错误
            if doc_metadata is None:
                doc_metadata = {}
            elif isinstance(doc_metadata, str):
                try:
                    # 使用安全的JSON解析
                    from services.json_repairer import safe_json_loads
                    doc_metadata = safe_json_loads(doc_metadata, {})
                except Exception:
                    doc_metadata = {}
            elif not isinstance(doc_metadata, dict):
                # 如果不是字典类型，强制转换为空字典
                doc_metadata = {}
            
            doc = Document(
                title=title,
                content=content,
                content_type=content_type,
                source=source,
                doc_metadata=doc_metadata,  # 确保传递的是字典，不是字符串
                # 统一 CAST 策略: 初次插入不直接绑定 Python list 到 pgvector 列
                embedding=None
            )
            session.add(doc)
            await session.commit()
            await session.refresh(doc)
            # 若提供 embedding,使用 CAST 文本安全更新 vector 列
            if embedding:
                embedding_str = '[' + ','.join(map(str, embedding)) + ']'
                await session.execute(
                    sa.text("UPDATE documents SET embedding = CAST(:embedding AS vector) WHERE id = :doc_id"),
                    {"embedding": embedding_str, "doc_id": doc.id}
                )
                await session.commit()
            return doc.id

    async def insert_paragraphs(self, paragraphs: List[Dict[str, Any]]) -> List[int]:
        """Batch insert paragraphs with optimized bulk operations
        Uses SQLAlchemy bulk_insert_mappings for better performance
        
        Args:
            paragraphs: List of paragraph dicts with keys:
                - content (required)
                - book_id, chapter_index, section_index, paragraph_index (optional)
                - meta, embedding, embedding_model (optional)
        
        Returns:
            List of inserted paragraph IDs
        """
        if not paragraphs:
            return []
        
        ids: List[int] = []
        # {{ logic+clean fix | 来源: PG numeric type mismatch("vector" OID) }}
        # 说明: 初始插入不直接绑定 Python list 到 embedding 列,避免 asyncpg/SQLAlchemy 对未知 PG 数字类型解码失败.
        # 后续使用 CAST(:embedding AS vector) 以文本形式安全更新向量.
        
        # Use bulk_insert_mappings for better performance
        async with self.get_session() as session:
            # Prepare mappings
            mappings = []
            pending_embeddings: List[Optional[List[float]]] = []
            pending_models: List[str] = []
            for p in paragraphs:
                mapping = {
                    "book_id": p.get("book_id"),
                    "chapter_index": p.get("chapter_index"),
                    "section_index": p.get("section_index"),
                    "paragraph_index": p.get("paragraph_index"),
                    "content": p["content"],
                    "meta": p.get("meta", {}),
                    # 初始插入统一置空,后续以 CAST 方式更新
                    "embedding": None,
                    "embedding_model": p.get("embedding_model", "text-embedding-3-small"),
                    "is_active": True
                }
                mappings.append(mapping)
                pending_embeddings.append(p.get("embedding"))
                pending_models.append(p.get("embedding_model", "text-embedding-3-small"))
            
            # Bulk insert with return of IDs
            # Note: bulk_insert_mappings doesn't return IDs directly, so we need a workaround
            # We'll insert and then query back the IDs
            for mapping in mappings:
                para = Paragraph(**mapping)
                session.add(para)
                await session.flush()
                ids.append(para.id)
            
            # 使用 CAST 将 embedding 文本安全写入 vector 列,避免客户端类型编解码器问题
            for pid, emb, model in zip(ids, pending_embeddings, pending_models):
                if emb:
                    emb_str = '[' + ','.join(map(str, emb)) + ']'
                    await session.execute(
                        sa.text("UPDATE paragraphs SET embedding = CAST(:embedding AS vector), embedding_model = :model WHERE id = :id")
                        , {"embedding": emb_str, "model": model, "id": pid}
                    )
            
            await session.commit()
        
        return ids
    
    async def update_document_embedding(self, doc_id: int, embedding: List[float], 
                                      embedding_model: str = "text-embedding-ada-002"):
        """更新文档嵌入向量"""
        async with self.get_session() as session:
            # {{ logic+clean fix | 来源: 使用 CAST 文本注入 vector 类型,绕过客户端类型解码 }}
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'
            await session.execute(
                sa.text("UPDATE documents SET embedding = CAST(:embedding AS vector), embedding_model = :embedding_model WHERE id = :doc_id"),
                {"embedding": embedding_str, "embedding_model": embedding_model, "doc_id": doc_id}
            )
            await session.commit()
    
    async def vector_search(self, query_embedding: List[float], limit: int = 10, 
                          threshold: float = 0.8, content_type: str = None) -> List[Dict]:
        """向量相似度搜索"""
        async with self.get_session() as session:
            # 将向量转换为字符串格式以避免参数类型问题
            embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'
            
            # 构建查询,使用参数化查询避免类型问题
            if content_type is None:
                query = sa.text("""
                    SELECT id, title, content, content_type, source, doc_metadata,
                           1 - (embedding <=> CAST(:query_embedding AS vector)) as similarity
                    FROM documents 
                    WHERE embedding IS NOT NULL 
                      AND is_active = true
                      AND 1 - (embedding <=> CAST(:query_embedding AS vector)) >= :threshold
                    ORDER BY embedding <=> CAST(:query_embedding AS vector)
                    LIMIT :limit
                """)
                
                result = await session.execute(query, {
                    "query_embedding": embedding_str,
                    "limit": limit,
                    "threshold": threshold
                })
            else:
                query = sa.text("""
                    SELECT id, title, content, content_type, source, doc_metadata,
                           1 - (embedding <=> CAST(:query_embedding AS vector)) as similarity
                    FROM documents 
                    WHERE embedding IS NOT NULL 
                      AND is_active = true
                      AND content_type = :content_type
                      AND 1 - (embedding <=> CAST(:query_embedding AS vector)) >= :threshold
                    ORDER BY embedding <=> CAST(:query_embedding AS vector)
                    LIMIT :limit
                """)
                
                result = await session.execute(query, {
                    "query_embedding": embedding_str,
                    "limit": limit,
                    "threshold": threshold,
                    "content_type": content_type
                })
            
            documents = []
            for row in result:
                doc = {
                    "id": row.id,
                    "title": row.title,
                    "content": row.content,
                    "content_type": row.content_type,
                    "source": row.source,
                    "doc_metadata": row.doc_metadata if row.doc_metadata else {},
                    "similarity": float(row.similarity)
                }
                documents.append(doc)
            
            return documents

    async def vector_search_paragraphs(self, query_embedding: List[float], limit: int = 10, threshold: float = 0.8,
                                       book_id: Optional[str] = None) -> List[Dict]:
        """段落向量相似度搜索"""
        async with self.get_session() as session:
            embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'
            if book_id is None:
                query = sa.text("""
                    SELECT id, content, meta,
                           1 - (embedding <=> CAST(:query_embedding AS vector)) as similarity
                    FROM paragraphs
                    WHERE embedding IS NOT NULL AND is_active = true
                      AND 1 - (embedding <=> CAST(:query_embedding AS vector)) >= :threshold
                    ORDER BY embedding <=> CAST(:query_embedding AS vector)
                    LIMIT :limit
                """)
                params = {"query_embedding": embedding_str, "limit": limit, "threshold": threshold}
            else:
                query = sa.text("""
                    SELECT id, content, meta,
                           1 - (embedding <=> CAST(:query_embedding AS vector)) as similarity
                    FROM paragraphs
                    WHERE embedding IS NOT NULL AND is_active = true AND book_id = :book_id
                      AND 1 - (embedding <=> CAST(:query_embedding AS vector)) >= :threshold
                    ORDER BY embedding <=> CAST(:query_embedding AS vector)
                    LIMIT :limit
                """)
                params = {"query_embedding": embedding_str, "limit": limit, "threshold": threshold, "book_id": book_id}

            result = await session.execute(query, params)
            items: List[Dict[str, Any]] = []
            for row in result:
                items.append({
                    "id": row.id,
                    "content": row.content,
                    "meta": row.meta or {},
                    "similarity": float(row.similarity)
                })
            return items
    
    async def hybrid_search(self, query_text: str, query_embedding: List[float], 
                          limit: int = 10, text_weight: float = 0.3, 
                          vector_weight: float = 0.7) -> List[Dict]:
        """混合搜索(文本+向量)"""
        async with self.get_session() as session:
            # {{ logic+clean fix | 来源: 混合搜索参数类型错误修复 }}
            # 修复查询参数类型不匹配问题，确保所有参数正确传递
            # 将向量转换为字符串格式
            embedding_str = '[' + ','.join(map(str, query_embedding)) + ']'
            
            # 修复 SQL 语法错误：ts_rank 函数调用
            query = sa.text("""
                SELECT id, title, content, content_type, source, doc_metadata,
                       ts_rank(to_tsvector('english', title || ' ' || left(content, 300000)), plainto_tsquery(:query_text)) as text_score,
                       1 - (embedding <=> CAST(:query_embedding AS vector)) as vector_score,
                       (:text_weight * ts_rank(to_tsvector('english', title || ' ' || left(content, 300000)), plainto_tsquery(:query_text)) + 
                        :vector_weight * (1 - (embedding <=> CAST(:query_embedding AS vector)))) as combined_score
                FROM documents 
                WHERE embedding IS NOT NULL 
                  AND is_active = true
                  AND (to_tsvector('english', title || ' ' || left(content, 300000)) @@ plainto_tsquery(:query_text)
                       OR 1 - (embedding <=> CAST(:query_embedding AS vector)) >= 0.5)
                ORDER BY combined_score DESC
                LIMIT :limit
            """)
            
            result = await session.execute(query, {
                "query_text": query_text,
                "query_embedding": embedding_str,
                "text_weight": text_weight,
                "vector_weight": vector_weight,
                "limit": limit
            })
            
            documents = []
            for row in result:
                doc = {
                    "id": row.id,
                    "title": row.title,
                    "content": row.content,
                    "content_type": row.content_type,
                    "source": row.source,
                    "doc_metadata": row.doc_metadata if row.doc_metadata else {},
                    "text_score": float(row.text_score or 0),
                    "vector_score": float(row.vector_score or 0),
                    "combined_score": float(row.combined_score or 0)
                }
                documents.append(doc)
            
            return documents
    
    async def get_document(self, doc_id: int) -> Optional[Dict]:
        """获取单个文档"""
        async with self.get_session() as session:
            result = await session.execute(
                sa.select(Document).where(Document.id == doc_id, Document.is_active == True)
            )
            doc = result.scalar_one_or_none()
            
            if doc:
                return {
                    "id": doc.id,
                    "title": doc.title,
                    "content": doc.content,
                    "content_type": doc.content_type,
                    "source": doc.source,
                    "doc_metadata": doc.doc_metadata if doc.doc_metadata else {},
                    "embedding_model": doc.embedding_model,
                    "created_at": doc.created_at,
                    "updated_at": doc.updated_at
                }
            return None

    async def get_paragraph(self, para_id: int) -> Optional[Dict]:
        """获取单个段落"""
        async with self.get_session() as session:
            result = await session.execute(
                sa.select(Paragraph).where(Paragraph.id == para_id, Paragraph.is_active == True)
            )
            para = result.scalar_one_or_none()
            if para:
                return {
                    "id": para.id,
                    "content": para.content,
                    "meta": para.meta or {},
                    "embedding_model": para.embedding_model,
                    "created_at": para.created_at,
                    "updated_at": para.updated_at
                }
            return None

    async def update_paragraph_embedding(self, para_id: int, embedding: List[float],
                                         embedding_model: str = "text-embedding-3-small"):
        """更新段落嵌入向量"""
        async with self.get_session() as session:
            # {{ logic+clean fix | 来源: 使用 CAST 文本注入 vector 类型,绕过客户端类型解码 }}
            embedding_str = '[' + ','.join(map(str, embedding)) + ']'
            await session.execute(
                sa.text("UPDATE paragraphs SET embedding = CAST(:embedding AS vector), embedding_model = :embedding_model WHERE id = :para_id"),
                {"embedding": embedding_str, "embedding_model": embedding_model, "para_id": para_id}
            )
            await session.commit()

    async def delete_paragraph(self, para_id: int, soft_delete: bool = True):
        """删除段落"""
        async with self.get_session() as session:
            if soft_delete:
                await session.execute(
                    sa.update(Paragraph)
                    .where(Paragraph.id == para_id)
                    .values(is_active=False)
                )
            else:
                await session.execute(sa.delete(Paragraph).where(Paragraph.id == para_id))
            await session.commit()

    async def insert_formula(self, name: str, expression: str, category: Optional[str] = None,
                             description: Optional[str] = None, parameters: Optional[Dict[str, Any]] = None,
                             embedding: Optional[List[float]] = None, embedding_model: str = "text-embedding-3-small") -> int:
        """插入公式"""
        async with self.get_session() as session:
            formula = Formula(
                name=name,
                category=category,
                description=description,
                expression=expression,
                parameters=parameters or {},
                # 统一 CAST 策略: 初次插入不直接绑定 Python list 到 pgvector 列
                embedding=None,
                embedding_model=embedding_model,
                is_active=True
            )
            session.add(formula)
            await session.commit()
            await session.refresh(formula)
            # 若提供 embedding,使用 CAST 文本安全更新 vector 列
            if embedding:
                embedding_str = '[' + ','.join(map(str, embedding)) + ']'
                await session.execute(
                    sa.text("UPDATE formulas SET embedding = CAST(:embedding AS vector), embedding_model = :embedding_model WHERE id = :id"),
                    {"embedding": embedding_str, "embedding_model": embedding_model, "id": formula.id}
                )
                await session.commit()
            return formula.id

    async def get_formulas(self, category: Optional[str] = None) -> List[Dict[str, Any]]:
        """查询公式列表"""
        async with self.get_session() as session:
            stmt = sa.select(Formula).where(Formula.is_active == True)
            if category:
                stmt = stmt.where(Formula.category == category)
            result = await session.execute(stmt)
            formulas: List[Dict[str, Any]] = []
            for f in result.scalars():
                formulas.append({
                    "id": f.id,
                    "name": f.name,
                    "category": f.category,
                    "description": f.description,
                    "expression": f.expression,
                    "parameters": f.parameters or {},
                    "embedding_model": f.embedding_model,
                    "created_at": f.created_at,
                    "updated_at": f.updated_at
                })
            return formulas

    async def update_formula(self, formula_id: int, updates: Dict[str, Any]) -> bool:
        """更新公式"""
        async with self.get_session() as session:
            # 统一 CAST 策略: 如包含 embedding,先以 CAST 更新向量列
            if "embedding" in updates:
                emb = updates.pop("embedding")
                emb_model = updates.get("embedding_model")
                if emb is not None:
                    emb_str = '[' + ','.join(map(str, emb)) + ']'
                    if emb_model is not None:
                        await session.execute(
                            sa.text("UPDATE formulas SET embedding = CAST(:embedding AS vector), embedding_model = :embedding_model WHERE id = :id"),
                            {"embedding": emb_str, "embedding_model": emb_model, "id": formula_id}
                        )
                        # embedding_model 已在上一步更新,避免重复
                        updates.pop("embedding_model", None)
                    else:
                        await session.execute(
                            sa.text("UPDATE formulas SET embedding = CAST(:embedding AS vector) WHERE id = :id"),
                            {"embedding": emb_str, "id": formula_id}
                        )
                else:
                    await session.execute(
                        sa.text("UPDATE formulas SET embedding = NULL WHERE id = :id"),
                        {"id": formula_id}
                    )
            # 其余字段走常规 ORM 更新
            if updates:
                await session.execute(
                    sa.update(Formula)
                    .where(Formula.id == formula_id)
                    .values(**updates)
                )
            await session.commit()
            return True

    async def delete_formula(self, formula_id: int, soft_delete: bool = True) -> bool:
        """删除公式"""
        async with self.get_session() as session:
            if soft_delete:
                await session.execute(
                    sa.update(Formula)
                    .where(Formula.id == formula_id)
                    .values(is_active=False)
                )
            else:
                await session.execute(sa.delete(Formula).where(Formula.id == formula_id))
            await session.commit()
            return True
    
    async def delete_document(self, doc_id: int, soft_delete: bool = True):
        """删除文档"""
        async with self.get_session() as session:
            if soft_delete:
                await session.execute(
                    sa.update(Document)
                    .where(Document.id == doc_id)
                    .values(is_active=False)
                )
            else:
                await session.execute(
                    sa.delete(Document).where(Document.id == doc_id)
                )
            await session.commit()
    
    async def get_database_stats(self) -> Dict:
        """获取数据库统计信息"""
        async with self.get_session() as session:
            # 文档统计
            doc_count = await session.execute(
                sa.select(func.count(Document.id)).where(Document.is_active == True)
            )
            total_docs = doc_count.scalar()
            
            # 有嵌入向量的文档数
            embedded_count = await session.execute(
                sa.select(func.count(Document.id))
                .where(Document.is_active == True, Document.embedding.isnot(None))
            )
            embedded_docs = embedded_count.scalar()

            # 段落统计
            para_count = await session.execute(
                sa.select(func.count(Paragraph.id)).where(Paragraph.is_active == True)
            )
            total_paras = para_count.scalar()
            para_emb_count = await session.execute(
                sa.select(func.count(Paragraph.id))
                .where(Paragraph.is_active == True, Paragraph.embedding.isnot(None))
            )
            embedded_paras = para_emb_count.scalar()
            
            # 索引信息
            indexes = await session.execute(sa.select(VectorIndex))
            index_info = [
                {
                    "table": idx.table_name,
                    "column": idx.column_name,
                    "type": idx.index_type,
                    "dimension": idx.dimension,
                    "metric": idx.distance_metric,
                    "active": idx.is_active
                }
                for idx in indexes.scalars()
            ]
            
            return {
                "total_documents": total_docs,
                "embedded_documents": embedded_docs,
                "embedding_coverage": embedded_docs / total_docs if total_docs > 0 else 0,
                "total_paragraphs": total_paras,
                "embedded_paragraphs": embedded_paras,
                "paragraph_embedding_coverage": embedded_paras / total_paras if total_paras > 0 else 0,
                "vector_indexes": index_info,
                "database_url": settings.get_database_url().split("@")[-1] if "@" in settings.get_database_url() else "localhost"
            }
    
    # Model Configuration Management Methods
    async def get_model_configs(self) -> List[Dict[str, Any]]:
        """Get all model configurations"""
        async with self.get_session() as session:
            result = await session.execute(
                sa.select(ModelConfig).where(ModelConfig.is_active == True)
            )
            configs = result.scalars().all()
            return [{
                "id": c.id,
                "name": c.name,
                "model_id": c.model_id,
                "provider": c.provider,
                "base_url": c.base_url,
                "model_name": c.model_name,
                "is_default": c.is_default,
                "config_metadata": c.config_metadata,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None
            } for c in configs]
    
    async def get_model_config_by_id(self, config_id: str) -> Optional[Dict[str, Any]]:
        """Get model configuration by ID"""
        async with self.get_session() as session:
            result = await session.execute(
                sa.select(ModelConfig).where(
                    ModelConfig.id == config_id,
                    ModelConfig.is_active == True
                )
            )
            config = result.scalar_one_or_none()
            if config:
                return {
                    "id": config.id,
                    "name": config.name,
                    "model_id": config.model_id,
                    "provider": config.provider,
                    "base_url": config.base_url,
                    "api_key": config.api_key,
                    "model_name": config.model_name,
                    "is_default": config.is_default,
                    "config_metadata": config.config_metadata
                }
            return None
    
    async def create_model_config(self, config_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new model configuration"""
        async with self.get_session() as session:
            config = ModelConfig(
                id=config_data["id"],
                name=config_data["name"],
                model_id=config_data["model_id"],
                provider=config_data["provider"],
                base_url=config_data["base_url"],
                api_key=config_data.get("api_key"),
                model_name=config_data.get("model_name", config_data["model_id"]),
                is_default=config_data.get("is_default", False),
                config_metadata=config_data.get("config_metadata", {})
            )
            session.add(config)
            await session.commit()
            await session.refresh(config)
            return {
                "id": config.id,
                "name": config.name,
                "model_id": config.model_id,
                "provider": config.provider,
                "base_url": config.base_url,
                "model_name": config.model_name,
                "is_default": config.is_default,
                "config_metadata": config.config_metadata
            }
    
    async def update_model_config(self, config_id: str, updates: Dict[str, Any]) -> bool:
        """Update model configuration"""
        async with self.get_session() as session:
            result = await session.execute(
                sa.update(ModelConfig)
                .where(ModelConfig.id == config_id)
                .values(**updates)
            )
            await session.commit()
            return result.rowcount > 0
    
    async def delete_model_config(self, config_id: str) -> bool:
        """Soft delete model configuration"""
        async with self.get_session() as session:
            result = await session.execute(
                sa.update(ModelConfig)
                .where(ModelConfig.id == config_id)
                .values(is_active=False)
            )
            await session.commit()
            return result.rowcount > 0
    
    # System Statistics Methods
    async def record_stat(self, stat_type: str, stat_key: str, stat_value: float, metadata: Dict = None):
        """Record system statistic"""
        async with self.get_session() as session:
            stat = SystemStats(
                stat_type=stat_type,
                stat_key=stat_key,
                stat_value=stat_value,
                stat_metadata=metadata or {}
            )
            session.add(stat)
            await session.commit()
    
    async def get_stats_summary(self) -> Dict[str, Any]:
        """Get summary of system statistics"""
        async with self.get_session() as session:
            # Get total workflows
            workflows_result = await session.execute(
                sa.text("""
                    SELECT COALESCE(SUM(stat_value), 0) as total 
                    FROM system_stats 
                    WHERE stat_type = 'workflow' AND is_active = true
                """)
            )
            total_workflows = workflows_result.scalar() or 0
            
            # Get active projects
            projects_result = await session.execute(
                sa.text("""
                    SELECT COALESCE(SUM(stat_value), 0) as total 
                    FROM system_stats 
                    WHERE stat_type = 'project' AND stat_key = 'active' AND is_active = true
                """)
            )
            active_projects = projects_result.scalar() or 0
            
            # Get total API calls
            api_calls_result = await session.execute(
                sa.text("""
                    SELECT COALESCE(SUM(stat_value), 0) as total 
                    FROM system_stats 
                    WHERE stat_type = 'api_call' AND is_active = true
                """)
            )
            total_api_calls = api_calls_result.scalar() or 0
            
            # Get AI model usage
            model_usage_result = await session.execute(
                sa.text("""
                    SELECT stat_key, SUM(stat_value) as usage
                    FROM system_stats
                    WHERE stat_type = 'ai_model_usage' AND is_active = true
                    GROUP BY stat_key
                """)
            )
            ai_model_usage = {row[0]: int(row[1]) for row in model_usage_result.fetchall()}
            
            return {
                "total_workflows": int(total_workflows),
                "active_projects": int(active_projects),
                "total_api_calls": int(total_api_calls),
                "ai_model_usage": ai_model_usage
            }
    
    async def cleanup(self):
        """Clean up resources"""
        if self.engine:
            await self.engine.dispose()
            logger.info("Database connections closed")
    
    async def execute_query(self, query: str, params: list = None) -> list:
        """Execute raw SQL query and return results as list of dicts
        
        Args:
            query: SQL query string (supports parameterized queries with $1, $2, etc.)
            params: List of parameters for the query
        
        Returns:
            List of result rows as dictionaries
        
        Examples:
            # Simple query
            results = await db.execute_query("SELECT * FROM memory_high LIMIT 5")
            
            # Parameterized query
            results = await db.execute_query(
                "SELECT * FROM memory_high WHERE quality_score >= $1",
                [0.8]
            )
        """
        async with self.engine.begin() as conn:
            result = await conn.execute(sa.text(query), params or [])
            if result.returns_rows:
                # Fetch all rows and convert to list of dicts
                rows = result.fetchall()
                return [dict(row._mapping) for row in rows]
            else:
                # For INSERT/UPDATE/DELETE, return affected row count
                return [{"affected_rows": result.rowcount}]

# 全局数据库服务实例
_db_service = None

async def get_db_service() -> DatabaseService:
    """获取数据库服务实例"""
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
        await _db_service.initialize()
    return _db_service

async def cleanup_db_service():
    """Clean up database service"""
    global _db_service
    if _db_service:
        await _db_service.cleanup()
        _db_service = None

async def init_db():
    """Initialize database and extensions"""
    db_service = await get_db_service()
    async with db_service.engine.begin() as conn:
        # Create pgvector extension
        await conn.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    # Ensure column types are pgvector
    await db_service._ensure_vector_columns()

# Add execute_query method to DatabaseService class above

