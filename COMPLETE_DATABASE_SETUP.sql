-- COMPLETE DATABASE SETUP
-- Run this entire script in your Supabase SQL Editor to set up the database.
-- This handles table creation, relationships, and permissions (RLS).

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. NOVELS
CREATE TABLE IF NOT EXISTS novels (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  genre TEXT NOT NULL,
  grand_saga TEXT DEFAULT '',
  current_realm_id UUID, -- Foreign key added later to avoid circular dependency
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. REALMS
CREATE TABLE IF NOT EXISTS realms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT CHECK (status IN ('current', 'archived', 'future')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add foreign key to novels for current_realm_id
-- Drop constraint if it exists first
ALTER TABLE novels 
DROP CONSTRAINT IF EXISTS fk_novels_current_realm;

ALTER TABLE novels 
ADD CONSTRAINT fk_novels_current_realm 
FOREIGN KEY (current_realm_id) REFERENCES realms(id) ON DELETE SET NULL;

-- 3. TERRITORIES
CREATE TABLE IF NOT EXISTS territories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm_id UUID REFERENCES realms(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT CHECK (type IN ('Empire', 'Kingdom', 'Neutral', 'Hidden')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. WORLD ENTRIES
CREATE TABLE IF NOT EXISTS world_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  realm_id UUID REFERENCES realms(id) ON DELETE CASCADE,
  category TEXT CHECK (category IN ('Geography', 'Sects', 'PowerLevels', 'Laws', 'Systems', 'Techniques', 'Other')),
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. CHARACTERS
CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  age TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  current_cultivation TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  portrait_url TEXT,
  status TEXT CHECK (status IN ('Alive', 'Deceased', 'Unknown')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. CHARACTER SKILLS
CREATE TABLE IF NOT EXISTS character_skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  skill TEXT NOT NULL
);

-- 7. CHARACTER ITEMS
CREATE TABLE IF NOT EXISTS character_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  item TEXT NOT NULL
);

-- 8. RELATIONSHIPS
CREATE TABLE IF NOT EXISTS relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  target_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  type TEXT,
  history TEXT DEFAULT '',
  impact TEXT DEFAULT ''
);

-- 9. CHAPTERS
CREATE TABLE IF NOT EXISTS chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT NOT NULL,
  content TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  logic_audit JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. SCENES
CREATE TABLE IF NOT EXISTS scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  number INTEGER NOT NULL,
  title TEXT,
  content TEXT DEFAULT '',
  summary TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT scenes_chapter_number_unique UNIQUE(chapter_id, number),
  CONSTRAINT scenes_number_positive CHECK (number > 0)
);

-- 11. ARCS
CREATE TABLE IF NOT EXISTS arcs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT CHECK (status IN ('active', 'completed')),
  started_at_chapter INTEGER,
  ended_at_chapter INTEGER,
  target_chapters INTEGER,
  checklist JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT arcs_started_at_positive CHECK (started_at_chapter IS NULL OR started_at_chapter > 0),
  CONSTRAINT arcs_ended_at_positive CHECK (ended_at_chapter IS NULL OR ended_at_chapter > 0),
  CONSTRAINT arcs_target_positive CHECK (target_chapters IS NULL OR target_chapters > 0)
);

-- 12. SYSTEM LOGS
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  type TEXT,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. TAGS
CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  category TEXT CHECK (category IN ('plot', 'character', 'world', 'theme')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT tags_novel_name_unique UNIQUE(novel_id, name)
);

-- 14. WRITING GOALS
CREATE TABLE IF NOT EXISTS writing_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  type TEXT CHECK (type IN ('daily', 'weekly', 'total')),
  target INTEGER NOT NULL CHECK (target > 0),
  current INTEGER DEFAULT 0 CHECK (current >= 0),
  deadline TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. REVISIONS
CREATE TABLE IF NOT EXISTS revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('chapter', 'scene', 'character', 'world')),
  entity_id UUID NOT NULL,
  content JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. ENTITY TAGS
CREATE TABLE IF NOT EXISTS entity_tags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('chapter', 'scene', 'character', 'world')),
  entity_id UUID NOT NULL,
  tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT entity_tags_unique UNIQUE(entity_type, entity_id, tag_id)
);

