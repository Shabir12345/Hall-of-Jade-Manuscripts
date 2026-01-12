-- Novelcrafter-Inspired Enhancements Database Migration
-- Run this migration in your Supabase SQL Editor

-- 1. Scenes table
CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT,
  content TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT scenes_chapter_number_unique UNIQUE(chapter_id, number),
  CONSTRAINT scenes_number_positive CHECK (number > 0)
);

-- 2. Revisions table
CREATE TABLE IF NOT EXISTS revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('chapter', 'scene', 'character', 'world')),
  entity_id UUID NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Tags table
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  category TEXT CHECK (category IN ('plot', 'character', 'world', 'theme')),
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT tags_novel_name_unique UNIQUE(novel_id, name)
);

-- 4. Entity tags junction table
CREATE TABLE IF NOT EXISTS entity_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('chapter', 'scene', 'character', 'world')),
  entity_id UUID NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT entity_tags_unique UNIQUE(entity_type, entity_id, tag_id)
);

-- 5. Writing goals table
CREATE TABLE IF NOT EXISTS writing_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('daily', 'weekly', 'total')),
  target INTEGER NOT NULL CHECK (target > 0),
  current INTEGER DEFAULT 0 CHECK (current >= 0),
  deadline TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenes_chapter_id ON scenes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_scenes_number ON scenes(chapter_id, number);
CREATE INDEX IF NOT EXISTS idx_revisions_entity ON revisions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_revisions_created_at ON revisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_novel_id ON tags(novel_id);
CREATE INDEX IF NOT EXISTS idx_writing_goals_novel_id ON writing_goals(novel_id);
CREATE INDEX IF NOT EXISTS idx_writing_goals_type ON writing_goals(novel_id, type);

-- Triggers for automatic updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_writing_goals_updated_at
  BEFORE UPDATE ON writing_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add full-text search indexes (GIN indexes for better search performance)
CREATE INDEX IF NOT EXISTS idx_scenes_content_gin ON scenes USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_chapters_content_gin ON chapters USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_world_entries_content_gin ON world_entries USING gin(to_tsvector('english', content));

-- Comments for documentation
COMMENT ON TABLE scenes IS 'Individual scenes within chapters for better organization';
COMMENT ON TABLE revisions IS 'Version history for chapters, scenes, characters, and world entries';
COMMENT ON TABLE tags IS 'Tags for organizing and filtering content';
COMMENT ON TABLE entity_tags IS 'Many-to-many relationship between entities and tags';
COMMENT ON TABLE writing_goals IS 'Writing goals and progress tracking';

-- 6. Arc progress tracking (Arc Ledger enhancements)
-- Adds fields used by the Arc progress bars and checklist.
ALTER TABLE arcs ADD COLUMN IF NOT EXISTS started_at_chapter INTEGER;
ALTER TABLE arcs ADD COLUMN IF NOT EXISTS ended_at_chapter INTEGER;
ALTER TABLE arcs ADD COLUMN IF NOT EXISTS target_chapters INTEGER;
ALTER TABLE arcs ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arcs_started_at_positive'
  ) THEN
    ALTER TABLE arcs ADD CONSTRAINT arcs_started_at_positive CHECK (started_at_chapter IS NULL OR started_at_chapter > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arcs_ended_at_positive'
  ) THEN
    ALTER TABLE arcs ADD CONSTRAINT arcs_ended_at_positive CHECK (ended_at_chapter IS NULL OR ended_at_chapter > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'arcs_target_positive'
  ) THEN
    ALTER TABLE arcs ADD CONSTRAINT arcs_target_positive CHECK (target_chapters IS NULL OR target_chapters > 0);
  END IF;
END $$;
