-- WORLD-CLASS NOVEL WRITING ENHANCEMENTS MIGRATION
-- This migration adds tables for advanced literary analysis, structure tracking,
-- thematic depth, character psychology, engagement metrics, and more.
-- 
-- Run this migration after your main database setup is complete.
-- Ensure uuid-ossp extension is enabled.

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- 1. STORY STRUCTURE ANALYSIS
-- ============================================================================

-- Story structure beats (Three-Act, Save the Cat, etc.)
CREATE TABLE IF NOT EXISTS story_structure_beats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  beat_type TEXT NOT NULL, -- 'inciting_incident', 'plot_point_1', 'midpoint', etc.
  structure_type TEXT NOT NULL, -- 'three_act', 'save_cat', 'hero_journey'
  chapter_number INTEGER,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  description TEXT,
  strength_score INTEGER CHECK (strength_score >= 0 AND strength_score <= 100),
  position_percentage DECIMAL(5,2), -- Position in story (0-100)
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Hero's journey stages
CREATE TABLE IF NOT EXISTS hero_journey_stages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  stage_number INTEGER NOT NULL CHECK (stage_number >= 1 AND stage_number <= 12),
  stage_name TEXT NOT NULL,
  chapter_number INTEGER,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  character_id UUID REFERENCES characters(id) ON DELETE SET NULL,
  is_complete BOOLEAN DEFAULT FALSE,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 2. THEMATIC DEPTH SYSTEM
-- ============================================================================

