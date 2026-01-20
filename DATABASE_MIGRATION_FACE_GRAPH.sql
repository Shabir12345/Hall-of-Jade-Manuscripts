-- FACE GRAPH SYSTEM MIGRATION
-- Run this script in your Supabase SQL Editor to add Face/Karma tracking capabilities
-- This migration adds the social network memory system for tracking Face, Karma, and Blood Feuds
-- 
-- The Face Graph prevents "Generic NPC Syndrome" by making every character part of a web
-- of blood feuds, favors, and social obligations that persist across thousands of chapters.

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. FACE PROFILES - Character social standing and reputation
-- ============================================================================
CREATE TABLE IF NOT EXISTS face_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  character_name TEXT NOT NULL,
  -- Total Face points
  total_face INTEGER DEFAULT 0,
  -- Face tier (calculated from total_face)
  tier TEXT CHECK (tier IN ('nobody', 'known', 'renowned', 'famous', 'legendary', 'mythical')) DEFAULT 'nobody',
  -- Face breakdown by category
  face_martial INTEGER DEFAULT 0,
  face_scholarly INTEGER DEFAULT 0,
  face_political INTEGER DEFAULT 0,
  face_moral INTEGER DEFAULT 0,
  face_mysterious INTEGER DEFAULT 0,
  face_wealth INTEGER DEFAULT 0,
  -- Karma balance
  karma_balance INTEGER DEFAULT 0,
  positive_karma_total INTEGER DEFAULT 0,
  negative_karma_total INTEGER DEFAULT 0,
  -- Chapter tracking
  first_appeared_chapter INTEGER,
  last_updated_chapter INTEGER,
  -- Protection flag
  is_protected BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT face_profiles_unique UNIQUE(novel_id, character_id),
  CONSTRAINT face_profiles_first_chapter_positive CHECK (first_appeared_chapter IS NULL OR first_appeared_chapter > 0)
);

-- ============================================================================
-- 2. FACE TITLES - Epithets and titles earned
-- ============================================================================
CREATE TABLE IF NOT EXISTS face_titles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  face_profile_id UUID REFERENCES face_profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  earned_by TEXT DEFAULT '',
  earned_chapter INTEGER NOT NULL,
  face_bonus INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  lost_chapter INTEGER,
  lost_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT face_titles_earned_chapter_positive CHECK (earned_chapter > 0),
  CONSTRAINT face_titles_lost_chapter_positive CHECK (lost_chapter IS NULL OR lost_chapter > 0)
);

-- ============================================================================
-- 3. FACE ACCOMPLISHMENTS - Major reputation-boosting events
-- ============================================================================
CREATE TABLE IF NOT EXISTS face_accomplishments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  face_profile_id UUID REFERENCES face_profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  face_gained INTEGER DEFAULT 0,
  category TEXT CHECK (category IN ('martial', 'scholarly', 'political', 'moral', 'mysterious', 'wealth')),
  notoriety TEXT CHECK (notoriety IN ('local', 'regional', 'realm', 'universal')) DEFAULT 'local',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT face_accomplishments_chapter_positive CHECK (chapter_number > 0)
);

