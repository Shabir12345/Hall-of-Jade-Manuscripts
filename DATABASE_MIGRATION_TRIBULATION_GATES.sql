-- ============================================================================
-- TRIBULATION GATES DATABASE MIGRATION
-- ============================================================================
-- Human-in-the-Loop Decision System for Major Plot Points
--
-- This migration creates tables for storing Tribulation Gates - decision points
-- where the AI pauses and presents the user with 3 fate paths to choose from.
-- ============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TRIBULATION GATES TABLE
-- ============================================================================
-- Stores each tribulation gate instance with its fate paths and resolution status

CREATE TABLE IF NOT EXISTS tribulation_gates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN (
        'realm_breakthrough',
        'life_death_crisis',
        'major_confrontation',
        'alliance_decision',
        'treasure_discovery',
        'identity_revelation',
        'marriage_proposal',
        'sect_choice',
        'forbidden_technique',
        'sacrifice_moment',
        'dao_comprehension',
        'inheritance_acceptance'
    )),
    situation TEXT NOT NULL,
    context TEXT,
    protagonist_name TEXT NOT NULL,
    fate_paths JSONB NOT NULL DEFAULT '[]'::jsonb,
    selected_path_id TEXT,
    selected_path_description TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'skipped', 'expired')),
    skip_reason TEXT,
    arc_id UUID REFERENCES arcs(id) ON DELETE SET NULL,
    related_thread_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    
    -- Ensure gate numbers are unique per novel
    CONSTRAINT unique_gate_per_chapter UNIQUE (novel_id, chapter_number, created_at)
);

-- Index for fast lookups by novel
CREATE INDEX IF NOT EXISTS idx_tribulation_gates_novel_id ON tribulation_gates(novel_id);

-- Index for finding pending gates
CREATE INDEX IF NOT EXISTS idx_tribulation_gates_status ON tribulation_gates(status);

-- Index for finding gates by trigger type (for analytics)
CREATE INDEX IF NOT EXISTS idx_tribulation_gates_trigger_type ON tribulation_gates(trigger_type);

-- Index for chronological ordering
CREATE INDEX IF NOT EXISTS idx_tribulation_gates_created_at ON tribulation_gates(created_at DESC);

-- ============================================================================
-- TRIBULATION GATE HISTORY TABLE
-- ============================================================================
-- Stores a simplified history of user choices for analytics