-- Theme evolution tracking
CREATE TABLE IF NOT EXISTS theme_evolution (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  theme_name TEXT NOT NULL,
  theme_type TEXT NOT NULL CHECK (theme_type IN ('primary', 'secondary', 'tertiary')),
  first_appeared_chapter INTEGER,
  setup_chapter INTEGER,
  resolution_chapter INTEGER,
  arcs_involved TEXT[], -- Array of arc IDs
  frequency_per_chapter DECIMAL(5,2),
  consistency_score INTEGER CHECK (consistency_score >= 0 AND consistency_score <= 100),
  depth_level TEXT CHECK (depth_level IN ('surface', 'mid', 'deep')),
  character_connections TEXT[], -- Array of character IDs
  philosophical_questions TEXT[],
  evolution_notes JSONB, -- Array of {chapter, note} objects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 3. CHARACTER PSYCHOLOGY
-- ============================================================================

-- Character psychology tracking
CREATE TABLE IF NOT EXISTS character_psychology (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_number INTEGER,
  psychological_state TEXT CHECK (psychological_state IN ('stable', 'conflicted', 'growing', 'breaking', 'transformed')),
  internal_conflict TEXT, -- Description of want vs need
  character_flaw TEXT,
  flaw_status TEXT CHECK (flaw_status IN ('active', 'acknowledged', 'working_on', 'resolved')),
  growth_stage TEXT CHECK (growth_stage IN ('beginning', 'development', 'crisis', 'resolution')),
  growth_score INTEGER CHECK (growth_score >= 0 AND growth_score <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Character motivations
CREATE TABLE IF NOT EXISTS character_motivations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  motivation_type TEXT NOT NULL CHECK (motivation_type IN ('primary', 'secondary', 'tertiary')),
  motivation_description TEXT NOT NULL,
  is_conflicted BOOLEAN DEFAULT FALSE,
  conflict_with_motivation_id UUID REFERENCES character_motivations(id) ON DELETE SET NULL,
  first_appeared_chapter INTEGER,
  resolved_chapter INTEGER,
  evolution_notes JSONB, -- Array of {chapter, note} objects
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Voice analysis
CREATE TABLE IF NOT EXISTS voice_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_number INTEGER,
  distinctiveness_score INTEGER CHECK (distinctiveness_score >= 0 AND distinctiveness_score <= 100),
  average_sentence_length DECIMAL(5,2),
  vocabulary_sophistication INTEGER,
  speech_patterns JSONB, -- Unique speech markers
  voice_consistency_score INTEGER CHECK (voice_consistency_score >= 0 AND voice_consistency_score <= 100),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 4. READER ENGAGEMENT METRICS
-- ============================================================================

-- Engagement metrics per chapter
CREATE TABLE IF NOT EXISTS engagement_metrics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  chapter_number INTEGER NOT NULL,
  overall_engagement_score INTEGER CHECK (overall_engagement_score >= 0 AND overall_engagement_score <= 100),
  hook_strength INTEGER CHECK (hook_strength >= 0 AND hook_strength <= 100),
  cliffhanger_effectiveness INTEGER CHECK (cliffhanger_effectiveness >= 0 AND cliffhanger_effectiveness <= 100),
  emotional_resonance INTEGER CHECK (emotional_resonance >= 0 AND emotional_resonance <= 100),
  tension_level INTEGER CHECK (tension_level >= 0 AND tension_level <= 100),
  narrative_momentum INTEGER CHECK (narrative_momentum >= 0 AND narrative_momentum <= 100),
  interest_score INTEGER CHECK (interest_score >= 0 AND interest_score <= 100),
  fatigue_detected BOOLEAN DEFAULT FALSE,
  peak_moment BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(novel_id, chapter_id)
);

-- Emotional moments tracking
CREATE TABLE IF NOT EXISTS emotional_moments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE CASCADE,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  emotion_type TEXT NOT NULL, -- 'joy', 'sadness', 'anger', 'fear', 'surprise', etc.
  intensity INTEGER CHECK (intensity >= 0 AND intensity <= 100),
  is_setup BOOLEAN DEFAULT FALSE,
  payoff_for_moment_id UUID REFERENCES emotional_moments(id) ON DELETE SET NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 5. COMPARATIVE ANALYSIS
-- ============================================================================

-- Comparative analysis against masterworks
CREATE TABLE IF NOT EXISTS comparative_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  comparison_type TEXT NOT NULL CHECK (comparison_type IN ('structure', 'pacing', 'themes', 'overall')),
  benchmark_novel_name TEXT,
  similarity_score INTEGER CHECK (similarity_score >= 0 AND similarity_score <= 100),
  strength_areas TEXT[],
  improvement_areas TEXT[],
  detailed_comparison JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Genre conventions analysis
CREATE TABLE IF NOT EXISTS genre_conventions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  convention_name TEXT NOT NULL,
  convention_category TEXT CHECK (convention_category IN ('structure', 'character', 'world', 'power')),
  adherence_score INTEGER CHECK (adherence_score >= 0 AND adherence_score <= 100),
  is_innovative BOOLEAN DEFAULT FALSE,
  innovation_description TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Market readiness assessment
CREATE TABLE IF NOT EXISTS market_readiness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  commercial_appeal_score INTEGER CHECK (commercial_appeal_score >= 0 AND commercial_appeal_score <= 100),
  literary_merit_score INTEGER CHECK (literary_merit_score >= 0 AND literary_merit_score <= 100),
  originality_score INTEGER CHECK (originality_score >= 0 AND originality_score <= 100),
  readability_score INTEGER CHECK (readability_score >= 0 AND readability_score <= 100),
  accessibility_score INTEGER CHECK (accessibility_score >= 0 AND accessibility_score <= 100),
  overall_readiness INTEGER CHECK (overall_readiness >= 0 AND overall_readiness <= 100),
  strengths TEXT[],
  weaknesses TEXT[],
  recommendations TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(novel_id)
);

-- ============================================================================
-- 6. MULTI-DRAFT REVISION WORKFLOW
-- ============================================================================

-- Draft versions
CREATE TABLE IF NOT EXISTS draft_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  draft_number INTEGER NOT NULL,
  draft_name TEXT,
  created_from_draft_id UUID REFERENCES draft_versions(id) ON DELETE SET NULL,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  structure_score INTEGER CHECK (structure_score >= 0 AND structure_score <= 100),
  thematic_score INTEGER CHECK (thematic_score >= 0 AND thematic_score <= 100),
  character_score INTEGER CHECK (character_score >= 0 AND character_score <= 100),
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  revision_goals TEXT[],
  revision_checklist JSONB, -- Array of {goal, status, notes}
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(novel_id, draft_number)
);

