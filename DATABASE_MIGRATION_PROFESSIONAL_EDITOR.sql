-- DATABASE MIGRATION: PROFESSIONAL EDITOR SYSTEM
-- Run this script in your Supabase SQL Editor to add professional editing features.
-- This handles comments, suggestions (track changes), highlights, and style checks.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EDITOR COMMENTS
-- Store comments/annotations on text
CREATE TABLE IF NOT EXISTS editor_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  entity_type TEXT CHECK (entity_type IN ('chapter', 'scene')) NOT NULL DEFAULT 'chapter',
  entity_id UUID NOT NULL, -- Chapter ID or Scene ID
  text_range JSONB NOT NULL, -- {start: number, end: number}
  selected_text TEXT NOT NULL, -- Snippet of commented text
  comment TEXT NOT NULL,
  author TEXT CHECK (author IN ('user', 'ai')) NOT NULL DEFAULT 'user',
  resolved BOOLEAN DEFAULT FALSE NOT NULL,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT editor_comments_text_range_valid CHECK (
    jsonb_typeof(text_range) = 'object' AND
    text_range ? 'start' AND text_range ? 'end' AND
    (text_range->>'start')::integer >= 0 AND
    (text_range->>'end')::integer >= (text_range->>'start')::integer
  ),
  CONSTRAINT editor_comments_comment_not_empty CHECK (length(trim(comment)) > 0),
  CONSTRAINT editor_comments_resolved_at_consistency CHECK (
    (resolved = FALSE AND resolved_at IS NULL) OR
    (resolved = TRUE AND resolved_at IS NOT NULL)
  )
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_editor_comments_chapter_id ON editor_comments(chapter_id);
CREATE INDEX IF NOT EXISTS idx_editor_comments_entity ON editor_comments(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_editor_comments_resolved ON editor_comments(resolved);
CREATE INDEX IF NOT EXISTS idx_editor_comments_created_at ON editor_comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editor_comments_author ON editor_comments(author);
-- GIN index for JSONB text_range queries (if needed for complex queries)
-- CREATE INDEX IF NOT EXISTS idx_editor_comments_text_range_gin ON editor_comments USING gin(text_range);

-- 2. EDITOR SUGGESTIONS
-- Track changes/suggestions (like Word/Google Docs track changes)
CREATE TABLE IF NOT EXISTS editor_suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  suggestion_type TEXT CHECK (suggestion_type IN ('insertion', 'deletion', 'replacement')) NOT NULL,
  original_text TEXT NOT NULL, -- Can be empty string for pure insertions
  suggested_text TEXT NOT NULL,
  text_range JSONB NOT NULL, -- {start: number, end: number}
  status TEXT CHECK (status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending' NOT NULL,
  author TEXT CHECK (author IN ('user', 'ai')) NOT NULL DEFAULT 'user',
  reason TEXT DEFAULT '' NOT NULL, -- Explanation of suggestion
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT editor_suggestions_text_range_valid CHECK (
    jsonb_typeof(text_range) = 'object' AND
    text_range ? 'start' AND text_range ? 'end' AND
    (text_range->>'start')::integer >= 0 AND
    (text_range->>'end')::integer >= (text_range->>'start')::integer
  ),
  CONSTRAINT editor_suggestions_suggested_text_not_empty CHECK (length(trim(suggested_text)) > 0),
  CONSTRAINT editor_suggestions_insertion_validity CHECK (
    suggestion_type != 'insertion' OR length(trim(original_text)) = 0
  )
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_editor_suggestions_chapter_id ON editor_suggestions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_editor_suggestions_status ON editor_suggestions(status);
CREATE INDEX IF NOT EXISTS idx_editor_suggestions_author ON editor_suggestions(author);
CREATE INDEX IF NOT EXISTS idx_editor_suggestions_created_at ON editor_suggestions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_editor_suggestions_type ON editor_suggestions(suggestion_type);
-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_editor_suggestions_chapter_status ON editor_suggestions(chapter_id, status);

-- 3. EDITOR HIGHLIGHTS
-- Text highlighting with categories
CREATE TABLE IF NOT EXISTS editor_highlights (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  text_range JSONB NOT NULL, -- {start: number, end: number}
  highlight_type TEXT CHECK (highlight_type IN ('issue', 'strength', 'needs_work', 'note', 'question')) NOT NULL DEFAULT 'note',
  color TEXT NOT NULL, -- Hex color code
  note TEXT DEFAULT '' NOT NULL, -- Optional note
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT editor_highlights_text_range_valid CHECK (
    jsonb_typeof(text_range) = 'object' AND
    text_range ? 'start' AND text_range ? 'end' AND
    (text_range->>'start')::integer >= 0 AND
    (text_range->>'end')::integer >= (text_range->>'start')::integer
  ),
  CONSTRAINT editor_highlights_color_format CHECK (
    color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_editor_highlights_chapter_id ON editor_highlights(chapter_id);
CREATE INDEX IF NOT EXISTS idx_editor_highlights_type ON editor_highlights(highlight_type);
CREATE INDEX IF NOT EXISTS idx_editor_highlights_created_at ON editor_highlights(created_at DESC);

-- 4. STYLE CHECKS
-- Real-time style checking results
CREATE TABLE IF NOT EXISTS style_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  check_type TEXT CHECK (check_type IN ('pov', 'dialogue', 'pacing', 'sentence_variety', 'structure', 'consistency')) NOT NULL,
  location JSONB NOT NULL, -- {start: number, end: number}
  severity TEXT CHECK (severity IN ('error', 'warning', 'info')) NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  suggestion TEXT DEFAULT '' NOT NULL, -- Optional fix suggestion
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  CONSTRAINT style_checks_location_valid CHECK (
    jsonb_typeof(location) = 'object' AND
    location ? 'start' AND location ? 'end' AND
    (location->>'start')::integer >= 0 AND
    (location->>'end')::integer >= (location->>'start')::integer
  ),
  CONSTRAINT style_checks_message_not_empty CHECK (length(trim(message)) > 0)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_style_checks_chapter_id ON style_checks(chapter_id);
CREATE INDEX IF NOT EXISTS idx_style_checks_type ON style_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_style_checks_severity ON style_checks(severity);
CREATE INDEX IF NOT EXISTS idx_style_checks_checked_at ON style_checks(checked_at DESC);
-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_style_checks_chapter_type ON style_checks(chapter_id, check_type);
CREATE INDEX IF NOT EXISTS idx_style_checks_chapter_severity ON style_checks(chapter_id, severity);

-- 5. CREATE/UPDATE FUNCTION TO UPDATE UPDATED_AT TIMESTAMP
CREATE OR REPLACE FUNCTION update_professional_editor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. CREATE TRIGGERS TO AUTO-UPDATE UPDATED_AT
CREATE TRIGGER update_editor_comments_updated_at
  BEFORE UPDATE ON editor_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_editor_updated_at();

CREATE TRIGGER update_editor_suggestions_updated_at
  BEFORE UPDATE ON editor_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_editor_updated_at();

CREATE TRIGGER update_editor_highlights_updated_at
  BEFORE UPDATE ON editor_highlights
  FOR EACH ROW
  EXECUTE FUNCTION update_professional_editor_updated_at();

-- 7. ENABLE ROW LEVEL SECURITY
ALTER TABLE editor_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE editor_highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE style_checks ENABLE ROW LEVEL SECURITY;

-- 8. DROP EXISTING POLICIES IF THEY EXIST
DROP POLICY IF EXISTS "Enable all for anon" ON editor_comments;
DROP POLICY IF EXISTS "Enable all for anon" ON editor_suggestions;
DROP POLICY IF EXISTS "Enable all for anon" ON editor_highlights;
DROP POLICY IF EXISTS "Enable all for anon" ON style_checks;

-- 9. CREATE POLICIES FOR ANONYMOUS ACCESS
CREATE POLICY "Enable all for anon" ON editor_comments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON editor_suggestions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON editor_highlights FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON style_checks FOR ALL TO anon USING (true) WITH CHECK (true);

-- 10. ADD COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE editor_comments IS 'Stores comments/annotations on specific text ranges in chapters';
COMMENT ON TABLE editor_suggestions IS 'Tracks changes/suggestions similar to Word/Google Docs track changes';
COMMENT ON TABLE editor_highlights IS 'Text highlighting with categories (issue, strength, needs_work, note, question)';
COMMENT ON TABLE style_checks IS 'Real-time style checking results (POV, dialogue, pacing, sentence variety, structure, consistency)';
COMMENT ON COLUMN editor_comments.text_range IS 'JSONB object with start and end character positions: {start: number, end: number}';
COMMENT ON COLUMN editor_suggestions.text_range IS 'JSONB object with start and end character positions: {start: number, end: number}';
COMMENT ON COLUMN editor_suggestions.original_text IS 'Can be empty string for pure insertions';
COMMENT ON COLUMN editor_highlights.text_range IS 'JSONB object with start and end character positions: {start: number, end: number}';
COMMENT ON COLUMN style_checks.location IS 'JSONB object with start and end character positions: {start: number, end: number}';