-- ROW LEVEL SECURITY (RLS) SETUP
-- Since we are not using Supabase Auth yet, we will enable RLS but allow public access for now.
-- Ideally, you should implement auth and restrict these policies.

ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE realms ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE revisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

-- Create policies to allow all operations for anonymous users (public)
-- DROP existing policies first to avoid errors if re-running
DROP POLICY IF EXISTS "Enable all for anon" ON novels;
DROP POLICY IF EXISTS "Enable all for anon" ON realms;
DROP POLICY IF EXISTS "Enable all for anon" ON territories;
DROP POLICY IF EXISTS "Enable all for anon" ON world_entries;
DROP POLICY IF EXISTS "Enable all for anon" ON characters;
DROP POLICY IF EXISTS "Enable all for anon" ON character_skills;
DROP POLICY IF EXISTS "Enable all for anon" ON character_items;
DROP POLICY IF EXISTS "Enable all for anon" ON relationships;
DROP POLICY IF EXISTS "Enable all for anon" ON chapters;
DROP POLICY IF EXISTS "Enable all for anon" ON scenes;
DROP POLICY IF EXISTS "Enable all for anon" ON arcs;
DROP POLICY IF EXISTS "Enable all for anon" ON system_logs;
DROP POLICY IF EXISTS "Enable all for anon" ON tags;
DROP POLICY IF EXISTS "Enable all for anon" ON writing_goals;
DROP POLICY IF EXISTS "Enable all for anon" ON revisions;
DROP POLICY IF EXISTS "Enable all for anon" ON entity_tags;

CREATE POLICY "Enable all for anon" ON novels FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON realms FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON territories FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON world_entries FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON characters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON character_skills FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON character_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON relationships FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON chapters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON scenes FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON arcs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON system_logs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON tags FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON writing_goals FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON revisions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON entity_tags FOR ALL TO anon USING (true) WITH CHECK (true);

-- Also allow service_role to do everything (standard)
CREATE POLICY "Enable all for service_role" ON novels FOR ALL TO service_role USING (true) WITH CHECK (true);
-- (Repeat for others if needed, but usually service_role bypasses RLS anyway)

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_scenes_chapter_id ON scenes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_scenes_number ON scenes(chapter_id, number);
CREATE INDEX IF NOT EXISTS idx_chapters_novel_id ON chapters(novel_id);
CREATE INDEX IF NOT EXISTS idx_chapters_number ON chapters(novel_id, number);
CREATE INDEX IF NOT EXISTS idx_characters_novel_id ON characters(novel_id);
CREATE INDEX IF NOT EXISTS idx_realms_novel_id ON realms(novel_id);
CREATE INDEX IF NOT EXISTS idx_territories_realm_id ON territories(realm_id);
CREATE INDEX IF NOT EXISTS idx_world_entries_realm_id ON world_entries(realm_id);
CREATE INDEX IF NOT EXISTS idx_arcs_novel_id ON arcs(novel_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_novel_id ON system_logs(novel_id);
CREATE INDEX IF NOT EXISTS idx_revisions_entity ON revisions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_revisions_created_at ON revisions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entity_tags_entity ON entity_tags(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_tags_tag ON entity_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_tags_novel_id ON tags(novel_id);
CREATE INDEX IF NOT EXISTS idx_writing_goals_novel_id ON writing_goals(novel_id);
CREATE INDEX IF NOT EXISTS idx_writing_goals_type ON writing_goals(novel_id, type);
CREATE INDEX IF NOT EXISTS idx_relationships_character_id ON relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_relationships_target_id ON relationships(target_character_id);

-- Full-text search indexes (GIN indexes for better search performance)
CREATE INDEX IF NOT EXISTS idx_scenes_content_gin ON scenes USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_chapters_content_gin ON chapters USING gin(to_tsvector('english', content));
CREATE INDEX IF NOT EXISTS idx_world_entries_content_gin ON world_entries USING gin(to_tsvector('english', content));

-- Triggers for automatic updated_at
-- Function with security settings to prevent search_path attacks
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist, then create them
DROP TRIGGER IF EXISTS update_novels_updated_at ON novels;
DROP TRIGGER IF EXISTS update_territories_updated_at ON territories;
DROP TRIGGER IF EXISTS update_world_entries_updated_at ON world_entries;
DROP TRIGGER IF EXISTS update_characters_updated_at ON characters;
DROP TRIGGER IF EXISTS update_chapters_updated_at ON chapters;
DROP TRIGGER IF EXISTS update_scenes_updated_at ON scenes;
DROP TRIGGER IF EXISTS update_arcs_updated_at ON arcs;
DROP TRIGGER IF EXISTS update_writing_goals_updated_at ON writing_goals;

-- Create triggers for all tables with updated_at columns
CREATE TRIGGER update_novels_updated_at
  BEFORE UPDATE ON novels
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_territories_updated_at
  BEFORE UPDATE ON territories
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_world_entries_updated_at
  BEFORE UPDATE ON world_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_chapters_updated_at
  BEFORE UPDATE ON chapters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_scenes_updated_at
  BEFORE UPDATE ON scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_arcs_updated_at
  BEFORE UPDATE ON arcs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_writing_goals_updated_at
  BEFORE UPDATE ON writing_goals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Constraints for data validation
-- Drop constraints if they exist, then add them
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chapters_number_positive'
  ) THEN
    ALTER TABLE chapters ADD CONSTRAINT chapters_number_positive CHECK (number > 0);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chapters_novel_number_unique'
  ) THEN
    ALTER TABLE chapters ADD CONSTRAINT chapters_novel_number_unique UNIQUE(novel_id, number);
  END IF;
