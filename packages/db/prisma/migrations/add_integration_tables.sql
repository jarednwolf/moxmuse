-- Add integration-related tables

-- Shareable links table
CREATE TABLE IF NOT EXISTS shareable_links (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  deck_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN DEFAULT true,
  allow_comments BOOLEAN DEFAULT false,
  allow_forks BOOLEAN DEFAULT true,
  view_count INTEGER DEFAULT 0,
  password TEXT,
  expires_at TIMESTAMP,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (deck_id) REFERENCES generated_decks(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User collections table
CREATE TABLE IF NOT EXISTS user_collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  card_count INTEGER DEFAULT 0,
  last_import_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Collection cards table
CREATE TABLE IF NOT EXISTS collection_cards (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL,
  card_id TEXT NOT NULL,
  name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  condition TEXT DEFAULT 'near_mint',
  foil BOOLEAN DEFAULT false,
  language TEXT DEFAULT 'en',
  set_code TEXT,
  collector_number TEXT,
  price DECIMAL(10,2),
  acquired_date TIMESTAMP DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (collection_id) REFERENCES user_collections(id) ON DELETE CASCADE,
  FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE,
  UNIQUE(collection_id, card_id)
);

-- API keys table
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  permissions TEXT[] DEFAULT '{}',
  rate_limit INTEGER DEFAULT 1000,
  expires_at TIMESTAMP,
  last_used_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth applications table
CREATE TABLE IF NOT EXISTS oauth_apps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  client_id TEXT UNIQUE NOT NULL,
  client_secret TEXT NOT NULL,
  redirect_uris TEXT[] DEFAULT '{}',
  scopes TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth authorization codes table
CREATE TABLE IF NOT EXISTS oauth_authorization_codes (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  client_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (client_id) REFERENCES oauth_apps(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- OAuth refresh tokens table
CREATE TABLE IF NOT EXISTS oauth_refresh_tokens (
  id TEXT PRIMARY KEY,
  token TEXT UNIQUE NOT NULL,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{}',
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (client_id) REFERENCES oauth_apps(client_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API requests table (for rate limiting and analytics)
CREATE TABLE IF NOT EXISTS api_requests (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

-- Webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] DEFAULT '{}',
  secret TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  retry_count INTEGER DEFAULT 0,
  last_triggered_at TIMESTAMP,
  last_success_at TIMESTAMP,
  last_failure_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Webhook deliveries table
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMP,
  response_status INTEGER,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shareable_links_slug ON shareable_links(slug);
CREATE INDEX IF NOT EXISTS idx_shareable_links_user_id ON shareable_links(user_id);
CREATE INDEX IF NOT EXISTS idx_shareable_links_deck_id ON shareable_links(deck_id);
CREATE INDEX IF NOT EXISTS idx_shareable_links_expires_at ON shareable_links(expires_at);

CREATE INDEX IF NOT EXISTS idx_collection_cards_collection_id ON collection_cards(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_card_id ON collection_cards(card_id);
CREATE INDEX IF NOT EXISTS idx_collection_cards_name ON collection_cards(name);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_is_active ON api_keys(is_active);

CREATE INDEX IF NOT EXISTS idx_oauth_apps_user_id ON oauth_apps(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_apps_client_id ON oauth_apps(client_id);

CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_code ON oauth_authorization_codes(code);
CREATE INDEX IF NOT EXISTS idx_oauth_authorization_codes_expires_at ON oauth_authorization_codes(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_token ON oauth_refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_oauth_refresh_tokens_expires_at ON oauth_refresh_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_api_requests_key_id ON api_requests(key_id);
CREATE INDEX IF NOT EXISTS idx_api_requests_created_at ON api_requests(created_at);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id ON webhooks(user_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_is_active ON webhooks(is_active);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);