-- ============================================================================
-- 4. FACE SHAMES - Major reputation-damaging events
-- ============================================================================
CREATE TABLE IF NOT EXISTS face_shames (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  face_profile_id UUID REFERENCES face_profiles(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  chapter_number INTEGER NOT NULL,
  face_lost INTEGER DEFAULT 0,
  category TEXT CHECK (category IN ('martial', 'scholarly', 'political', 'moral', 'mysterious', 'wealth')),
  is_redeemed BOOLEAN DEFAULT false,
  redeemed_chapter INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT face_shames_chapter_positive CHECK (chapter_number > 0),
  CONSTRAINT face_shames_redeemed_chapter_positive CHECK (redeemed_chapter IS NULL OR redeemed_chapter > 0)
);

-- ============================================================================
-- 5. KARMA EVENTS - Individual karmic actions between characters
-- ============================================================================
CREATE TABLE IF NOT EXISTS karma_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  -- Actor (who did the action)
  actor_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  actor_name TEXT NOT NULL,
  -- Target (who received the action)
  target_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  target_name TEXT NOT NULL,
  -- Action details
  action_type TEXT CHECK (action_type IN (
    'kill', 'spare', 'humiliate', 'honor', 'betray', 'save', 'steal', 'gift',
    'defeat', 'submit', 'offend', 'protect', 'avenge', 'abandon', 'enslave',
    'liberate', 'curse', 'bless', 'destroy_sect', 'cripple_cultivation',
    'restore_cultivation', 'exterminate_clan', 'elevate_status'
  )) NOT NULL,
  polarity TEXT CHECK (polarity IN ('positive', 'negative', 'neutral')) NOT NULL,
  severity TEXT CHECK (severity IN ('minor', 'moderate', 'major', 'severe', 'extreme')) NOT NULL,
  karma_weight INTEGER NOT NULL CHECK (karma_weight BETWEEN 1 AND 100),
  -- Weight modifiers stored as JSONB
  weight_modifiers JSONB DEFAULT '[]'::jsonb,
  final_karma_weight INTEGER NOT NULL,
  -- Chapter tracking
  chapter_number INTEGER NOT NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  description TEXT DEFAULT '',
  -- Witness tracking
  was_witnessed BOOLEAN DEFAULT false,
  witness_ids UUID[] DEFAULT '{}',
  -- Face impact
  affected_face BOOLEAN DEFAULT false,
  face_change_actor INTEGER DEFAULT 0,
  face_change_target INTEGER DEFAULT 0,
  -- Ripple tracking
  ripple_affected_ids UUID[] DEFAULT '{}',
  -- Retaliation tracking
  is_retaliation BOOLEAN DEFAULT false,
  retaliation_for_event_id UUID REFERENCES karma_events(id) ON DELETE SET NULL,
  -- Settlement tracking
  is_settled BOOLEAN DEFAULT false,
  settlement_type TEXT CHECK (settlement_type IN ('avenged', 'forgiven', 'balanced', 'inherited')),
  settled_chapter INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT karma_events_chapter_positive CHECK (chapter_number > 0),
  CONSTRAINT karma_events_settled_chapter_positive CHECK (settled_chapter IS NULL OR settled_chapter > 0)
);

-- ============================================================================
-- 6. SOCIAL LINKS - Relationship connections in the social network
-- ============================================================================
CREATE TABLE IF NOT EXISTS social_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  -- Source character (whose perspective)
  source_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  source_character_name TEXT NOT NULL,
  -- Target character
  target_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  target_character_name TEXT NOT NULL,
  -- Link details
  link_type TEXT CHECK (link_type IN (
    'parent', 'child', 'sibling', 'spouse', 'clan_elder', 'clan_member',
    'master', 'disciple', 'martial_brother', 'martial_sister', 'dao_companion',
    'sect_leader', 'sect_member', 'sect_elder', 'faction_ally', 'faction_enemy',
    'vassal', 'overlord', 'friend', 'rival', 'enemy', 'nemesis',
    'debt_owed', 'debt_owed_by', 'blood_feud_target', 'blood_feud_hunter',
    'protector', 'protected', 'benefactor', 'beneficiary'
  )) NOT NULL,
  strength TEXT CHECK (strength IN ('weak', 'moderate', 'strong', 'unbreakable')) DEFAULT 'moderate',
  -- Sentiment (-100 to 100)
  sentiment_score INTEGER DEFAULT 0 CHECK (sentiment_score BETWEEN -100 AND 100),
  sentiment TEXT CHECK (sentiment IN ('hostile', 'antagonistic', 'cold', 'neutral', 'warm', 'friendly', 'devoted')) DEFAULT 'neutral',
  -- Karma tracking
  mutual_karma_balance INTEGER DEFAULT 0,
  unsettled_karma INTEGER DEFAULT 0,
  -- Chapter tracking
  established_chapter INTEGER NOT NULL,
  last_interaction_chapter INTEGER NOT NULL,
  relationship_history TEXT DEFAULT '',
  -- Inheritance tracking
  is_inherited BOOLEAN DEFAULT false,
  inherited_from_character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  inherited_chapter INTEGER,
  -- Visibility
  is_known_to_both BOOLEAN DEFAULT true,
  is_public_knowledge BOOLEAN DEFAULT false,
  -- Connected karma events
  karma_event_ids UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT social_links_unique UNIQUE(novel_id, source_character_id, target_character_id, link_type),
  CONSTRAINT social_links_established_chapter_positive CHECK (established_chapter > 0),
  CONSTRAINT social_links_no_self_link CHECK (source_character_id != target_character_id)
);

