-- STORY THREADS PLANNING SYSTEM MIGRATION
-- Adds fields for planning thread length and resolution targets

-- Add new columns for thread planning
ALTER TABLE story_threads 
ADD COLUMN IF NOT EXISTS thread_scope TEXT CHECK (thread_scope IN ('short', 'medium', 'long', 'story')),
ADD COLUMN IF NOT EXISTS estimated_duration INTEGER,
ADD COLUMN IF NOT EXISTS resolution_target_chapter INTEGER;

-- Comments for documentation
COMMENT ON COLUMN story_threads.thread_scope IS 'Planned scope: short (1-5 chapters), medium (15-20 chapters), long (arc length), story (novel length)';
COMMENT ON COLUMN story_threads.estimated_duration IS 'Estimated total duration in chapters';
COMMENT ON COLUMN story_threads.resolution_target_chapter IS 'Target chapter number for resolution';

-- Update existing rows to have default values if needed (optional)
-- UPDATE story_threads SET thread_scope = 'medium' WHERE thread_scope IS NULL;
