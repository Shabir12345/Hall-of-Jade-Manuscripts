-- STORY THREADS SYSTEM MIGRATION
-- Run this script in your Supabase SQL Editor to add story thread tracking capabilities
-- This migration adds comprehensive thread tracking to prevent plot holes and ensure all narrative threads reach satisfying conclusions

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. STORY_THREADS - Main thread entities tracking narrative threads
CREATE TABLE IF NOT EXISTS story_threads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT CHECK (type IN ('enemy', 'technique', 'item', 'location', 'sect', 'promise', 'mystery', 'relationship', 'power', 'quest', 'revelation', 'conflict', 'alliance')),
  status TEXT CHECK (status IN ('active', 'paused', 'resolved', 'abandoned')),
  priority TEXT CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  description TEXT DEFAULT '',
  introduced_chapter INTEGER NOT NULL,
  last_updated_chapter INTEGER NOT NULL,
  resolved_chapter INTEGER,
  related_entity_id UUID,
  related_entity_type TEXT,
  progression_notes JSONB DEFAULT '[]'::jsonb,
  resolution_notes TEXT,
  satisfaction_score INTEGER,
  chapters_involved JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT story_threads_introduced_chapter_positive CHECK (introduced_chapter > 0),
  CONSTRAINT story_threads_last_updated_chapter_positive CHECK (last_updated_chapter > 0),
  CONSTRAINT story_threads_resolved_chapter_positive CHECK (resolved_chapter IS NULL OR resolved_chapter > 0),
  CONSTRAINT story_threads_satisfaction_score_range CHECK (satisfaction_score IS NULL OR (satisfaction_score >= 0 AND satisfaction_score <= 100))
);

-- 2. THREAD_PROGRESSION_EVENTS - Track thread progression events over time
CREATE TABLE IF NOT EXISTS thread_progression_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  thread_id UUID REFERENCES story_threads(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  event_type TEXT CHECK (event_type IN ('introduced', 'progressed', 'resolved', 'hinted')),
  description TEXT NOT NULL,
  significance TEXT CHECK (significance IN ('major', 'minor', 'foreshadowing')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT thread_progression_events_chapter_positive CHECK (chapter_number > 0),
  CONSTRAINT thread_progression_events_unique UNIQUE(thread_id, chapter_number, event_type)
);

-- Enable Row Level Security
ALTER TABLE story_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE thread_progression_events ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Enable all for anon" ON story_threads;
DROP POLICY IF EXISTS "Enable all for anon" ON thread_progression_events;

-- Create policies to allow all operations for anonymous users (public)
CREATE POLICY "Enable all for anon" ON story_threads FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON thread_progression_events FOR ALL TO anon USING (true) WITH CHECK (true);

-- Create triggers for automatic updated_at
DROP TRIGGER IF EXISTS update_story_threads_updated_at ON story_threads;

CREATE TRIGGER update_story_threads_updated_at
  BEFORE UPDATE ON story_threads
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_story_threads_novel_id ON story_threads(novel_id);
CREATE INDEX IF NOT EXISTS idx_story_threads_status ON story_threads(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_story_threads_type ON story_threads(novel_id, type);
CREATE INDEX IF NOT EXISTS idx_story_threads_priority ON story_threads(novel_id, priority);
CREATE INDEX IF NOT EXISTS idx_story_threads_introduced_chapter ON story_threads(novel_id, introduced_chapter);
CREATE INDEX IF NOT EXISTS idx_story_threads_last_updated_chapter ON story_threads(novel_id, last_updated_chapter);
CREATE INDEX IF NOT EXISTS idx_story_threads_related_entity ON story_threads(related_entity_id, related_entity_type);
CREATE INDEX IF NOT EXISTS idx_thread_progression_events_thread ON thread_progression_events(thread_id);
CREATE INDEX IF NOT EXISTS idx_thread_progression_events_chapter ON thread_progression_events(chapter_id);
CREATE INDEX IF NOT EXISTS idx_thread_progression_events_chapter_number ON thread_progression_events(thread_id, chapter_number);

-- Comments for documentation
COMMENT ON TABLE story_threads IS 'Tracks narrative threads (enemies, techniques, items, locations, sects) to ensure all threads progress and reach satisfying conclusions';
COMMENT ON TABLE thread_progression_events IS 'Tracks progression events for each thread (introduced, progressed, resolved, hinted)';
COMMENT ON COLUMN story_threads.type IS 'Thread type: enemy (antagonist/opposition), technique (technique-related), item (item-related), location (territory-related), sect (sect/organization-related), promise (character promises), mystery (unsolved mysteries), relationship (character relationships), power (cultivation/power progression), quest (missions/quests), revelation (secrets to reveal), conflict (ongoing conflicts), alliance (alliances/partnerships)';
COMMENT ON COLUMN story_threads.status IS 'Thread status: active (currently progressing), paused (on hold), resolved (satisfying conclusion reached), abandoned (dropped, needs attention)';
COMMENT ON COLUMN story_threads.priority IS 'Thread priority: critical (must address soon), high (important), medium (standard), low (background)';
COMMENT ON COLUMN story_threads.progression_notes IS 'JSONB array of progression milestones: [{chapterNumber, note, significance}]';
COMMENT ON COLUMN story_threads.chapters_involved IS 'JSONB array of chapter numbers where this thread appears';
COMMENT ON COLUMN story_threads.satisfaction_score IS '0-100 score for resolution quality (only set when resolved)';
COMMENT ON COLUMN thread_progression_events.event_type IS 'Event type: introduced (thread first appears), progressed (thread advances), resolved (thread concludes), hinted (thread foreshadowed)';
COMMENT ON COLUMN thread_progression_events.significance IS 'Event significance: major (significant development), minor (small update), foreshadowing (hint for future)';