-- Draft changes tracking
CREATE TABLE IF NOT EXISTS draft_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  draft_version_id UUID REFERENCES draft_versions(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL CHECK (change_type IN ('structure', 'theme', 'character', 'prose', 'other')),
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  change_description TEXT NOT NULL,
  impact_analysis TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 7. LITERARY DEVICE OPTIMIZATION
-- ============================================================================

-- Literary devices tracking
CREATE TABLE IF NOT EXISTS literary_devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  device_type TEXT NOT NULL, -- 'foreshadowing', 'symbolism', 'metaphor', 'irony', etc.
  device_content TEXT,
  frequency_count INTEGER DEFAULT 1,
  effectiveness_score INTEGER CHECK (effectiveness_score >= 0 AND effectiveness_score <= 100),
  is_overused BOOLEAN DEFAULT FALSE,
  is_underused BOOLEAN DEFAULT FALSE,
  related_device_ids UUID[], -- Devices that work together
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Prose quality metrics
CREATE TABLE IF NOT EXISTS prose_quality (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  sentence_variety_score INTEGER CHECK (sentence_variety_score >= 0 AND sentence_variety_score <= 100),
  average_sentence_length DECIMAL(5,2),
  vocabulary_sophistication INTEGER,
  flesch_kincaid_score DECIMAL(5,2),
  show_tell_balance DECIMAL(5,2), -- Percentage of "show" vs "tell"
  rhythm_score INTEGER CHECK (rhythm_score >= 0 AND rhythm_score <= 100),
  cadence_pattern TEXT,
  cliches_detected TEXT[],
  tropes_detected TEXT[],
  unique_elements TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 8. NARRATIVE TENSION MAPPING
-- ============================================================================

-- Tension mapping
CREATE TABLE IF NOT EXISTS tension_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  tension_level INTEGER CHECK (tension_level >= 0 AND tension_level <= 100),
  tension_type TEXT CHECK (tension_type IN ('emotional', 'physical', 'psychological', 'social')),
  is_peak BOOLEAN DEFAULT FALSE,
  is_valley BOOLEAN DEFAULT FALSE,
  escalation_pattern TEXT CHECK (escalation_pattern IN ('rising', 'falling', 'stable', 'oscillating')),
  release_after_tension BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Conflict hierarchy
CREATE TABLE IF NOT EXISTS conflict_hierarchy (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  conflict_level TEXT NOT NULL CHECK (conflict_level IN ('story', 'arc', 'chapter', 'scene')),
  arc_id UUID REFERENCES arcs(id) ON DELETE SET NULL,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES scenes(id) ON DELETE SET NULL,
  conflict_type TEXT CHECK (conflict_type IN ('man_vs_man', 'man_vs_self', 'man_vs_nature', 'man_vs_society')),
  conflict_description TEXT NOT NULL,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolution_chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  related_conflict_ids UUID[], -- Related conflicts
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- 9. VOICE AND ORIGINALITY ENHANCEMENT
-- ============================================================================

-- Voice analysis (novel-level, not just character-level)
CREATE TABLE IF NOT EXISTS novel_voice_analysis (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  distinctiveness_score INTEGER CHECK (distinctiveness_score >= 0 AND distinctiveness_score <= 100),
  consistency_score INTEGER CHECK (consistency_score >= 0 AND consistency_score <= 100),
  style_fingerprint JSONB, -- Unique patterns identified
  voice_evolution_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Originality scores
CREATE TABLE IF NOT EXISTS originality_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  plot_originality INTEGER CHECK (plot_originality >= 0 AND plot_originality <= 100),
  character_originality INTEGER CHECK (character_originality >= 0 AND character_originality <= 100),
  world_building_originality INTEGER CHECK (world_building_originality >= 0 AND world_building_originality <= 100),
  concept_innovation INTEGER CHECK (concept_innovation >= 0 AND concept_innovation <= 100),
  overall_originality INTEGER CHECK (overall_originality >= 0 AND overall_originality <= 100),
  unique_elements TEXT[],
  common_tropes_detected TEXT[],
  fresh_angles TEXT[],
  market_gaps TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(novel_id)
);

-- ============================================================================
-- 10. ADVANCED PROMPT ENGINEERING
-- ============================================================================

-- Prompt effectiveness tracking
CREATE TABLE IF NOT EXISTS prompt_effectiveness (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
  prompt_version TEXT NOT NULL, -- Version identifier
  prompt_template_id TEXT, -- Which template was used
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100),
  structure_score INTEGER CHECK (structure_score >= 0 AND structure_score <= 100),
  engagement_score INTEGER CHECK (engagement_score >= 0 AND engagement_score <= 100),
  user_feedback INTEGER CHECK (user_feedback >= 1 AND user_feedback <= 5), -- 1-5 rating
  effectiveness_metrics JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Story structure indexes
CREATE INDEX IF NOT EXISTS idx_story_beats_novel ON story_structure_beats(novel_id);
CREATE INDEX IF NOT EXISTS idx_story_beats_chapter ON story_structure_beats(chapter_id);
CREATE INDEX IF NOT EXISTS idx_hero_journey_novel ON hero_journey_stages(novel_id);
CREATE INDEX IF NOT EXISTS idx_hero_journey_character ON hero_journey_stages(character_id);

-- Theme evolution indexes
CREATE INDEX IF NOT EXISTS idx_theme_evolution_novel ON theme_evolution(novel_id);
CREATE INDEX IF NOT EXISTS idx_theme_evolution_name ON theme_evolution(theme_name);

-- Character psychology indexes
CREATE INDEX IF NOT EXISTS idx_char_psychology_character ON character_psychology(character_id);
CREATE INDEX IF NOT EXISTS idx_char_psychology_novel ON character_psychology(novel_id);
CREATE INDEX IF NOT EXISTS idx_char_motivations_character ON character_motivations(character_id);
CREATE INDEX IF NOT EXISTS idx_voice_analysis_character ON voice_analysis(character_id);
CREATE INDEX IF NOT EXISTS idx_voice_analysis_novel ON voice_analysis(novel_id);

-- Engagement indexes
CREATE INDEX IF NOT EXISTS idx_engagement_novel ON engagement_metrics(novel_id);
CREATE INDEX IF NOT EXISTS idx_engagement_chapter ON engagement_metrics(chapter_number);
CREATE INDEX IF NOT EXISTS idx_emotional_moments_novel ON emotional_moments(novel_id);
CREATE INDEX IF NOT EXISTS idx_emotional_moments_chapter ON emotional_moments(chapter_id);

-- Comparative analysis indexes
CREATE INDEX IF NOT EXISTS idx_comparative_novel ON comparative_analysis(novel_id);
CREATE INDEX IF NOT EXISTS idx_genre_conventions_novel ON genre_conventions(novel_id);

-- Draft indexes
CREATE INDEX IF NOT EXISTS idx_draft_versions_novel ON draft_versions(novel_id);
CREATE INDEX IF NOT EXISTS idx_draft_changes_draft ON draft_changes(draft_version_id);

-- Literary device indexes
CREATE INDEX IF NOT EXISTS idx_literary_devices_novel ON literary_devices(novel_id);
CREATE INDEX IF NOT EXISTS idx_prose_quality_novel ON prose_quality(novel_id);

-- Tension mapping indexes
CREATE INDEX IF NOT EXISTS idx_tension_mapping_novel ON tension_mapping(novel_id);
CREATE INDEX IF NOT EXISTS idx_conflict_hierarchy_novel ON conflict_hierarchy(novel_id);

-- Voice and originality indexes
CREATE INDEX IF NOT EXISTS idx_novel_voice_analysis_novel ON novel_voice_analysis(novel_id);

-- Prompt effectiveness indexes
CREATE INDEX IF NOT EXISTS idx_prompt_effectiveness_novel ON prompt_effectiveness(novel_id);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE story_structure_beats ENABLE ROW LEVEL SECURITY;
ALTER TABLE hero_journey_stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE theme_evolution ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_psychology ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_motivations ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE engagement_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotional_moments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comparative_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE genre_conventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_readiness ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE literary_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE prose_quality ENABLE ROW LEVEL SECURITY;
ALTER TABLE tension_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE conflict_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE novel_voice_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE originality_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_effectiveness ENABLE ROW LEVEL SECURITY;

-- Create RLS policies: Users can only access their own data
DO $$
BEGIN
  -- Story structure beats
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_structure_beats' AND policyname = 'Users can view own story beats') THEN
    CREATE POLICY "Users can view own story beats" ON story_structure_beats FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_structure_beats' AND policyname = 'Users can insert own story beats') THEN
    CREATE POLICY "Users can insert own story beats" ON story_structure_beats FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_structure_beats' AND policyname = 'Users can update own story beats') THEN
    CREATE POLICY "Users can update own story beats" ON story_structure_beats FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_structure_beats' AND policyname = 'Users can delete own story beats') THEN
    CREATE POLICY "Users can delete own story beats" ON story_structure_beats FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Hero journey stages
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hero_journey_stages' AND policyname = 'Users can view own hero journey') THEN
    CREATE POLICY "Users can view own hero journey" ON hero_journey_stages FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hero_journey_stages' AND policyname = 'Users can insert own hero journey') THEN
    CREATE POLICY "Users can insert own hero journey" ON hero_journey_stages FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hero_journey_stages' AND policyname = 'Users can update own hero journey') THEN
    CREATE POLICY "Users can update own hero journey" ON hero_journey_stages FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'hero_journey_stages' AND policyname = 'Users can delete own hero journey') THEN
    CREATE POLICY "Users can delete own hero journey" ON hero_journey_stages FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Theme evolution
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'theme_evolution' AND policyname = 'Users can view own themes') THEN
    CREATE POLICY "Users can view own themes" ON theme_evolution FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'theme_evolution' AND policyname = 'Users can insert own themes') THEN
    CREATE POLICY "Users can insert own themes" ON theme_evolution FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'theme_evolution' AND policyname = 'Users can update own themes') THEN
    CREATE POLICY "Users can update own themes" ON theme_evolution FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'theme_evolution' AND policyname = 'Users can delete own themes') THEN
    CREATE POLICY "Users can delete own themes" ON theme_evolution FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Character psychology
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_psychology' AND policyname = 'Users can view own character psychology') THEN
    CREATE POLICY "Users can view own character psychology" ON character_psychology FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_psychology' AND policyname = 'Users can insert own character psychology') THEN
    CREATE POLICY "Users can insert own character psychology" ON character_psychology FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_psychology' AND policyname = 'Users can update own character psychology') THEN
    CREATE POLICY "Users can update own character psychology" ON character_psychology FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_psychology' AND policyname = 'Users can delete own character psychology') THEN
    CREATE POLICY "Users can delete own character psychology" ON character_psychology FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Character motivations
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_motivations' AND policyname = 'Users can view own motivations') THEN
    CREATE POLICY "Users can view own motivations" ON character_motivations FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_motivations' AND policyname = 'Users can insert own motivations') THEN
    CREATE POLICY "Users can insert own motivations" ON character_motivations FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_motivations' AND policyname = 'Users can update own motivations') THEN
    CREATE POLICY "Users can update own motivations" ON character_motivations FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'character_motivations' AND policyname = 'Users can delete own motivations') THEN
    CREATE POLICY "Users can delete own motivations" ON character_motivations FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Voice analysis
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_analysis' AND policyname = 'Users can view own voice analysis') THEN
    CREATE POLICY "Users can view own voice analysis" ON voice_analysis FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_analysis' AND policyname = 'Users can insert own voice analysis') THEN
    CREATE POLICY "Users can insert own voice analysis" ON voice_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_analysis' AND policyname = 'Users can update own voice analysis') THEN
    CREATE POLICY "Users can update own voice analysis" ON voice_analysis FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'voice_analysis' AND policyname = 'Users can delete own voice analysis') THEN
    CREATE POLICY "Users can delete own voice analysis" ON voice_analysis FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Engagement metrics
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'engagement_metrics' AND policyname = 'Users can view own engagement') THEN
    CREATE POLICY "Users can view own engagement" ON engagement_metrics FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'engagement_metrics' AND policyname = 'Users can insert own engagement') THEN
    CREATE POLICY "Users can insert own engagement" ON engagement_metrics FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'engagement_metrics' AND policyname = 'Users can update own engagement') THEN
    CREATE POLICY "Users can update own engagement" ON engagement_metrics FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'engagement_metrics' AND policyname = 'Users can delete own engagement') THEN
    CREATE POLICY "Users can delete own engagement" ON engagement_metrics FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Emotional moments
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emotional_moments' AND policyname = 'Users can view own emotional moments') THEN
    CREATE POLICY "Users can view own emotional moments" ON emotional_moments FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emotional_moments' AND policyname = 'Users can insert own emotional moments') THEN
    CREATE POLICY "Users can insert own emotional moments" ON emotional_moments FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emotional_moments' AND policyname = 'Users can update own emotional moments') THEN
    CREATE POLICY "Users can update own emotional moments" ON emotional_moments FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'emotional_moments' AND policyname = 'Users can delete own emotional moments') THEN
    CREATE POLICY "Users can delete own emotional moments" ON emotional_moments FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Comparative analysis
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comparative_analysis' AND policyname = 'Users can view own comparisons') THEN
    CREATE POLICY "Users can view own comparisons" ON comparative_analysis FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comparative_analysis' AND policyname = 'Users can insert own comparisons') THEN
    CREATE POLICY "Users can insert own comparisons" ON comparative_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comparative_analysis' AND policyname = 'Users can update own comparisons') THEN
    CREATE POLICY "Users can update own comparisons" ON comparative_analysis FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'comparative_analysis' AND policyname = 'Users can delete own comparisons') THEN
    CREATE POLICY "Users can delete own comparisons" ON comparative_analysis FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Genre conventions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'genre_conventions' AND policyname = 'Users can view own conventions') THEN
    CREATE POLICY "Users can view own conventions" ON genre_conventions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'genre_conventions' AND policyname = 'Users can insert own conventions') THEN
    CREATE POLICY "Users can insert own conventions" ON genre_conventions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'genre_conventions' AND policyname = 'Users can update own conventions') THEN
    CREATE POLICY "Users can update own conventions" ON genre_conventions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'genre_conventions' AND policyname = 'Users can delete own conventions') THEN
    CREATE POLICY "Users can delete own conventions" ON genre_conventions FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Market readiness
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_readiness' AND policyname = 'Users can view own market readiness') THEN
    CREATE POLICY "Users can view own market readiness" ON market_readiness FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_readiness' AND policyname = 'Users can insert own market readiness') THEN
    CREATE POLICY "Users can insert own market readiness" ON market_readiness FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_readiness' AND policyname = 'Users can update own market readiness') THEN
    CREATE POLICY "Users can update own market readiness" ON market_readiness FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'market_readiness' AND policyname = 'Users can delete own market readiness') THEN
    CREATE POLICY "Users can delete own market readiness" ON market_readiness FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Draft versions
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_versions' AND policyname = 'Users can view own drafts') THEN
    CREATE POLICY "Users can view own drafts" ON draft_versions FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_versions' AND policyname = 'Users can insert own drafts') THEN
    CREATE POLICY "Users can insert own drafts" ON draft_versions FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_versions' AND policyname = 'Users can update own drafts') THEN
    CREATE POLICY "Users can update own drafts" ON draft_versions FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_versions' AND policyname = 'Users can delete own drafts') THEN
    CREATE POLICY "Users can delete own drafts" ON draft_versions FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Draft changes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_changes' AND policyname = 'Users can view own draft changes') THEN
    CREATE POLICY "Users can view own draft changes" ON draft_changes FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_changes' AND policyname = 'Users can insert own draft changes') THEN
    CREATE POLICY "Users can insert own draft changes" ON draft_changes FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_changes' AND policyname = 'Users can update own draft changes') THEN
    CREATE POLICY "Users can update own draft changes" ON draft_changes FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'draft_changes' AND policyname = 'Users can delete own draft changes') THEN
    CREATE POLICY "Users can delete own draft changes" ON draft_changes FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Literary devices
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'literary_devices' AND policyname = 'Users can view own devices') THEN
    CREATE POLICY "Users can view own devices" ON literary_devices FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'literary_devices' AND policyname = 'Users can insert own devices') THEN
    CREATE POLICY "Users can insert own devices" ON literary_devices FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'literary_devices' AND policyname = 'Users can update own devices') THEN
    CREATE POLICY "Users can update own devices" ON literary_devices FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'literary_devices' AND policyname = 'Users can delete own devices') THEN
    CREATE POLICY "Users can delete own devices" ON literary_devices FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Prose quality
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prose_quality' AND policyname = 'Users can view own prose quality') THEN
    CREATE POLICY "Users can view own prose quality" ON prose_quality FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prose_quality' AND policyname = 'Users can insert own prose quality') THEN
    CREATE POLICY "Users can insert own prose quality" ON prose_quality FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prose_quality' AND policyname = 'Users can update own prose quality') THEN
    CREATE POLICY "Users can update own prose quality" ON prose_quality FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prose_quality' AND policyname = 'Users can delete own prose quality') THEN
    CREATE POLICY "Users can delete own prose quality" ON prose_quality FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Tension mapping
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tension_mapping' AND policyname = 'Users can view own tension') THEN
    CREATE POLICY "Users can view own tension" ON tension_mapping FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tension_mapping' AND policyname = 'Users can insert own tension') THEN
    CREATE POLICY "Users can insert own tension" ON tension_mapping FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tension_mapping' AND policyname = 'Users can update own tension') THEN
    CREATE POLICY "Users can update own tension" ON tension_mapping FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tension_mapping' AND policyname = 'Users can delete own tension') THEN
    CREATE POLICY "Users can delete own tension" ON tension_mapping FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Conflict hierarchy
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conflict_hierarchy' AND policyname = 'Users can view own conflicts') THEN
    CREATE POLICY "Users can view own conflicts" ON conflict_hierarchy FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conflict_hierarchy' AND policyname = 'Users can insert own conflicts') THEN
    CREATE POLICY "Users can insert own conflicts" ON conflict_hierarchy FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conflict_hierarchy' AND policyname = 'Users can update own conflicts') THEN
    CREATE POLICY "Users can update own conflicts" ON conflict_hierarchy FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'conflict_hierarchy' AND policyname = 'Users can delete own conflicts') THEN
    CREATE POLICY "Users can delete own conflicts" ON conflict_hierarchy FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Novel voice analysis
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'novel_voice_analysis' AND policyname = 'Users can view own novel voice') THEN
    CREATE POLICY "Users can view own novel voice" ON novel_voice_analysis FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'novel_voice_analysis' AND policyname = 'Users can insert own novel voice') THEN
    CREATE POLICY "Users can insert own novel voice" ON novel_voice_analysis FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'novel_voice_analysis' AND policyname = 'Users can update own novel voice') THEN
    CREATE POLICY "Users can update own novel voice" ON novel_voice_analysis FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'novel_voice_analysis' AND policyname = 'Users can delete own novel voice') THEN
    CREATE POLICY "Users can delete own novel voice" ON novel_voice_analysis FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Originality scores
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'originality_scores' AND policyname = 'Users can view own originality') THEN
    CREATE POLICY "Users can view own originality" ON originality_scores FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'originality_scores' AND policyname = 'Users can insert own originality') THEN
    CREATE POLICY "Users can insert own originality" ON originality_scores FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'originality_scores' AND policyname = 'Users can update own originality') THEN
    CREATE POLICY "Users can update own originality" ON originality_scores FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'originality_scores' AND policyname = 'Users can delete own originality') THEN
    CREATE POLICY "Users can delete own originality" ON originality_scores FOR DELETE USING (auth.uid() = user_id);
  END IF;

  -- Prompt effectiveness
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prompt_effectiveness' AND policyname = 'Users can view own prompt effectiveness') THEN
    CREATE POLICY "Users can view own prompt effectiveness" ON prompt_effectiveness FOR SELECT USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prompt_effectiveness' AND policyname = 'Users can insert own prompt effectiveness') THEN
    CREATE POLICY "Users can insert own prompt effectiveness" ON prompt_effectiveness FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prompt_effectiveness' AND policyname = 'Users can update own prompt effectiveness') THEN
    CREATE POLICY "Users can update own prompt effectiveness" ON prompt_effectiveness FOR UPDATE USING (auth.uid() = user_id);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'prompt_effectiveness' AND policyname = 'Users can delete own prompt effectiveness') THEN
    CREATE POLICY "Users can delete own prompt effectiveness" ON prompt_effectiveness FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

