-- AUTHENTICATION MIGRATION
-- This migration adds user_id columns to all tables and updates RLS policies
-- to require authentication and filter by user_id.
-- 
-- IMPORTANT: This migration assumes existing data belongs to a single user.
-- For production, you may need to assign existing data to a specific user_id
-- or allow null user_id temporarily during migration.

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Add user_id columns to all tables (nullable initially for existing data)
-- We'll make them NOT NULL after migrating existing data

-- Main tables
ALTER TABLE novels ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE realms ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE territories ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE world_entries ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE characters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE chapters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE scenes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE arcs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE system_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE tags ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE writing_goals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Newer tables (may not exist yet, so use IF EXISTS checks)
DO $$ 
BEGIN
  -- Novel items and techniques
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'novel_items') THEN
    ALTER TABLE novel_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'novel_techniques') THEN
    ALTER TABLE novel_techniques ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- Character relationships
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'character_item_possessions') THEN
    ALTER TABLE character_item_possessions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'character_technique_mastery') THEN
    ALTER TABLE character_technique_mastery ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- Antagonists
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'antagonists') THEN
    ALTER TABLE antagonists ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'antagonist_relationships') THEN
    ALTER TABLE antagonist_relationships ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'antagonist_arcs') THEN
    ALTER TABLE antagonist_arcs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'antagonist_chapters') THEN
    ALTER TABLE antagonist_chapters ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'antagonist_groups') THEN
    ALTER TABLE antagonist_groups ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'antagonist_progression') THEN
    ALTER TABLE antagonist_progression ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- Narrative elements
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'foreshadowing_elements') THEN
    ALTER TABLE foreshadowing_elements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'symbolic_elements') THEN
    ALTER TABLE symbolic_elements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'emotional_payoffs') THEN
    ALTER TABLE emotional_payoffs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'subtext_elements') THEN
    ALTER TABLE subtext_elements ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- Editor system
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'editor_reports') THEN
    ALTER TABLE editor_reports ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'editor_fixes') THEN
    ALTER TABLE editor_fixes ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'editor_highlights') THEN
    ALTER TABLE editor_highlights ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'editor_comments') THEN
    ALTER TABLE editor_comments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'editor_suggestions') THEN
    ALTER TABLE editor_suggestions ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  -- Pattern detection
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'recurring_issue_patterns') THEN
    ALTER TABLE recurring_issue_patterns ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
  
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'pattern_occurrences') THEN
    ALTER TABLE pattern_occurrences ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Step 2: Create indexes on user_id columns for performance
CREATE INDEX IF NOT EXISTS idx_novels_user_id ON novels(user_id);
CREATE INDEX IF NOT EXISTS idx_realms_user_id ON realms(user_id);
CREATE INDEX IF NOT EXISTS idx_territories_user_id ON territories(user_id);
CREATE INDEX IF NOT EXISTS idx_world_entries_user_id ON world_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON characters(user_id);
CREATE INDEX IF NOT EXISTS idx_chapters_user_id ON chapters(user_id);
CREATE INDEX IF NOT EXISTS idx_scenes_user_id ON scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_arcs_user_id ON arcs(user_id);
CREATE INDEX IF NOT EXISTS idx_system_logs_user_id ON system_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
CREATE INDEX IF NOT EXISTS idx_writing_goals_user_id ON writing_goals(user_id);

-- Step 3: Drop existing RLS policies (if any) and enable RLS on all tables
-- Enable RLS
ALTER TABLE novels ENABLE ROW LEVEL SECURITY;
ALTER TABLE realms ENABLE ROW LEVEL SECURITY;
ALTER TABLE territories ENABLE ROW LEVEL SECURITY;
ALTER TABLE world_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE arcs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE writing_goals ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies that require authentication and filter by user_id
-- Policy: Users can only see their own data
-- Policy: Users can only insert data with their own user_id
-- Policy: Users can only update their own data
-- Policy: Users can only delete their own data

-- Helper function to create policies for a table
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'novels', 'realms', 'territories', 'world_entries', 'characters', 
    'chapters', 'scenes', 'arcs', 'system_logs', 'tags', 'writing_goals',
    'novel_items', 'novel_techniques', 'character_item_possessions',
    'character_technique_mastery', 'antagonists', 'antagonist_relationships',
    'antagonist_arcs', 'antagonist_chapters', 'antagonist_groups',
    'antagonist_progression', 'foreshadowing_elements', 'symbolic_elements',
    'emotional_payoffs', 'subtext_elements', 'editor_reports', 'editor_fixes',
    'editor_highlights', 'editor_comments', 'editor_suggestions',
    'recurring_issue_patterns', 'pattern_occurrences'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    -- Skip if table doesn't exist
    IF NOT EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = table_name) THEN
      CONTINUE;
    END IF;
    
    -- Drop existing policies
    EXECUTE format('DROP POLICY IF EXISTS %I_select ON %I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_insert ON %I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_update ON %I', table_name, table_name);
    EXECUTE format('DROP POLICY IF EXISTS %I_delete ON %I', table_name, table_name);
    
    -- Create SELECT policy: Users can only see their own data
    EXECUTE format(
      'CREATE POLICY %I_select ON %I FOR SELECT USING (auth.uid() = user_id)',
      table_name, table_name
    );
    
    -- Create INSERT policy: Users can only insert data with their own user_id
    EXECUTE format(
      'CREATE POLICY %I_insert ON %I FOR INSERT WITH CHECK (auth.uid() = user_id)',
      table_name, table_name
    );
    
    -- Create UPDATE policy: Users can only update their own data
    EXECUTE format(
      'CREATE POLICY %I_update ON %I FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)',
      table_name, table_name
    );
    
    -- Create DELETE policy: Users can only delete their own data
    EXECUTE format(
      'CREATE POLICY %I_delete ON %I FOR DELETE USING (auth.uid() = user_id)',
      table_name, table_name
    );
  END LOOP;
