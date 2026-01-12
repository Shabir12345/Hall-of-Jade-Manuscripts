-- ANTAGONIST SYSTEM MIGRATION
-- Run this script in your Supabase SQL Editor to add antagonist tracking capabilities
-- This migration adds comprehensive antagonist management to the novel writing system

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ANTAGONISTS - Main antagonist entities
CREATE TABLE IF NOT EXISTS antagonists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('individual', 'group', 'system', 'society', 'abstract')),
  description TEXT DEFAULT '',
  motivation TEXT DEFAULT '',
  power_level TEXT DEFAULT '',
  status TEXT CHECK (status IN ('active', 'defeated', 'transformed', 'dormant', 'hinted')),
  first_appeared_chapter INTEGER,
  last_appeared_chapter INTEGER,
  resolved_chapter INTEGER,
  duration_scope TEXT CHECK (duration_scope IN ('chapter', 'arc', 'novel', 'multi_arc')),
  threat_level TEXT CHECK (threat_level IN ('low', 'medium', 'high', 'extreme')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT antagonists_first_chapter_positive CHECK (first_appeared_chapter IS NULL OR first_appeared_chapter > 0),
  CONSTRAINT antagonists_last_chapter_positive CHECK (last_appeared_chapter IS NULL OR last_appeared_chapter > 0),
  CONSTRAINT antagonists_resolved_chapter_positive CHECK (resolved_chapter IS NULL OR resolved_chapter > 0)
);

-- 2. ANTAGONIST RELATIONSHIPS - Links antagonists to characters
CREATE TABLE IF NOT EXISTS antagonist_relationships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  antagonist_id UUID REFERENCES antagonists(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  relationship_type TEXT CHECK (relationship_type IN ('primary_target', 'secondary_target', 'ally_of_antagonist', 'neutral')),
  intensity TEXT CHECK (intensity IN ('rival', 'enemy', 'nemesis', 'opposition')),
  history TEXT DEFAULT '',
  current_state TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT antagonist_relationships_unique UNIQUE(antagonist_id, character_id)
);

-- 3. ANTAGONIST ARCS - Many-to-many: antagonists active in arcs
CREATE TABLE IF NOT EXISTS antagonist_arcs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  antagonist_id UUID REFERENCES antagonists(id) ON DELETE CASCADE,
  arc_id UUID REFERENCES arcs(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('primary', 'secondary', 'background', 'hinted')),
  introduced_in_arc BOOLEAN DEFAULT false,
  resolved_in_arc BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT antagonist_arcs_unique UNIQUE(antagonist_id, arc_id)
);

-- 4. ANTAGONIST CHAPTERS - Track antagonist appearances in chapters
CREATE TABLE IF NOT EXISTS antagonist_chapters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  antagonist_id UUID REFERENCES antagonists(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  presence_type TEXT CHECK (presence_type IN ('direct', 'mentioned', 'hinted', 'influence')),
  significance TEXT CHECK (significance IN ('major', 'minor', 'foreshadowing')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT antagonist_chapters_unique UNIQUE(antagonist_id, chapter_id)
);

-- 5. ANTAGONIST GROUPS - For group-type antagonists
CREATE TABLE IF NOT EXISTS antagonist_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  antagonist_id UUID REFERENCES antagonists(id) ON DELETE CASCADE,
  member_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  role_in_group TEXT CHECK (role_in_group IN ('leader', 'core_member', 'member', 'associate')),
  joined_chapter INTEGER,
  left_chapter INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT antagonist_groups_joined_positive CHECK (joined_chapter IS NULL OR joined_chapter > 0),
  CONSTRAINT antagonist_groups_left_positive CHECK (left_chapter IS NULL OR left_chapter > 0),
  CONSTRAINT antagonist_groups_unique UNIQUE(antagonist_id, member_character_id)
);

