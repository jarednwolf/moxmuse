-- CreateTable
CREATE TABLE "SavedDeckSearch" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedDeckSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckSearchHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "query" JSONB NOT NULL,
    "resultCount" INTEGER NOT NULL,
    "searchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckSearchHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchIndex" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "searchableText" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "popularity" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SearchIndex_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SavedDeckSearch_userId_idx" ON "SavedDeckSearch"("userId");

-- CreateIndex
CREATE INDEX "SavedDeckSearch_isPublic_idx" ON "SavedDeckSearch"("isPublic");

-- CreateIndex
CREATE INDEX "SavedDeckSearch_usageCount_idx" ON "SavedDeckSearch"("usageCount");

-- CreateIndex
CREATE INDEX "SavedDeckSearch_createdAt_idx" ON "SavedDeckSearch"("createdAt");

-- CreateIndex
CREATE INDEX "DeckSearchHistory_userId_idx" ON "DeckSearchHistory"("userId");

-- CreateIndex
CREATE INDEX "DeckSearchHistory_searchedAt_idx" ON "DeckSearchHistory"("searchedAt");

-- CreateIndex
CREATE INDEX "SearchIndex_type_idx" ON "SearchIndex"("type");

-- CreateIndex
CREATE INDEX "SearchIndex_itemId_idx" ON "SearchIndex"("itemId");

-- CreateIndex
CREATE INDEX "SearchIndex_searchableText_idx" ON "SearchIndex"("searchableText");

-- CreateIndex
CREATE INDEX "SearchIndex_popularity_idx" ON "SearchIndex"("popularity");

-- CreateIndex
CREATE INDEX "SearchIndex_lastUpdated_idx" ON "SearchIndex"("lastUpdated");

-- AddForeignKey
ALTER TABLE "SavedDeckSearch" ADD CONSTRAINT "SavedDeckSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckSearchHistory" ADD CONSTRAINT "DeckSearchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;