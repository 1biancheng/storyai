-- 迁移脚本: 扩展 paragraphs 表以支持轻量级神经替代网络
-- 设计理念: 将段落视为神经元,添加权重/偏置参数和序列索引

-- 新增字段
ALTER TABLE paragraphs 
ADD COLUMN IF NOT EXISTS sequence_weight FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS paragraph_bias VECTOR(1536),
ADD COLUMN IF NOT EXISTS enhanced_embedding VECTOR(1536),
ADD COLUMN IF NOT EXISTS prev_paragraph_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS next_paragraph_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS global_position FLOAT,
ADD COLUMN IF NOT EXISTS keywords TEXT[],
ADD COLUMN IF NOT EXISTS idioms TEXT[];

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_global_position ON paragraphs(global_position);
CREATE INDEX IF NOT EXISTS idx_sequence_weight ON paragraphs(sequence_weight);
CREATE INDEX IF NOT EXISTS idx_enhanced_embedding ON paragraphs USING ivfflat(enhanced_embedding vector_cosine_ops) 
WITH (lists = 100);

-- 新增GIN索引用于数组检索
CREATE INDEX IF NOT EXISTS idx_keywords ON paragraphs USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_idioms ON paragraphs USING GIN(idioms);

-- 添加注释
COMMENT ON COLUMN paragraphs.sequence_weight IS '段落序列权重,用于增强向量计算(可学习参数)';
COMMENT ON COLUMN paragraphs.paragraph_bias IS '段落偏置向量(1536维,可学习参数)';
COMMENT ON COLUMN paragraphs.enhanced_embedding IS '增强向量 = embedding × weight + bias';
COMMENT ON COLUMN paragraphs.global_position IS '段落在全书中的归一化位置(0-1)';
COMMENT ON COLUMN paragraphs.keywords IS '段落关键词数组(用于稀疏激活)';
COMMENT ON COLUMN paragraphs.idioms IS '段落成语数组';
COMMENT ON COLUMN paragraphs.prev_paragraph_id IS '前一段落ID(网络拓扑连接)';
COMMENT ON COLUMN paragraphs.next_paragraph_id IS '后一段落ID(网络拓扑连接)';
-- 迁移脚本: 扩展 paragraphs 表以支持轻量级神经替代网络
-- 设计理念: 将段落视为神经元,添加权重/偏置参数和序列索引

-- 新增字段
ALTER TABLE paragraphs 
ADD COLUMN IF NOT EXISTS sequence_weight FLOAT DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS paragraph_bias VECTOR(1536),
ADD COLUMN IF NOT EXISTS enhanced_embedding VECTOR(1536),
ADD COLUMN IF NOT EXISTS prev_paragraph_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS next_paragraph_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS global_position FLOAT,
ADD COLUMN IF NOT EXISTS keywords TEXT[],
ADD COLUMN IF NOT EXISTS idioms TEXT[];

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_global_position ON paragraphs(global_position);
CREATE INDEX IF NOT EXISTS idx_sequence_weight ON paragraphs(sequence_weight);
CREATE INDEX IF NOT EXISTS idx_enhanced_embedding ON paragraphs USING ivfflat(enhanced_embedding vector_cosine_ops) 
WITH (lists = 100);

-- 新增GIN索引用于数组检索
CREATE INDEX IF NOT EXISTS idx_keywords ON paragraphs USING GIN(keywords);
CREATE INDEX IF NOT EXISTS idx_idioms ON paragraphs USING GIN(idioms);

-- 添加注释
COMMENT ON COLUMN paragraphs.sequence_weight IS '段落序列权重,用于增强向量计算(可学习参数)';
COMMENT ON COLUMN paragraphs.paragraph_bias IS '段落偏置向量(1536维,可学习参数)';
COMMENT ON COLUMN paragraphs.enhanced_embedding IS '增强向量 = embedding × weight + bias';
COMMENT ON COLUMN paragraphs.global_position IS '段落在全书中的归一化位置(0-1)';
COMMENT ON COLUMN paragraphs.keywords IS '段落关键词数组(用于稀疏激活)';
COMMENT ON COLUMN paragraphs.idioms IS '段落成语数组';
COMMENT ON COLUMN paragraphs.prev_paragraph_id IS '前一段落ID(网络拓扑连接)';
COMMENT ON COLUMN paragraphs.next_paragraph_id IS '后一段落ID(网络拓扑连接)';
