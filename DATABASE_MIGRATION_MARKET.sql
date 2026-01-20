-- ============================================================================
-- MARKET / ECONOMIC SIMULATION TABLES
-- ============================================================================
-- This migration creates tables for the Spirit Stone Market economic simulation
-- system that tracks prices, currencies, and economic conditions across the novel.
-- ============================================================================

-- ============================================================================
-- MARKET STATE (Main table)
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Economic condition
  economic_condition TEXT DEFAULT 'normal' CHECK (
    economic_condition IN ('normal', 'boom', 'recession', 'war_economy', 'scarcity', 'abundance')
  ),
  
  -- Chapter tracking
  last_updated_chapter INTEGER DEFAULT 0,
  
  -- Protagonist wealth (stored as JSONB)
  protagonist_wealth JSONB,
  
  -- General notes
  market_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One market state per novel
  UNIQUE(novel_id)
);

-- Index for novel lookup
CREATE INDEX IF NOT EXISTS idx_market_states_novel_id ON market_states(novel_id);

-- ============================================================================
-- CURRENCIES
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_state_id UUID NOT NULL REFERENCES market_states(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Currency info
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('spirit_stone', 'gold', 'contribution_points', 'custom')),
  grade TEXT CHECK (grade IN ('low', 'mid', 'high', 'supreme')),
  symbol TEXT,
  description TEXT,
  
  -- Conversion rate (relative to base currency, spirit_stone = 1)
  conversion_rate NUMERIC(20, 6) NOT NULL DEFAULT 1,
  
  -- Primary currency flag
  is_primary BOOLEAN DEFAULT FALSE,
  
  -- When introduced
  introduced_chapter INTEGER,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique name per market state
  UNIQUE(market_state_id, name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_currencies_market_state ON market_currencies(market_state_id);
CREATE INDEX IF NOT EXISTS idx_market_currencies_novel_id ON market_currencies(novel_id);
CREATE INDEX IF NOT EXISTS idx_market_currencies_is_primary ON market_currencies(is_primary) WHERE is_primary = TRUE;

-- ============================================================================
-- MARKET ITEMS
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_state_id UUID NOT NULL REFERENCES market_states(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Item identification
  name TEXT NOT NULL,
  canonical_name TEXT NOT NULL, -- Normalized for matching
  
  -- Categorization
  category TEXT NOT NULL CHECK (
    category IN ('pill', 'weapon', 'armor', 'material', 'talisman', 'artifact', 'technique', 'service', 'other')
  ),
  rarity TEXT NOT NULL CHECK (
    rarity IN ('common', 'uncommon', 'rare', 'epic', 'legendary')
  ),
  description TEXT,
  
  -- Pricing
  base_price NUMERIC(20, 2) NOT NULL DEFAULT 0,
  current_price NUMERIC(20, 2) NOT NULL DEFAULT 0,
  currency_id UUID REFERENCES market_currencies(id) ON DELETE SET NULL,
  
  -- Price trend and variance
  trend TEXT DEFAULT 'stable' CHECK (trend IN ('stable', 'rising', 'falling', 'volatile')),
  price_variance INTEGER DEFAULT 10 CHECK (price_variance >= 0 AND price_variance <= 100),
  
  -- Price history (JSONB array)
  price_history JSONB DEFAULT '[]'::JSONB,
  
  -- Chapter references
  first_mentioned_chapter INTEGER,
  last_referenced_chapter INTEGER,
  
  -- Additional info
  notes TEXT,
  tags TEXT[], -- Array of tags for categorization
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Unique canonical name per market state
  UNIQUE(market_state_id, canonical_name)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_items_market_state ON market_items(market_state_id);
CREATE INDEX IF NOT EXISTS idx_market_items_novel_id ON market_items(novel_id);
CREATE INDEX IF NOT EXISTS idx_market_items_category ON market_items(category);
CREATE INDEX IF NOT EXISTS idx_market_items_rarity ON market_items(rarity);
CREATE INDEX IF NOT EXISTS idx_market_items_canonical_name ON market_items(canonical_name);
CREATE INDEX IF NOT EXISTS idx_market_items_tags ON market_items USING GIN(tags);

-- ============================================================================
-- PRICE MODIFIERS
-- ============================================================================

CREATE TABLE IF NOT EXISTS market_price_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  market_state_id UUID NOT NULL REFERENCES market_states(id) ON DELETE CASCADE,
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  
  -- Modifier info
  name TEXT NOT NULL,
  description TEXT,
  
  -- Modifier value (percentage: -100 to +500)
  percentage_modifier NUMERIC(6, 2) NOT NULL CHECK (
    percentage_modifier >= -100 AND percentage_modifier <= 500
  ),
  
  -- What it affects (arrays of categories/item IDs)
  affected_categories TEXT[],
  affected_item_ids UUID[],
  
  -- Duration
  introduced_chapter INTEGER NOT NULL,
  expires_chapter INTEGER, -- NULL = permanent
  is_active BOOLEAN DEFAULT TRUE,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_modifiers_market_state ON market_price_modifiers(market_state_id);
CREATE INDEX IF NOT EXISTS idx_price_modifiers_novel_id ON market_price_modifiers(novel_id);
CREATE INDEX IF NOT EXISTS idx_price_modifiers_active ON market_price_modifiers(is_active) WHERE is_active = TRUE;

-- ============================================================================
-- PRICE MENTIONS (for validation tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS price_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  novel_id UUID NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
  chapter_id UUID NOT NULL,
  
  -- What was mentioned
  item_name TEXT NOT NULL,
  mentioned_price NUMERIC(20, 2) NOT NULL,
  
  -- Expected vs actual
  expected_price NUMERIC(20, 2),
  variance_percent NUMERIC(6, 2),
  
  -- Context
  context_snippet TEXT,
  position_in_chapter INTEGER,
  
  -- Validation result
  is_consistent BOOLEAN,
  was_explained BOOLEAN DEFAULT FALSE,
  explanation_note TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_price_mentions_novel_id ON price_mentions(novel_id);
CREATE INDEX IF NOT EXISTS idx_price_mentions_chapter_id ON price_mentions(chapter_id);
CREATE INDEX IF NOT EXISTS idx_price_mentions_inconsistent ON price_mentions(is_consistent) WHERE is_consistent = FALSE;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Auto-update updated_at on market_states
CREATE OR REPLACE FUNCTION update_market_states_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_market_states_updated_at ON market_states;
CREATE TRIGGER trigger_market_states_updated_at
  BEFORE UPDATE ON market_states
  FOR EACH ROW EXECUTE FUNCTION update_market_states_updated_at();

-- Auto-update updated_at on market_currencies
DROP TRIGGER IF EXISTS trigger_market_currencies_updated_at ON market_currencies;
CREATE TRIGGER trigger_market_currencies_updated_at
  BEFORE UPDATE ON market_currencies
  FOR EACH ROW EXECUTE FUNCTION update_market_states_updated_at();

-- Auto-update updated_at on market_items
DROP TRIGGER IF EXISTS trigger_market_items_updated_at ON market_items;
CREATE TRIGGER trigger_market_items_updated_at
  BEFORE UPDATE ON market_items
  FOR EACH ROW EXECUTE FUNCTION update_market_states_updated_at();

-- Auto-update updated_at on price_modifiers
DROP TRIGGER IF EXISTS trigger_price_modifiers_updated_at ON market_price_modifiers;
CREATE TRIGGER trigger_price_modifiers_updated_at
  BEFORE UPDATE ON market_price_modifiers
  FOR EACH ROW EXECUTE FUNCTION update_market_states_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS
ALTER TABLE market_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_price_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_mentions ENABLE ROW LEVEL SECURITY;

-- Example policies (adjust based on your auth system)
-- Users can only access their own novel's market data

-- market_states policies
CREATE POLICY market_states_select_policy ON market_states
  FOR SELECT USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_states_insert_policy ON market_states
  FOR INSERT WITH CHECK (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_states_update_policy ON market_states
  FOR UPDATE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_states_delete_policy ON market_states
  FOR DELETE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

-- market_currencies policies
CREATE POLICY market_currencies_select_policy ON market_currencies
  FOR SELECT USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_currencies_insert_policy ON market_currencies
  FOR INSERT WITH CHECK (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_currencies_update_policy ON market_currencies
  FOR UPDATE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_currencies_delete_policy ON market_currencies
  FOR DELETE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

-- market_items policies
CREATE POLICY market_items_select_policy ON market_items
  FOR SELECT USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_items_insert_policy ON market_items
  FOR INSERT WITH CHECK (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_items_update_policy ON market_items
  FOR UPDATE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY market_items_delete_policy ON market_items
  FOR DELETE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

-- market_price_modifiers policies
CREATE POLICY price_modifiers_select_policy ON market_price_modifiers
  FOR SELECT USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY price_modifiers_insert_policy ON market_price_modifiers
  FOR INSERT WITH CHECK (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY price_modifiers_update_policy ON market_price_modifiers
  FOR UPDATE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY price_modifiers_delete_policy ON market_price_modifiers
  FOR DELETE USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

-- price_mentions policies
CREATE POLICY price_mentions_select_policy ON price_mentions
  FOR SELECT USING (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

CREATE POLICY price_mentions_insert_policy ON price_mentions
  FOR INSERT WITH CHECK (
    novel_id IN (SELECT id FROM novels WHERE user_id = auth.uid())
  );

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get effective price with modifiers
CREATE OR REPLACE FUNCTION get_effective_price(
  p_item_id UUID,
  p_market_state_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_base_price NUMERIC;
  v_current_price NUMERIC;
  v_category TEXT;
  v_economic_condition TEXT;
  v_modifier_total NUMERIC := 0;
  v_condition_modifier NUMERIC := 0;
  v_result NUMERIC;
BEGIN
  -- Get item info
  SELECT current_price, category 
  INTO v_current_price, v_category
  FROM market_items 
  WHERE id = p_item_id;
  
  IF v_current_price IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Get economic condition
  SELECT economic_condition INTO v_economic_condition
  FROM market_states WHERE id = p_market_state_id;
  
  -- Apply economic condition modifier
  v_condition_modifier := CASE v_economic_condition
    WHEN 'normal' THEN 0
    WHEN 'boom' THEN 15
    WHEN 'recession' THEN -15
    WHEN 'war_economy' THEN CASE WHEN v_category IN ('weapon', 'armor') THEN 30 ELSE -10 END
    WHEN 'scarcity' THEN 50
    WHEN 'abundance' THEN -30
    ELSE 0
  END;
  
  -- Get active modifiers that apply to this item
  SELECT COALESCE(SUM(percentage_modifier), 0)
  INTO v_modifier_total
  FROM market_price_modifiers
  WHERE market_state_id = p_market_state_id
    AND is_active = TRUE
    AND (
      -- Applies to all (no specific targets)
      (affected_categories IS NULL OR array_length(affected_categories, 1) IS NULL)
      AND (affected_item_ids IS NULL OR array_length(affected_item_ids, 1) IS NULL)
      -- Or applies to this category
      OR v_category = ANY(affected_categories)
      -- Or applies to this specific item
      OR p_item_id = ANY(affected_item_ids)
    );
  
  -- Calculate final price
  v_result := v_current_price * (1 + (v_condition_modifier + v_modifier_total) / 100.0);
  
  RETURN ROUND(v_result, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to validate a price mention
CREATE OR REPLACE FUNCTION validate_price_mention(
  p_novel_id UUID,
  p_item_name TEXT,
  p_mentioned_price NUMERIC,
  p_chapter_number INTEGER
)
RETURNS TABLE (
  is_valid BOOLEAN,
  expected_price NUMERIC,
  variance_percent NUMERIC,
  message TEXT
) AS $$
DECLARE
  v_market_state_id UUID;
  v_item_id UUID;
  v_expected NUMERIC;
  v_variance_allowed INTEGER;
  v_actual_variance NUMERIC;
BEGIN
  -- Get market state
  SELECT id INTO v_market_state_id
  FROM market_states WHERE novel_id = p_novel_id;
  
  IF v_market_state_id IS NULL THEN
    RETURN QUERY SELECT TRUE, 0::NUMERIC, 0::NUMERIC, 'No market state configured'::TEXT;
    RETURN;
  END IF;
  
  -- Find item by name
  SELECT id, price_variance INTO v_item_id, v_variance_allowed
  FROM market_items 
  WHERE market_state_id = v_market_state_id 
    AND (canonical_name = LOWER(REGEXP_REPLACE(p_item_name, '[^a-zA-Z0-9\s]', '', 'g'))
         OR name ILIKE '%' || p_item_name || '%');
  
  IF v_item_id IS NULL THEN
    RETURN QUERY SELECT TRUE, 0::NUMERIC, 0::NUMERIC, 'Item not found in market database'::TEXT;
    RETURN;
  END IF;
  
  -- Get expected price
  v_expected := get_effective_price(v_item_id, v_market_state_id);
  
  -- Calculate variance
  IF v_expected > 0 THEN
    v_actual_variance := ABS((p_mentioned_price - v_expected) / v_expected * 100);
  ELSE
    v_actual_variance := 0;
  END IF;
  
  -- Return validation result
  RETURN QUERY SELECT 
    v_actual_variance <= v_variance_allowed,
    v_expected,
    ROUND(v_actual_variance, 2),
    CASE 
      WHEN v_actual_variance <= v_variance_allowed 
      THEN 'Price is within acceptable range'
      ELSE 'Price deviates ' || ROUND(v_actual_variance, 1) || '% from expected ' || v_expected
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE market_states IS 'Main market state for each novel - one per novel';
COMMENT ON TABLE market_currencies IS 'Currency definitions (Spirit Stones, Gold, etc.)';
COMMENT ON TABLE market_items IS 'Items with tracked prices for consistency';
COMMENT ON TABLE market_price_modifiers IS 'Temporary or permanent price modifiers';
COMMENT ON TABLE price_mentions IS 'Tracked price mentions in chapters for validation';

COMMENT ON COLUMN market_states.economic_condition IS 'Global economic condition affecting all prices';
COMMENT ON COLUMN market_states.protagonist_wealth IS 'JSONB storing known protagonist currency amounts';
COMMENT ON COLUMN market_currencies.conversion_rate IS 'Value relative to base currency (spirit stone = 1)';
COMMENT ON COLUMN market_items.canonical_name IS 'Normalized lowercase name for fuzzy matching';
COMMENT ON COLUMN market_items.price_variance IS 'Allowed variance percentage before flagging inconsistency';
COMMENT ON COLUMN market_items.price_history IS 'JSONB array of price changes with chapter/reason';
COMMENT ON COLUMN market_price_modifiers.percentage_modifier IS 'Price adjustment (-100% to +500%)';

-- ============================================================================
-- SAMPLE DATA (Optional - uncomment to add default items)
-- ============================================================================

/*
-- Insert sample currencies for a novel
INSERT INTO market_currencies (market_state_id, novel_id, name, type, grade, symbol, conversion_rate, is_primary)
VALUES
  ('your-market-state-id', 'your-novel-id', 'Spirit Stone', 'spirit_stone', 'low', 'SS', 1, TRUE),
  ('your-market-state-id', 'your-novel-id', 'Mid-Grade Spirit Stone', 'spirit_stone', 'mid', 'MSS', 100, FALSE),
  ('your-market-state-id', 'your-novel-id', 'High-Grade Spirit Stone', 'spirit_stone', 'high', 'HSS', 10000, FALSE),
  ('your-market-state-id', 'your-novel-id', 'Gold Tael', 'gold', NULL, 'GT', 0.01, FALSE);

-- Insert sample items
INSERT INTO market_items (market_state_id, novel_id, name, canonical_name, category, rarity, base_price, current_price, currency_id)
VALUES
  ('your-market-state-id', 'your-novel-id', 'Qi Gathering Pill', 'qi gathering pill', 'pill', 'common', 50, 50, 'your-currency-id'),
  ('your-market-state-id', 'your-novel-id', 'Foundation Establishment Pill', 'foundation establishment pill', 'pill', 'uncommon', 1000, 1000, 'your-currency-id'),
  ('your-market-state-id', 'your-novel-id', 'Low-Grade Spirit Sword', 'low grade spirit sword', 'weapon', 'common', 500, 500, 'your-currency-id');
*/
