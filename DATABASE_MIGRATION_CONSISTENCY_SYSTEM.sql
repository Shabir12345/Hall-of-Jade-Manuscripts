-- Narrative Consistency System Database Migration
-- Run this migration in your Supabase SQL Editor
-- This migration adds tables for entity state history, power level progression, and context snapshots

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. ENTITY STATE HISTORY
-- Tracks state changes for all entities with chapter-level provenance
CREATE TABLE IF NOT EXISTS entity_state_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('character', 'territory', 'world_entry', 'item', 'technique', 'antagonist')),
  entity_id UUID NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  state_snapshot JSONB NOT NULL, -- Full state at this point
  changes JSONB DEFAULT '[]', -- Array of {field, oldValue, newValue}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT entity_state_history_chapter_positive CHECK (chapter_number > 0)
);

-- Indexes for entity_state_history
CREATE INDEX IF NOT EXISTS idx_entity_state_history_novel ON entity_state_history(novel_id);
CREATE INDEX IF NOT EXISTS idx_entity_state_history_entity ON entity_state_history(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_state_history_chapter ON entity_state_history(chapter_id);
CREATE INDEX IF NOT EXISTS idx_entity_state_history_chapter_number ON entity_state_history(chapter_number);
CREATE INDEX IF NOT EXISTS idx_entity_state_history_created ON entity_state_history(created_at);

-- 2. POWER LEVEL PROGRESSION
-- Tracks power level changes with progression type and event descriptions
CREATE TABLE IF NOT EXISTS power_level_progression (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  power_level TEXT NOT NULL,
  progression_type TEXT NOT NULL CHECK (progression_type IN ('breakthrough', 'gradual', 'regression', 'stable')),
  event_description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT power_level_progression_chapter_positive CHECK (chapter_number > 0)
);

-- Indexes for power_level_progression
CREATE INDEX IF NOT EXISTS idx_power_level_progression_novel ON power_level_progression(novel_id);
CREATE INDEX IF NOT EXISTS idx_power_level_progression_character ON power_level_progression(character_id);
CREATE INDEX IF NOT EXISTS idx_power_level_progression_chapter ON power_level_progression(chapter_id);
CREATE INDEX IF NOT EXISTS idx_power_level_progression_chapter_number ON power_level_progression(chapter_number);
CREATE INDEX IF NOT EXISTS idx_power_level_progression_type ON power_level_progression(progression_type);
CREATE INDEX IF NOT EXISTS idx_power_level_progression_created ON power_level_progression(created_at);

-- 3. CONTEXT SNAPSHOTS
-- Stores context used for each chapter generation
CREATE TABLE IF NOT EXISTS context_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  context_data JSONB NOT NULL, -- What context was sent to LLM
  entities_included TEXT[] DEFAULT '{}', -- Which entities were in context
  token_count INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT context_snapshots_chapter_positive CHECK (chapter_number > 0)
);

-- Indexes for context_snapshots
CREATE INDEX IF NOT EXISTS idx_context_snapshots_novel ON context_snapshots(novel_id);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_chapter ON context_snapshots(chapter_id);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_chapter_number ON context_snapshots(chapter_number);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_created ON context_snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_context_snapshots_entities ON context_snapshots USING GIN(entities_included);

-- 4. Add indexes to existing characters table for fast power level queries
CREATE INDEX IF NOT EXISTS idx_characters_current_cultivation ON characters(current_cultivation) WHERE current_cultivation IS NOT NULL AND current_cultivation != '';
CREATE INDEX IF NOT EXISTS idx_characters_status ON characters(status);

-- 5. Add state_version tracking to characters (optional enhancement)
-- This allows tracking which version of state a character is at
ALTER TABLE characters ADD COLUMN IF NOT EXISTS state_version INTEGER DEFAULT 1;

-- Comments for documentation
COMMENT ON TABLE entity_state_history IS 'Tracks state changes for all entities with chapter-level provenance. Supports rollback to any previous state.';
COMMENT ON TABLE power_level_progression IS 'Tracks power level changes with progression type (breakthrough, gradual, regression, stable) and event descriptions.';
COMMENT ON TABLE context_snapshots IS 'Stores context used for each chapter generation to enable debugging and consistency analysis.';
COMMENT ON COLUMN entity_state_history.state_snapshot IS 'Full JSON state of the entity at this point in time';
COMMENT ON COLUMN entity_state_history.changes IS 'Array of changes: [{field, oldValue, newValue}]';
COMMENT ON COLUMN power_level_progression.progression_type IS 'Type of progression: breakthrough (stage jump), gradual (within stage), regression (power loss), stable (no change)';
COMMENT ON COLUMN context_snapshots.context_data IS 'Complete context data sent to LLM including characters, power levels, relationships, world rules';
COMMENT ON COLUMN context_snapshots.entities_included IS 'Array of entity IDs that were included in the context';

-- RLS Policies (if using Row Level Security)
-- Note: These assume you have user_id column and RLS enabled
-- Adjust based on your authentication setup

-- Enable RLS on new tables
ALTER TABLE entity_state_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE power_level_progression ENABLE ROW LEVEL SECURITY;
ALTER TABLE context_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies for entity_state_history
CREATE POLICY "Users can view their own entity state history"
  ON entity_state_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM novels
      WHERE novels.id = entity_state_history.novel_id
      AND novels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own entity state history"
  ON entity_state_history FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM novels
      WHERE novels.id = entity_state_history.novel_id
      AND novels.user_id = auth.uid()
    )
  );

-- RLS Policies for power_level_progression
CREATE POLICY "Users can view their own power level progression"
  ON power_level_progression FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM novels
      WHERE novels.id = power_level_progression.novel_id
      AND novels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own power level progression"
  ON power_level_progression FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM novels
      WHERE novels.id = power_level_progression.novel_id
      AND novels.user_id = auth.uid()
    )
  );

-- RLS Policies for context_snapshots
CREATE POLICY "Users can view their own context snapshots"
  ON context_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM novels
      WHERE novels.id = context_snapshots.novel_id
      AND novels.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own context snapshots"
  ON context_snapshots FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM novels
      WHERE novels.id = context_snapshots.novel_id
      AND novels.user_id = auth.uid()
    )
  );

-- Automatic timestamp triggers (if not already created)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: These tables use created_at only, but if you add updated_at later:
-- CREATE TRIGGER update_entity_state_history_updated_at BEFORE UPDATE ON entity_state_history
--   FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
