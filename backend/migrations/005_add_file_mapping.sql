-- 为 chapters 表增加文件系统映射字段
ALTER TABLE chapters
ADD COLUMN file_mtime REAL DEFAULT 0;

ALTER TABLE chapters
ADD COLUMN file_size INTEGER DEFAULT 0;

ALTER TABLE chapters
ADD COLUMN status TEXT CHECK(status IN ('active','missing')) DEFAULT 'active';

-- 创建索引加速同步扫描
CREATE INDEX IF NOT EXISTS idx_chapters_project_status ON chapters(project_id, status);