-- ============================================================================
-- 7. KARMA RIPPLES - Ripple effects from karmic actions
-- ============================================================================
CREATE TABLE IF NOT EXISTS karma_ripples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  -- Source karma event
  source_karma_event_id UUID REFERENCES karma_events(id) ON DELETE CASCADE,
  -- Original actor and target
  original_actor_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  original_actor_name TEXT NOT NULL,
  original_target_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  original_target_name TEXT NOT NULL,
  -- Affected character
  affected_character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  affected_character_name TEXT NOT NULL,
  -- Connection details
  connection_to_target TEXT NOT NULL,
  connection_path JSONB DEFAULT '[]'::jsonb,
  degrees_of_separation INTEGER NOT NULL CHECK (degrees_of_separation > 0),
  -- Effect details
  sentiment_change INTEGER DEFAULT 0,
  becomes_threat BOOLEAN DEFAULT false,
  threat_level TEXT CHECK (threat_level IN ('minor', 'moderate', 'major', 'extreme')),
  potential_response TEXT DEFAULT '',
  -- Tracking
  calculated_at_chapter INTEGER NOT NULL,
  has_manifested BOOLEAN DEFAULT false,
  manifested_chapter INTEGER,
  manifestation_description TEXT,
  decay_factor DECIMAL(3, 2) DEFAULT 1.00 CHECK (decay_factor BETWEEN 0 AND 1),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT karma_ripples_chapter_positive CHECK (calculated_at_chapter > 0)
);

-- ============================================================================
-- 8. BLOOD FEUDS - Multigenerational vendettas
-- ============================================================================
CREATE TABLE IF NOT EXISTS blood_feuds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  feud_name TEXT NOT NULL,
  -- Aggrieved party (seeking vengeance)
  aggrieved_party_type TEXT CHECK (aggrieved_party_type IN ('character', 'clan', 'sect', 'faction')) NOT NULL,
  aggrieved_party_id TEXT NOT NULL,
  aggrieved_party_name TEXT NOT NULL,
  -- Target of vengeance
  target_party_type TEXT CHECK (target_party_type IN ('character', 'clan', 'sect', 'faction')) NOT NULL,
  target_party_id TEXT NOT NULL,
  target_party_name TEXT NOT NULL,
  -- Feud details
  original_cause TEXT NOT NULL,
  origin_karma_event_id UUID REFERENCES karma_events(id) ON DELETE SET NULL,
  started_chapter INTEGER NOT NULL,
  intensity INTEGER DEFAULT 50 CHECK (intensity BETWEEN 0 AND 100),
  -- Members
  aggrieved_member_ids UUID[] DEFAULT '{}',
  target_member_ids UUID[] DEFAULT '{}',
  -- Resolution
  is_resolved BOOLEAN DEFAULT false,
  resolution_type TEXT CHECK (resolution_type IN ('vengeance_complete', 'mutual_destruction', 'forgiveness', 'extinction', 'alliance')),
  resolution_chapter INTEGER,
  resolution_description TEXT,
  -- Escalation history stored as JSONB
  escalations JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT blood_feuds_started_chapter_positive CHECK (started_chapter > 0),
  CONSTRAINT blood_feuds_resolution_chapter_positive CHECK (resolution_chapter IS NULL OR resolution_chapter > 0)
);

