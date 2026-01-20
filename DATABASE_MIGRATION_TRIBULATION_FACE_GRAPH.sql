-- ============================================================================
-- TRIBULATION GATES & FACE GRAPH DATABASE MIGRATION
-- ============================================================================
-- This migration creates tables for two major features:
-- 1. Tribulation Gates: Human-in-the-loop decision points
-- 2. Face Graph: Social network memory system for karma and reputation
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TRIBULATION GATES TABLES
-- ============================================================================

-- Tribulation Gates table - stores decision points
CREATE TABLE IF NOT EXISTS tribulation_gates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    trigger_type TEXT NOT NULL,
    situation TEXT NOT NULL,
    context TEXT,
    protagonist_name TEXT NOT NULL,
    fate_paths JSONB NOT NULL DEFAULT '[]',
    selected_path_id UUID,
    selected_path_description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'skipped', 'expired')),
    skip_reason TEXT,
    arc_id UUID,
    related_thread_ids UUID[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast lookups by novel
CREATE INDEX IF NOT EXISTS idx_tribulation_gates_novel ON tribulation_gates(novel_id);
CREATE INDEX IF NOT EXISTS idx_tribulation_gates_status ON tribulation_gates(novel_id, status);
CREATE INDEX IF NOT EXISTS idx_tribulation_gates_chapter ON tribulation_gates(novel_id, chapter_number);

-- Tribulation Gate Config table - per-novel configuration
CREATE TABLE IF NOT EXISTS tribulation_gate_config (
    novel_id UUID PRIMARY KEY REFERENCES novels(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    minimum_chapter_gap INTEGER NOT NULL DEFAULT 15,
    auto_select_after_ms INTEGER,
    trigger_sensitivity TEXT NOT NULL DEFAULT 'medium' CHECK (trigger_sensitivity IN ('low', 'medium', 'high')),
    excluded_triggers TEXT[] DEFAULT '{}',
    max_pending_gates INTEGER DEFAULT 3,
    show_consequences BOOLEAN NOT NULL DEFAULT true,
    show_risk_levels BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- FACE GRAPH TABLES
-- ============================================================================

-- Face Profiles table - character reputation tracking
CREATE TABLE IF NOT EXISTS face_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    character_id UUID NOT NULL,
    character_name TEXT NOT NULL,
    total_face INTEGER NOT NULL DEFAULT 0,
    tier TEXT NOT NULL DEFAULT 'nobody' CHECK (tier IN ('nobody', 'known', 'renowned', 'famous', 'legendary', 'mythical')),
    face_martial INTEGER NOT NULL DEFAULT 0,
    face_scholarly INTEGER NOT NULL DEFAULT 0,
    face_political INTEGER NOT NULL DEFAULT 0,
    face_moral INTEGER NOT NULL DEFAULT 0,
    face_mysterious INTEGER NOT NULL DEFAULT 0,
    face_wealth INTEGER NOT NULL DEFAULT 0,
    karma_balance INTEGER NOT NULL DEFAULT 0,
    positive_karma_total INTEGER NOT NULL DEFAULT 0,
    negative_karma_total INTEGER NOT NULL DEFAULT 0,
    first_appeared_chapter INTEGER,
    last_updated_chapter INTEGER,
    is_protected BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(novel_id, character_id)
);

CREATE INDEX IF NOT EXISTS idx_face_profiles_novel ON face_profiles(novel_id);
CREATE INDEX IF NOT EXISTS idx_face_profiles_character ON face_profiles(novel_id, character_id);
CREATE INDEX IF NOT EXISTS idx_face_profiles_face ON face_profiles(novel_id, total_face DESC);

-- Face Titles table - epithets and titles
CREATE TABLE IF NOT EXISTS face_titles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    face_profile_id UUID NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    earned_by TEXT NOT NULL,
    earned_chapter INTEGER NOT NULL,
    face_bonus INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    lost_chapter INTEGER,
    lost_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_titles_profile ON face_titles(face_profile_id);

-- Face Accomplishments table
CREATE TABLE IF NOT EXISTS face_accomplishments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    face_profile_id UUID NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    face_gained INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('martial', 'scholarly', 'political', 'moral', 'mysterious', 'wealth')),
    notoriety TEXT NOT NULL DEFAULT 'local' CHECK (notoriety IN ('local', 'regional', 'realm', 'universal')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_accomplishments_profile ON face_accomplishments(face_profile_id);

-- Face Shames table
CREATE TABLE IF NOT EXISTS face_shames (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    face_profile_id UUID NOT NULL REFERENCES face_profiles(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    chapter_number INTEGER NOT NULL,
    face_lost INTEGER NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('martial', 'scholarly', 'political', 'moral', 'mysterious', 'wealth')),
    is_redeemed BOOLEAN NOT NULL DEFAULT false,
    redeemed_chapter INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_shames_profile ON face_shames(face_profile_id);

-- Karma Events table - tracks karmic actions between characters
CREATE TABLE IF NOT EXISTS karma_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL,
    actor_name TEXT NOT NULL,
    target_id UUID NOT NULL,
    target_name TEXT NOT NULL,
    action_type TEXT NOT NULL,
    polarity TEXT NOT NULL CHECK (polarity IN ('positive', 'negative', 'neutral')),
    severity TEXT NOT NULL DEFAULT 'moderate' CHECK (severity IN ('minor', 'moderate', 'major', 'severe', 'extreme')),
    karma_weight INTEGER NOT NULL,
    weight_modifiers JSONB DEFAULT '[]',
    final_karma_weight INTEGER NOT NULL,
    chapter_number INTEGER NOT NULL,
    chapter_id UUID,
    description TEXT NOT NULL,
    was_witnessed BOOLEAN NOT NULL DEFAULT false,
    witness_ids UUID[] DEFAULT '{}',
    affected_face BOOLEAN NOT NULL DEFAULT true,
    face_change_actor INTEGER DEFAULT 0,
    face_change_target INTEGER DEFAULT 0,
    ripple_affected_ids UUID[] DEFAULT '{}',
    is_retaliation BOOLEAN NOT NULL DEFAULT false,
    retaliation_for_event_id UUID REFERENCES karma_events(id),
    is_settled BOOLEAN NOT NULL DEFAULT false,
    settlement_type TEXT CHECK (settlement_type IN ('avenged', 'forgiven', 'balanced', 'inherited')),
    settled_chapter INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_karma_events_novel ON karma_events(novel_id);
CREATE INDEX IF NOT EXISTS idx_karma_events_actor ON karma_events(novel_id, actor_id);
CREATE INDEX IF NOT EXISTS idx_karma_events_target ON karma_events(novel_id, target_id);
CREATE INDEX IF NOT EXISTS idx_karma_events_unsettled ON karma_events(novel_id, is_settled) WHERE is_settled = false;
CREATE INDEX IF NOT EXISTS idx_karma_events_chapter ON karma_events(novel_id, chapter_number);

-- Social Links table - relationship network
CREATE TABLE IF NOT EXISTS social_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    source_character_id UUID NOT NULL,
    source_character_name TEXT NOT NULL,
    target_character_id UUID NOT NULL,
    target_character_name TEXT NOT NULL,
    link_type TEXT NOT NULL,
    strength TEXT NOT NULL DEFAULT 'moderate' CHECK (strength IN ('weak', 'moderate', 'strong', 'unbreakable')),
    sentiment_score INTEGER NOT NULL DEFAULT 0 CHECK (sentiment_score >= -100 AND sentiment_score <= 100),
    sentiment TEXT GENERATED ALWAYS AS (
        CASE
            WHEN sentiment_score <= -60 THEN 'hostile'
            WHEN sentiment_score <= -20 THEN 'antagonistic'
            WHEN sentiment_score < 0 THEN 'cold'
            WHEN sentiment_score = 0 THEN 'neutral'
            WHEN sentiment_score <= 19 THEN 'warm'
            WHEN sentiment_score <= 59 THEN 'friendly'
            ELSE 'devoted'
        END
    ) STORED,
    mutual_karma_balance INTEGER NOT NULL DEFAULT 0,
    unsettled_karma INTEGER NOT NULL DEFAULT 0,
    established_chapter INTEGER NOT NULL,
    last_interaction_chapter INTEGER NOT NULL,
    relationship_history TEXT,
    is_inherited BOOLEAN NOT NULL DEFAULT false,
    inherited_from_character_id UUID,
    inherited_chapter INTEGER,
    is_known_to_both BOOLEAN NOT NULL DEFAULT true,
    is_public_knowledge BOOLEAN NOT NULL DEFAULT false,
    karma_event_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(novel_id, source_character_id, target_character_id, link_type)
);

CREATE INDEX IF NOT EXISTS idx_social_links_novel ON social_links(novel_id);
CREATE INDEX IF NOT EXISTS idx_social_links_source ON social_links(novel_id, source_character_id);
CREATE INDEX IF NOT EXISTS idx_social_links_target ON social_links(novel_id, target_character_id);
CREATE INDEX IF NOT EXISTS idx_social_links_type ON social_links(novel_id, link_type);

-- Karma Ripples table - tracks ripple effects
CREATE TABLE IF NOT EXISTS karma_ripples (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    source_karma_event_id UUID NOT NULL REFERENCES karma_events(id) ON DELETE CASCADE,
    original_actor_id UUID NOT NULL,
    original_actor_name TEXT NOT NULL,
    original_target_id UUID NOT NULL,
    original_target_name TEXT NOT NULL,
    affected_character_id UUID NOT NULL,
    affected_character_name TEXT NOT NULL,
    connection_to_target TEXT NOT NULL,
    connection_path JSONB NOT NULL DEFAULT '[]',
    degrees_of_separation INTEGER NOT NULL,
    sentiment_change INTEGER NOT NULL,
    becomes_threat BOOLEAN NOT NULL DEFAULT false,
    threat_level TEXT CHECK (threat_level IN ('minor', 'moderate', 'major', 'extreme')),
    potential_response TEXT,
    calculated_at_chapter INTEGER NOT NULL,
    has_manifested BOOLEAN NOT NULL DEFAULT false,
    manifested_chapter INTEGER,
    manifestation_description TEXT,
    decay_factor DECIMAL(5,4) NOT NULL DEFAULT 1.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_karma_ripples_novel ON karma_ripples(novel_id);
CREATE INDEX IF NOT EXISTS idx_karma_ripples_source ON karma_ripples(source_karma_event_id);
CREATE INDEX IF NOT EXISTS idx_karma_ripples_affected ON karma_ripples(novel_id, affected_character_id);
CREATE INDEX IF NOT EXISTS idx_karma_ripples_unmanifested ON karma_ripples(novel_id, has_manifested) WHERE has_manifested = false;

-- Blood Feuds table
CREATE TABLE IF NOT EXISTS blood_feuds (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    feud_name TEXT NOT NULL,
    aggrieved_party_type TEXT NOT NULL CHECK (aggrieved_party_type IN ('character', 'clan', 'sect', 'faction')),
    aggrieved_party_id UUID NOT NULL,
    aggrieved_party_name TEXT NOT NULL,
    target_party_type TEXT NOT NULL CHECK (target_party_type IN ('character', 'clan', 'sect', 'faction')),
    target_party_id UUID NOT NULL,
    target_party_name TEXT NOT NULL,
    original_cause TEXT NOT NULL,
    origin_karma_event_id UUID REFERENCES karma_events(id),
    started_chapter INTEGER NOT NULL,
    intensity INTEGER NOT NULL DEFAULT 50 CHECK (intensity >= 0 AND intensity <= 100),
    aggrieved_member_ids UUID[] DEFAULT '{}',
    target_member_ids UUID[] DEFAULT '{}',
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolution_type TEXT CHECK (resolution_type IN ('vengeance_complete', 'mutual_destruction', 'forgiveness', 'extinction', 'alliance')),
    resolution_chapter INTEGER,
    resolution_description TEXT,
    escalations JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blood_feuds_novel ON blood_feuds(novel_id);
CREATE INDEX IF NOT EXISTS idx_blood_feuds_active ON blood_feuds(novel_id, is_resolved) WHERE is_resolved = false;
CREATE INDEX IF NOT EXISTS idx_blood_feuds_aggrieved ON blood_feuds(novel_id, aggrieved_party_id);
CREATE INDEX IF NOT EXISTS idx_blood_feuds_target ON blood_feuds(novel_id, target_party_id);

-- Face Debts table
CREATE TABLE IF NOT EXISTS face_debts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    debtor_id UUID NOT NULL,
    debtor_name TEXT NOT NULL,
    creditor_id UUID NOT NULL,
    creditor_name TEXT NOT NULL,
    debt_type TEXT NOT NULL CHECK (debt_type IN ('life_saving', 'treasure', 'teaching', 'protection', 'political', 'other')),
    description TEXT NOT NULL,
    origin_karma_event_id UUID REFERENCES karma_events(id),
    incurred_chapter INTEGER NOT NULL,
    debt_weight INTEGER NOT NULL DEFAULT 50,
    is_repaid BOOLEAN NOT NULL DEFAULT false,
    repayment_description TEXT,
    repayment_chapter INTEGER,
    is_public_knowledge BOOLEAN NOT NULL DEFAULT false,
    can_be_inherited BOOLEAN NOT NULL DEFAULT true,
    was_inherited BOOLEAN NOT NULL DEFAULT false,
    inherited_from_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_face_debts_novel ON face_debts(novel_id);
CREATE INDEX IF NOT EXISTS idx_face_debts_debtor ON face_debts(novel_id, debtor_id);
CREATE INDEX IF NOT EXISTS idx_face_debts_creditor ON face_debts(novel_id, creditor_id);
CREATE INDEX IF NOT EXISTS idx_face_debts_unpaid ON face_debts(novel_id, is_repaid) WHERE is_repaid = false;

-- Face Graph Config table
CREATE TABLE IF NOT EXISTS face_graph_config (
    novel_id UUID PRIMARY KEY REFERENCES novels(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT true,
    auto_calculate_ripples BOOLEAN NOT NULL DEFAULT true,
    max_ripple_degrees INTEGER NOT NULL DEFAULT 3,
    ripple_karma_threshold INTEGER NOT NULL DEFAULT 30,
    karma_decay_per_chapter DECIMAL(5,4) NOT NULL DEFAULT 0.99,
    auto_extract_karma BOOLEAN NOT NULL DEFAULT true,
    extraction_model TEXT NOT NULL DEFAULT 'gemini-2.5-flash',
    protected_character_ids UUID[] DEFAULT '{}',
    face_multipliers JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_tribulation_gates_updated_at ON tribulation_gates;
CREATE TRIGGER update_tribulation_gates_updated_at
    BEFORE UPDATE ON tribulation_gates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tribulation_gate_config_updated_at ON tribulation_gate_config;
CREATE TRIGGER update_tribulation_gate_config_updated_at
    BEFORE UPDATE ON tribulation_gate_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_face_profiles_updated_at ON face_profiles;
CREATE TRIGGER update_face_profiles_updated_at
    BEFORE UPDATE ON face_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karma_events_updated_at ON karma_events;
CREATE TRIGGER update_karma_events_updated_at
    BEFORE UPDATE ON karma_events
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_social_links_updated_at ON social_links;
CREATE TRIGGER update_social_links_updated_at
    BEFORE UPDATE ON social_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_karma_ripples_updated_at ON karma_ripples;
CREATE TRIGGER update_karma_ripples_updated_at
    BEFORE UPDATE ON karma_ripples
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_blood_feuds_updated_at ON blood_feuds;
CREATE TRIGGER update_blood_feuds_updated_at
    BEFORE UPDATE ON blood_feuds
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_face_debts_updated_at ON face_debts;
CREATE TRIGGER update_face_debts_updated_at
    BEFORE UPDATE ON face_debts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_face_graph_config_updated_at ON face_graph_config;
CREATE TRIGGER update_face_graph_config_updated_at
    BEFORE UPDATE ON face_graph_config
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================
-- Note: Adjust policies based on your auth setup

ALTER TABLE tribulation_gates ENABLE ROW LEVEL SECURITY;
ALTER TABLE tribulation_gate_config ENABLE ROW LEVEL SECURITY;
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

-- Example policies (adjust based on your auth model)
-- These assume a user_id column exists on novels table

-- Tribulation Gates policies
CREATE POLICY "Users can manage their own tribulation gates"
    ON tribulation_gates
    FOR ALL
    USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()))
    WITH CHECK (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

-- Face Profiles policies  
CREATE POLICY "Users can manage face profiles for their novels"
    ON face_profiles
    FOR ALL
    USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()))
    WITH CHECK (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

-- Karma Events policies
CREATE POLICY "Users can manage karma events for their novels"
    ON karma_events
    FOR ALL
    USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()))
    WITH CHECK (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

-- Social Links policies
CREATE POLICY "Users can manage social links for their novels"
    ON social_links
    FOR ALL
    USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()))
    WITH CHECK (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

-- Blood Feuds policies
CREATE POLICY "Users can manage blood feuds for their novels"
    ON blood_feuds
    FOR ALL
    USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()))
    WITH CHECK (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

-- Face Debts policies
CREATE POLICY "Users can manage face debts for their novels"
    ON face_debts
    FOR ALL
    USING (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()))
    WITH CHECK (novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid()));

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tribulation_gates IS 'Human-in-the-loop decision points for novel generation';
COMMENT ON TABLE face_profiles IS 'Character reputation and Face tracking';
COMMENT ON TABLE karma_events IS 'Records of karmic actions between characters';
COMMENT ON TABLE social_links IS 'Social network connections between characters';
COMMENT ON TABLE karma_ripples IS 'Ripple effects from karma events';
COMMENT ON TABLE blood_feuds IS 'Multi-generational vendettas between parties';
COMMENT ON TABLE face_debts IS 'Favors owed between characters';
