-- DATABASE MIGRATION: Items and Techniques System
-- This migration adds comprehensive items and techniques tables with deduplication,
-- categorization, and archive support. Run this after backing up your database.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. NOVEL_ITEMS - Canonical item registry per novel
CREATE TABLE IF NOT EXISTS novel_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL, -- For fuzzy matching (normalized)
  description TEXT DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Treasure', 'Equipment', 'Consumable', 'Essential')),
  powers TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of abilities/functions
  history TEXT DEFAULT '', -- Evolution over chapters
  first_appeared_chapter INTEGER,
  last_referenced_chapter INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT novel_items_novel_canonical_unique UNIQUE(novel_id, canonical_name)
);

-- 2. NOVEL_TECHNIQUES - Canonical technique registry per novel
CREATE TABLE IF NOT EXISTS novel_techniques (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL, -- For fuzzy matching (normalized)
  description TEXT DEFAULT '',
  category TEXT NOT NULL CHECK (category IN ('Core', 'Important', 'Standard', 'Basic')),
  type TEXT NOT NULL CHECK (type IN ('Cultivation', 'Combat', 'Support', 'Secret', 'Other')),
  functions TEXT[] DEFAULT ARRAY[]::TEXT[], -- Array of abilities
  history TEXT DEFAULT '', -- Evolution over chapters
  first_appeared_chapter INTEGER,
  last_referenced_chapter INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT novel_techniques_novel_canonical_unique UNIQUE(novel_id, canonical_name)
);

-- 3. CHARACTER_ITEM_POSSESSIONS - Character-Item relationships with status
CREATE TABLE IF NOT EXISTS character_item_possessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES novel_items(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'lost', 'destroyed')),
  acquired_chapter INTEGER,
  archived_chapter INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT character_item_possessions_unique UNIQUE(character_id, item_id)
);

-- 4. CHARACTER_TECHNIQUE_MASTERY - Character-Technique relationships with status
CREATE TABLE IF NOT EXISTS character_technique_mastery (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  technique_id UUID NOT NULL REFERENCES novel_techniques(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'forgotten', 'mastered')),
  mastery_level TEXT DEFAULT 'Novice',
  learned_chapter INTEGER,
  archived_chapter INTEGER,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT character_technique_mastery_unique UNIQUE(character_id, technique_id)
);

-- Enable Row Level Security
ALTER TABLE novel_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_techniques ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_item_possessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_technique_mastery ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for anon" ON novel_items;
DROP POLICY IF EXISTS "Enable all for anon" ON novel_techniques;
DROP POLICY IF EXISTS "Enable all for anon" ON character_item_possessions;
DROP POLICY IF EXISTS "Enable all for anon" ON character_technique_mastery;

-- Create policies for anonymous access (adjust based on your auth setup)
CREATE POLICY "Enable all for anon" ON novel_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON novel_techniques FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON character_item_possessions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON character_technique_mastery FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_novel_items_novel_id ON novel_items(novel_id);
CREATE INDEX IF NOT EXISTS idx_novel_items_canonical_name ON novel_items(canonical_name);
CREATE INDEX IF NOT EXISTS idx_novel_items_category ON novel_items(category);
CREATE INDEX IF NOT EXISTS idx_novel_items_last_referenced ON novel_items(last_referenced_chapter);

CREATE INDEX IF NOT EXISTS idx_novel_techniques_novel_id ON novel_techniques(novel_id);
CREATE INDEX IF NOT EXISTS idx_novel_techniques_canonical_name ON novel_techniques(canonical_name);
CREATE INDEX IF NOT EXISTS idx_novel_techniques_category ON novel_techniques(category);
CREATE INDEX IF NOT EXISTS idx_novel_techniques_type ON novel_techniques(type);
CREATE INDEX IF NOT EXISTS idx_novel_techniques_last_referenced ON novel_techniques(last_referenced_chapter);

CREATE INDEX IF NOT EXISTS idx_character_item_possessions_character_id ON character_item_possessions(character_id);
CREATE INDEX IF NOT EXISTS idx_character_item_possessions_item_id ON character_item_possessions(item_id);
CREATE INDEX IF NOT EXISTS idx_character_item_possessions_status ON character_item_possessions(status);

CREATE INDEX IF NOT EXISTS idx_character_technique_mastery_character_id ON character_technique_mastery(character_id);
CREATE INDEX IF NOT EXISTS idx_character_technique_mastery_technique_id ON character_technique_mastery(technique_id);
CREATE INDEX IF NOT EXISTS idx_character_technique_mastery_status ON character_technique_mastery(status);

-- Create triggers for automatic updated_at
-- Use the existing update_updated_at_column() function if it exists
CREATE TRIGGER update_novel_items_updated_at
  BEFORE UPDATE ON novel_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_novel_techniques_updated_at
  BEFORE UPDATE ON novel_techniques
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_item_possessions_updated_at
  BEFORE UPDATE ON character_item_possessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_character_technique_mastery_updated_at
  BEFORE UPDATE ON character_technique_mastery
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Full-text search indexes for items and techniques
CREATE INDEX IF NOT EXISTS idx_novel_items_description_gin ON novel_items USING gin(to_tsvector('english', description || ' ' || COALESCE(array_to_string(powers, ' '), '')));
CREATE INDEX IF NOT EXISTS idx_novel_techniques_description_gin ON novel_techniques USING gin(to_tsvector('english', description || ' ' || COALESCE(array_to_string(functions, ' '), '')));

-- Comments for documentation
COMMENT ON TABLE novel_items IS 'Canonical item registry per novel with deduplication support. Each item has a normalized canonical_name for fuzzy matching.';
COMMENT ON TABLE novel_techniques IS 'Canonical technique registry per novel with deduplication support. Each technique has a normalized canonical_name for fuzzy matching.';
COMMENT ON TABLE character_item_possessions IS 'Character-item relationships with status tracking (active, archived, lost, destroyed). Links characters to canonical items.';
COMMENT ON TABLE character_technique_mastery IS 'Character-technique relationships with status tracking (active, archived, forgotten, mastered). Links characters to canonical techniques.';
COMMENT ON COLUMN novel_items.canonical_name IS 'Normalized name for fuzzy matching (lowercase, trimmed, punctuation removed)';
COMMENT ON COLUMN novel_techniques.canonical_name IS 'Normalized name for fuzzy matching (lowercase, trimmed, punctuation removed)';
COMMENT ON COLUMN novel_items.powers IS 'Array of abilities/functions that this item has. Powers can be added across chapters as the item evolves.';
COMMENT ON COLUMN novel_techniques.functions IS 'Array of abilities that this technique provides. Functions can be added across chapters as the technique evolves.';
COMMENT ON COLUMN novel_items.history IS 'Evolution history of the item across chapters. Format: "In Chapter X: [description of change]"';
COMMENT ON COLUMN novel_techniques.history IS 'Evolution history of the technique across chapters. Format: "In Chapter X: [description of change]"';
