-- DATABASE MIGRATION: EDITOR SYSTEM
-- Run this script in your Supabase SQL Editor to add editor tables.
-- This handles editor reports and fixes tracking.

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. EDITOR REPORTS
-- Tracks editor analysis runs (every 5 chapters or arc completion)
CREATE TABLE IF NOT EXISTS editor_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  trigger_type TEXT CHECK (trigger_type IN ('chapter_batch', 'arc_complete', 'manual')) NOT NULL,
  trigger_id UUID, -- Arc ID if arc_complete, null if chapter_batch
  chapters_analyzed INTEGER[] NOT NULL, -- Array of chapter numbers analyzed
  report_data JSONB NOT NULL, -- Full editor report data (analysis, issues, fixes)
  auto_fixed_count INTEGER DEFAULT 0,
  pending_fix_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT editor_reports_chapters_not_empty CHECK (array_length(chapters_analyzed, 1) > 0)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_editor_reports_novel_id ON editor_reports(novel_id);
CREATE INDEX IF NOT EXISTS idx_editor_reports_trigger_type ON editor_reports(trigger_type);
CREATE INDEX IF NOT EXISTS idx_editor_reports_created_at ON editor_reports(created_at DESC);

-- 2. EDITOR FIXES
-- Tracks individual fixes applied to chapters
CREATE TABLE IF NOT EXISTS editor_fixes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID REFERENCES editor_reports(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  issue_id UUID NOT NULL, -- Reference to issue in report_data
  fix_type TEXT CHECK (fix_type IN ('gap', 'transition', 'grammar', 'continuity', 'time_skip', 'character_consistency', 'plot_hole', 'style', 'formatting')) NOT NULL,
  original_text TEXT NOT NULL,
  fixed_text TEXT NOT NULL,
  reason TEXT DEFAULT '',
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected', 'applied')) DEFAULT 'pending',
  applied_at TIMESTAMP WITH TIME ZONE,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_editor_fixes_report_id ON editor_fixes(report_id);
CREATE INDEX IF NOT EXISTS idx_editor_fixes_chapter_id ON editor_fixes(chapter_id);
CREATE INDEX IF NOT EXISTS idx_editor_fixes_status ON editor_fixes(status);

-- 3. CREATE FUNCTION TO UPDATE UPDATED_AT TIMESTAMP
CREATE OR REPLACE FUNCTION update_editor_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. CREATE TRIGGERS TO AUTO-UPDATE UPDATED_AT
CREATE TRIGGER update_editor_reports_updated_at
  BEFORE UPDATE ON editor_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_editor_tables_updated_at();

CREATE TRIGGER update_editor_fixes_updated_at
  BEFORE UPDATE ON editor_fixes
  FOR EACH ROW
  EXECUTE FUNCTION update_editor_tables_updated_at();

-- 5. ADD COMMENTS FOR DOCUMENTATION
COMMENT ON TABLE editor_reports IS 'Tracks editor analysis runs (every 5 chapters or arc completion)';
COMMENT ON TABLE editor_fixes IS 'Tracks individual fixes applied to chapters';
COMMENT ON COLUMN editor_reports.trigger_type IS 'Type of trigger: chapter_batch (every 5 chapters), arc_complete (arc finished), manual (user triggered)';
COMMENT ON COLUMN editor_reports.chapters_analyzed IS 'Array of chapter numbers that were analyzed';
COMMENT ON COLUMN editor_reports.report_data IS 'Full JSONB report containing analysis, issues, and fixes';
COMMENT ON COLUMN editor_fixes.status IS 'pending: awaiting approval, approved: approved but not applied, applied: fix has been applied, rejected: fix was rejected';