END $$;

-- Additional unique constraints for data integrity
DO $$
BEGIN
  -- Ensure character_skills don't have duplicates
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'character_skills_unique') THEN
    ALTER TABLE character_skills ADD CONSTRAINT character_skills_unique UNIQUE(character_id, skill);
  END IF;
  
  -- Ensure character_items don't have duplicates
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'character_items_unique') THEN
    ALTER TABLE character_items ADD CONSTRAINT character_items_unique UNIQUE(character_id, item);
  END IF;
  
  -- Ensure relationships don't have duplicates
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'relationships_unique') THEN
    ALTER TABLE relationships ADD CONSTRAINT relationships_unique UNIQUE(character_id, target_character_id);
  END IF;
  
  -- Ensure realms don't have duplicate names per novel
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'realms_novel_name_unique') THEN
    ALTER TABLE realms ADD CONSTRAINT realms_novel_name_unique UNIQUE(novel_id, name);
  END IF;
END $$;

-- Additional performance indexes
CREATE INDEX IF NOT EXISTS idx_chapters_novel_created ON chapters(novel_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chapters_logic_audit_gin ON chapters USING gin(logic_audit);
CREATE INDEX IF NOT EXISTS idx_characters_novel_status ON characters(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_territories_realm_type ON territories(realm_id, type);
CREATE INDEX IF NOT EXISTS idx_world_entries_category_realm ON world_entries(category, realm_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_novel_type_time ON system_logs(novel_id, type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_novels_updated_at ON novels(updated_at DESC);

-- Comments for documentation
COMMENT ON FUNCTION update_updated_at_column() IS 'Automatically updates the updated_at timestamp when a row is modified. Uses SECURITY DEFINER with fixed search_path for security.';
COMMENT ON TABLE scenes IS 'Individual scenes within chapters for better organization';
COMMENT ON TABLE revisions IS 'Version history for chapters, scenes, characters, and world entries';
COMMENT ON TABLE tags IS 'Tags for organizing and filtering content';
COMMENT ON TABLE entity_tags IS 'Many-to-many relationship between entities and tags';
COMMENT ON TABLE writing_goals IS 'Writing goals and progress tracking';
COMMENT ON COLUMN chapters.logic_audit IS 'JSONB field storing the logic audit (starting value, friction, choice, resulting value, causality type)';
COMMENT ON COLUMN characters.status IS 'Character status: Alive, Deceased, or Unknown';
COMMENT ON COLUMN realms.status IS 'Realm status: current (active), archived, or future (planned)';
COMMENT ON COLUMN arcs.status IS 'Arc status: active (in progress) or completed';
