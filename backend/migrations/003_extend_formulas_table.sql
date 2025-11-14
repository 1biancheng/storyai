-- 迁移脚本: 扩展 formulas 表以支持多维度公式存储
-- 支持: 总公式、剧情公式、描写公式、情绪公式、词汇公式

-- 新增字段
ALTER TABLE formulas
ADD COLUMN IF NOT EXISTS formula_type VARCHAR(50) NOT NULL DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS book_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_formula_id INT,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'valid',
ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0;

-- 新增约束
DO $$ 
BEGIN
    -- 添加外键约束(如果不存在)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_parent_formula'
    ) THEN
        ALTER TABLE formulas
        ADD CONSTRAINT fk_parent_formula FOREIGN KEY (parent_formula_id) REFERENCES formulas(id) ON DELETE CASCADE;
    END IF;

    -- 添加唯一约束(如果不存在)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_master_formula'
    ) THEN
        CREATE UNIQUE INDEX unique_master_formula ON formulas(book_id, formula_type) 
        WHERE formula_type='master_formula';
    END IF;
END $$;

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_formula_type ON formulas(formula_type);
CREATE INDEX IF NOT EXISTS idx_book_id ON formulas(book_id);
CREATE INDEX IF NOT EXISTS idx_parent_formula_id ON formulas(parent_formula_id);

-- 添加注释
COMMENT ON COLUMN formulas.formula_type IS '公式类型:master_formula/plot_formula/description_formula/emotion_formula/vocabulary_formula';
COMMENT ON COLUMN formulas.book_id IS '关联的书籍ID';
COMMENT ON COLUMN formulas.parent_formula_id IS '父公式ID(子公式关联总公式)';
COMMENT ON COLUMN formulas.validation_status IS '验证状态:valid/invalid/pending';
COMMENT ON COLUMN formulas.usage_count IS '公式使用次数统计';
COMMENT ON COLUMN formulas.metadata IS '公式元信息(JSON格式,包含剧情结构、情绪曲线等)';
-- 迁移脚本: 扩展 formulas 表以支持多维度公式存储
-- 支持: 总公式、剧情公式、描写公式、情绪公式、词汇公式

-- 新增字段
ALTER TABLE formulas
ADD COLUMN IF NOT EXISTS formula_type VARCHAR(50) NOT NULL DEFAULT 'custom',
ADD COLUMN IF NOT EXISTS book_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS parent_formula_id INT,
ADD COLUMN IF NOT EXISTS metadata JSONB,
ADD COLUMN IF NOT EXISTS validation_status VARCHAR(50) DEFAULT 'valid',
ADD COLUMN IF NOT EXISTS usage_count INT DEFAULT 0;

-- 新增约束
DO $$ 
BEGIN
    -- 添加外键约束(如果不存在)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_parent_formula'
    ) THEN
        ALTER TABLE formulas
        ADD CONSTRAINT fk_parent_formula FOREIGN KEY (parent_formula_id) REFERENCES formulas(id) ON DELETE CASCADE;
    END IF;

    -- 添加唯一约束(如果不存在)
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'unique_master_formula'
    ) THEN
        CREATE UNIQUE INDEX unique_master_formula ON formulas(book_id, formula_type) 
        WHERE formula_type='master_formula';
    END IF;
END $$;

-- 新增索引
CREATE INDEX IF NOT EXISTS idx_formula_type ON formulas(formula_type);
CREATE INDEX IF NOT EXISTS idx_book_id ON formulas(book_id);
CREATE INDEX IF NOT EXISTS idx_parent_formula_id ON formulas(parent_formula_id);

-- 添加注释
COMMENT ON COLUMN formulas.formula_type IS '公式类型:master_formula/plot_formula/description_formula/emotion_formula/vocabulary_formula';
COMMENT ON COLUMN formulas.book_id IS '关联的书籍ID';
COMMENT ON COLUMN formulas.parent_formula_id IS '父公式ID(子公式关联总公式)';
COMMENT ON COLUMN formulas.validation_status IS '验证状态:valid/invalid/pending';
COMMENT ON COLUMN formulas.usage_count IS '公式使用次数统计';
COMMENT ON COLUMN formulas.metadata IS '公式元信息(JSON格式,包含剧情结构、情绪曲线等)';
