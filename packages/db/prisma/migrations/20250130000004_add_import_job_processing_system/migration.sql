-- CreateEnum
CREATE TYPE "ImportJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ImportJobType" AS ENUM ('single', 'batch', 'bulk');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('moxfield', 'archidekt', 'tappedout', 'edhrec', 'mtggoldfish', 'csv', 'text', 'custom');

-- CreateEnum
CREATE TYPE "ConflictResolution" AS ENUM ('skip', 'overwrite', 'merge', 'rename', 'ask_user');

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ImportJobType" NOT NULL DEFAULT 'single',
    "source" "ImportSource" NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    
    -- Input data
    "rawData" TEXT,
    "sourceUrl" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    
    -- Processing configuration
    "options" JSONB NOT NULL DEFAULT '{}',
    "conflictResolution" "ConflictResolution" NOT NULL DEFAULT 'ask_user',
    
    -- Progress tracking
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "totalSteps" INTEGER,
    "estimatedTimeRemaining" INTEGER,
    
    -- Results
    "decksFound" INTEGER DEFAULT 0,
    "decksImported" INTEGER DEFAULT 0,
    "cardsProcessed" INTEGER DEFAULT 0,
    "cardsResolved" INTEGER DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    
    -- Metadata
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingTime" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJobItem" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "itemIndex" INTEGER NOT NULL,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'pending',
    
    -- Input data for this item
    "rawData" TEXT NOT NULL,
    "sourceIdentifier" TEXT,
    
    -- Processing results
    "deckId" TEXT,
    "deckName" TEXT,
    "cardsFound" INTEGER DEFAULT 0,
    "cardsImported" INTEGER DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    
    -- Timing
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingTime" INTEGER,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportConflict" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "itemId" TEXT,
    "conflictType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "existingData" JSONB,
    "newData" JSONB,
    "resolution" "ConflictResolution",
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportPreview" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "previewData" JSONB NOT NULL,
    "decksPreview" JSONB NOT NULL DEFAULT '[]',
    "statistics" JSONB NOT NULL DEFAULT '{}',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "conflicts" JSONB NOT NULL DEFAULT '[]',
    "isApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportPreview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "canRollback" BOOLEAN NOT NULL DEFAULT false,
    "rollbackData" JSONB,
    "rolledBackAt" TIMESTAMP(3),
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "jobType" "ImportJobType" NOT NULL,
    "status" "ImportJobStatus" NOT NULL,
    "decksCount" INTEGER NOT NULL DEFAULT 0,
    "cardsCount" INTEGER NOT NULL DEFAULT 0,
    "processingTime" INTEGER,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DECIMAL(5,2),
    "fileSize" INTEGER,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "source" "ImportSource" NOT NULL,
    "template" JSONB NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportTemplate_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportJobItem" ADD CONSTRAINT "ImportJobItem_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportJobItem" ADD CONSTRAINT "ImportJobItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportConflict" ADD CONSTRAINT "ImportConflict_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportConflict" ADD CONSTRAINT "ImportConflict_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ImportJobItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportPreview" ADD CONSTRAINT "ImportPreview_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportHistory" ADD CONSTRAINT "ImportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportHistory" ADD CONSTRAINT "ImportHistory_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportAnalytics" ADD CONSTRAINT "ImportAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ImportTemplate" ADD CONSTRAINT "ImportTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX "ImportJob_userId_idx" ON "ImportJob"("userId");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
CREATE INDEX "ImportJob_source_idx" ON "ImportJob"("source");
CREATE INDEX "ImportJob_createdAt_idx" ON "ImportJob"("createdAt");
CREATE INDEX "ImportJob_priority_status_idx" ON "ImportJob"("priority", "status");

CREATE INDEX "ImportJobItem_importJobId_idx" ON "ImportJobItem"("importJobId");
CREATE INDEX "ImportJobItem_status_idx" ON "ImportJobItem"("status");
CREATE INDEX "ImportJobItem_deckId_idx" ON "ImportJobItem"("deckId");

CREATE INDEX "ImportConflict_importJobId_idx" ON "ImportConflict"("importJobId");
CREATE INDEX "ImportConflict_resolution_idx" ON "ImportConflict"("resolution");

CREATE INDEX "ImportPreview_importJobId_idx" ON "ImportPreview"("importJobId");
CREATE INDEX "ImportPreview_expiresAt_idx" ON "ImportPreview"("expiresAt");

CREATE INDEX "ImportHistory_userId_idx" ON "ImportHistory"("userId");
CREATE INDEX "ImportHistory_importJobId_idx" ON "ImportHistory"("importJobId");
CREATE INDEX "ImportHistory_createdAt_idx" ON "ImportHistory"("createdAt");

CREATE INDEX "ImportAnalytics_userId_idx" ON "ImportAnalytics"("userId");
CREATE INDEX "ImportAnalytics_source_idx" ON "ImportAnalytics"("source");
CREATE INDEX "ImportAnalytics_createdAt_idx" ON "ImportAnalytics"("createdAt");

CREATE INDEX "ImportTemplate_userId_idx" ON "ImportTemplate"("userId");
CREATE INDEX "ImportTemplate_source_idx" ON "ImportTemplate"("source");
CREATE INDEX "ImportTemplate_isPublic_idx" ON "ImportTemplate"("isPublic");