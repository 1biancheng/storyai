-- Migration: Add display_order column to chapters table
-- Created: 2025-11-02
-- Description: Add display_order column to support user-defined chapter ordering

-- Add display_order column with default value
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS display_order INTEGER;

-- Set default display_order values based on chapter_number
UPDATE chapters SET display_order = chapter_number WHERE display_order IS NULL;

-- Create index for efficient ordering
CREATE INDEX IF NOT EXISTS idx_chapters_display_order ON chapters(project_id, display_order);

-- Comments for documentation
COMMENT ON COLUMN chapters.display_order IS 'User-defined display order for chapters (independent of chapter_number)';