END $$;

-- Step 5: Create a trigger function to automatically set user_id on insert
-- This ensures user_id is always set to the authenticated user's ID
CREATE OR REPLACE FUNCTION set_user_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for all tables (only if they have user_id column)
DO $$
DECLARE
  table_name TEXT;
  tables TEXT[] := ARRAY[
    'novels', 'realms', 'territories', 'world_entries', 'characters', 
    'chapters', 'scenes', 'arcs', 'system_logs', 'tags', 'writing_goals',
    'novel_items', 'novel_techniques', 'character_item_possessions',
    'character_technique_mastery', 'antagonists', 'antagonist_relationships',
    'antagonist_arcs', 'antagonist_chapters', 'antagonist_groups',
    'antagonist_progression', 'foreshadowing_elements', 'symbolic_elements',
    'emotional_payoffs', 'subtext_elements', 'editor_reports', 'editor_fixes',
    'editor_highlights', 'editor_comments', 'editor_suggestions',
    'recurring_issue_patterns', 'pattern_occurrences'
  ];
BEGIN
  FOREACH table_name IN ARRAY tables
  LOOP
    -- Skip if table doesn't exist or doesn't have user_id column
    IF NOT EXISTS (
      SELECT FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = table_name 
      AND column_name = 'user_id'
    ) THEN
      CONTINUE;
    END IF;
    
    -- Drop existing trigger if it exists
    EXECUTE format('DROP TRIGGER IF EXISTS set_user_id_%I ON %I', table_name, table_name);
    
    -- Create trigger
    EXECUTE format(
      'CREATE TRIGGER set_user_id_%I BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION set_user_id()',
      table_name, table_name
    );
  END LOOP;
END $$;

-- Step 6: Update existing data (OPTIONAL - only if you want to assign existing data to a user)
-- This step is commented out by default. Uncomment and replace 'YOUR_USER_ID' with an actual user ID
-- if you want to assign existing data to a specific user.
/*
DO $$
DECLARE
  default_user_id UUID := 'YOUR_USER_ID'::UUID; -- Replace with actual user ID
BEGIN
  -- Update all tables with existing data
  UPDATE novels SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE realms SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE territories SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE world_entries SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE characters SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE chapters SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE scenes SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE arcs SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE system_logs SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE tags SET user_id = default_user_id WHERE user_id IS NULL;
  UPDATE writing_goals SET user_id = default_user_id WHERE user_id IS NULL;
END $$;
*/

-- Step 7: After migrating existing data, you can make user_id NOT NULL
-- Uncomment these lines after migrating existing data:
/*
ALTER TABLE novels ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE realms ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE territories ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE world_entries ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE characters ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE chapters ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE scenes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE arcs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE system_logs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE tags ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE writing_goals ALTER COLUMN user_id SET NOT NULL;
*/

-- Step 8: Add comments for documentation
COMMENT ON COLUMN novels.user_id IS 'User who owns this novel';
COMMENT ON COLUMN realms.user_id IS 'User who owns this realm';
COMMENT ON COLUMN territories.user_id IS 'User who owns this territory';
COMMENT ON COLUMN world_entries.user_id IS 'User who owns this world entry';
COMMENT ON COLUMN characters.user_id IS 'User who owns this character';
COMMENT ON COLUMN chapters.user_id IS 'User who owns this chapter';
COMMENT ON COLUMN scenes.user_id IS 'User who owns this scene';
COMMENT ON COLUMN arcs.user_id IS 'User who owns this arc';
COMMENT ON COLUMN system_logs.user_id IS 'User who owns this system log';
COMMENT ON COLUMN tags.user_id IS 'User who owns this tag';
COMMENT ON COLUMN writing_goals.user_id IS 'User who owns this writing goal';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Authentication migration completed successfully!';
  RAISE NOTICE 'Remember to:';
  RAISE NOTICE '1. Assign existing data to a user (optional, see Step 6)';
  RAISE NOTICE '2. Make user_id NOT NULL after migrating data (see Step 7)';
  RAISE NOTICE '3. Test authentication with a test user';
END $$;
