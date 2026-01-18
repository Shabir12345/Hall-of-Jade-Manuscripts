-- CHARACTER SYSTEM MIGRATION
-- Run this script in your Supabase SQL Editor to add character system tracking capabilities
-- This migration adds comprehensive character system management to the novel writing system

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. CHARACTER_SYSTEMS - Main character system entities
CREATE TABLE IF NOT EXISTS character_systems (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('cultivation', 'game', 'cheat', 'ability', 'interface', 'evolution', 'other')),
  category TEXT CHECK (category IN ('core', 'support', 'evolution', 'utility', 'combat', 'passive')),
  description TEXT DEFAULT '',
  current_level TEXT DEFAULT '',
  current_version TEXT DEFAULT '',
  status TEXT CHECK (status IN ('active', 'dormant', 'upgraded', 'merged', 'deactivated')),
  first_appeared_chapter INTEGER,
  last_updated_chapter INTEGER,
  history TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT character_systems_first_chapter_positive CHECK (first_appeared_chapter IS NULL OR first_appeared_chapter > 0),
  CONSTRAINT character_systems_last_chapter_positive CHECK (last_updated_chapter IS NULL OR last_updated_chapter > 0)
);

-- 2. SYSTEM_FEATURES - Features/abilities of each system
CREATE TABLE IF NOT EXISTS system_features (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID REFERENCES character_systems(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT '',
  unlocked_chapter INTEGER,
  is_active BOOLEAN DEFAULT true,
  level TEXT DEFAULT '',
  strength INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT system_features_unlocked_chapter_positive CHECK (unlocked_chapter IS NULL OR unlocked_chapter > 0)
);

-- 3. SYSTEM_PROGRESSION - Track system evolution per chapter
CREATE TABLE IF NOT EXISTS system_progression (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID REFERENCES character_systems(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  features_added TEXT[] DEFAULT '{}',
  features_upgraded TEXT[] DEFAULT '{}',
  level_changes TEXT DEFAULT '',
  key_events TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT system_progression_chapter_positive CHECK (chapter_number > 0),
  CONSTRAINT system_progression_unique UNIQUE(system_id, chapter_number)
);

-- 4. SYSTEM_CHAPTER_APPEARANCES - Track when systems appear/are used in chapters
CREATE TABLE IF NOT EXISTS system_chapter_appearances (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  system_id UUID REFERENCES character_systems(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  presence_type TEXT CHECK (presence_type IN ('direct', 'mentioned', 'hinted', 'used')),
  significance TEXT CHECK (significance IN ('major', 'minor', 'foreshadowing')),
  features_used TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT system_chapter_appearances_unique UNIQUE(system_id, chapter_id)
);

-- Enable Row Level Security
ALTER TABLE character_systems ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_chapter_appearances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for anon" ON character_systems;
DROP POLICY IF EXISTS "Enable all for anon" ON system_features;
DROP POLICY IF EXISTS "Enable all for anon" ON system_progression;
DROP POLICY IF EXISTS "Enable all for anon" ON system_chapter_appearances;

-- Create policies to allow all operations for anonymous users (public)
CREATE POLICY "Enable all for anon" ON character_systems FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON system_features FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON system_progression FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON system_chapter_appearances FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create triggers for automatic updated_at
DROP TRIGGER IF EXISTS update_character_systems_updated_at ON character_systems;
DROP TRIGGER IF EXISTS update_system_features_updated_at ON system_features;

CREATE TRIGGER update_character_systems_updated_at
  BEFORE UPDATE ON character_systems
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_features_updated_at
  BEFORE UPDATE ON system_features
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_character_systems_novel_id ON character_systems(novel_id);
CREATE INDEX IF NOT EXISTS idx_character_systems_character_id ON character_systems(character_id);
CREATE INDEX IF NOT EXISTS idx_character_systems_status ON character_systems(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_character_systems_type ON character_systems(novel_id, type);
CREATE INDEX IF NOT EXISTS idx_character_systems_category ON character_systems(novel_id, category);
CREATE INDEX IF NOT EXISTS idx_character_systems_first_chapter ON character_systems(novel_id, first_appeared_chapter);
CREATE INDEX IF NOT EXISTS idx_system_features_system_id ON system_features(system_id);
CREATE INDEX IF NOT EXISTS idx_system_features_is_active ON system_features(system_id, is_active);
CREATE INDEX IF NOT EXISTS idx_system_progression_system_id ON system_progression(system_id);
CREATE INDEX IF NOT EXISTS idx_system_progression_chapter ON system_progression(system_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_system_chapter_appearances_system_id ON system_chapter_appearances(system_id);
CREATE INDEX IF NOT EXISTS idx_system_chapter_appearances_chapter_id ON system_chapter_appearances(chapter_id);

-- Comments for documentation
COMMENT ON TABLE character_systems IS 'Main character system entities tracking systems that help the main character (cultivation systems, game interfaces, cheat abilities, etc.)';
COMMENT ON TABLE system_features IS 'Features and abilities available in each character system';
COMMENT ON TABLE system_progression IS 'Tracks system evolution, feature unlocks, and upgrades over chapters';
COMMENT ON TABLE system_chapter_appearances IS 'Tracks system appearances and feature usage in specific chapters';
COMMENT ON COLUMN character_systems.status IS 'System status: active (currently in use), dormant (inactive but available), upgraded (recently enhanced), merged (combined with another system), deactivated (no longer functional)';
COMMENT ON COLUMN character_systems.type IS 'System type: cultivation (cultivation technique system), game (game-like interface), cheat (cheat ability), ability (special ability), interface (UI system), evolution (evolution system), other';
COMMENT ON COLUMN system_features.is_active IS 'Whether this feature is currently active and available for use';
