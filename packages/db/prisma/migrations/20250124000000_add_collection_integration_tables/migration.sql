-- CreateTable
CREATE TABLE "CardPriceHistory" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "source" TEXT NOT NULL,
    "condition" TEXT NOT NULL DEFAULT 'NM',
    "foil" BOOLEAN NOT NULL DEFAULT false,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "CardPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PriceAlert" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "targetPrice" DECIMAL(10,2) NOT NULL,
    "condition" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketIntelligence" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "currentPrice" DECIMAL(10,2),
    "priceHistory" JSONB,
    "volatility" DECIMAL(5,4),
    "metaShare" DECIMAL(5,4),
    "winRate" DECIMAL(5,4),
    "popularityTrend" TEXT,
    "tournamentResults" JSONB,
    "matchupData" JSONB,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketIntelligence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckMetaAnalysis" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'commander',
    "archetype" TEXT,
    "metaShare" DECIMAL(5,4),
    "winRate" DECIMAL(5,4),
    "popularityTrend" TEXT,
    "favorableMatchups" JSONB,
    "unfavorableMatchups" JSONB,
    "metaAdaptations" JSONB,
    "competitiveViability" DECIMAL(5,2),
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckMetaAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PopularityTrend" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "cardName" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'commander',
    "currentPopularity" DECIMAL(5,2),
    "previousPopularity" DECIMAL(5,2),
    "trend" TEXT NOT NULL,
    "trendStrength" DECIMAL(3,2),
    "playRate" DECIMAL(5,4),
    "winRate" DECIMAL(5,4),
    "timeframe" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PopularityTrend_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CardPriceHistory_cardId_idx" ON "CardPriceHistory"("cardId");

-- CreateIndex
CREATE INDEX "CardPriceHistory_date_idx" ON "CardPriceHistory"("date");

-- CreateIndex
CREATE INDEX "CardPriceHistory_source_idx" ON "CardPriceHistory"("source");

-- CreateIndex
CREATE INDEX "PriceAlert_userId_idx" ON "PriceAlert"("userId");

-- CreateIndex
CREATE INDEX "PriceAlert_cardId_idx" ON "PriceAlert"("cardId");

-- CreateIndex
CREATE INDEX "PriceAlert_isActive_idx" ON "PriceAlert"("isActive");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketIntelligence_cardId_key" ON "MarketIntelligence"("cardId");

-- CreateIndex
CREATE INDEX "MarketIntelligence_lastUpdated_idx" ON "MarketIntelligence"("lastUpdated");

-- CreateIndex
CREATE INDEX "DeckMetaAnalysis_deckId_idx" ON "DeckMetaAnalysis"("deckId");

-- CreateIndex
CREATE INDEX "DeckMetaAnalysis_format_idx" ON "DeckMetaAnalysis"("format");

-- CreateIndex
CREATE INDEX "DeckMetaAnalysis_archetype_idx" ON "DeckMetaAnalysis"("archetype");

-- CreateIndex
CREATE INDEX "DeckMetaAnalysis_analyzedAt_idx" ON "DeckMetaAnalysis"("analyzedAt");

-- CreateIndex
CREATE INDEX "PopularityTrend_cardId_idx" ON "PopularityTrend"("cardId");

-- CreateIndex
CREATE INDEX "PopularityTrend_format_idx" ON "PopularityTrend"("format");

-- CreateIndex
CREATE INDEX "PopularityTrend_trend_idx" ON "PopularityTrend"("trend");

-- CreateIndex
CREATE INDEX "PopularityTrend_date_idx" ON "PopularityTrend"("date");

-- CreateIndex
CREATE INDEX "PopularityTrend_timeframe_idx" ON "PopularityTrend"("timeframe");

-- AddForeignKey
ALTER TABLE "PriceAlert" ADD CONSTRAINT "PriceAlert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;