-- 6. ANTAGONIST PROGRESSION - Track antagonist development over time
CREATE TABLE IF NOT EXISTS antagonist_progression (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  antagonist_id UUID REFERENCES antagonists(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  power_level TEXT DEFAULT '',
  threat_assessment TEXT DEFAULT '',
  key_events TEXT[] DEFAULT '{}',
  relationship_changes TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT antagonist_progression_chapter_positive CHECK (chapter_number > 0),
  CONSTRAINT antagonist_progression_unique UNIQUE(antagonist_id, chapter_number)
);

-- Enable Row Level Security
ALTER TABLE antagonists ENABLE ROW LEVEL SECURITY;
ALTER TABLE antagonist_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE antagonist_arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE antagonist_chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE antagonist_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE antagonist_progression ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for anon" ON antagonists;
DROP POLICY IF EXISTS "Enable all for anon" ON antagonist_relationships;
DROP POLICY IF EXISTS "Enable all for anon" ON antagonist_arcs;
DROP POLICY IF EXISTS "Enable all for anon" ON antagonist_chapters;
DROP POLICY IF EXISTS "Enable all for anon" ON antagonist_groups;
DROP POLICY IF EXISTS "Enable all for anon" ON antagonist_progression;

-- Create policies to allow all operations for anonymous users (public)
CREATE POLICY "Enable all for anon" ON antagonists FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON antagonist_relationships FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON antagonist_arcs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON antagonist_chapters FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON antagonist_groups FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON antagonist_progression FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create triggers for automatic updated_at
DROP TRIGGER IF EXISTS update_antagonists_updated_at ON antagonists;
DROP TRIGGER IF EXISTS update_antagonist_relationships_updated_at ON antagonist_relationships;
DROP TRIGGER IF EXISTS update_antagonist_arcs_updated_at ON antagonist_arcs;
DROP TRIGGER IF EXISTS update_antagonist_groups_updated_at ON antagonist_groups;

CREATE TRIGGER update_antagonists_updated_at
  BEFORE UPDATE ON antagonists
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_antagonist_relationships_updated_at
  BEFORE UPDATE ON antagonist_relationships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_antagonist_arcs_updated_at
  BEFORE UPDATE ON antagonist_arcs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_antagonist_groups_updated_at
  BEFORE UPDATE ON antagonist_groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_antagonists_novel_id ON antagonists(novel_id);
CREATE INDEX IF NOT EXISTS idx_antagonists_status ON antagonists(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_antagonists_type ON antagonists(novel_id, type);
CREATE INDEX IF NOT EXISTS idx_antagonists_duration_scope ON antagonists(novel_id, duration_scope);
CREATE INDEX IF NOT EXISTS idx_antagonists_first_chapter ON antagonists(novel_id, first_appeared_chapter);
CREATE INDEX IF NOT EXISTS idx_antagonist_relationships_antagonist ON antagonist_relationships(antagonist_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_relationships_character ON antagonist_relationships(character_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_arcs_antagonist ON antagonist_arcs(antagonist_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_arcs_arc ON antagonist_arcs(arc_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_chapters_antagonist ON antagonist_chapters(antagonist_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_chapters_chapter ON antagonist_chapters(chapter_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_groups_antagonist ON antagonist_groups(antagonist_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_groups_member ON antagonist_groups(member_character_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_progression_antagonist ON antagonist_progression(antagonist_id);
CREATE INDEX IF NOT EXISTS idx_antagonist_progression_chapter ON antagonist_progression(antagonist_id, chapter_number);

-- Comments for documentation
COMMENT ON TABLE antagonists IS 'Main antagonist entities tracking different types of opposition (individuals, groups, systems, societies, abstract concepts)';
COMMENT ON TABLE antagonist_relationships IS 'Links antagonists to characters they oppose or are allied with';
COMMENT ON TABLE antagonist_arcs IS 'Many-to-many relationship tracking which antagonists are active in which arcs';
COMMENT ON TABLE antagonist_chapters IS 'Tracks antagonist appearances and presence in specific chapters';
COMMENT ON TABLE antagonist_groups IS 'For group-type antagonists, tracks individual members and their roles';
COMMENT ON TABLE antagonist_progression IS 'Tracks antagonist development, power level, and threat assessment over time';
COMMENT ON COLUMN antagonists.status IS 'Antagonist status: active (currently opposing), defeated (resolved), transformed (changed role), dormant (inactive), hinted (foreshadowed)';
COMMENT ON COLUMN antagonists.duration_scope IS 'How long this antagonist spans: chapter (single chapter), arc (one arc), novel (entire novel), multi_arc (multiple arcs but not entire novel)';
