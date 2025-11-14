-- ComRAG质心式记忆机制独立表设计
-- 用途: 将高质量/低质量段落存储到独立的记忆库表,支持质心向量计算

-- 高质量记忆库表
CREATE TABLE IF NOT EXISTS memory_high (
    id SERIAL PRIMARY KEY,
    centroid_id VARCHAR(50),  -- 质心ID,同一质心的段落聚类在一起
    content TEXT NOT NULL,
    embedding vector(1536),  -- pgvector类型,存储向量
    centroid_embedding vector(1536),  -- 质心向量(多段落平均)
    quality_score FLOAT DEFAULT 0.0,  -- 综合质量评分(0-1)
    llm_score FLOAT DEFAULT 0.0,  -- LLM评分
    user_feedback_score FLOAT DEFAULT 0.0,  -- 用户反馈评分
    usage_count INT DEFAULT 0,  -- 被调用次数
    cluster_tightness FLOAT DEFAULT 0.0,  -- 聚类紧密度(方差)
    source_paragraph_ids TEXT[],  -- 来源段落ID列表
    meta JSONB DEFAULT '{}',  -- 元数据:{mode, source, tags, emotion, category}
    created_at TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- 低质量记忆库表
CREATE TABLE IF NOT EXISTS memory_low (
    id SERIAL PRIMARY KEY,
    centroid_id VARCHAR(50),
    content TEXT NOT NULL,
    embedding vector(1536),
    centroid_embedding vector(1536),
    quality_score FLOAT DEFAULT 0.0,
    llm_score FLOAT DEFAULT 0.0,
    user_feedback_score FLOAT DEFAULT 0.0,
    usage_count INT DEFAULT 0,
    cluster_tightness FLOAT DEFAULT 0.0,
    source_paragraph_ids TEXT[],
    meta JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    last_updated TIMESTAMP DEFAULT NOW()
);

-- 用户反馈表(记录用户对生成内容的评价)
CREATE TABLE IF NOT EXISTS user_feedback (
    id SERIAL PRIMARY KEY,
    memory_id INT,  -- 对应memory_high或memory_low的id
    memory_type VARCHAR(10),  -- 'high' 或 'low'
    feedback_type VARCHAR(20),  -- 'like' | 'dislike' | 'report'
    comment TEXT,
    user_id VARCHAR(100),
    created_at TIMESTAMP DEFAULT NOW()
);

-- 创建向量索引(HNSW算法,适合大规模检索)
CREATE INDEX IF NOT EXISTS memory_high_embedding_idx ON memory_high 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS memory_low_embedding_idx ON memory_low 
USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS memory_high_centroid_idx ON memory_high 
USING hnsw (centroid_embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS memory_low_centroid_idx ON memory_low 
USING hnsw (centroid_embedding vector_cosine_ops);

-- 创建其他索引
CREATE INDEX IF NOT EXISTS memory_high_centroid_id_idx ON memory_high(centroid_id);
CREATE INDEX IF NOT EXISTS memory_low_centroid_id_idx ON memory_low(centroid_id);
CREATE INDEX IF NOT EXISTS memory_high_quality_score_idx ON memory_high(quality_score);
CREATE INDEX IF NOT EXISTS memory_low_quality_score_idx ON memory_low(quality_score);
CREATE INDEX IF NOT EXISTS memory_high_usage_count_idx ON memory_high(usage_count);

-- JSONB索引(支持元数据查询)
CREATE INDEX IF NOT EXISTS memory_high_meta_idx ON memory_high USING GIN(meta);
CREATE INDEX IF NOT EXISTS memory_low_meta_idx ON memory_low USING GIN(meta);

-- 用户反馈索引
CREATE INDEX IF NOT EXISTS user_feedback_memory_idx ON user_feedback(memory_id, memory_type);
CREATE INDEX IF NOT EXISTS user_feedback_created_idx ON user_feedback(created_at);

-- 注释说明
COMMENT ON TABLE memory_high IS 'ComRAG高质量记忆库:存储LLM评分>=阈值的段落聚类';
COMMENT ON TABLE memory_low IS 'ComRAG低质量记忆库:存储LLM评分<阈值的段落,用于排除干扰';
COMMENT ON COLUMN memory_high.centroid_id IS '质心ID:每10个相似段落计算一个质心';
COMMENT ON COLUMN memory_high.centroid_embedding IS '质心向量:聚类内所有段落embedding的平均值';
COMMENT ON COLUMN memory_high.cluster_tightness IS '聚类紧密度:方差<0.3表示高质量聚类';
COMMENT ON COLUMN memory_high.usage_count IS '使用频率:被拼接调用的次数,影响质量评分';
