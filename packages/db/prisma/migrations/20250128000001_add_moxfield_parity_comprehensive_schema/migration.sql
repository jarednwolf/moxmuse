-- Moxfield Parity + AI Enhancement Comprehensive Schema Migration
-- This migration adds all tables required for the comprehensive deck building platform

-- =====================================================
-- DECK ORGANIZATION SYSTEM
-- =====================================================

-- Deck Folders for hierarchical organization
CREATE TABLE "DeckFolder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeckFolder_pkey" PRIMARY KEY ("id")
);

-- Deck Templates for reusable deck structures
CREATE TABLE "DeckTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'commander',
    "archetype" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "powerLevel" INTEGER,
    "estimatedBudget" DECIMAL(10,2),
    "tags" TEXT[],
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "categories" JSONB NOT NULL DEFAULT '[]',
    "coreCards" JSONB NOT NULL DEFAULT '[]',
    "flexSlots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeckTemplate_pkey" PRIMARY KEY ("id")
);

-- Junction table for deck-folder relationships
CREATE TABLE "DeckFolderItem" (
    "id" TEXT NOT NULL,
    "folderId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckFolderItem_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- ENHANCED CARD DATABASE INTEGRATION
-- =====================================================

-- Enhanced card data with community and market information
CREATE TABLE "EnhancedCardData" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "manaCost" TEXT,
    "cmc" INTEGER NOT NULL DEFAULT 0,
    "typeLine" TEXT NOT NULL,
    "oracleText" TEXT,
    "power" TEXT,
    "toughness" TEXT,
    "colors" TEXT[],
    "colorIdentity" TEXT[],
    "legalities" JSONB NOT NULL DEFAULT '{}',
    "rulings" JSONB NOT NULL DEFAULT '[]',
    "printings" JSONB NOT NULL DEFAULT '[]',
    "relatedCards" JSONB NOT NULL DEFAULT '[]',
    "edhrecRank" INTEGER,
    "popularityScore" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "synergyTags" TEXT[],
    "currentPrice" DECIMAL(10,2),
    "priceHistory" JSONB NOT NULL DEFAULT '[]',
    "availability" JSONB NOT NULL DEFAULT '{}',
    "imageUrls" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnhancedCardData_pkey" PRIMARY KEY ("id")
);

-- Card search queries for saved searches
CREATE TABLE "SavedCardSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedCardSearch_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- UNIVERSAL IMPORT/EXPORT SYSTEM
-- =====================================================

-- Import jobs for tracking deck imports from various platforms
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" TEXT NOT NULL, -- moxfield, archidekt, tappedout, edhrec, mtggoldfish, csv, text
    "status" TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    "rawData" TEXT,
    "sourceUrl" TEXT,
    "fileName" TEXT,
    "decksFound" INTEGER NOT NULL DEFAULT 0,
    "decksImported" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "metadata" JSONB,
    "processingTime" INTEGER, -- milliseconds
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- Export jobs for tracking deck exports to various formats
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckIds" TEXT[],
    "format" JSONB NOT NULL, -- ExportFormat object
    "options" JSONB NOT NULL DEFAULT '{}', -- ExportOptions object
    "status" TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    "downloadUrl" TEXT,
    "fileSize" INTEGER,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- Platform adapters configuration
CREATE TABLE "PlatformAdapter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- import, export, both
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "configuration" JSONB NOT NULL DEFAULT '{}',
    "supportedFormats" TEXT[],
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformAdapter_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- ADVANCED ANALYTICS AND TESTING
-- =====================================================

-- Comprehensive deck analytics
CREATE TABLE "DeckAnalytics" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "manaAnalysis" JSONB NOT NULL DEFAULT '{}',
    "consistencyMetrics" JSONB NOT NULL DEFAULT '{}',
    "metaAnalysis" JSONB NOT NULL DEFAULT '{}',
    "performanceData" JSONB NOT NULL DEFAULT '{}',
    "optimizationSuggestions" JSONB NOT NULL DEFAULT '[]',
    "analysisVersion" TEXT NOT NULL,
    "lastAnalyzed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckAnalytics_pkey" PRIMARY KEY ("id")
);

