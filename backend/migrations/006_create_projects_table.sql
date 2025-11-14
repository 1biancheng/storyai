-- 创建项目表
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    genre VARCHAR(100),
    requirements TEXT,
    workflow_id VARCHAR(100),
    settings JSONB,
    extra_data JSONB,
    is_active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
CREATE INDEX IF NOT EXISTS idx_projects_is_active ON projects(is_active);
CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);

-- 添加表和字段注释
COMMENT ON TABLE projects IS '项目表 - 存储项目基本信息';
COMMENT ON COLUMN projects.id IS '项目唯一标识';
COMMENT ON COLUMN projects.name IS '项目名称';
COMMENT ON COLUMN projects.genre IS '项目类型/题材';
COMMENT ON COLUMN projects.requirements IS '项目需求描述';
COMMENT ON COLUMN projects.workflow_id IS '关联的工作流ID';
COMMENT ON COLUMN projects.settings IS '项目设置配置';
COMMENT ON COLUMN projects.extra_data IS '扩展数据';
COMMENT ON COLUMN projects.is_active IS '是否激活';
COMMENT ON COLUMN projects.created_at IS '创建时间';
COMMENT ON COLUMN projects.updated_at IS '更新时间';

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_projects_updated_at();