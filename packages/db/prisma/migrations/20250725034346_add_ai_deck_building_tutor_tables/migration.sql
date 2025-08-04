-- CreateTable
CREATE TABLE "GeneratedDeck" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commander" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'commander',
    "strategy" JSONB NOT NULL,
    "winConditions" JSONB NOT NULL,
    "powerLevel" INTEGER,
    "estimatedBudget" DECIMAL(10,2),
    "consultationData" JSONB NOT NULL,
    "generationPrompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'generated',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GeneratedDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneratedDeckCard" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "category" TEXT NOT NULL,
    "role" TEXT,
    "reasoning" TEXT,
    "alternatives" TEXT[],
    "upgradeOptions" TEXT[],
    "budgetOptions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneratedDeckCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckAnalysis" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "statistics" JSONB NOT NULL,
    "synergies" JSONB NOT NULL,
    "weaknesses" TEXT[],
    "strategyDescription" TEXT,
    "winConditionAnalysis" TEXT,
    "playPatternDescription" TEXT,
    "analyzedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "consultationData" JSONB NOT NULL,
    "currentStep" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "generatedDeckId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultationSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedDeck_userId_idx" ON "GeneratedDeck"("userId");

-- CreateIndex
CREATE INDEX "GeneratedDeck_sessionId_idx" ON "GeneratedDeck"("sessionId");

-- CreateIndex
CREATE INDEX "GeneratedDeck_status_idx" ON "GeneratedDeck"("status");

-- CreateIndex
CREATE INDEX "GeneratedDeck_createdAt_idx" ON "GeneratedDeck"("createdAt");

-- CreateIndex
CREATE INDEX "GeneratedDeckCard_deckId_idx" ON "GeneratedDeckCard"("deckId");

-- CreateIndex
CREATE INDEX "GeneratedDeckCard_cardId_idx" ON "GeneratedDeckCard"("cardId");

-- CreateIndex
CREATE INDEX "GeneratedDeckCard_category_idx" ON "GeneratedDeckCard"("category");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedDeckCard_deckId_cardId_key" ON "GeneratedDeckCard"("deckId", "cardId");

-- CreateIndex
CREATE UNIQUE INDEX "DeckAnalysis_deckId_key" ON "DeckAnalysis"("deckId");

-- CreateIndex
CREATE INDEX "DeckAnalysis_deckId_idx" ON "DeckAnalysis"("deckId");

-- CreateIndex
CREATE INDEX "DeckAnalysis_analyzedAt_idx" ON "DeckAnalysis"("analyzedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSession_sessionId_key" ON "ConsultationSession"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultationSession_generatedDeckId_key" ON "ConsultationSession"("generatedDeckId");

-- CreateIndex
CREATE INDEX "ConsultationSession_userId_idx" ON "ConsultationSession"("userId");

-- CreateIndex
CREATE INDEX "ConsultationSession_sessionId_idx" ON "ConsultationSession"("sessionId");

-- CreateIndex
CREATE INDEX "ConsultationSession_completed_idx" ON "ConsultationSession"("completed");

-- CreateIndex
CREATE INDEX "ConsultationSession_createdAt_idx" ON "ConsultationSession"("createdAt");

-- AddForeignKey
ALTER TABLE "GeneratedDeck" ADD CONSTRAINT "GeneratedDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedDeckCard" ADD CONSTRAINT "GeneratedDeckCard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "GeneratedDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeckAnalysis" ADD CONSTRAINT "DeckAnalysis_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "GeneratedDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSession" ADD CONSTRAINT "ConsultationSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationSession" ADD CONSTRAINT "ConsultationSession_generatedDeckId_fkey" FOREIGN KEY ("generatedDeckId") REFERENCES "GeneratedDeck"("id") ON DELETE SET NULL ON UPDATE CASCADE;