-- Goldfish simulation results
CREATE TABLE "GoldfishSimulation" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "simulationRuns" INTEGER NOT NULL,
    "openingHandStats" JSONB NOT NULL DEFAULT '{}',
    "earlyGameStats" JSONB NOT NULL DEFAULT '{}',
    "keepableHands" DECIMAL(5,2) NOT NULL,
    "averageTurnToPlay" JSONB NOT NULL DEFAULT '{}',
    "mulliganRate" DECIMAL(5,2) NOT NULL,
    "gameplayConsistency" DECIMAL(5,2) NOT NULL,
    "simulationParameters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoldfishSimulation_pkey" PRIMARY KEY ("id")
);

-- Performance tracking for individual games
CREATE TABLE "GameResult" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "opponent" TEXT,
    "opponentDeck" TEXT,
    "result" TEXT NOT NULL, -- win, loss, draw
    "gameLength" INTEGER, -- minutes
    "format" TEXT NOT NULL DEFAULT 'commander',
    "notes" TEXT,
    "metadata" JSONB,
    "playedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameResult_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- SOCIAL AND COMMUNITY FEATURES
-- =====================================================

-- Public deck sharing
CREATE TABLE "PublicDeck" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "commander" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'commander',
    "cardCount" INTEGER NOT NULL DEFAULT 0,
    "estimatedBudget" DECIMAL(10,2),
    "powerLevel" INTEGER,
    "archetype" TEXT,
    "tags" TEXT[],
    "views" INTEGER NOT NULL DEFAULT 0,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "copies" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUpdated" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PublicDeck_pkey" PRIMARY KEY ("id")
);

-- Deck comments system
CREATE TABLE "DeckComment" (
    "id" TEXT NOT NULL,
    "publicDeckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentId" TEXT,
    "content" TEXT NOT NULL,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "isDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeckComment_pkey" PRIMARY KEY ("id")
);

-- User profiles for social features
CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "bio" TEXT,
    "avatar" TEXT,
    "totalDecks" INTEGER NOT NULL DEFAULT 0,
    "publicDecks" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "favoriteFormats" TEXT[],
    "favoriteArchetypes" TEXT[],
    "brewingStyle" TEXT[],
    "followers" INTEGER NOT NULL DEFAULT 0,
    "following" INTEGER NOT NULL DEFAULT 0,
    "achievements" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

-- User following system
CREATE TABLE "UserFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserFollow_pkey" PRIMARY KEY ("id")
);

-- Deck likes system
CREATE TABLE "DeckLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "publicDeckId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckLike_pkey" PRIMARY KEY ("id")
);

-- Comment likes system
CREATE TABLE "CommentLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommentLike_pkey" PRIMARY KEY ("id")
);

-- Trending data tracking
CREATE TABLE "TrendingData" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL, -- deck, card, archetype, commander
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "score" DECIMAL(10,2) NOT NULL,
    "timeframe" TEXT NOT NULL, -- day, week, month
    "metadata" JSONB,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrendingData_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- PERFORMANCE MONITORING AND CACHING
-- =====================================================

-- Performance monitoring
CREATE TABLE "PerformanceMetric" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "operation" TEXT NOT NULL,
    "duration" INTEGER NOT NULL, -- milliseconds
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "metadata" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceMetric_pkey" PRIMARY KEY ("id")
);

-- Intelligent caching system
CREATE TABLE "CacheEntry" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "tags" TEXT[],
    "expiresAt" TIMESTAMP(3),
    "hitCount" INTEGER NOT NULL DEFAULT 0,
    "lastAccessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CacheEntry_pkey" PRIMARY KEY ("id")
);

-- Background job processing
CREATE TABLE "BackgroundJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending', -- pending, processing, completed, failed
    "priority" INTEGER NOT NULL DEFAULT 0,
    "data" JSONB NOT NULL DEFAULT '{}',
    "result" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "scheduledFor" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- System health monitoring
CREATE TABLE "SystemHealth" (
    "id" TEXT NOT NULL,
    "component" TEXT NOT NULL,
    "status" TEXT NOT NULL, -- healthy, warning, critical
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "message" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SystemHealth_pkey" PRIMARY KEY ("id")
);

-- =====================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- =====================================================

-- Deck Folder indexes
CREATE INDEX "DeckFolder_userId_idx" ON "DeckFolder"("userId");
CREATE INDEX "DeckFolder_parentId_idx" ON "DeckFolder"("parentId");
CREATE INDEX "DeckFolder_sortOrder_idx" ON "DeckFolder"("sortOrder");

