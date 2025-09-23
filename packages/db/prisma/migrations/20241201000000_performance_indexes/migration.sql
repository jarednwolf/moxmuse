-- Performance optimization indexes for card database

-- Full-text search indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_name_gin 
ON "Card" USING gin(to_tsvector('english', name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_oracle_text_gin 
ON "Card" USING gin(to_tsvector('english', "oracleText"));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_type_line_gin 
ON "Card" USING gin(to_tsvector('english', "typeLine"));

-- Color and color identity indexes (GIN for array operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_colors_gin 
ON "Card" USING gin(colors);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_color_identity_gin 
ON "Card" USING gin("colorIdentity");

-- CMC index for mana curve queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_cmc 
ON "Card" (cmc);

-- Composite index for commander searches (legendary creatures by color identity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_commander_search 
ON "Card" ("typeLine", "colorIdentity") 
WHERE "typeLine" ILIKE '%legendary%creature%';

-- Legalities index for format filtering (GIN for JSONB)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_legalities_gin 
ON "Card" USING gin(legalities);

-- Price index for budget filtering (GIN for JSONB)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cards_prices_gin 
ON "Card" USING gin(prices);

-- Deck-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_decks_user_id 
ON "GeneratedDeck" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_decks_format 
ON "GeneratedDeck" (format);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_decks_created_at 
ON "GeneratedDeck" ("createdAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_decks_updated_at 
ON "GeneratedDeck" ("updatedAt" DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_decks_power_level 
ON "GeneratedDeck" ("powerLevel");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_decks_quality_score 
ON "GeneratedDeck" ("qualityScore" DESC);

-- Composite index for user deck queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_decks_user_format_created 
ON "GeneratedDeck" ("userId", format, "createdAt" DESC);

-- Deck cards indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_deck_cards_deck_id 
ON "GeneratedDeckCard" ("deckId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_deck_cards_card_id 
ON "GeneratedDeckCard" ("cardId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_deck_cards_category 
ON "GeneratedDeckCard" (category);

-- Composite index for deck card queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_generated_deck_cards_deck_category 
ON "GeneratedDeckCard" ("deckId", category);

-- User-related indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON "User" (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
ON "User" ("createdAt" DESC);

-- Session indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_user_id 
ON "Session" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sessions_expires 
ON "Session" (expires);

-- Account indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_user_id 
ON "Account" ("userId");

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_provider_account 
ON "Account" (provider, "providerAccountId");

-- Verification token indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_tokens_token 
ON "VerificationToken" (token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_verification_tokens_identifier 
ON "VerificationToken" (identifier);

-- Performance monitoring table
CREATE TABLE IF NOT EXISTS "QueryPerformance" (
  id SERIAL PRIMARY KEY,
  query_name TEXT NOT NULL,
  execution_time INTEGER NOT NULL,
  parameters JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_query_performance_name_time 
ON "QueryPerformance" (query_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_query_performance_execution_time 
ON "QueryPerformance" (execution_time DESC);

-- Partitioning for query performance table (by month)
-- This would be set up in production for better performance
-- ALTER TABLE "QueryPerformance" PARTITION BY RANGE (timestamp);

-- Statistics update
ANALYZE "Card";
ANALYZE "GeneratedDeck";
ANALYZE "GeneratedDeckCard";
ANALYZE "User";