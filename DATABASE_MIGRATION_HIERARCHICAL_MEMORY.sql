-- =============================================================================
-- HIERARCHICAL MEMORY ARCHITECTURE DATABASE MIGRATION
-- =============================================================================
-- This migration adds tables to support the three-tier memory system:
-- 1. Lore Bible snapshots (source of truth)
-- 2. Arc memory summaries (mid-term episodic memory)
-- 3. Vector sync status (Pinecone indexing tracking)
-- =============================================================================

-- =============================================================================
-- LORE BIBLE SNAPSHOTS TABLE
-- =============================================================================
-- Stores point-in-time snapshots of the Lore Bible for consistency tracking
-- and rollback capabilities.

CREATE TABLE IF NOT EXISTS lore_bible_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Chapter this snapshot represents
  chapter_number INTEGER NOT NULL,
  
  -- The complete Lore Bible JSON structure
  -- Contains: protagonist state, major characters, world state, 
  -- narrative anchors, power system, conflicts, karma debts
  lore_bible JSONB NOT NULL,
  
  -- Version for tracking changes
  version INTEGER NOT NULL DEFAULT 1,
  
  -- Whether this is the current active snapshot
  is_current BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure only one current snapshot per novel
  CONSTRAINT unique_current_snapshot 
    EXCLUDE USING btree (novel_id WITH =) WHERE (is_current = true)
);

-- Indexes for lore_bible_snapshots
CREATE INDEX IF NOT EXISTS idx_lore_bible_snapshots_novel 
  ON lore_bible_snapshots(novel_id);
CREATE INDEX IF NOT EXISTS idx_lore_bible_snapshots_chapter 
  ON lore_bible_snapshots(novel_id, chapter_number DESC);
CREATE INDEX IF NOT EXISTS idx_lore_bible_snapshots_current 
  ON lore_bible_snapshots(novel_id) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_lore_bible_snapshots_user 
  ON lore_bible_snapshots(user_id);

-- Enable RLS
ALTER TABLE lore_bible_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own lore bible snapshots"
  ON lore_bible_snapshots FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own lore bible snapshots"
  ON lore_bible_snapshots FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own lore bible snapshots"
  ON lore_bible_snapshots FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can delete their own lore bible snapshots"
  ON lore_bible_snapshots FOR DELETE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- =============================================================================
-- ARC MEMORY SUMMARIES TABLE
-- =============================================================================
-- Stores episodic memory summaries for each arc, including character states
-- at arc boundaries and thread progression.

CREATE TABLE IF NOT EXISTS arc_memory_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  arc_id UUID NOT NULL REFERENCES arcs(id) ON DELETE CASCADE,
  
  -- Arc information
  arc_title TEXT NOT NULL,
  start_chapter INTEGER NOT NULL,
  end_chapter INTEGER,
  arc_status TEXT NOT NULL DEFAULT 'active',
  
  -- The ~500 word arc summary
  summary TEXT NOT NULL,
  
  -- Key events that happened during the arc
  key_events JSONB DEFAULT '[]'::jsonb,
  
  -- Character states at arc boundaries
  -- Structure: Array of { characterId, characterName, cultivation, status, majorChanges, relationships }
  character_states JSONB DEFAULT '[]'::jsonb,
  
  -- Thread states during the arc
  -- Structure: Array of { threadId, threadTitle, type, statusAtStart, statusAtEnd, progression, isResolved }
  thread_states JSONB DEFAULT '[]'::jsonb,
  
  -- Conflict changes during the arc
  -- Structure: { introduced: [], resolved: [], escalated: [] }
  conflict_changes JSONB DEFAULT '{"introduced":[],"resolved":[],"escalated":[]}'::jsonb,
  
  -- Unresolved elements carried forward
  unresolved_elements JSONB DEFAULT '[]'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for arc_memory_summaries
CREATE INDEX IF NOT EXISTS idx_arc_memory_summaries_novel 
  ON arc_memory_summaries(novel_id);
CREATE INDEX IF NOT EXISTS idx_arc_memory_summaries_arc 
  ON arc_memory_summaries(arc_id);
CREATE INDEX IF NOT EXISTS idx_arc_memory_summaries_chapter 
  ON arc_memory_summaries(novel_id, start_chapter);
CREATE INDEX IF NOT EXISTS idx_arc_memory_summaries_status 
  ON arc_memory_summaries(novel_id, arc_status);
