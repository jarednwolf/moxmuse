-- Enhanced deck profiles with AI insights
CREATE TABLE enhanced_decks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  commander TEXT NOT NULL,
  format TEXT DEFAULT 'commander',
  
  -- AI analysis data
  strategy JSONB NOT NULL,
  analysis JSONB,
  personalization_data JSONB,
  
  -- Real-time data
  statistics JSONB,
  market_data JSONB,
  meta_position JSONB,
  
  -- Maintenance tracking
  last_optimized TIMESTAMP,
  suggestion_history JSONB[],
  user_preferences JSONB,
  
  -- Mobile optimization
  mobile_layout JSONB,
  touch_settings JSONB,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Enhanced deck cards with AI insights
CREATE TABLE enhanced_deck_cards (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES enhanced_decks(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT NOT NULL,
  role TEXT NOT NULL,
  
  -- AI insights
  synergy_score DECIMAL(3,2),
  strategic_importance DECIMAL(3,2),
  replaceability DECIMAL(3,2),
  
  -- Market data
  current_price DECIMAL(10,2),
  price_history JSONB,
  alternatives JSONB,
  
  -- Personalization
  user_rating INTEGER CHECK (user_rating >= 1 AND user_rating <= 5),
  performance_notes TEXT,
  last_modified TIMESTAMP DEFAULT NOW(),
  
  -- Collection integration
  owned BOOLEAN DEFAULT FALSE,
  owned_quantity INTEGER DEFAULT 0,
  condition TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- User learning and personalization
CREATE TABLE user_learning_data (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Style profile
  style_profile JSONB NOT NULL,
  deck_preferences JSONB,
  
  -- Learning history
  learning_events JSONB[],
  suggestion_feedback JSONB[],
  
  -- Multi-deck context
  deck_relationships JSONB,
  cross_deck_insights JSONB,
  
  last_updated TIMESTAMP DEFAULT NOW()
);

-- Enhanced market intelligence (extending existing table)
ALTER TABLE market_intelligence 
ADD COLUMN IF NOT EXISTS tournament_results JSONB,
ADD COLUMN IF NOT EXISTS matchup_data JSONB;

-- AI analysis cache with versioning
CREATE TABLE ai_analysis_cache (
  id TEXT PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES enhanced_decks(id) ON DELETE CASCADE,
  analysis_version INTEGER NOT NULL,
  
  -- Analysis results
  synergy_analysis JSONB,
  strategy_analysis JSONB,
  meta_analysis JSONB,
  personalized_insights JSONB,
  
  -- Metadata
  confidence_score DECIMAL(3,2),
  analysis_duration INTEGER, -- milliseconds
  model_version TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(deck_id, analysis_version)
);

-- Create indexes for performance
CREATE INDEX idx_enhanced_decks_user_id ON enhanced_decks(user_id);
CREATE INDEX idx_enhanced_decks_format ON enhanced_decks(format);
CREATE INDEX idx_enhanced_decks_last_optimized ON enhanced_decks(last_optimized);
CREATE INDEX idx_enhanced_decks_created_at ON enhanced_decks(created_at);

CREATE INDEX idx_enhanced_deck_cards_deck_id ON enhanced_deck_cards(deck_id);
CREATE INDEX idx_enhanced_deck_cards_card_id ON enhanced_deck_cards(card_id);
CREATE INDEX idx_enhanced_deck_cards_category ON enhanced_deck_cards(category);
CREATE INDEX idx_enhanced_deck_cards_role ON enhanced_deck_cards(role);
CREATE INDEX idx_enhanced_deck_cards_synergy_score ON enhanced_deck_cards(synergy_score);
CREATE INDEX idx_enhanced_deck_cards_owned ON enhanced_deck_cards(owned);

CREATE INDEX idx_user_learning_data_user_id ON user_learning_data(user_id);
CREATE INDEX idx_user_learning_data_last_updated ON user_learning_data(last_updated);

CREATE INDEX idx_ai_analysis_cache_deck_id ON ai_analysis_cache(deck_id);
CREATE INDEX idx_ai_analysis_cache_analysis_version ON ai_analysis_cache(analysis_version);
CREATE INDEX idx_ai_analysis_cache_created_at ON ai_analysis_cache(created_at);
CREATE INDEX idx_ai_analysis_cache_confidence_score ON ai_analysis_cache(confidence_score);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_enhanced_decks_updated_at 
    BEFORE UPDATE ON enhanced_decks 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_learning_data_last_updated 
    BEFORE UPDATE ON user_learning_data 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();