-- ============================================================================
-- UPDATE TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add update triggers to all tables with updated_at
CREATE TRIGGER update_story_structure_beats_updated_at BEFORE UPDATE ON story_structure_beats FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_hero_journey_stages_updated_at BEFORE UPDATE ON hero_journey_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_theme_evolution_updated_at BEFORE UPDATE ON theme_evolution FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_character_psychology_updated_at BEFORE UPDATE ON character_psychology FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_character_motivations_updated_at BEFORE UPDATE ON character_motivations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_voice_analysis_updated_at BEFORE UPDATE ON voice_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_engagement_metrics_updated_at BEFORE UPDATE ON engagement_metrics FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_comparative_analysis_updated_at BEFORE UPDATE ON comparative_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_genre_conventions_updated_at BEFORE UPDATE ON genre_conventions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_market_readiness_updated_at BEFORE UPDATE ON market_readiness FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_draft_versions_updated_at BEFORE UPDATE ON draft_versions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_literary_devices_updated_at BEFORE UPDATE ON literary_devices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_prose_quality_updated_at BEFORE UPDATE ON prose_quality FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_tension_mapping_updated_at BEFORE UPDATE ON tension_mapping FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conflict_hierarchy_updated_at BEFORE UPDATE ON conflict_hierarchy FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_novel_voice_analysis_updated_at BEFORE UPDATE ON novel_voice_analysis FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_originality_scores_updated_at BEFORE UPDATE ON originality_scores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Migration complete!
-- Run this SQL file in your Supabase SQL Editor to create all tables for world-class novel writing enhancements.
