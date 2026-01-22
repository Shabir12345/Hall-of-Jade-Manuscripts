-- ============================================================================
-- DATABASE MIGRATION: NARRATIVE FORENSICS SYSTEM (AKASHA RECALL)
-- ============================================================================
-- This migration adds support for the Narrative Forensic Scan feature,
-- which excavates forgotten plot threads and tracks their recovery.
-- ============================================================================

-- Add recovered thread fields to story_threads table
ALTER TABLE story_threads 
ADD COLUMN IF NOT EXISTS is_recovered BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS historical_evidence JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS neglect_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS recovery_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS recovered_at TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS priority_multiplier DECIMAL(3,2) DEFAULT 1.0;

-- Create narrative_seeds table for tracking discovered but not yet approved seeds
CREATE TABLE IF NOT EXISTS narrative_seeds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Seed identification
  seed_type TEXT NOT NULL CHECK (seed_type IN (
    'unanswered_question', 'unused_item', 'missing_npc', 
    'broken_promise', 'unresolved_conflict', 'forgotten_technique',
    'abandoned_location', 'dangling_mystery', 'chekhov_gun'
  )),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  
  -- Origin tracking
  origin_chapter INTEGER NOT NULL,
  origin_quote TEXT NOT NULL,
  origin_context TEXT,
  
  -- Discovery metadata
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  discovered_by_scan_id UUID,
  confidence_score INTEGER DEFAULT 0 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  
  -- Trace-forward results
  last_mentioned_chapter INTEGER,
  mention_count INTEGER DEFAULT 0,
  chapters_mentioned INTEGER[] DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'verified', 'approved', 'rejected', 'converted'
  )),
  neglect_score INTEGER DEFAULT 0,
  
  -- Conversion to thread
  converted_thread_id UUID REFERENCES story_threads(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ,
  approved_by TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create excavation_scans table for tracking scan history
CREATE TABLE IF NOT EXISTS excavation_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Scan parameters
  start_chapter INTEGER NOT NULL,
  end_chapter INTEGER NOT NULL,
  current_chapter INTEGER NOT NULL,
  
  -- Scan results
  seeds_discovered INTEGER DEFAULT 0,
  seeds_verified INTEGER DEFAULT 0,
  seeds_stale INTEGER DEFAULT 0,
  seeds_with_mentions INTEGER DEFAULT 0,
  
  -- Narrative debt calculation
  narrative_debt_score DECIMAL(10,2) DEFAULT 0,
  debt_breakdown JSONB DEFAULT '{}',
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'scanning', 'tracing', 'completed', 'failed'
  )),
  error_message TEXT,
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create recovered_thread_history table for tracking recovery actions
CREATE TABLE IF NOT EXISTS recovered_thread_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id UUID NOT NULL REFERENCES story_threads(id) ON DELETE CASCADE,
  seed_id UUID REFERENCES narrative_seeds(id) ON DELETE SET NULL,
  
  -- Recovery details
  action TEXT NOT NULL CHECK (action IN (
    'discovered', 'approved', 'rejected', 'reactivated', 'resolved'
  )),
  action_by TEXT,
  action_notes TEXT,
  
  -- Priority tracking
  priority_before TEXT,
  priority_after TEXT,
  priority_multiplier_applied DECIMAL(3,2),
  
  -- Director integration
  director_notified BOOLEAN DEFAULT FALSE,
  chapters_to_reintroduce INTEGER DEFAULT 3,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_narrative_seeds_novel_id ON narrative_seeds(novel_id);
CREATE INDEX IF NOT EXISTS idx_narrative_seeds_status ON narrative_seeds(status);
CREATE INDEX IF NOT EXISTS idx_narrative_seeds_origin_chapter ON narrative_seeds(origin_chapter);
CREATE INDEX IF NOT EXISTS idx_narrative_seeds_neglect_score ON narrative_seeds(neglect_score DESC);

CREATE INDEX IF NOT EXISTS idx_excavation_scans_novel_id ON excavation_scans(novel_id);
CREATE INDEX IF NOT EXISTS idx_excavation_scans_status ON excavation_scans(status);

CREATE INDEX IF NOT EXISTS idx_recovered_thread_history_thread_id ON recovered_thread_history(thread_id);

CREATE INDEX IF NOT EXISTS idx_story_threads_is_recovered ON story_threads(is_recovered) WHERE is_recovered = TRUE;
CREATE INDEX IF NOT EXISTS idx_story_threads_neglect_score ON story_threads(neglect_score DESC);

-- Add trigger to update updated_at on narrative_seeds
CREATE OR REPLACE FUNCTION update_narrative_seeds_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_narrative_seeds_updated_at ON narrative_seeds;
CREATE TRIGGER trigger_narrative_seeds_updated_at
  BEFORE UPDATE ON narrative_seeds
  FOR EACH ROW
  EXECUTE FUNCTION update_narrative_seeds_updated_at();

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE narrative_seeds IS 'Stores discovered narrative seeds (forgotten plot elements) from excavation scans';
COMMENT ON TABLE excavation_scans IS 'Tracks history of narrative forensic scans';
COMMENT ON TABLE recovered_thread_history IS 'Audit trail for recovered thread actions';

COMMENT ON COLUMN story_threads.is_recovered IS 'Whether this thread was recovered from a forensic scan';
COMMENT ON COLUMN story_threads.historical_evidence IS 'JSON containing origin quote, chapter, and discovery context';
COMMENT ON COLUMN story_threads.neglect_score IS 'Calculated score based on chapters since last mention (higher = more neglected)';
COMMENT ON COLUMN story_threads.priority_multiplier IS 'Multiplier applied to priority for recovered threads (default 2.0 for approved recoveries)';

COMMENT ON COLUMN narrative_seeds.seed_type IS 'Category of the discovered narrative seed';
COMMENT ON COLUMN narrative_seeds.origin_quote IS 'The exact text from the chapter where this seed was found';
COMMENT ON COLUMN narrative_seeds.neglect_score IS 'Current chapter - last mentioned chapter (or origin if never mentioned)';
