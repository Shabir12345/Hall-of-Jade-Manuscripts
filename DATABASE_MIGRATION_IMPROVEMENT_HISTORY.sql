-- =====================================================
-- IMPROVEMENT HISTORY TABLE MIGRATION
-- =====================================================
-- This migration creates the improvement_history table
-- for tracking all novel improvements made through the
-- Narrative Optimization Engine (NOE).
-- =====================================================

-- Create the improvement_history table
CREATE TABLE IF NOT EXISTS improvement_history (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Timestamp when improvement was made
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Improvement category (structure, engagement, tension, etc.)
  category TEXT NOT NULL,
  
  -- Score tracking
  score_before INTEGER NOT NULL DEFAULT 0,
  score_after INTEGER NOT NULL DEFAULT 0,
  score_improvement INTEGER GENERATED ALWAYS AS (score_after - score_before) STORED,
  
  -- Action counts
  chapters_edited INTEGER NOT NULL DEFAULT 0,
  chapters_inserted INTEGER NOT NULL DEFAULT 0,
  chapters_regenerated INTEGER NOT NULL DEFAULT 0,
  actions_executed INTEGER NOT NULL DEFAULT 0,
  actions_succeeded INTEGER NOT NULL DEFAULT 0,
  actions_failed INTEGER NOT NULL DEFAULT 0,
  
  -- Summary text describing the improvement
  summary TEXT,
  
  -- JSON data for complex objects
  strategy JSONB,                    -- ImprovementStrategy object
  execution_result JSONB,            -- ImprovementExecutionResult object
  request JSONB,                     -- Original ImprovementRequest
  
  -- Full state snapshots for diff and rollback
  -- These can be large, so they're stored separately
  full_before_state JSONB,           -- Complete NovelState before improvement
  full_after_state JSONB,            -- Complete NovelState after improvement
  
  -- Pre-computed diff for fast rendering
  diff_snapshot JSONB,               -- NovelDiff object
  
  -- Evaluation fields (user assessment of the improvement)
  evaluation TEXT NOT NULL DEFAULT 'pending' CHECK (evaluation IN ('pending', 'approved', 'rejected')),
  evaluation_notes TEXT,
  evaluation_timestamp TIMESTAMPTZ,
  
  -- Rollback tracking
  rolled_back BOOLEAN NOT NULL DEFAULT FALSE,
  rollback_timestamp TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================

-- Index for querying by novel
CREATE INDEX IF NOT EXISTS idx_improvement_history_novel_id 
  ON improvement_history(novel_id);

-- Index for querying by user
CREATE INDEX IF NOT EXISTS idx_improvement_history_user_id 
  ON improvement_history(user_id);

-- Index for querying by category
CREATE INDEX IF NOT EXISTS idx_improvement_history_category 
  ON improvement_history(category);

-- Index for querying by timestamp (descending for recent first)
CREATE INDEX IF NOT EXISTS idx_improvement_history_timestamp 
  ON improvement_history(timestamp DESC);

-- Index for filtering by evaluation status
CREATE INDEX IF NOT EXISTS idx_improvement_history_evaluation 
  ON improvement_history(evaluation);

-- Index for filtering rolled back improvements
CREATE INDEX IF NOT EXISTS idx_improvement_history_rolled_back 
  ON improvement_history(rolled_back);

-- Composite index for common query pattern: novel + timestamp
CREATE INDEX IF NOT EXISTS idx_improvement_history_novel_timestamp 
  ON improvement_history(novel_id, timestamp DESC);

-- Composite index for filtering: novel + category + evaluation
CREATE INDEX IF NOT EXISTS idx_improvement_history_novel_category_eval 
  ON improvement_history(novel_id, category, evaluation);

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS
ALTER TABLE improvement_history ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own improvement history
CREATE POLICY improvement_history_select_own ON improvement_history
  FOR SELECT
  USING (
    auth.uid() = user_id 
    OR 
    EXISTS (
      SELECT 1 FROM novels 
      WHERE novels.id = improvement_history.novel_id 
      AND novels.user_id = auth.uid()
    )
  );

-- Policy: Users can insert improvement history for their own novels
CREATE POLICY improvement_history_insert_own ON improvement_history
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM novels 
      WHERE novels.id = improvement_history.novel_id 
      AND novels.user_id = auth.uid()
    )
  );

