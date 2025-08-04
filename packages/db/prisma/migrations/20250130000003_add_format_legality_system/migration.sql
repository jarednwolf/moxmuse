-- CreateTable
CREATE TABLE "FormatRules" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "deckSizeMin" INTEGER NOT NULL,
    "deckSizeMax" INTEGER NOT NULL,
    "sideboardSizeMin" INTEGER NOT NULL DEFAULT 0,
    "sideboardSizeMax" INTEGER NOT NULL DEFAULT 15,
    "defaultCardLimit" INTEGER NOT NULL DEFAULT 4,
    "cardLimitExceptions" JSONB NOT NULL DEFAULT '{}',
    "bannedCards" TEXT[],
    "restrictedCards" TEXT[],
    "specialRules" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormatRules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardLegality" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "scryfallId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalities" JSONB NOT NULL DEFAULT '{}',
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardLegality_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BannedListUpdate" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "updateType" TEXT NOT NULL,
    "cards" JSONB NOT NULL DEFAULT '[]',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "announcementDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BannedListUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormatRotation" (
    "id" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "rotationType" TEXT NOT NULL,
    "rotatingOut" JSONB NOT NULL DEFAULT '[]',
    "rotatingIn" JSONB NOT NULL DEFAULT '[]',
    "nextRotationDate" TIMESTAMP(3),
    "lastUpdated" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormatRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeckValidation" (
    "id" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "isValid" BOOLEAN NOT NULL,
    "violations" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "suggestions" JSONB NOT NULL DEFAULT '[]',
    "validatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validationVersion" TEXT NOT NULL DEFAULT '1.0',

    CONSTRAINT "DeckValidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFormat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" JSONB NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalityNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "cardId" TEXT,
    "cardName" TEXT,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalityNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormatRules_format_key" ON "FormatRules"("format");

-- CreateIndex
CREATE INDEX "FormatRules_format_idx" ON "FormatRules"("format");

-- CreateIndex
CREATE INDEX "FormatRules_isActive_idx" ON "FormatRules"("isActive");

-- CreateIndex
CREATE INDEX "FormatRules_lastUpdated_idx" ON "FormatRules"("lastUpdated");

-- CreateIndex
CREATE UNIQUE INDEX "CardLegality_cardId_key" ON "CardLegality"("cardId");

-- CreateIndex
CREATE UNIQUE INDEX "CardLegality_scryfallId_key" ON "CardLegality"("scryfallId");

-- CreateIndex
CREATE INDEX "CardLegality_cardId_idx" ON "CardLegality"("cardId");

-- CreateIndex
CREATE INDEX "CardLegality_scryfallId_idx" ON "CardLegality"("scryfallId");

-- CreateIndex
CREATE INDEX "CardLegality_name_idx" ON "CardLegality"("name");

-- CreateIndex
CREATE INDEX "CardLegality_lastUpdated_idx" ON "CardLegality"("lastUpdated");

-- CreateIndex
CREATE INDEX "BannedListUpdate_format_idx" ON "BannedListUpdate"("format");

-- CreateIndex
CREATE INDEX "BannedListUpdate_updateType_idx" ON "BannedListUpdate"("updateType");

-- CreateIndex
CREATE INDEX "BannedListUpdate_effectiveDate_idx" ON "BannedListUpdate"("effectiveDate");

-- CreateIndex
CREATE INDEX "BannedListUpdate_isActive_idx" ON "BannedListUpdate"("isActive");

-- CreateIndex
CREATE INDEX "BannedListUpdate_createdAt_idx" ON "BannedListUpdate"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FormatRotation_format_key" ON "FormatRotation"("format");

-- CreateIndex
CREATE INDEX "FormatRotation_format_idx" ON "FormatRotation"("format");

-- CreateIndex
CREATE INDEX "FormatRotation_rotationType_idx" ON "FormatRotation"("rotationType");

-- CreateIndex
CREATE INDEX "FormatRotation_nextRotationDate_idx" ON "FormatRotation"("nextRotationDate");

-- CreateIndex
CREATE INDEX "FormatRotation_lastUpdated_idx" ON "FormatRotation"("lastUpdated");

-- CreateIndex
CREATE INDEX "DeckValidation_deckId_idx" ON "DeckValidation"("deckId");

-- CreateIndex
CREATE INDEX "DeckValidation_format_idx" ON "DeckValidation"("format");

-- CreateIndex
CREATE INDEX "DeckValidation_isValid_idx" ON "DeckValidation"("isValid");

-- CreateIndex
CREATE INDEX "DeckValidation_validatedAt_idx" ON "DeckValidation"("validatedAt");

-- CreateIndex
CREATE INDEX "CustomFormat_userId_idx" ON "CustomFormat"("userId");

-- CreateIndex
CREATE INDEX "CustomFormat_name_idx" ON "CustomFormat"("name");

-- CreateIndex
CREATE INDEX "CustomFormat_isPublic_idx" ON "CustomFormat"("isPublic");

-- CreateIndex
CREATE INDEX "CustomFormat_usageCount_idx" ON "CustomFormat"("usageCount");

-- CreateIndex
CREATE INDEX "CustomFormat_createdAt_idx" ON "CustomFormat"("createdAt");

-- CreateIndex
CREATE INDEX "LegalityNotification_userId_idx" ON "LegalityNotification"("userId");

-- CreateIndex
CREATE INDEX "LegalityNotification_type_idx" ON "LegalityNotification"("type");

-- CreateIndex
CREATE INDEX "LegalityNotification_format_idx" ON "LegalityNotification"("format");

-- CreateIndex
CREATE INDEX "LegalityNotification_isRead_idx" ON "LegalityNotification"("isRead");

-- CreateIndex
CREATE INDEX "LegalityNotification_createdAt_idx" ON "LegalityNotification"("createdAt");

-- AddForeignKey
ALTER TABLE "CustomFormat" ADD CONSTRAINT "CustomFormat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalityNotification" ADD CONSTRAINT "LegalityNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE;