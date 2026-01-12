-- NARRATIVE ELEMENTS SYSTEM MIGRATION
-- Adds database tables for foreshadowing, symbolism, emotional payoffs, and subtext
-- Run this script in your Supabase SQL Editor

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. FORESHADOWING ELEMENTS - Track foreshadowing throughout the novel
CREATE TABLE IF NOT EXISTS foreshadowing_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('prophecy', 'symbolic_object', 'repeated_imagery', 'mystery', 'omen', 'dialogue_hint', 'action_pattern', 'environmental')),
  content TEXT NOT NULL,
  introduced_chapter INTEGER NOT NULL CHECK (introduced_chapter > 0),
  paid_off_chapter INTEGER CHECK (paid_off_chapter IS NULL OR paid_off_chapter > 0),
  status TEXT NOT NULL CHECK (status IN ('active', 'paid_off', 'subverted', 'forgotten')),
  subtlety TEXT NOT NULL CHECK (subtlety IN ('obvious', 'subtle', 'very_subtle', 'only_visible_in_retrospect')),
  related_element TEXT DEFAULT '',
  chapters_referenced INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT foreshadowing_paid_off_after_introduced CHECK (paid_off_chapter IS NULL OR paid_off_chapter >= introduced_chapter)
);

-- 2. SYMBOLIC ELEMENTS - Track symbolic objects, actions, imagery
CREATE TABLE IF NOT EXISTS symbolic_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  symbolic_meaning TEXT NOT NULL,
  first_appeared_chapter INTEGER NOT NULL CHECK (first_appeared_chapter > 0),
  chapters_appeared INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  evolution_notes TEXT[] DEFAULT ARRAY[]::TEXT[],
  related_themes TEXT[] DEFAULT ARRAY[]::TEXT[],
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. EMOTIONAL PAYOFF MOMENTS - Track emotional payoff moments
CREATE TABLE IF NOT EXISTS emotional_payoffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('revelation', 'victory', 'loss', 'transformation', 'reunion', 'betrayal', 'sacrifice', 'redemption')),
  description TEXT NOT NULL,
  chapter_number INTEGER NOT NULL CHECK (chapter_number > 0),
  intensity INTEGER NOT NULL CHECK (intensity >= 1 AND intensity <= 5),
  characters_involved TEXT[] DEFAULT ARRAY[]::TEXT[],
  setup_chapters INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  reader_impact TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. SUBTEXT ELEMENTS - Track subtext in dialogue and scenes
CREATE TABLE IF NOT EXISTS subtext_elements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('dialogue', 'action', 'description', 'symbolic_action')),
  surface_content TEXT NOT NULL,
  hidden_meaning TEXT NOT NULL,
  characters_involved TEXT[] DEFAULT ARRAY[]::TEXT[],
  significance TEXT CHECK (significance IN ('major', 'minor', 'foreshadowing')),
  related_to TEXT DEFAULT '', -- What it relates to (character, plot thread, theme)
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE foreshadowing_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbolic_elements ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_payoffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtext_elements ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for anon" ON foreshadowing_elements;
DROP POLICY IF EXISTS "Enable all for anon" ON symbolic_elements;
DROP POLICY IF EXISTS "Enable all for anon" ON emotional_payoffs;
DROP POLICY IF EXISTS "Enable all for anon" ON subtext_elements;

-- Create policies to allow all operations for anonymous users (public)
CREATE POLICY "Enable all for anon" ON foreshadowing_elements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON symbolic_elements FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON emotional_payoffs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON subtext_elements FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create triggers for automatic updated_at (only if function exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS update_foreshadowing_elements_updated_at ON foreshadowing_elements;
    DROP TRIGGER IF EXISTS update_symbolic_elements_updated_at ON symbolic_elements;
    DROP TRIGGER IF EXISTS update_emotional_payoffs_updated_at ON emotional_payoffs;
    DROP TRIGGER IF EXISTS update_subtext_elements_updated_at ON subtext_elements;

    CREATE TRIGGER update_foreshadowing_elements_updated_at
      BEFORE UPDATE ON foreshadowing_elements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_symbolic_elements_updated_at
      BEFORE UPDATE ON symbolic_elements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_emotional_payoffs_updated_at
      BEFORE UPDATE ON emotional_payoffs
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();

    CREATE TRIGGER update_subtext_elements_updated_at
      BEFORE UPDATE ON subtext_elements
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_foreshadowing_novel_id ON foreshadowing_elements(novel_id);
CREATE INDEX IF NOT EXISTS idx_foreshadowing_status ON foreshadowing_elements(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_foreshadowing_type ON foreshadowing_elements(novel_id, type);
CREATE INDEX IF NOT EXISTS idx_foreshadowing_introduced_chapter ON foreshadowing_elements(novel_id, introduced_chapter);
CREATE INDEX IF NOT EXISTS idx_foreshadowing_paid_off_chapter ON foreshadowing_elements(novel_id, paid_off_chapter) WHERE paid_off_chapter IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_symbolic_novel_id ON symbolic_elements(novel_id);
CREATE INDEX IF NOT EXISTS idx_symbolic_first_chapter ON symbolic_elements(novel_id, first_appeared_chapter);

CREATE INDEX IF NOT EXISTS idx_emotional_payoffs_novel_id ON emotional_payoffs(novel_id);
CREATE INDEX IF NOT EXISTS idx_emotional_payoffs_chapter ON emotional_payoffs(novel_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_emotional_payoffs_type ON emotional_payoffs(novel_id, type);
CREATE INDEX IF NOT EXISTS idx_emotional_payoffs_intensity ON emotional_payoffs(novel_id, intensity);

CREATE INDEX IF NOT EXISTS idx_subtext_novel_id ON subtext_elements(novel_id);
CREATE INDEX IF NOT EXISTS idx_subtext_chapter_id ON subtext_elements(chapter_id) WHERE chapter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subtext_scene_id ON subtext_elements(scene_id) WHERE scene_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subtext_type ON subtext_elements(novel_id, type);

-- Comments for documentation
COMMENT ON TABLE foreshadowing_elements IS 'Tracks foreshadowing elements throughout the novel, including prophecies, symbolic objects, repeated imagery, mysteries, omens, dialogue hints, action patterns, and environmental cues';
COMMENT ON TABLE symbolic_elements IS 'Tracks symbolic objects, actions, and imagery that carry deeper meaning and evolve throughout the story';
COMMENT ON TABLE emotional_payoffs IS 'Tracks emotional payoff moments (revelations, victories, losses, transformations, reunions, betrayals, sacrifices, redemptions) with intensity ratings';
COMMENT ON TABLE subtext_elements IS 'Tracks subtext in dialogue, actions, and descriptions - the hidden meaning beneath surface content';
COMMENT ON COLUMN foreshadowing_elements.subtlety IS 'How subtle the foreshadowing is: obvious (clear to readers), subtle (requires attention), very_subtle (easy to miss), only_visible_in_retrospect (only makes sense after payoff)';
COMMENT ON COLUMN emotional_payoffs.intensity IS 'Emotional intensity rating from 1 (mild) to 5 (extreme)';
COMMENT ON COLUMN subtext_elements.surface_content IS 'What is said/done on the surface';
COMMENT ON COLUMN subtext_elements.hidden_meaning IS 'What it actually means beneath the surface';