-- Policy: Users can update their own improvement history (for evaluation)
CREATE POLICY improvement_history_update_own ON improvement_history
  FOR UPDATE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM novels 
      WHERE novels.id = improvement_history.novel_id 
      AND novels.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM novels 
      WHERE novels.id = improvement_history.novel_id 
      AND novels.user_id = auth.uid()
    )
  );

-- Policy: Users can delete their own improvement history
CREATE POLICY improvement_history_delete_own ON improvement_history
  FOR DELETE
  USING (
    auth.uid() = user_id
    OR
    EXISTS (
      SELECT 1 FROM novels 
      WHERE novels.id = improvement_history.novel_id 
      AND novels.user_id = auth.uid()
    )
  );

-- =====================================================
-- TRIGGER FOR UPDATED_AT
-- =====================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_improvement_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on update
DROP TRIGGER IF EXISTS trigger_improvement_history_updated_at ON improvement_history;
CREATE TRIGGER trigger_improvement_history_updated_at
  BEFORE UPDATE ON improvement_history
  FOR EACH ROW
  EXECUTE FUNCTION update_improvement_history_updated_at();

-- =====================================================
-- HELPER VIEWS
-- =====================================================

-- View for improvement statistics per novel
CREATE OR REPLACE VIEW improvement_statistics AS
SELECT 
  novel_id,
  COUNT(*) as total_improvements,
  COUNT(*) FILTER (WHERE NOT rolled_back) as active_improvements,
  COUNT(*) FILTER (WHERE rolled_back) as rolled_back_count,
  COUNT(*) FILTER (WHERE evaluation = 'approved') as approved_count,
  COUNT(*) FILTER (WHERE evaluation = 'rejected') as rejected_count,
  COUNT(*) FILTER (WHERE evaluation = 'pending') as pending_count,
  AVG(score_improvement) FILTER (WHERE NOT rolled_back) as avg_score_improvement,
  MAX(score_improvement) FILTER (WHERE NOT rolled_back) as max_score_improvement,
  SUM(chapters_edited) FILTER (WHERE NOT rolled_back) as total_chapters_edited,
  SUM(chapters_inserted) FILTER (WHERE NOT rolled_back) as total_chapters_inserted,
  MIN(timestamp) as first_improvement,
  MAX(timestamp) as last_improvement
FROM improvement_history
GROUP BY novel_id;

-- View for score progression over time
CREATE OR REPLACE VIEW score_progression AS
SELECT 
  novel_id,
  category,
  timestamp,
  score_before,
  score_after,
  score_improvement,
  SUM(score_improvement) OVER (
    PARTITION BY novel_id, category 
    ORDER BY timestamp
  ) as cumulative_improvement
FROM improvement_history
WHERE NOT rolled_back
ORDER BY novel_id, category, timestamp;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE improvement_history IS 'Stores the complete history of novel improvements made through the Narrative Optimization Engine';
COMMENT ON COLUMN improvement_history.category IS 'The improvement category: structure, engagement, tension, theme, character, prose, originality, voice, literary_devices, excellence, market_readiness';
COMMENT ON COLUMN improvement_history.full_before_state IS 'Complete NovelState JSON snapshot before the improvement was applied';
COMMENT ON COLUMN improvement_history.full_after_state IS 'Complete NovelState JSON snapshot after the improvement was applied';
COMMENT ON COLUMN improvement_history.diff_snapshot IS 'Pre-computed NovelDiff JSON for fast rendering of changes';
COMMENT ON COLUMN improvement_history.evaluation IS 'User assessment of the improvement quality: pending, approved, or rejected';