-- Deck Template indexes
CREATE INDEX "DeckTemplate_userId_idx" ON "DeckTemplate"("userId");
CREATE INDEX "DeckTemplate_format_idx" ON "DeckTemplate"("format");
CREATE INDEX "DeckTemplate_archetype_idx" ON "DeckTemplate"("archetype");
CREATE INDEX "DeckTemplate_isPublic_idx" ON "DeckTemplate"("isPublic");
CREATE INDEX "DeckTemplate_usageCount_idx" ON "DeckTemplate"("usageCount");

-- Deck Folder Item indexes
CREATE INDEX "DeckFolderItem_folderId_idx" ON "DeckFolderItem"("folderId");
CREATE INDEX "DeckFolderItem_deckId_idx" ON "DeckFolderItem"("deckId");
CREATE INDEX "DeckFolderItem_sortOrder_idx" ON "DeckFolderItem"("sortOrder");

-- Enhanced Card Data indexes
CREATE INDEX "EnhancedCardData_cardId_idx" ON "EnhancedCardData"("cardId");
CREATE INDEX "EnhancedCardData_name_idx" ON "EnhancedCardData"("name");
CREATE INDEX "EnhancedCardData_cmc_idx" ON "EnhancedCardData"("cmc");
CREATE INDEX "EnhancedCardData_colors_idx" ON "EnhancedCardData" USING GIN("colors");
CREATE INDEX "EnhancedCardData_colorIdentity_idx" ON "EnhancedCardData" USING GIN("colorIdentity");
CREATE INDEX "EnhancedCardData_popularityScore_idx" ON "EnhancedCardData"("popularityScore");
CREATE INDEX "EnhancedCardData_currentPrice_idx" ON "EnhancedCardData"("currentPrice");
CREATE INDEX "EnhancedCardData_lastUpdated_idx" ON "EnhancedCardData"("lastUpdated");

-- Saved Card Search indexes
CREATE INDEX "SavedCardSearch_userId_idx" ON "SavedCardSearch"("userId");
CREATE INDEX "SavedCardSearch_isPublic_idx" ON "SavedCardSearch"("isPublic");
CREATE INDEX "SavedCardSearch_usageCount_idx" ON "SavedCardSearch"("usageCount");

-- Import Job indexes
CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");
CREATE INDEX "ImportJob_source_idx" ON "ImportJob"("source");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");

-- Export Job indexes
CREATE INDEX "ExportJob_userId_idx" ON "ExportJob"("userId");
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");
CREATE INDEX "ExportJob_createdAt_idx" ON "ExportJob"("createdAt");

-- Platform Adapter indexes
CREATE INDEX "PlatformAdapter_name_idx" ON "PlatformAdapter"("name");
CREATE INDEX "PlatformAdapter_type_idx" ON "PlatformAdapter"("type");
CREATE INDEX "PlatformAdapter_isActive_idx" ON "PlatformAdapter"("isActive");

-- Deck Analytics indexes
CREATE INDEX "DeckAnalytics_deckId_idx" ON "DeckAnalytics"("deckId");
CREATE INDEX "DeckAnalytics_analysisVersion_idx" ON "DeckAnalytics"("analysisVersion");
CREATE INDEX "DeckAnalytics_lastAnalyzed_idx" ON "DeckAnalytics"("lastAnalyzed");

-- Goldfish Simulation indexes
CREATE INDEX "GoldfishSimulation_deckId_idx" ON "GoldfishSimulation"("deckId");
CREATE INDEX "GoldfishSimulation_userId_idx" ON "GoldfishSimulation"("userId");
CREATE INDEX "GoldfishSimulation_createdAt_idx" ON "GoldfishSimulation"("createdAt");

-- Game Result indexes
CREATE INDEX "GameResult_userId_idx" ON "GameResult"("userId");
CREATE INDEX "GameResult_deckId_idx" ON "GameResult"("deckId");
CREATE INDEX "GameResult_result_idx" ON "GameResult"("result");
CREATE INDEX "GameResult_format_idx" ON "GameResult"("format");
CREATE INDEX "GameResult_playedAt_idx" ON "GameResult"("playedAt");

