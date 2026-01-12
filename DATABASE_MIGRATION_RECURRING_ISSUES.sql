-- DATABASE MIGRATION: RECURRING ISSUE PATTERNS SYSTEM
-- Run this script in your Supabase SQL Editor to add recurring issue pattern tracking tables.
-- This handles tracking recurring issues and updating prompts automatically.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. RECURRING ISSUE PATTERNS
-- Tracks recurring issue patterns detected during chapter editing/analysis
CREATE TABLE IF NOT EXISTS recurring_issue_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  issue_type TEXT NOT NULL CHECK (issue_type IN ('gap', 'transition', 'grammar', 'continuity', 'time_skip', 'character_consistency', 'plot_hole', 'style', 'formatting', 'paragraph_structure', 'sentence_structure')),
  location TEXT NOT NULL CHECK (location IN ('start', 'middle', 'end', 'transition')),
  pattern_description TEXT NOT NULL, -- Human-readable description of the pattern
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  threshold_count INTEGER NOT NULL DEFAULT 5, -- Threshold for considering it a recurring pattern
  first_detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN NOT NULL DEFAULT true, -- true if still occurring, false if resolved
  prompt_constraint_added TEXT, -- The constraint text added to prompts
  resolved_at TIMESTAMP WITH TIME ZONE, -- When pattern was marked as resolved
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT recurring_issue_patterns_unique UNIQUE (issue_type, location)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_recurring_issue_patterns_issue_type ON recurring_issue_patterns(issue_type);
CREATE INDEX IF NOT EXISTS idx_recurring_issue_patterns_location ON recurring_issue_patterns(location);
CREATE INDEX IF NOT EXISTS idx_recurring_issue_patterns_is_active ON recurring_issue_patterns(is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_issue_patterns_last_seen ON recurring_issue_patterns(last_seen_at DESC);

-- 2. PATTERN OCCURRENCES
-- Tracks individual occurrences of patterns (for detailed tracking)
CREATE TABLE IF NOT EXISTS pattern_occurrences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pattern_id UUID NOT NULL REFERENCES recurring_issue_patterns(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  chapter_number INTEGER NOT NULL,
  report_id UUID REFERENCES editor_reports(id) ON DELETE SET NULL,
  issue_id UUID NOT NULL, -- Reference to issue in report_data (stored as string)
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_pattern_id ON pattern_occurrences(pattern_id);
CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_chapter_id ON pattern_occurrences(chapter_id);
CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_report_id ON pattern_occurrences(report_id);
CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_novel_id ON pattern_occurrences(novel_id);
CREATE INDEX IF NOT EXISTS idx_pattern_occurrences_detected_at ON pattern_occurrences(detected_at DESC);

-- 3. CREATE FUNCTION TO UPDATE UPDATED_AT TIMESTAMP
CREATE OR REPLACE FUNCTION update_recurring_patterns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. CREATE TRIGGERS TO AUTO-UPDATE UPDATED_AT
CREATE TRIGGER update_recurring_issue_patterns_updated_at
  BEFORE UPDATE ON recurring_issue_patterns
  FOR EACH ROW
  EXECUTE FUNCTION update_recurring_patterns_updated_at();

-- 5. CREATE FUNCTION TO AUTO-UPDATE PATTERN STATISTICS
-- This function updates the pattern's occurrence_count and last_seen_at when a new occurrence is added
CREATE OR REPLACE FUNCTION update_pattern_statistics()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE recurring_issue_patterns
  SET 
    occurrence_count = occurrence_count + 1,
    last_seen_at = NEW.detected_at,
    is_active = true, -- Reactivate if it was previously resolved
    updated_at = NOW()
  WHERE id = NEW.pattern_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. CREATE TRIGGER TO AUTO-UPDATE PATTERN STATISTICS
CREATE TRIGGER update_pattern_statistics_on_occurrence
  AFTER INSERT ON pattern_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_statistics();

-- 7. ADD COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE recurring_issue_patterns IS 'Tracks recurring issue patterns detected during chapter editing/analysis. When a pattern exceeds the threshold, prompts are automatically updated to prevent the issue.';
COMMENT ON TABLE pattern_occurrences IS 'Tracks individual occurrences of recurring issue patterns for detailed tracking and analysis.';
COMMENT ON COLUMN recurring_issue_patterns.issue_type IS 'Type of issue: gap, transition, grammar, continuity, time_skip, character_consistency, plot_hole, style, formatting, paragraph_structure, sentence_structure';
COMMENT ON COLUMN recurring_issue_patterns.location IS 'Location where issue occurs: start (chapter beginning), middle, end (chapter ending), transition (between chapters)';
COMMENT ON COLUMN recurring_issue_patterns.threshold_count IS 'Number of occurrences required before pattern is considered recurring (default: 5)';
COMMENT ON COLUMN recurring_issue_patterns.is_active IS 'true if pattern is still occurring, false if resolved';
COMMENT ON COLUMN recurring_issue_patterns.prompt_constraint_added IS 'The constraint text that was added to prompts to prevent this issue';
