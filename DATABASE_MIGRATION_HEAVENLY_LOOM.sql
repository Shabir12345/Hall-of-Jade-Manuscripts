-- HEAVENLY LOOM NARRATIVE ENGINE MIGRATION
-- Transforms the thread tracking system into a full Narrative Control System
-- with Thread Physics (gravity, velocity, entropy, payoff debt)

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. ENHANCE STORY_THREADS TABLE WITH PHYSICS MODEL
-- ============================================================================

-- Add new columns for Thread Physics Model
ALTER TABLE story_threads 
ADD COLUMN IF NOT EXISTS signature TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS category TEXT CHECK (category IN ('SOVEREIGN', 'MAJOR', 'MINOR', 'SEED')) DEFAULT 'MINOR',
ADD COLUMN IF NOT EXISTS loom_status TEXT CHECK (loom_status IN ('SEED', 'OPEN', 'ACTIVE', 'BLOOMING', 'STALLED', 'CLOSED', 'ABANDONED')) DEFAULT 'OPEN',
ADD COLUMN IF NOT EXISTS karma_weight INTEGER DEFAULT 50 CHECK (karma_weight >= 1 AND karma_weight <= 100),
ADD COLUMN IF NOT EXISTS velocity INTEGER DEFAULT 0 CHECK (velocity >= -10 AND velocity <= 10),
ADD COLUMN IF NOT EXISTS payoff_debt INTEGER DEFAULT 0 CHECK (payoff_debt >= 0),
ADD COLUMN IF NOT EXISTS entropy INTEGER DEFAULT 0 CHECK (entropy >= 0 AND entropy <= 100),
ADD COLUMN IF NOT EXISTS first_chapter INTEGER,
ADD COLUMN IF NOT EXISTS last_mentioned_chapter INTEGER,
ADD COLUMN IF NOT EXISTS participants TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS resolution_criteria TEXT,
ADD COLUMN IF NOT EXISTS blooming_chapter INTEGER,
ADD COLUMN IF NOT EXISTS urgency_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_progress_type TEXT CHECK (last_progress_type IN ('NONE', 'INFO', 'ESCALATION', 'RESOLUTION')),
ADD COLUMN IF NOT EXISTS mention_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS director_attention_forced BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS intentional_abandonment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS abandonment_reason TEXT;

-- Create index on signature for fast lookups
CREATE INDEX IF NOT EXISTS idx_story_threads_signature ON story_threads(signature);
CREATE INDEX IF NOT EXISTS idx_story_threads_loom_status ON story_threads(novel_id, loom_status);
CREATE INDEX IF NOT EXISTS idx_story_threads_karma_weight ON story_threads(novel_id, karma_weight DESC);
CREATE INDEX IF NOT EXISTS idx_story_threads_urgency ON story_threads(novel_id, urgency_score DESC);
CREATE INDEX IF NOT EXISTS idx_story_threads_last_mentioned ON story_threads(novel_id, last_mentioned_chapter DESC);

-- ============================================================================
-- 2. THREAD MENTIONS TABLE - Track every time a thread is touched
-- ============================================================================