CREATE INDEX IF NOT EXISTS idx_arc_memory_summaries_user 
  ON arc_memory_summaries(user_id);

-- Enable RLS
ALTER TABLE arc_memory_summaries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own arc memory summaries"
  ON arc_memory_summaries FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own arc memory summaries"
  ON arc_memory_summaries FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own arc memory summaries"
  ON arc_memory_summaries FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can delete their own arc memory summaries"
  ON arc_memory_summaries FOR DELETE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- =============================================================================
-- VECTOR SYNC STATUS TABLE
-- =============================================================================
-- Tracks what entities have been indexed in Pinecone and when.
-- Used for incremental sync and detecting changes.

CREATE TABLE IF NOT EXISTS vector_sync_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Entity identification
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  
  -- Pinecone vector ID
  pinecone_id TEXT NOT NULL,
  
  -- Sync tracking
  last_synced TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  content_hash TEXT NOT NULL, -- Hash of content for change detection
  
  -- Sync status
  sync_status TEXT NOT NULL DEFAULT 'synced', -- synced, pending, failed
  error_message TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure unique entity per novel
  CONSTRAINT unique_entity_sync 
    UNIQUE (novel_id, entity_type, entity_id)
);

-- Indexes for vector_sync_status
CREATE INDEX IF NOT EXISTS idx_vector_sync_status_novel 
  ON vector_sync_status(novel_id);
