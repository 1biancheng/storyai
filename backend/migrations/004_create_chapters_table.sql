-- Migration: Create chapters table for writing space
-- Created: 2025-01-01
-- Description: Add chapter management support with PostgreSQL JSONB storage

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  tags JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_project_chapter UNIQUE (project_id, chapter_number)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(project_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_chapters_created ON chapters(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE chapters IS 'Chapter management for writing space - stores metadata only';
COMMENT ON COLUMN chapters.id IS 'Unique chapter identifier (nanoid)';
COMMENT ON COLUMN chapters.project_id IS 'Foreign key to projects table';
COMMENT ON COLUMN chapters.chapter_number IS 'Sequential chapter number within project';
COMMENT ON COLUMN chapters.title IS 'Chapter title displayed in navigation';
COMMENT ON COLUMN chapters.summary IS 'AI-generated chapter summary for quick reference';
COMMENT ON COLUMN chapters.word_count IS 'Automatically calculated from content';
COMMENT ON COLUMN chapters.tags IS 'JSONB array of tags for categorization';
COMMENT ON COLUMN chapters.notes IS 'Author notes or comments about the chapter';
-- Migration: Create chapters table for writing space
-- Created: 2025-01-01
-- Description: Add chapter management support with PostgreSQL JSONB storage

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  word_count INTEGER DEFAULT 0,
  tags JSONB,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT unique_project_chapter UNIQUE (project_id, chapter_number)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_chapters_project ON chapters(project_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(project_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_chapters_created ON chapters(created_at DESC);

-- Comments for documentation
COMMENT ON TABLE chapters IS 'Chapter management for writing space - stores metadata only';
COMMENT ON COLUMN chapters.id IS 'Unique chapter identifier (nanoid)';
COMMENT ON COLUMN chapters.project_id IS 'Foreign key to projects table';
COMMENT ON COLUMN chapters.chapter_number IS 'Sequential chapter number within project';
COMMENT ON COLUMN chapters.title IS 'Chapter title displayed in navigation';
COMMENT ON COLUMN chapters.summary IS 'AI-generated chapter summary for quick reference';
COMMENT ON COLUMN chapters.word_count IS 'Automatically calculated from content';
COMMENT ON COLUMN chapters.tags IS 'JSONB array of tags for categorization';
COMMENT ON COLUMN chapters.notes IS 'Author notes or comments about the chapter';
