-- Add performance indexes for frequently queried fields
-- This migration adds indexes to improve query performance across the application

-- User table indexes (authentication and user lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_email_idx" ON "User"("email");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_createdAt_idx" ON "User"("createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "User_updatedAt_idx" ON "User"("updatedAt");

-- Session table indexes (authentication performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_userId_expires_idx" ON "Session"("userId", "expires");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_expires_idx" ON "Session"("expires");

-- Account table indexes (OAuth and authentication)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Account_userId_provider_idx" ON "Account"("userId", "provider");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Account_provider_providerAccountId_idx" ON "Account"("provider", "providerAccountId");

-- Deck table indexes (deck browsing and filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_userId_createdAt_idx" ON "Deck"("userId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_format_isPublic_idx" ON "Deck"("format", "isPublic");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_commander_format_idx" ON "Deck"("commander", "format");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_powerLevel_budget_idx" ON "Deck"("powerLevel", "budget");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_tags_gin_idx" ON "Deck" USING gin("tags");

-- DeckCard table indexes (deck composition queries)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckCard_deckId_boardState_idx" ON "DeckCard"("deckId", "boardState");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckCard_cardId_deckId_idx" ON "DeckCard"("cardId", "deckId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckCard_isCommander_idx" ON "DeckCard"("isCommander") WHERE "isCommander" = true;

-- GeneratedDeck table indexes (AI deck generation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_userId_status_idx" ON "GeneratedDeck"("userId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_sessionId_createdAt_idx" ON "GeneratedDeck"("sessionId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_commander_format_idx" ON "GeneratedDeck"("commander", "format");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_powerLevel_estimatedBudget_idx" ON "GeneratedDeck"("powerLevel", "estimatedBudget");

-- GeneratedDeckCard table indexes (AI deck card analysis)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeckCard_deckId_category_idx" ON "GeneratedDeckCard"("deckId", "category");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeckCard_cardId_category_idx" ON "GeneratedDeckCard"("cardId", "category");

-- Recommendation table indexes (AI recommendations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_userId_sessionId_idx" ON "Recommendation"("userId", "sessionId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_deckId_createdAt_idx" ON "Recommendation"("deckId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_cardId_confidence_idx" ON "Recommendation"("cardId", "confidence");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_owned_accepted_idx" ON "Recommendation"("owned", "accepted");

-- ConsultationSession table indexes (user sessions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ConsultationSession_userId_completed_idx" ON "ConsultationSession"("userId", "completed");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ConsultationSession_sessionId_currentStep_idx" ON "ConsultationSession"("sessionId", "currentStep");

-- CollectionCard table indexes (user collections)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionCard_userId_cardId_idx" ON "CollectionCard"("userId", "cardId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionCard_cardId_quantity_idx" ON "CollectionCard"("cardId", "quantity");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionCard_userId_updatedAt_idx" ON "CollectionCard"("userId", "updatedAt");

-- ClickEvent table indexes (analytics and tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClickEvent_userId_createdAt_idx" ON "ClickEvent"("userId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClickEvent_sessionId_cardId_idx" ON "ClickEvent"("sessionId", "cardId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ClickEvent_affiliatePartner_createdAt_idx" ON "ClickEvent"("affiliatePartner", "createdAt");

-- PerformanceMetric table indexes (monitoring and analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_operation_timestamp_idx" ON "PerformanceMetric"("operation", "timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_userId_operation_idx" ON "PerformanceMetric"("userId", "operation");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_success_timestamp_idx" ON "PerformanceMetric"("success", "timestamp");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_duration_operation_idx" ON "PerformanceMetric"("duration", "operation");

-- EnhancedDeck table indexes (enhanced deck features)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedDeck_userId_lastOptimized_idx" ON "EnhancedDeck"("userId", "lastOptimized");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedDeck_format_commander_idx" ON "EnhancedDeck"("format", "commander");

-- EnhancedDeckCard table indexes (enhanced deck cards)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedDeckCard_deckId_synergyScore_idx" ON "EnhancedDeckCard"("deckId", "synergyScore");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedDeckCard_cardId_strategicImportance_idx" ON "EnhancedDeckCard"("cardId", "strategicImportance");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedDeckCard_owned_currentPrice_idx" ON "EnhancedDeckCard"("owned", "currentPrice");

-- PublicDeck table indexes (public deck browsing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_format_archetype_idx" ON "PublicDeck"("format", "archetype");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_rating_views_idx" ON "PublicDeck"("rating", "views");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_publishedAt_isActive_idx" ON "PublicDeck"("publishedAt", "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_commander_powerLevel_idx" ON "PublicDeck"("commander", "powerLevel");

-- DeckComment table indexes (social features)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckComment_publicDeckId_createdAt_idx" ON "DeckComment"("publicDeckId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckComment_userId_isDeleted_idx" ON "DeckComment"("userId", "isDeleted");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckComment_parentId_createdAt_idx" ON "DeckComment"("parentId", "createdAt");

-- UserProfile table indexes (user profiles and social)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProfile_username_isPublic_idx" ON "UserProfile"("username", "isPublic");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProfile_totalLikes_followers_idx" ON "UserProfile"("totalLikes", "followers");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserProfile_lastActive_isPublic_idx" ON "UserProfile"("lastActive", "isPublic");

-- DeckFolder table indexes (deck organization)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckFolder_userId_parentId_idx" ON "DeckFolder"("userId", "parentId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckFolder_parentId_sortOrder_idx" ON "DeckFolder"("parentId", "sortOrder");

-- DeckTemplate table indexes (deck templates)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckTemplate_format_archetype_idx" ON "DeckTemplate"("format", "archetype");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckTemplate_isPublic_usageCount_idx" ON "DeckTemplate"("isPublic", "usageCount");

-- CardPriceHistory table indexes (price tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardPriceHistory_cardId_date_idx" ON "CardPriceHistory"("cardId", "date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardPriceHistory_source_date_idx" ON "CardPriceHistory"("source", "date");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardPriceHistory_condition_foil_idx" ON "CardPriceHistory"("condition", "foil");

-- PriceAlert table indexes (price alerts)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PriceAlert_userId_isActive_idx" ON "PriceAlert"("userId", "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PriceAlert_cardId_targetPrice_idx" ON "PriceAlert"("cardId", "targetPrice");

-- Notification table indexes (user notifications)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_type_createdAt_idx" ON "Notification"("type", "createdAt");

-- SyncJob table indexes (collection sync)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SyncJob_userId_status_idx" ON "SyncJob"("userId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SyncJob_status_createdAt_idx" ON "SyncJob"("status", "createdAt");

-- CollectionSource table indexes (collection sources)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionSource_userId_isActive_idx" ON "CollectionSource"("userId", "isActive");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionSource_type_lastSynced_idx" ON "CollectionSource"("type", "lastSynced");

-- MarketIntelligence table indexes (market data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "MarketIntelligence_cardId_lastUpdated_idx" ON "MarketIntelligence"("cardId", "lastUpdated");

-- PopularityTrend table indexes (card popularity)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PopularityTrend_cardId_format_idx" ON "PopularityTrend"("cardId", "format");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PopularityTrend_format_trend_idx" ON "PopularityTrend"("format", "trend");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PopularityTrend_date_timeframe_idx" ON "PopularityTrend"("date", "timeframe");

-- UserLearningData table indexes (AI learning)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "UserLearningData_userId_lastUpdated_idx" ON "UserLearningData"("userId", "lastUpdated");

-- AIAnalysisCache table indexes (AI analysis caching)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIAnalysisCache_deckId_analysisVersion_idx" ON "AIAnalysisCache"("deckId", "analysisVersion");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "AIAnalysisCache_createdAt_confidenceScore_idx" ON "AIAnalysisCache"("createdAt", "confidenceScore");

-- SuggestionFeedback table indexes (AI feedback)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SuggestionFeedback_userId_feedback_idx" ON "SuggestionFeedback"("userId", "feedback");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SuggestionFeedback_suggestionId_createdAt_idx" ON "SuggestionFeedback"("suggestionId", "createdAt");

-- BulkOperation table indexes (bulk operations)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BulkOperation_userId_status_idx" ON "BulkOperation"("userId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BulkOperation_type_createdAt_idx" ON "BulkOperation"("type", "createdAt");

-- SearchHistory table indexes (search analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SearchHistory_userId_timestamp_idx" ON "SearchHistory"("userId", "timestamp");

-- SearchAnalytics table indexes (search performance)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "SearchAnalytics_timestamp_query_idx" ON "SearchAnalytics"("timestamp", "query");

-- CardClick table indexes (card interaction tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardClick_userId_cardId_idx" ON "CardClick"("userId", "cardId");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardClick_cardId_timestamp_idx" ON "CardClick"("cardId", "timestamp");

-- EnhancedCard table indexes (enhanced card data)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedCard_name_popularityScore_idx" ON "EnhancedCard"("name", "popularityScore");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "EnhancedCard_edhrecRank_lastUpdated_idx" ON "EnhancedCard"("edhrecRank", "lastUpdated");

-- FormatRules table indexes (format validation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "FormatRules_format_isActive_idx" ON "FormatRules"("format", "isActive");

-- CardLegality table indexes (card legality checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CardLegality_name_lastUpdated_idx" ON "CardLegality"("name", "lastUpdated");

-- BannedListUpdate table indexes (banned list tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BannedListUpdate_format_effectiveDate_idx" ON "BannedListUpdate"("format", "effectiveDate");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "BannedListUpdate_isActive_createdAt_idx" ON "BannedListUpdate"("isActive", "createdAt");

-- DeckValidation table indexes (deck validation)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckValidation_deckId_format_idx" ON "DeckValidation"("deckId", "format");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckValidation_isValid_validatedAt_idx" ON "DeckValidation"("isValid", "validatedAt");

-- ImportJob table indexes (import processing)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportJob_userId_status_idx" ON "ImportJob"("userId", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportJob_source_createdAt_idx" ON "ImportJob"("source", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportJob_priority_status_idx" ON "ImportJob"("priority", "status");

-- ImportJobItem table indexes (import items)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportJobItem_importJobId_status_idx" ON "ImportJobItem"("importJobId", "status");

-- ImportHistory table indexes (import history)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportHistory_userId_createdAt_idx" ON "ImportHistory"("userId", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportHistory_importJobId_action_idx" ON "ImportHistory"("importJobId", "action");

-- ImportAnalytics table indexes (import analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportAnalytics_userId_source_idx" ON "ImportAnalytics"("userId", "source");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ImportAnalytics_createdAt_status_idx" ON "ImportAnalytics"("createdAt", "status");

-- Composite indexes for complex queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_userId_format_isPublic_createdAt_idx" ON "Deck"("userId", "format", "isPublic", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "GeneratedDeck_userId_format_status_createdAt_idx" ON "GeneratedDeck"("userId", "format", "status", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Recommendation_userId_deckId_confidence_createdAt_idx" ON "Recommendation"("userId", "deckId", "confidence", "createdAt");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PerformanceMetric_operation_success_timestamp_duration_idx" ON "PerformanceMetric"("operation", "success", "timestamp", "duration");

-- Partial indexes for common filtered queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_public_recent_idx" ON "Deck"("createdAt", "powerLevel") WHERE "isPublic" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_active_popular_idx" ON "PublicDeck"("rating", "views") WHERE "isActive" = true;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Notification_unread_recent_idx" ON "Notification"("createdAt") WHERE "read" = false;
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Session_active_idx" ON "Session"("expires", "userId") WHERE "expires" > NOW();
CREATE INDEX CONCURRENTLY IF NOT EXISTS "CollectionCard_owned_idx" ON "CollectionCard"("userId", "cardId") WHERE "quantity" > 0 OR "foilQuantity" > 0;

-- Text search indexes for full-text search capabilities
CREATE INDEX CONCURRENTLY IF NOT EXISTS "Deck_name_trgm_idx" ON "Deck" USING gin("name" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "PublicDeck_name_trgm_idx" ON "PublicDeck" USING gin("name" gin_trgm_ops);
CREATE INDEX CONCURRENTLY IF NOT EXISTS "DeckTemplate_name_trgm_idx" ON "DeckTemplate" USING gin("name" gin_trgm_ops);

-- Add trigram extension if not exists (for text search)
CREATE EXTENSION IF NOT EXISTS pg_trgm;