CREATE INDEX IF NOT EXISTS idx_vector_sync_status_entity 
  ON vector_sync_status(novel_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_vector_sync_status_pending 
  ON vector_sync_status(novel_id) WHERE sync_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_vector_sync_status_failed 
  ON vector_sync_status(novel_id) WHERE sync_status = 'failed';
CREATE INDEX IF NOT EXISTS idx_vector_sync_status_pinecone 
  ON vector_sync_status(pinecone_id);
CREATE INDEX IF NOT EXISTS idx_vector_sync_status_user 
  ON vector_sync_status(user_id);

-- Enable RLS
ALTER TABLE vector_sync_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own vector sync status"
  ON vector_sync_status FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can insert their own vector sync status"
  ON vector_sync_status FOR INSERT
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can update their own vector sync status"
  ON vector_sync_status FOR UPDATE
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Users can delete their own vector sync status"
  ON vector_sync_status FOR DELETE
  USING (user_id = auth.uid() OR user_id IS NULL);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_lore_bible_snapshots_updated_at ON lore_bible_snapshots;
CREATE TRIGGER update_lore_bible_snapshots_updated_at
  BEFORE UPDATE ON lore_bible_snapshots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_arc_memory_summaries_updated_at ON arc_memory_summaries;
CREATE TRIGGER update_arc_memory_summaries_updated_at
  BEFORE UPDATE ON arc_memory_summaries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_vector_sync_status_updated_at ON vector_sync_status;
CREATE TRIGGER update_vector_sync_status_updated_at
  BEFORE UPDATE ON vector_sync_status
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to mark previous lore bible snapshots as not current
CREATE OR REPLACE FUNCTION set_lore_bible_current()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_current = true THEN
    UPDATE lore_bible_snapshots
    SET is_current = false
    WHERE novel_id = NEW.novel_id 
      AND id != NEW.id 
      AND is_current = true;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS set_lore_bible_current_trigger ON lore_bible_snapshots;
CREATE TRIGGER set_lore_bible_current_trigger
  BEFORE INSERT OR UPDATE ON lore_bible_snapshots
  FOR EACH ROW EXECUTE FUNCTION set_lore_bible_current();

-- =============================================================================
-- VIEWS FOR EASY QUERYING
-- =============================================================================

-- View: Current lore bible for each novel
CREATE OR REPLACE VIEW current_lore_bibles AS
SELECT 
  lbs.id,
  lbs.novel_id,
  lbs.chapter_number,
  lbs.lore_bible,
  lbs.version,
  lbs.created_at,
  lbs.updated_at,
  n.title as novel_title
FROM lore_bible_snapshots lbs
JOIN novels n ON n.id = lbs.novel_id
WHERE lbs.is_current = true;

-- View: Arc memories with novel info
CREATE OR REPLACE VIEW arc_memories_with_novel AS
SELECT 
  ams.id,
  ams.novel_id,
  ams.arc_id,
  ams.arc_title,
  ams.start_chapter,
  ams.end_chapter,
  ams.arc_status,
  ams.summary,
  ams.key_events,
  ams.character_states,
  ams.thread_states,
  ams.conflict_changes,
  ams.unresolved_elements,
  ams.created_at,
  ams.updated_at,
  n.title as novel_title
FROM arc_memory_summaries ams
JOIN novels n ON n.id = ams.novel_id;

-- View: Vector sync summary by novel
CREATE OR REPLACE VIEW vector_sync_summary AS
SELECT 
  novel_id,
  entity_type,
  COUNT(*) as total_entities,
  COUNT(*) FILTER (WHERE sync_status = 'synced') as synced_count,
  COUNT(*) FILTER (WHERE sync_status = 'pending') as pending_count,
  COUNT(*) FILTER (WHERE sync_status = 'failed') as failed_count,
  MAX(last_synced) as last_sync_time
FROM vector_sync_status
GROUP BY novel_id, entity_type;

-- =============================================================================
-- GRANT PERMISSIONS
-- =============================================================================
-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON lore_bible_snapshots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON arc_memory_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON vector_sync_status TO authenticated;
GRANT SELECT ON current_lore_bibles TO authenticated;
GRANT SELECT ON arc_memories_with_novel TO authenticated;
GRANT SELECT ON vector_sync_summary TO authenticated;

-- Grant access to anon for development (if needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON lore_bible_snapshots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON arc_memory_summaries TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON vector_sync_status TO anon;
GRANT SELECT ON current_lore_bibles TO anon;
GRANT SELECT ON arc_memories_with_novel TO anon;
GRANT SELECT ON vector_sync_summary TO anon;

-- =============================================================================
-- SAMPLE DATA DOCUMENTATION
-- =============================================================================
-- Example Lore Bible structure (for reference):
/*
{
  "novelId": "uuid",
  "asOfChapter": 412,
  "protagonist": {
    "identity": {
      "name": "Han Xiao",
      "aliases": ["The Azure Sword"],
      "sect": "Hidden Cloud",
      "title": "Inner Disciple"
    },
    "cultivation": {
      "realm": "Nascent Soul",
      "stage": "Middle",
      "foundationQuality": "Heaven-Grade (Perfect)",
      "physique": "Indestructible Vajra Body"
    },
    "techniques": [
      {"name": "Nine Heavens Thunder", "masteryLevel": "70%", "description": "Summons purple lightning"}
    ],
    "inventory": {
      "equipped": [{"name": "Rusty Spirit Sword", "category": "equipped"}],
      "storageRing": [{"name": "Qi Gathering Pill", "quantity": 5}, {"name": "Dragon Scale", "quantity": 1}]
    },
    "lastUpdatedChapter": 412
  },
  "majorCharacters": [...],
  "worldState": {
    "currentRealm": "Mortal Realm - Southern Continent",
    "currentLocation": "Hidden Cloud Sect",
    "currentSituation": "Preparing for the Alchemy Competition"
  },
  "narrativeAnchors": {
    "lastMajorEvent": "The destruction of the Wei Clan manor",
    "lastMajorEventChapter": 412,
    "currentObjective": "Find the Thousand-Year Ginseng to heal the Sect Leader",
    "activeQuests": ["Heal Sect Leader", "Win Alchemy Competition"],
    "pendingPromises": [...]
  },
  "powerSystem": {...},
  "activeConflicts": [
    {
      "id": "conflict_1",
      "description": "Sect War: Hidden Cloud vs. Blood Moon",
      "type": "sect",
      "status": "active",
      "urgency": "high"
    }
  ],
  "karmaDebts": [
    {
      "id": "karma_1",
      "target": "Young Master Wei",
      "targetStatus": "Deceased",
      "consequence": "Wei Clan Ancestor is hunting Han Xiao",
      "threatLevel": "severe"
    }
  ],
  "updatedAt": 1737293547000,
  "version": 15
}
*/

COMMENT ON TABLE lore_bible_snapshots IS 'Stores point-in-time snapshots of the Lore Bible for narrative consistency';
COMMENT ON TABLE arc_memory_summaries IS 'Stores episodic memory summaries for story arcs (mid-term memory)';
COMMENT ON TABLE vector_sync_status IS 'Tracks which entities have been indexed in Pinecone vector database';
