-- Add version control and conflict resolution fields to existing tables

-- Add version and checksum fields to generated_decks
ALTER TABLE generated_decks 
ADD COLUMN version INTEGER DEFAULT 1,
ADD COLUMN checksum TEXT,
ADD COLUMN auto_save_enabled BOOLEAN DEFAULT true,
ADD COLUMN last_auto_save TIMESTAMP;

-- Add consultation_sessions table for session persistence
CREATE TABLE consultation_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_step INTEGER NOT NULL DEFAULT 0,
  total_steps INTEGER NOT NULL DEFAULT 10,
  responses JSONB NOT NULL DEFAULT '{}',
  preferences JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'in_progress',
  version INTEGER NOT NULL DEFAULT 1,
  checksum TEXT,
  auto_save_enabled BOOLEAN DEFAULT true,
  last_auto_save TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add save_operations table for tracking save operations
CREATE TABLE save_operations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL, -- 'deck' or 'consultation-session'
  entity_id TEXT NOT NULL,
  operation_type TEXT NOT NULL, -- 'create', 'update', 'delete'
  data_snapshot JSONB,
  version_before INTEGER,
  version_after INTEGER,
  checksum_before TEXT,
  checksum_after TEXT,
  conflict_detected BOOLEAN DEFAULT false,
  conflict_resolution TEXT, -- 'client-wins', 'server-wins', 'merged'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Add conflict_resolutions table for tracking conflicts
CREATE TABLE conflict_resolutions (
  id TEXT PRIMARY KEY,
  save_operation_id TEXT NOT NULL REFERENCES save_operations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  client_version INTEGER NOT NULL,
  server_version INTEGER NOT NULL,
  client_checksum TEXT NOT NULL,
  server_checksum TEXT NOT NULL,
  resolution_strategy TEXT NOT NULL,
  resolution_result TEXT NOT NULL, -- 'client', 'server', 'merged'
  merged_data JSONB,
  user_choice TEXT, -- for manual resolution
  created_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_consultation_sessions_user_id ON consultation_sessions(user_id);
CREATE INDEX idx_consultation_sessions_status ON consultation_sessions(status);
CREATE INDEX idx_consultation_sessions_updated_at ON consultation_sessions(updated_at);

CREATE INDEX idx_save_operations_user_id ON save_operations(user_id);
CREATE INDEX idx_save_operations_entity ON save_operations(entity_type, entity_id);
CREATE INDEX idx_save_operations_status ON save_operations(status);
CREATE INDEX idx_save_operations_created_at ON save_operations(created_at);

CREATE INDEX idx_conflict_resolutions_entity ON conflict_resolutions(entity_type, entity_id);
CREATE INDEX idx_conflict_resolutions_created_at ON conflict_resolutions(created_at);

-- Add triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_consultation_sessions_updated_at 
    BEFORE UPDATE ON consultation_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add generated deck cards table if it doesn't exist
CREATE TABLE IF NOT EXISTS generated_deck_cards (
  id SERIAL PRIMARY KEY,
  deck_id TEXT NOT NULL REFERENCES generated_decks(id) ON DELETE CASCADE,
  card_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  category TEXT DEFAULT 'main', -- 'main', 'commander', 'sideboard'
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(deck_id, card_id, category)
);

CREATE INDEX IF NOT EXISTS idx_generated_deck_cards_deck_id ON generated_deck_cards(deck_id);
CREATE INDEX IF NOT EXISTS idx_generated_deck_cards_card_id ON generated_deck_cards(card_id);

-- Add session_snapshots table for step-by-step session history
CREATE TABLE session_snapshots (
  id SERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES consultation_sessions(id) ON DELETE CASCADE,
  step INTEGER NOT NULL,
  step_data JSONB NOT NULL DEFAULT '{}',
  timestamp TIMESTAMP DEFAULT NOW(),
  is_checkpoint BOOLEAN DEFAULT false,
  
  UNIQUE(session_id, step)
);

CREATE INDEX idx_session_snapshots_session_id ON session_snapshots(session_id);
CREATE INDEX idx_session_snapshots_timestamp ON session_snapshots(timestamp);
CREATE INDEX idx_session_snapshots_checkpoint ON session_snapshots(is_checkpoint);