-- ============================================================================
-- 9. FACE DEBTS - Favors owed
-- ============================================================================
CREATE TABLE IF NOT EXISTS face_debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  -- Debtor (who owes)
  debtor_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  debtor_name TEXT NOT NULL,
  -- Creditor (who is owed)
  creditor_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  creditor_name TEXT NOT NULL,
  -- Debt details
  debt_type TEXT CHECK (debt_type IN ('life_saving', 'treasure', 'teaching', 'protection', 'political', 'other')) NOT NULL,
  description TEXT NOT NULL,
  origin_karma_event_id UUID REFERENCES karma_events(id) ON DELETE SET NULL,
  incurred_chapter INTEGER NOT NULL,
  debt_weight INTEGER DEFAULT 50 CHECK (debt_weight BETWEEN 1 AND 100),
  -- Repayment
  is_repaid BOOLEAN DEFAULT false,
  repayment_description TEXT,
  repayment_chapter INTEGER,
  -- Visibility and inheritance
  is_public_knowledge BOOLEAN DEFAULT false,
  can_be_inherited BOOLEAN DEFAULT true,
  was_inherited BOOLEAN DEFAULT false,
  inherited_from_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT face_debts_incurred_chapter_positive CHECK (incurred_chapter > 0),
  CONSTRAINT face_debts_repayment_chapter_positive CHECK (repayment_chapter IS NULL OR repayment_chapter > 0),
  CONSTRAINT face_debts_no_self_debt CHECK (debtor_id != creditor_id)
);