CREATE TABLE IF NOT EXISTS thread_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES story_threads(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  mention_type TEXT CHECK (mention_type IN ('DIRECT', 'INDIRECT', 'FORESHADOW', 'CALLBACK')),
  progress_type TEXT CHECK (progress_type IN ('NONE', 'INFO', 'ESCALATION', 'RESOLUTION')) DEFAULT 'NONE',
  context_summary TEXT,
  characters_involved TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT thread_mentions_chapter_positive CHECK (chapter_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_thread_mentions_thread ON thread_mentions(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_mentions_chapter ON thread_mentions(chapter_number);

-- ============================================================================
-- 3. DIRECTOR CONSTRAINTS TABLE - Track constraints issued by Director
-- ============================================================================

CREATE TABLE IF NOT EXISTS director_constraints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  thread_id UUID REFERENCES story_threads(id) ON DELETE SET NULL,
  constraint_type TEXT CHECK (constraint_type IN ('MUST_PROGRESS', 'MUST_ESCALATE', 'MUST_RESOLVE', 'FORESHADOW', 'TOUCH', 'FORBIDDEN_RESOLUTION', 'FORBIDDEN_OUTCOME')),
  mandatory_detail TEXT,
  was_satisfied BOOLEAN DEFAULT FALSE,
  satisfaction_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT director_constraints_chapter_positive CHECK (chapter_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_director_constraints_novel ON director_constraints(novel_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_director_constraints_thread ON director_constraints(thread_id);

-- ============================================================================
-- 4. CLERK AUDIT LOG TABLE - Track Clerk's narrative audits
-- ============================================================================

CREATE TABLE IF NOT EXISTS clerk_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  audit_result JSONB NOT NULL,
  thread_updates JSONB DEFAULT '[]'::jsonb,
  consistency_warnings TEXT[] DEFAULT '{}',
  new_threads_created INTEGER DEFAULT 0,
  threads_progressed INTEGER DEFAULT 0,
  threads_resolved INTEGER DEFAULT 0,
  threads_stalled INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT clerk_audit_log_chapter_positive CHECK (chapter_number > 0)
);

CREATE INDEX IF NOT EXISTS idx_clerk_audit_log_novel ON clerk_audit_log(novel_id, chapter_number DESC);

-- ============================================================================
-- 5. LOOM CONFIG TABLE - Store Loom configuration per novel
-- ============================================================================

CREATE TABLE IF NOT EXISTS loom_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE UNIQUE,
  enabled BOOLEAN DEFAULT TRUE,
  max_new_threads_per_chapter INTEGER DEFAULT 3,
  payoff_debt_multiplier FLOAT DEFAULT 1.0,
  urgency_calculation_enabled BOOLEAN DEFAULT TRUE,
  auto_stall_detection BOOLEAN DEFAULT TRUE,
  stall_threshold_chapters INTEGER DEFAULT 5,
  bloom_threshold_karma INTEGER DEFAULT 70,
  entropy_decay_rate FLOAT DEFAULT 0.1,
  velocity_momentum FLOAT DEFAULT 0.8,
  director_constraints_per_chapter INTEGER DEFAULT 3,
  protected_thread_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- 6. ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE thread_mentions ENABLE ROW LEVEL SECURITY;
ALTER TABLE director_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE clerk_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE loom_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for anon" ON thread_mentions;
DROP POLICY IF EXISTS "Enable all for anon" ON director_constraints;
DROP POLICY IF EXISTS "Enable all for anon" ON clerk_audit_log;
DROP POLICY IF EXISTS "Enable all for anon" ON loom_config;

-- Create policies for anonymous access
CREATE POLICY "Enable all for anon" ON thread_mentions FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON director_constraints FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON clerk_audit_log FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON loom_config FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================================
-- 7. TRIGGERS FOR AUTOMATIC UPDATES
-- ============================================================================

-- Update loom_config updated_at
DROP TRIGGER IF EXISTS update_loom_config_updated_at ON loom_config;
CREATE TRIGGER update_loom_config_updated_at
  BEFORE UPDATE ON loom_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- 8. HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate thread urgency
CREATE OR REPLACE FUNCTION calculate_thread_urgency(
  p_current_chapter INTEGER,
  p_last_mentioned_chapter INTEGER,
  p_karma_weight INTEGER,
  p_payoff_debt INTEGER,
  p_entropy INTEGER
) RETURNS INTEGER AS $$
DECLARE
  distance INTEGER;
  urgency INTEGER;
BEGIN
  distance := p_current_chapter - COALESCE(p_last_mentioned_chapter, p_current_chapter);
  urgency := (distance * p_karma_weight) + p_payoff_debt + p_entropy;
  RETURN LEAST(1000, GREATEST(0, urgency)); -- Cap at 0-1000
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to increment payoff debt on mention without progress
CREATE OR REPLACE FUNCTION increment_payoff_debt()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.progress_type = 'NONE' OR NEW.progress_type = 'INFO' THEN
    UPDATE story_threads
    SET payoff_debt = payoff_debt + (karma_weight / 10),
        mention_count = mention_count + 1,
        last_mentioned_chapter = NEW.chapter_number
    WHERE id = NEW.thread_id;
  ELSE
    UPDATE story_threads
    SET payoff_debt = GREATEST(0, payoff_debt - (karma_weight / 5)),
        mention_count = mention_count + 1,
        progress_count = progress_count + 1,
        last_mentioned_chapter = NEW.chapter_number,
        last_progress_type = NEW.progress_type,
        velocity = LEAST(10, velocity + 1)
    WHERE id = NEW.thread_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_increment_payoff_debt ON thread_mentions;
CREATE TRIGGER trg_increment_payoff_debt
  AFTER INSERT ON thread_mentions
  FOR EACH ROW
  EXECUTE FUNCTION increment_payoff_debt();

-- ============================================================================
-- 9. COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON COLUMN story_threads.signature IS 'Semantic ID for thread matching (e.g., REVENGE_SUN_FAMILY)';
COMMENT ON COLUMN story_threads.category IS 'Thread importance: SOVEREIGN (story-defining), MAJOR (arc-level), MINOR (chapter-level), SEED (mentioned, no obligation)';
COMMENT ON COLUMN story_threads.loom_status IS 'Lifecycle state: SEED→OPEN→ACTIVE→BLOOMING→CLOSED or STALLED/ABANDONED';
COMMENT ON COLUMN story_threads.karma_weight IS 'Narrative gravity/mass (1-100). Higher = more pull toward resolution';
COMMENT ON COLUMN story_threads.velocity IS 'Progression rate (-10 to +10). Negative = regressing, Positive = advancing';
COMMENT ON COLUMN story_threads.payoff_debt IS 'Accumulated debt from mentions without progress. Forces climax timing';
COMMENT ON COLUMN story_threads.entropy IS 'Chaos/unresolved state (0-100). High entropy = inconsistent/contradictory';
COMMENT ON COLUMN story_threads.resolution_criteria IS 'What must happen for valid resolution';
COMMENT ON COLUMN story_threads.blooming_chapter IS 'Chapter when thread entered BLOOMING state (payoff window open)';

COMMENT ON TABLE thread_mentions IS 'Every interaction with a thread across chapters';
COMMENT ON TABLE director_constraints IS 'Constraints issued by Director for Writer to follow';
COMMENT ON TABLE clerk_audit_log IS 'Audit trail of Clerk narrative analysis per chapter';
COMMENT ON TABLE loom_config IS 'Per-novel configuration for the Heavenly Loom system';

COMMENT ON FUNCTION calculate_thread_urgency IS 'Calculates urgency score: U = (distance × karma_weight) + payoff_debt + entropy';
