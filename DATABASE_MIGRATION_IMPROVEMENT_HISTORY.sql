-- IMPROVEMENT HISTORY MIGRATION
-- Run this script in your Supabase SQL Editor to add improvement history tracking
-- This migration adds the improvement_history table for tracking all improvement operations

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- IMPROVEMENT HISTORY - Track all improvement operations
CREATE TABLE IF NOT EXISTS improvement_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  novel_id UUID REFERENCES novels(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN (
    'excellence',
    'structure',
    'engagement',
    'character',
    'theme',
    'tension',
    'prose',
    'originality',
    'voice',
    'literary_devices',
    'market_readiness'
  )),
  request JSONB NOT NULL,
  strategy JSONB NOT NULL,
  result JSONB NOT NULL,
  executed_at TIMESTAMPTZ DEFAULT NOW(),
  rolled_back BOOLEAN DEFAULT FALSE,
  rollback_at TIMESTAMPTZ,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_improvement_history_novel ON improvement_history(novel_id);
CREATE INDEX IF NOT EXISTS idx_improvement_history_category ON improvement_history(category);
CREATE INDEX IF NOT EXISTS idx_improvement_history_executed_at ON improvement_history(executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_improvement_history_user ON improvement_history(user_id);

-- Enable RLS
ALTER TABLE improvement_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own improvement history" 
  ON improvement_history FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own improvement history" 
  ON improvement_history FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own improvement history" 
  ON improvement_history FOR UPDATE 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_improvement_history_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_improvement_history_updated_at
  BEFORE UPDATE ON improvement_history
  FOR EACH ROW
  EXECUTE FUNCTION update_improvement_history_updated_at();

-- Comments
COMMENT ON TABLE improvement_history IS 'Tracks all improvement operations performed on novels';
COMMENT ON COLUMN improvement_history.request IS 'JSONB representation of ImprovementRequest';
COMMENT ON COLUMN improvement_history.strategy IS 'JSONB representation of ImprovementStrategy';
COMMENT ON COLUMN improvement_history.result IS 'JSONB representation of ImprovementExecutionResult';
COMMENT ON COLUMN improvement_history.rolled_back IS 'Whether this improvement has been rolled back';
COMMENT ON COLUMN improvement_history.rollback_at IS 'Timestamp when improvement was rolled back';