-- ============================================================================
-- 10. FACE GRAPH CONFIG - Novel-specific configuration
-- ============================================================================
CREATE TABLE IF NOT EXISTS face_graph_config (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  auto_calculate_ripples BOOLEAN DEFAULT true,
  max_ripple_degrees INTEGER DEFAULT 3 CHECK (max_ripple_degrees BETWEEN 1 AND 10),
  ripple_karma_threshold INTEGER DEFAULT 30 CHECK (ripple_karma_threshold BETWEEN 1 AND 100),
  karma_decay_per_chapter DECIMAL(4, 3) DEFAULT 0.990 CHECK (karma_decay_per_chapter BETWEEN 0 AND 1),
  auto_extract_karma BOOLEAN DEFAULT true,
  extraction_model TEXT DEFAULT 'gemini-2.5-flash',
  protected_character_ids UUID[] DEFAULT '{}',
  face_multipliers JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT face_graph_config_unique UNIQUE(novel_id)
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE face_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_accomplishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_shames ENABLE ROW LEVEL SECURITY;
ALTER TABLE karma_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE social_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE karma_ripples ENABLE ROW LEVEL SECURITY;
ALTER TABLE blood_feuds ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_graph_config ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Enable all for anon" ON face_profiles;
DROP POLICY IF EXISTS "Enable all for anon" ON face_titles;
DROP POLICY IF EXISTS "Enable all for anon" ON face_accomplishments;
DROP POLICY IF EXISTS "Enable all for anon" ON face_shames;
DROP POLICY IF EXISTS "Enable all for anon" ON karma_events;
DROP POLICY IF EXISTS "Enable all for anon" ON social_links;
DROP POLICY IF EXISTS "Enable all for anon" ON karma_ripples;
DROP POLICY IF EXISTS "Enable all for anon" ON blood_feuds;
DROP POLICY IF EXISTS "Enable all for anon" ON face_debts;
DROP POLICY IF EXISTS "Enable all for anon" ON face_graph_config;

-- ============================================================================
-- CREATE POLICIES (allow all for anonymous users)
-- ============================================================================
CREATE POLICY "Enable all for anon" ON face_profiles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON face_titles FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON face_accomplishments FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON face_shames FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON karma_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON social_links FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON karma_ripples FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON blood_feuds FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON face_debts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Enable all for anon" ON face_graph_config FOR ALL TO anon USING (true) WITH CHECK (true);

-- ============================================================================
-- TRIGGERS FOR AUTOMATIC updated_at
-- ============================================================================
DROP TRIGGER IF EXISTS update_face_profiles_updated_at ON face_profiles;
DROP TRIGGER IF EXISTS update_face_titles_updated_at ON face_titles;
DROP TRIGGER IF EXISTS update_face_shames_updated_at ON face_shames;
DROP TRIGGER IF EXISTS update_karma_events_updated_at ON karma_events;
DROP TRIGGER IF EXISTS update_social_links_updated_at ON social_links;
DROP TRIGGER IF EXISTS update_karma_ripples_updated_at ON karma_ripples;
DROP TRIGGER IF EXISTS update_blood_feuds_updated_at ON blood_feuds;
DROP TRIGGER IF EXISTS update_face_debts_updated_at ON face_debts;
DROP TRIGGER IF EXISTS update_face_graph_config_updated_at ON face_graph_config;

CREATE TRIGGER update_face_profiles_updated_at
  BEFORE UPDATE ON face_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_face_titles_updated_at
  BEFORE UPDATE ON face_titles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_face_shames_updated_at
  BEFORE UPDATE ON face_shames
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_karma_events_updated_at
  BEFORE UPDATE ON karma_events
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_social_links_updated_at
  BEFORE UPDATE ON social_links
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_karma_ripples_updated_at
  BEFORE UPDATE ON karma_ripples
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_blood_feuds_updated_at
  BEFORE UPDATE ON blood_feuds
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_face_debts_updated_at
  BEFORE UPDATE ON face_debts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_face_graph_config_updated_at
  BEFORE UPDATE ON face_graph_config
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================
-- Face profiles
CREATE INDEX IF NOT EXISTS idx_face_profiles_novel_id ON face_profiles(novel_id);
CREATE INDEX IF NOT EXISTS idx_face_profiles_character_id ON face_profiles(character_id);
CREATE INDEX IF NOT EXISTS idx_face_profiles_tier ON face_profiles(novel_id, tier);
CREATE INDEX IF NOT EXISTS idx_face_profiles_karma ON face_profiles(novel_id, karma_balance);

-- Face titles
CREATE INDEX IF NOT EXISTS idx_face_titles_profile_id ON face_titles(face_profile_id);
CREATE INDEX IF NOT EXISTS idx_face_titles_active ON face_titles(face_profile_id, is_active);

-- Karma events
CREATE INDEX IF NOT EXISTS idx_karma_events_novel_id ON karma_events(novel_id);
CREATE INDEX IF NOT EXISTS idx_karma_events_actor ON karma_events(novel_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_karma_events_target ON karma_events(novel_id, target_id);
CREATE INDEX IF NOT EXISTS idx_karma_events_chapter ON karma_events(novel_id, chapter_number);
CREATE INDEX IF NOT EXISTS idx_karma_events_action_type ON karma_events(novel_id, action_type);
CREATE INDEX IF NOT EXISTS idx_karma_events_unsettled ON karma_events(novel_id, is_settled) WHERE is_settled = false;
CREATE INDEX IF NOT EXISTS idx_karma_events_severity ON karma_events(novel_id, severity);

-- Social links
CREATE INDEX IF NOT EXISTS idx_social_links_novel_id ON social_links(novel_id);
CREATE INDEX IF NOT EXISTS idx_social_links_source ON social_links(novel_id, source_character_id);
CREATE INDEX IF NOT EXISTS idx_social_links_target ON social_links(novel_id, target_character_id);
CREATE INDEX IF NOT EXISTS idx_social_links_type ON social_links(novel_id, link_type);
CREATE INDEX IF NOT EXISTS idx_social_links_sentiment ON social_links(novel_id, sentiment_score);

-- Karma ripples
CREATE INDEX IF NOT EXISTS idx_karma_ripples_novel_id ON karma_ripples(novel_id);
CREATE INDEX IF NOT EXISTS idx_karma_ripples_source_event ON karma_ripples(source_karma_event_id);
CREATE INDEX IF NOT EXISTS idx_karma_ripples_affected ON karma_ripples(novel_id, affected_character_id);
CREATE INDEX IF NOT EXISTS idx_karma_ripples_unmanifested ON karma_ripples(novel_id, has_manifested) WHERE has_manifested = false;
CREATE INDEX IF NOT EXISTS idx_karma_ripples_threat ON karma_ripples(novel_id, becomes_threat) WHERE becomes_threat = true;

-- Blood feuds
CREATE INDEX IF NOT EXISTS idx_blood_feuds_novel_id ON blood_feuds(novel_id);
CREATE INDEX IF NOT EXISTS idx_blood_feuds_active ON blood_feuds(novel_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_blood_feuds_intensity ON blood_feuds(novel_id, intensity);

-- Face debts
CREATE INDEX IF NOT EXISTS idx_face_debts_novel_id ON face_debts(novel_id);
CREATE INDEX IF NOT EXISTS idx_face_debts_debtor ON face_debts(novel_id, debtor_id);
CREATE INDEX IF NOT EXISTS idx_face_debts_creditor ON face_debts(novel_id, creditor_id);
CREATE INDEX IF NOT EXISTS idx_face_debts_unpaid ON face_debts(novel_id, is_repaid) WHERE is_repaid = false;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to calculate Face tier from total Face points
CREATE OR REPLACE FUNCTION calculate_face_tier(total_face INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN total_face >= 10000 THEN 'mythical'
    WHEN total_face >= 5000 THEN 'legendary'
    WHEN total_face >= 2000 THEN 'famous'
    WHEN total_face >= 500 THEN 'renowned'
    WHEN total_face >= 100 THEN 'known'
    ELSE 'nobody'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to calculate sentiment category from score
CREATE OR REPLACE FUNCTION calculate_sentiment_category(sentiment_score INTEGER)
RETURNS TEXT AS $$
BEGIN
  RETURN CASE
    WHEN sentiment_score <= -60 THEN 'hostile'
    WHEN sentiment_score <= -20 THEN 'antagonistic'
    WHEN sentiment_score < 0 THEN 'cold'
    WHEN sentiment_score = 0 THEN 'neutral'
    WHEN sentiment_score <= 19 THEN 'warm'
    WHEN sentiment_score <= 59 THEN 'friendly'
    ELSE 'devoted'
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger to auto-update Face tier when total_face changes
CREATE OR REPLACE FUNCTION update_face_tier()
RETURNS TRIGGER AS $$
BEGIN
  NEW.tier = calculate_face_tier(NEW.total_face);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_face_tier ON face_profiles;
CREATE TRIGGER trigger_update_face_tier
  BEFORE INSERT OR UPDATE OF total_face ON face_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_face_tier();

-- Trigger to auto-update sentiment category when sentiment_score changes
CREATE OR REPLACE FUNCTION update_sentiment_category()
RETURNS TRIGGER AS $$
BEGIN
  NEW.sentiment = calculate_sentiment_category(NEW.sentiment_score);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_sentiment ON social_links;
CREATE TRIGGER trigger_update_sentiment
  BEFORE INSERT OR UPDATE OF sentiment_score ON social_links
  FOR EACH ROW
  EXECUTE FUNCTION update_sentiment_category();

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================
COMMENT ON TABLE face_profiles IS 'Character Face/reputation profiles tracking social standing in the cultivation world';
COMMENT ON TABLE face_titles IS 'Titles and epithets earned by characters (e.g., "Sword Demon", "Young Master Killer")';
COMMENT ON TABLE face_accomplishments IS 'Major accomplishments that increased a character''s Face';
COMMENT ON TABLE face_shames IS 'Major shames or losses of Face that a character has suffered';
COMMENT ON TABLE karma_events IS 'Individual karmic actions between characters (kills, saves, betrayals, etc.)';
COMMENT ON TABLE social_links IS 'Social network connections between characters with sentiment tracking';
COMMENT ON TABLE karma_ripples IS 'Ripple effects from karmic actions that affect connected characters';
COMMENT ON TABLE blood_feuds IS 'Multigenerational blood feuds between clans, sects, or individuals';
COMMENT ON TABLE face_debts IS 'Favors owed between characters that must be repaid';
COMMENT ON TABLE face_graph_config IS 'Per-novel configuration for the Face Graph system';

COMMENT ON COLUMN karma_events.karma_weight IS 'Raw karma weight 1-100 before modifiers';
COMMENT ON COLUMN karma_events.final_karma_weight IS 'Final karma weight after applying all modifiers';
COMMENT ON COLUMN social_links.sentiment_score IS 'Sentiment from source toward target (-100 hostile to 100 devoted)';
COMMENT ON COLUMN karma_ripples.degrees_of_separation IS 'How many relationship hops from the original target';
COMMENT ON COLUMN blood_feuds.intensity IS 'How heated the feud is (0-100), affects NPC aggression';
COMMENT ON COLUMN face_debts.debt_weight IS 'How significant the debt is (1-100), affects repayment expectations';
