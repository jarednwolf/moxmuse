-- Advanced Performance Optimization Indexes
-- This migration adds specialized indexes for complex queries and performance optimization

-- Advanced composite indexes for deck building queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_userId_format_powerLevel_budget_idx" ON "Deck"("userId", "format", "powerLevel", "budget");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_commander_powerLevel_isPublic_createdAt_idx" ON "Deck"("commander", "powerLevel", "isPublic", "createdAt");

-- Optimized indexes for AI deck generation
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_userId_format_powerLevel_status_idx" ON "GeneratedDeck"("userId", "format", "powerLevel", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_sessionId_status_createdAt_idx" ON "GeneratedDeck"("sessionId", "status", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_commander_estimatedBudget_powerLevel_idx" ON "GeneratedDeck"("commander", "estimatedBudget", "powerLevel");

-- Enhanced recommendation system indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_userId_deckId_confidence_accepted_idx" ON "Recommendation"("userId", "deckId", "confidence", "accepted");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_cardId_confidence_owned_createdAt_idx" ON "Recommendation"("cardId", "confidence", "owned", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_sessionId_confidence_category_idx" ON "Recommendation"("sessionId", "confidence", "category");

-- Performance monitoring indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_operation_success_duration_timestamp_idx" ON "PerformanceMetric"("operation", "success", "duration", "timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_userId_operation_timestamp_idx" ON "PerformanceMetric"("userId", "operation", "timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_timestamp_operation_duration_idx" ON "PerformanceMetric"("timestamp", "operation", "duration");

-- Collection management optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionCard_userId_quantity_foilQuantity_idx" ON "CollectionCard"("userId", "quantity", "foilQuantity");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionCard_cardId_userId_updatedAt_idx" ON "CollectionCard"("cardId", "userId", "updatedAt");

-- Enhanced deck card analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedDeckCard_deckId_strategicImportance_synergyScore_idx" ON "EnhancedDeckCard"("deckId", "strategicImportance", "synergyScore");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedDeckCard_cardId_currentPrice_owned_idx" ON "EnhancedDeckCard"("cardId", "currentPrice", "owned");

-- Public deck discovery optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_format_powerLevel_rating_views_idx" ON "PublicDeck"("format", "powerLevel", "rating", "views");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_archetype_commander_isActive_publishedAt_idx" ON "PublicDeck"("archetype", "commander", "isActive", "publishedAt");

-- User activity and analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClickEvent_userId_sessionId_createdAt_cardId_idx" ON "ClickEvent"("userId", "sessionId", "createdAt", "cardId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClickEvent_affiliatePartner_cardId_createdAt_idx" ON "ClickEvent"("affiliatePartner", "cardId", "createdAt");

-- Search and analytics optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SearchHistory_userId_query_timestamp_idx" ON "SearchHistory"("userId", "query", "timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SearchAnalytics_query_timestamp_resultCount_idx" ON "SearchAnalytics"("query", "timestamp", "resultCount");

-- Card interaction tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardClick_cardId_userId_timestamp_idx" ON "CardClick"("cardId", "userId", "timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardClick_timestamp_cardId_context_idx" ON "CardClick"("timestamp", "cardId", "context");

-- Enhanced card data optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedCard_popularityScore_edhrecRank_lastUpdated_idx" ON "EnhancedCard"("popularityScore", "edhrecRank", "lastUpdated");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedCard_name_colors_cmc_idx" ON "EnhancedCard"("name", "colors", "cmc");

-- Price tracking optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardPriceHistory_cardId_source_date_condition_idx" ON "CardPriceHistory"("cardId", "source", "date", "condition");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardPriceHistory_date_source_foil_idx" ON "CardPriceHistory"("date", "source", "foil");

-- Market intelligence indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MarketIntelligence_cardId_priceChange24h_lastUpdated_idx" ON "MarketIntelligence"("cardId", "priceChange24h", "lastUpdated");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MarketIntelligence_volatilityScore_lastUpdated_idx" ON "MarketIntelligence"("volatilityScore", "lastUpdated");

-- Popularity trend analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PopularityTrend_cardId_format_date_timeframe_idx" ON "PopularityTrend"("cardId", "format", "date", "timeframe");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PopularityTrend_format_trend_date_idx" ON "PopularityTrend"("format", "trend", "date");

-- AI analysis caching optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIAnalysisCache_deckId_analysisType_analysisVersion_idx" ON "AIAnalysisCache"("deckId", "analysisType", "analysisVersion");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIAnalysisCache_confidenceScore_createdAt_analysisType_idx" ON "AIAnalysisCache"("confidenceScore", "createdAt", "analysisType");

-- Bulk operations tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BulkOperation_userId_type_status_createdAt_idx" ON "BulkOperation"("userId", "type", "status", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BulkOperation_status_priority_createdAt_idx" ON "BulkOperation"("status", "priority", "createdAt");

-- Import system optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportJob_userId_source_status_priority_idx" ON "ImportJob"("userId", "source", "status", "priority");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportJob_status_priority_createdAt_estimatedDuration_idx" ON "ImportJob"("status", "priority", "createdAt", "estimatedDuration");

-- Notification system optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_userId_type_read_createdAt_idx" ON "Notification"("userId", "type", "read", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_type_createdAt_read_idx" ON "Notification"("type", "createdAt", "read");

-- Session and authentication optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_userId_expires_sessionToken_idx" ON "Session"("userId", "expires", "sessionToken");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_expires_userId_idx" ON "Session"("expires", "userId") WHERE "expires" > NOW();

-- User profile and social features
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProfile_username_isPublic_lastActive_idx" ON "UserProfile"("username", "isPublic", "lastActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProfile_totalLikes_followers_isPublic_idx" ON "UserProfile"("totalLikes", "followers", "isPublic");

-- Deck organization optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckFolder_userId_parentId_sortOrder_name_idx" ON "DeckFolder"("userId", "parentId", "sortOrder", "name");

-- Template system optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckTemplate_format_archetype_isPublic_usageCount_idx" ON "DeckTemplate"("format", "archetype", "isPublic", "usageCount");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckTemplate_createdBy_isPublic_createdAt_idx" ON "DeckTemplate"("createdBy", "isPublic", "createdAt");

-- Covering indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_covering_user_decks_idx" ON "Deck"("userId", "isPublic", "createdAt") INCLUDE ("name", "format", "commander", "powerLevel");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_covering_user_generations_idx" ON "GeneratedDeck"("userId", "status", "createdAt") INCLUDE ("format", "commander", "powerLevel", "estimatedBudget");

-- Functional indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_name_lower_idx" ON "Deck"(LOWER("name"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_name_lower_idx" ON "PublicDeck"(LOWER("name"));
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_email_lower_idx" ON "User"(LOWER("email"));

-- Partial indexes for specific conditions
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_active_public_idx" ON "Deck"("createdAt", "powerLevel", "budget") WHERE "isPublic" = true AND "deletedAt" IS NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_completed_idx" ON "GeneratedDeck"("createdAt", "estimatedBudget") WHERE "status" = 'completed';
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_high_confidence_idx" ON "Recommendation"("createdAt", "cardId") WHERE "confidence" > 0.8;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_errors_idx" ON "PerformanceMetric"("timestamp", "operation") WHERE "success" = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionCard_owned_cards_idx" ON "CollectionCard"("userId", "cardId", "updatedAt") WHERE "quantity" > 0 OR "foilQuantity" > 0;

-- Expression indexes for calculated values
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_total_value_idx" ON "Deck"(("budget" * "powerLevel")) WHERE "isPublic" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_duration_category_idx" ON "PerformanceMetric"(
  CASE 
    WHEN "duration" < 100 THEN 'fast'
    WHEN "duration" < 1000 THEN 'medium'
    ELSE 'slow'
  END,
  "timestamp"
);

-- Specialized indexes for analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClickEvent_daily_stats_idx" ON "ClickEvent"(DATE("createdAt"), "affiliatePartner", "cardId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SearchHistory_daily_trends_idx" ON "SearchHistory"(DATE("timestamp"), "query");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_hourly_stats_idx" ON "PerformanceMetric"(DATE_TRUNC('hour', "timestamp"), "operation", "success");

-- Multi-column statistics for better query planning
-- Note: These would be database-specific commands in production
-- CREATE STATISTICS deck_format_power_stats ON format, powerLevel FROM "Deck";
-- CREATE STATISTICS recommendation_confidence_stats ON confidence, accepted FROM "Recommendation";
-- CREATE STATISTICS performance_operation_stats ON operation, duration FROM "PerformanceMetric";

-- Maintenance: Update table statistics
ANALYZE "Deck";
ANALYZE "GeneratedDeck";
ANALYZE "Recommendation";
ANALYZE "PerformanceMetric";
ANALYZE "CollectionCard";
ANALYZE "PublicDeck";
ANALYZE "ClickEvent";
ANALYZE "EnhancedDeckCard";
ANALYZE "AIAnalysisCache";