-- Public Deck indexes
CREATE INDEX "PublicDeck_deckId_idx" ON "PublicDeck"("deckId");
CREATE INDEX "PublicDeck_userId_idx" ON "PublicDeck"("userId");
CREATE INDEX "PublicDeck_format_idx" ON "PublicDeck"("format");
CREATE INDEX "PublicDeck_archetype_idx" ON "PublicDeck"("archetype");
CREATE INDEX "PublicDeck_views_idx" ON "PublicDeck"("views");
CREATE INDEX "PublicDeck_likes_idx" ON "PublicDeck"("likes");
CREATE INDEX "PublicDeck_rating_idx" ON "PublicDeck"("rating");
CREATE INDEX "PublicDeck_publishedAt_idx" ON "PublicDeck"("publishedAt");
CREATE INDEX "PublicDeck_isActive_idx" ON "PublicDeck"("isActive");

-- Deck Comment indexes
CREATE INDEX "DeckComment_publicDeckId_idx" ON "DeckComment"("publicDeckId");
CREATE INDEX "DeckComment_userId_idx" ON "DeckComment"("userId");
CREATE INDEX "DeckComment_parentId_idx" ON "DeckComment"("parentId");
CREATE INDEX "DeckComment_createdAt_idx" ON "DeckComment"("createdAt");
CREATE INDEX "DeckComment_isDeleted_idx" ON "DeckComment"("isDeleted");

-- User Profile indexes
CREATE INDEX "UserProfile_userId_idx" ON "UserProfile"("userId");
CREATE INDEX "UserProfile_username_idx" ON "UserProfile"("username");
CREATE INDEX "UserProfile_totalLikes_idx" ON "UserProfile"("totalLikes");
CREATE INDEX "UserProfile_followers_idx" ON "UserProfile"("followers");
CREATE INDEX "UserProfile_isPublic_idx" ON "UserProfile"("isPublic");
CREATE INDEX "UserProfile_lastActive_idx" ON "UserProfile"("lastActive");

-- User Follow indexes
CREATE INDEX "UserFollow_followerId_idx" ON "UserFollow"("followerId");
CREATE INDEX "UserFollow_followingId_idx" ON "UserFollow"("followingId");
CREATE INDEX "UserFollow_createdAt_idx" ON "UserFollow"("createdAt");

-- Deck Like indexes
CREATE INDEX "DeckLike_userId_idx" ON "DeckLike"("userId");
CREATE INDEX "DeckLike_publicDeckId_idx" ON "DeckLike"("publicDeckId");
CREATE INDEX "DeckLike_createdAt_idx" ON "DeckLike"("createdAt");

-- Comment Like indexes
CREATE INDEX "CommentLike_userId_idx" ON "CommentLike"("userId");
CREATE INDEX "CommentLike_commentId_idx" ON "CommentLike"("commentId");
CREATE INDEX "CommentLike_createdAt_idx" ON "CommentLike"("createdAt");

-- Trending Data indexes
CREATE INDEX "TrendingData_type_idx" ON "TrendingData"("type");
CREATE INDEX "TrendingData_itemId_idx" ON "TrendingData"("itemId");
CREATE INDEX "TrendingData_score_idx" ON "TrendingData"("score");
CREATE INDEX "TrendingData_timeframe_idx" ON "TrendingData"("timeframe");
CREATE INDEX "TrendingData_date_idx" ON "TrendingData"("date");

-- Performance Metric indexes
CREATE INDEX "PerformanceMetric_userId_idx" ON "PerformanceMetric"("userId");
CREATE INDEX "PerformanceMetric_operation_idx" ON "PerformanceMetric"("operation");
CREATE INDEX "PerformanceMetric_success_idx" ON "PerformanceMetric"("success");
CREATE INDEX "PerformanceMetric_timestamp_idx" ON "PerformanceMetric"("timestamp");

-- Cache Entry indexes
CREATE INDEX "CacheEntry_key_idx" ON "CacheEntry"("key");
CREATE INDEX "CacheEntry_tags_idx" ON "CacheEntry" USING GIN("tags");
CREATE INDEX "CacheEntry_expiresAt_idx" ON "CacheEntry"("expiresAt");
CREATE INDEX "CacheEntry_lastAccessed_idx" ON "CacheEntry"("lastAccessed");

-- Background Job indexes
CREATE INDEX "BackgroundJob_type_idx" ON "BackgroundJob"("type");
CREATE INDEX "BackgroundJob_status_idx" ON "BackgroundJob"("status");
CREATE INDEX "BackgroundJob_priority_idx" ON "BackgroundJob"("priority");
CREATE INDEX "BackgroundJob_scheduledFor_idx" ON "BackgroundJob"("scheduledFor");
CREATE INDEX "BackgroundJob_createdAt_idx" ON "BackgroundJob"("createdAt");

