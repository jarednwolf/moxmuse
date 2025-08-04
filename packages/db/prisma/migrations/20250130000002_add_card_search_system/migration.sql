-- CreateTable
CREATE TABLE "SavedSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "query" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT[],
    "useCount" INTEGER NOT NULL DEFAULT 0,
    "lastUsed" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchAnalytics" (
    "id" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "clickThroughRate" DECIMAL(5,4) NOT NULL DEFAULT 0,
    "averagePosition" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "searchTime" INTEGER NOT NULL,
    "userId" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardClick" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardClick_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnhancedCard" (
    "id" TEXT NOT NULL,
    "scryfallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "edhrecRank" INTEGER,
    "popularityScore" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "synergyTags" TEXT[],
    "priceHistory" JSONB NOT NULL DEFAULT '[]',
    "rulings" JSONB NOT NULL DEFAULT '[]',
    "relatedCards" JSONB NOT NULL DEFAULT '[]',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EnhancedCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedSearch_userId_idx" ON "SavedSearch"("userId");

-- CreateIndex
CREATE INDEX "SavedSearch_isPublic_idx" ON "SavedSearch"("isPublic");

-- CreateIndex
CREATE INDEX "SavedSearch_useCount_idx" ON "SavedSearch"("useCount");

-- CreateIndex
CREATE INDEX "SavedSearch_createdAt_idx" ON "SavedSearch"("createdAt");

-- CreateIndex
CREATE INDEX "SavedSearch_lastUsed_idx" ON "SavedSearch"("lastUsed");

-- CreateIndex
CREATE INDEX "SearchHistory_userId_idx" ON "SearchHistory"("userId");

-- CreateIndex
CREATE INDEX "SearchHistory_timestamp_idx" ON "SearchHistory"("timestamp");

-- CreateIndex
CREATE INDEX "SearchAnalytics_userId_idx" ON "SearchAnalytics"("userId");

-- CreateIndex
CREATE INDEX "SearchAnalytics_timestamp_idx" ON "SearchAnalytics"("timestamp");

-- CreateIndex
CREATE INDEX "SearchAnalytics_query_idx" ON "SearchAnalytics"("query");

-- CreateIndex
CREATE INDEX "CardClick_userId_idx" ON "CardClick"("userId");

-- CreateIndex
CREATE INDEX "CardClick_cardId_idx" ON "CardClick"("cardId");

-- CreateIndex
CREATE INDEX "CardClick_timestamp_idx" ON "CardClick"("timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "EnhancedCard_scryfallId_key" ON "EnhancedCard"("scryfallId");

-- CreateIndex
CREATE INDEX "EnhancedCard_scryfallId_idx" ON "EnhancedCard"("scryfallId");

-- CreateIndex
CREATE INDEX "EnhancedCard_name_idx" ON "EnhancedCard"("name");

-- CreateIndex
CREATE INDEX "EnhancedCard_edhrecRank_idx" ON "EnhancedCard"("edhrecRank");

-- CreateIndex
CREATE INDEX "EnhancedCard_popularityScore_idx" ON "EnhancedCard"("popularityScore");

-- CreateIndex
CREATE INDEX "EnhancedCard_lastUpdated_idx" ON "EnhancedCard"("lastUpdated");

-- AddForeignKey
ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchHistory" ADD CONSTRAINT "SearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "SearchAnalytics" ADD CONSTRAINT "SearchAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL;

-- AddForeignKey
ALTER TABLE "CardClick" ADD CONSTRAINT "CardClick_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;