CREATE TABLE IF NOT EXISTS tribulation_gate_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    gate_id UUID NOT NULL REFERENCES tribulation_gates(id) ON DELETE CASCADE,
    novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
    chapter_number INTEGER NOT NULL,
    trigger_type TEXT NOT NULL,
    selected_path_label TEXT NOT NULL,
    selected_path_risk TEXT NOT NULL CHECK (selected_path_risk IN ('low', 'medium', 'high', 'extreme')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX IF NOT EXISTS idx_tribulation_gate_history_novel_id ON tribulation_gate_history(novel_id);
CREATE INDEX IF NOT EXISTS idx_tribulation_gate_history_risk ON tribulation_gate_history(selected_path_risk);

-- ============================================================================
-- TRIBULATION GATE CONFIG (stored in novel JSONB)
-- ============================================================================
-- Configuration is stored directly in the novels table's JSONB config column.
-- This comment documents the expected schema:
--
-- tribulation_gate_config: {
--     enabled: boolean,                    -- Whether gates are active
--     minimum_chapter_gap: integer,        -- Min chapters between gates (default: 15)
--     auto_select_after_ms: integer | null, -- Auto-select after timeout (null = no timeout)
--     trigger_sensitivity: 'low' | 'medium' | 'high', -- Detection sensitivity
--     excluded_triggers: string[],         -- Trigger types to exclude
--     max_pending_gates: integer,          -- Max pending gates before forcing resolution
--     show_consequences: boolean,          -- Whether to show consequence previews
--     show_risk_levels: boolean            -- Whether to show risk indicators
-- }

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function to get gate statistics for a novel
CREATE OR REPLACE FUNCTION get_tribulation_gate_stats(p_novel_id UUID)
RETURNS TABLE (
    total_gates BIGINT,
    resolved_gates BIGINT,
    skipped_gates BIGINT,
    pending_gates BIGINT,
    most_common_trigger TEXT,
    most_chosen_risk TEXT,
    avg_resolution_time_minutes NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    WITH gate_counts AS (
        SELECT 
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
            COUNT(*) FILTER (WHERE status = 'skipped') AS skipped,
            COUNT(*) FILTER (WHERE status = 'pending') AS pending
        FROM tribulation_gates
        WHERE novel_id = p_novel_id
    ),
    trigger_stats AS (
        SELECT trigger_type, COUNT(*) as cnt
        FROM tribulation_gates
        WHERE novel_id = p_novel_id
        GROUP BY trigger_type
        ORDER BY cnt DESC
        LIMIT 1
    ),
    risk_stats AS (
        SELECT selected_path_risk, COUNT(*) as cnt
        FROM tribulation_gate_history
        WHERE novel_id = p_novel_id
        GROUP BY selected_path_risk
        ORDER BY cnt DESC
        LIMIT 1
    ),
    resolution_time AS (
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) as avg_minutes
        FROM tribulation_gates
        WHERE novel_id = p_novel_id AND resolved_at IS NOT NULL
    )
    SELECT 
        gc.total,
        gc.resolved,
        gc.skipped,
        gc.pending,
        ts.trigger_type,
        rs.selected_path_risk,
        ROUND(rt.avg_minutes::NUMERIC, 2)
    FROM gate_counts gc
    LEFT JOIN trigger_stats ts ON true
    LEFT JOIN risk_stats rs ON true
    LEFT JOIN resolution_time rt ON true;
END;
$$ LANGUAGE plpgsql;

-- Function to check if a novel can trigger a new gate (respects minimum chapter gap)
CREATE OR REPLACE FUNCTION can_trigger_tribulation_gate(
    p_novel_id UUID,
    p_current_chapter INTEGER,
    p_minimum_gap INTEGER DEFAULT 15
)
RETURNS BOOLEAN AS $$
DECLARE
    last_gate_chapter INTEGER;
BEGIN
    SELECT chapter_number INTO last_gate_chapter
    FROM tribulation_gates
    WHERE novel_id = p_novel_id AND status = 'resolved'
    ORDER BY chapter_number DESC
    LIMIT 1;
    
    IF last_gate_chapter IS NULL THEN
        RETURN TRUE;
    END IF;
    
    RETURN (p_current_chapter - last_gate_chapter) >= p_minimum_gap;
END;
$$ LANGUAGE plpgsql;

-- Function to expire old pending gates
CREATE OR REPLACE FUNCTION expire_pending_tribulation_gates(
    p_max_age_hours INTEGER DEFAULT 24
)
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    WITH expired AS (
        UPDATE tribulation_gates
        SET 
            status = 'expired',
            resolved_at = NOW(),
            skip_reason = 'Expired due to inactivity'
        WHERE 
            status = 'pending' 
            AND created_at < NOW() - (p_max_age_hours || ' hours')::INTERVAL
        RETURNING id
    )
    SELECT COUNT(*) INTO expired_count FROM expired;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on tribulation_gates
ALTER TABLE tribulation_gates ENABLE ROW LEVEL SECURITY;

-- Policy for viewing gates (users can see gates for their novels)
CREATE POLICY tribulation_gates_select_policy ON tribulation_gates
    FOR SELECT
    USING (
        novel_id IN (
            SELECT id FROM novels 
            WHERE user_id = auth.uid() OR auth.uid() IS NULL
        )
    );

-- Policy for inserting gates
CREATE POLICY tribulation_gates_insert_policy ON tribulation_gates
    FOR INSERT
    WITH CHECK (
        novel_id IN (
            SELECT id FROM novels 
            WHERE user_id = auth.uid() OR auth.uid() IS NULL
        )
    );

-- Policy for updating gates
CREATE POLICY tribulation_gates_update_policy ON tribulation_gates
    FOR UPDATE
    USING (
        novel_id IN (
            SELECT id FROM novels 
            WHERE user_id = auth.uid() OR auth.uid() IS NULL
        )
    );

-- Policy for deleting gates
CREATE POLICY tribulation_gates_delete_policy ON tribulation_gates
    FOR DELETE
    USING (
        novel_id IN (
            SELECT id FROM novels 
            WHERE user_id = auth.uid() OR auth.uid() IS NULL
        )
    );

-- Enable RLS on tribulation_gate_history
ALTER TABLE tribulation_gate_history ENABLE ROW LEVEL SECURITY;

-- Policies for history table
CREATE POLICY tribulation_gate_history_select_policy ON tribulation_gate_history
    FOR SELECT
    USING (
        novel_id IN (
            SELECT id FROM novels 
            WHERE user_id = auth.uid() OR auth.uid() IS NULL
        )
    );

CREATE POLICY tribulation_gate_history_insert_policy ON tribulation_gate_history
    FOR INSERT
    WITH CHECK (
        novel_id IN (
            SELECT id FROM novels 
            WHERE user_id = auth.uid() OR auth.uid() IS NULL
        )
    );

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE tribulation_gates IS 'Stores Tribulation Gate instances - decision points where users choose fate paths';
COMMENT ON TABLE tribulation_gate_history IS 'Simplified history of user choices for analytics';

COMMENT ON COLUMN tribulation_gates.fate_paths IS 'JSONB array of FatePath objects: [{id, label, description, consequences[], riskLevel, emotionalTone, ...}]';
COMMENT ON COLUMN tribulation_gates.trigger_type IS 'What type of story moment triggered this gate (e.g., realm_breakthrough, life_death_crisis)';
COMMENT ON COLUMN tribulation_gates.status IS 'Gate status: pending (awaiting choice), resolved (choice made), skipped (user skipped), expired (timed out)';

-- ============================================================================
-- SAMPLE DATA (for testing - comment out in production)
-- ============================================================================

-- Uncomment to insert sample data for testing:
/*
INSERT INTO tribulation_gates (novel_id, chapter_number, trigger_type, situation, protagonist_name, fate_paths, status)
VALUES (
    '00000000-0000-0000-0000-000000000001', -- Replace with actual novel_id
    50,
    'realm_breakthrough',
    'Han Xiao stands at the threshold of Foundation Establishment. The heavenly tribulation gathers above, but three paths lie before him.',
    'Han Xiao',
    '[
        {
            "id": "path-a",
            "label": "A) Face the Tribulation Directly",
            "description": "Han Xiao steels his resolve and faces the heavenly lightning head-on, trusting in his accumulated cultivation.",
            "consequences": ["May achieve breakthrough", "Risk of severe injury", "Gains heaven recognition"],
            "riskLevel": "medium",
            "emotionalTone": "determined"
        },
        {
            "id": "path-b",
            "label": "B) Use the Forbidden Pill",
            "description": "The mysterious pill from the ancient tomb could guarantee success, but at what hidden cost?",
            "consequences": ["Guaranteed breakthrough", "Unknown side effects", "Attracts sect attention"],
            "riskLevel": "high",
            "emotionalTone": "desperate"
        },
        {
            "id": "path-c",
            "label": "C) Call Upon the Mysterious Voice",
            "description": "That voice in his mind has offered power before. Perhaps it is time to finally accept.",
            "consequences": ["Unknown power boost", "Deeper connection to mysterious entity", "May lose control"],
            "riskLevel": "extreme",
            "emotionalTone": "mysterious"
        }
    ]'::jsonb,
    'pending'
);
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