-- System Health indexes
CREATE INDEX "SystemHealth_component_idx" ON "SystemHealth"("component");
CREATE INDEX "SystemHealth_status_idx" ON "SystemHealth"("status");
CREATE INDEX "SystemHealth_timestamp_idx" ON "SystemHealth"("timestamp");

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Deck Folder constraints
ALTER TABLE "DeckFolder" ADD CONSTRAINT "DeckFolder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckFolder" ADD CONSTRAINT "DeckFolder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DeckFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deck Template constraints
ALTER TABLE "DeckTemplate" ADD CONSTRAINT "DeckTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deck Folder Item constraints
ALTER TABLE "DeckFolderItem" ADD CONSTRAINT "DeckFolderItem_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DeckFolder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckFolderItem" ADD CONSTRAINT "DeckFolderItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Saved Card Search constraints
ALTER TABLE "SavedCardSearch" ADD CONSTRAINT "SavedCardSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Import Job constraints
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Export Job constraints
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deck Analytics constraints
ALTER TABLE "DeckAnalytics" ADD CONSTRAINT "DeckAnalytics_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Goldfish Simulation constraints
ALTER TABLE "GoldfishSimulation" ADD CONSTRAINT "GoldfishSimulation_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GoldfishSimulation" ADD CONSTRAINT "GoldfishSimulation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Game Result constraints
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GameResult" ADD CONSTRAINT "GameResult_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Public Deck constraints
ALTER TABLE "PublicDeck" ADD CONSTRAINT "PublicDeck_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PublicDeck" ADD CONSTRAINT "PublicDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deck Comment constraints
ALTER TABLE "DeckComment" ADD CONSTRAINT "DeckComment_publicDeckId_fkey" FOREIGN KEY ("publicDeckId") REFERENCES "PublicDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckComment" ADD CONSTRAINT "DeckComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckComment" ADD CONSTRAINT "DeckComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DeckComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User Profile constraints
ALTER TABLE "UserProfile" ADD CONSTRAINT "UserProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- User Follow constraints
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserFollow" ADD CONSTRAINT "UserFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Deck Like constraints
ALTER TABLE "DeckLike" ADD CONSTRAINT "DeckLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DeckLike" ADD CONSTRAINT "DeckLike_publicDeckId_fkey" FOREIGN KEY ("publicDeckId") REFERENCES "PublicDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Comment Like constraints
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CommentLike" ADD CONSTRAINT "CommentLike_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "DeckComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Performance Metric constraints
ALTER TABLE "PerformanceMetric" ADD CONSTRAINT "PerformanceMetric_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- =====================================================
-- UNIQUE CONSTRAINTS
-- =====================================================

-- Ensure unique folder names per user at same level
CREATE UNIQUE INDEX "DeckFolder_userId_parentId_name_key" ON "DeckFolder"("userId", "parentId", "name") WHERE "parentId" IS NOT NULL;
CREATE UNIQUE INDEX "DeckFolder_userId_name_key" ON "DeckFolder"("userId", "name") WHERE "parentId" IS NULL;

-- Ensure unique deck-folder relationships
CREATE UNIQUE INDEX "DeckFolderItem_folderId_deckId_key" ON "DeckFolderItem"("folderId", "deckId");

-- Ensure unique card IDs in enhanced card data
CREATE UNIQUE INDEX "EnhancedCardData_cardId_key" ON "EnhancedCardData"("cardId");

-- Ensure unique usernames in profiles
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");
CREATE UNIQUE INDEX "UserProfile_userId_key" ON "UserProfile"("userId");

-- Ensure unique follows
CREATE UNIQUE INDEX "UserFollow_followerId_followingId_key" ON "UserFollow"("followerId", "followingId");

-- Ensure unique likes
CREATE UNIQUE INDEX "DeckLike_userId_publicDeckId_key" ON "DeckLike"("userId", "publicDeckId");
CREATE UNIQUE INDEX "CommentLike_userId_commentId_key" ON "CommentLike"("userId", "commentId");

-- Ensure unique cache keys
CREATE UNIQUE INDEX "CacheEntry_key_key" ON "CacheEntry"("key");

-- Ensure unique deck analytics per deck
CREATE UNIQUE INDEX "DeckAnalytics_deckId_key" ON "DeckAnalytics"("deckId");

-- Ensure unique public deck per deck
CREATE UNIQUE INDEX "PublicDeck_deckId_key" ON "PublicDeck"("deckId");