-- CreateEnum
CREATE TYPE "ExportJobStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "ExportJobType" AS ENUM ('single', 'batch', 'bulk', 'scheduled');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('text', 'json', 'moxfield', 'archidekt', 'tappedout', 'edhrec', 'mtggoldfish', 'csv', 'tournament', 'proxy', 'custom');

-- CreateEnum
CREATE TYPE "CompressionType" AS ENUM ('none', 'zip', 'gzip');

-- CreateTable
CREATE TABLE "ExportJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ExportJobType" NOT NULL DEFAULT 'single',
    "format" "ExportFormat" NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 0,
    
    -- Input data
    "deckIds" TEXT[] NOT NULL,
    "customFormatId" TEXT,
    
    -- Export configuration
    "options" JSONB NOT NULL DEFAULT '{}',
    "compression" "CompressionType" NOT NULL DEFAULT 'none',
    "includeMetadata" BOOLEAN NOT NULL DEFAULT true,
    "includeAnalysis" BOOLEAN NOT NULL DEFAULT false,
    "includePricing" BOOLEAN NOT NULL DEFAULT false,
    "includeAIInsights" BOOLEAN NOT NULL DEFAULT false,
    
    -- Progress tracking
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStep" TEXT,
    "totalSteps" INTEGER,
    "estimatedTimeRemaining" INTEGER,
    
    -- Results
    "decksProcessed" INTEGER DEFAULT 0,
    "totalDecks" INTEGER DEFAULT 0,
    "fileSize" INTEGER,
    "downloadUrl" TEXT,
    "fileName" TEXT,
    "mimeType" TEXT,
    "expiresAt" TIMESTAMP(3),
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    
    -- Metadata
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingTime" INTEGER,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "nextRetryAt" TIMESTAMP(3),
    
    -- Scheduling
    "scheduledFor" TIMESTAMP(3),
    "cronExpression" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportJobItem" (
    "id" TEXT NOT NULL,
    "exportJobId" TEXT NOT NULL,
    "deckId" TEXT NOT NULL,
    "itemIndex" INTEGER NOT NULL,
    "status" "ExportJobStatus" NOT NULL DEFAULT 'pending',
    
    -- Processing results
    "deckName" TEXT,
    "cardsExported" INTEGER DEFAULT 0,
    "fileSize" INTEGER,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "warnings" JSONB NOT NULL DEFAULT '[]',
    
    -- Timing
    "processingStartedAt" TIMESTAMP(3),
    "processingCompletedAt" TIMESTAMP(3),
    "processingTime" INTEGER,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportJobItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomFormat" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fileExtension" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "template" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "validation" JSONB NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "format" "ExportFormat" NOT NULL,
    "template" JSONB NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "rating" DECIMAL(3,2) DEFAULT 0,
    "ratingCount" INTEGER NOT NULL DEFAULT 0,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exportJobId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "fileSize" INTEGER,
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadAt" TIMESTAMP(3),
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportAnalytics" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "jobType" "ExportJobType" NOT NULL,
    "status" "ExportJobStatus" NOT NULL,
    "decksCount" INTEGER NOT NULL DEFAULT 0,
    "cardsCount" INTEGER NOT NULL DEFAULT 0,
    "processingTime" INTEGER,
    "fileSize" INTEGER,
    "compressionRatio" DECIMAL(5,2),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "warningCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DECIMAL(5,2),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExportAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExportSchedule" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "deckIds" TEXT[] NOT NULL,
    "format" "ExportFormat" NOT NULL,
    "customFormatId" TEXT,
    "options" JSONB NOT NULL DEFAULT '{}',
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "runCount" INTEGER NOT NULL DEFAULT 0,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "maxFailures" INTEGER NOT NULL DEFAULT 5,
    "notifyOnSuccess" BOOLEAN NOT NULL DEFAULT false,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "retentionDays" INTEGER NOT NULL DEFAULT 30,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExportSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormatRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "customFormatId" TEXT,
    "exportTemplateId" TEXT,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    
    -- Timestamps
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormatRating_pkey" PRIMARY KEY ("id")
);

-- Add foreign key constraints
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportJob" ADD CONSTRAINT "ExportJob_customFormatId_fkey" FOREIGN KEY ("customFormatId") REFERENCES "CustomFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExportJobItem" ADD CONSTRAINT "ExportJobItem_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "ExportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportJobItem" ADD CONSTRAINT "ExportJobItem_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "Deck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFormat" ADD CONSTRAINT "CustomFormat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportTemplate" ADD CONSTRAINT "ExportTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportHistory" ADD CONSTRAINT "ExportHistory_exportJobId_fkey" FOREIGN KEY ("exportJobId") REFERENCES "ExportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportAnalytics" ADD CONSTRAINT "ExportAnalytics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExportSchedule" ADD CONSTRAINT "ExportSchedule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExportSchedule" ADD CONSTRAINT "ExportSchedule_customFormatId_fkey" FOREIGN KEY ("customFormatId") REFERENCES "CustomFormat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FormatRating" ADD CONSTRAINT "FormatRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormatRating" ADD CONSTRAINT "FormatRating_customFormatId_fkey" FOREIGN KEY ("customFormatId") REFERENCES "CustomFormat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FormatRating" ADD CONSTRAINT "FormatRating_exportTemplateId_fkey" FOREIGN KEY ("exportTemplateId") REFERENCES "ExportTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for performance
CREATE INDEX "ExportJob_userId_idx" ON "ExportJob"("userId");
CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");
CREATE INDEX "ExportJob_format_idx" ON "ExportJob"("format");
CREATE INDEX "ExportJob_createdAt_idx" ON "ExportJob"("createdAt");
CREATE INDEX "ExportJob_priority_status_idx" ON "ExportJob"("priority", "status");
CREATE INDEX "ExportJob_scheduledFor_idx" ON "ExportJob"("scheduledFor");
CREATE INDEX "ExportJob_nextRunAt_idx" ON "ExportJob"("nextRunAt");

CREATE INDEX "ExportJobItem_exportJobId_idx" ON "ExportJobItem"("exportJobId");
CREATE INDEX "ExportJobItem_deckId_idx" ON "ExportJobItem"("deckId");
CREATE INDEX "ExportJobItem_status_idx" ON "ExportJobItem"("status");

CREATE INDEX "CustomFormat_userId_idx" ON "CustomFormat"("userId");
CREATE INDEX "CustomFormat_isPublic_idx" ON "CustomFormat"("isPublic");
CREATE INDEX "CustomFormat_rating_idx" ON "CustomFormat"("rating");
CREATE INDEX "CustomFormat_usageCount_idx" ON "CustomFormat"("usageCount");

CREATE INDEX "ExportTemplate_userId_idx" ON "ExportTemplate"("userId");
CREATE INDEX "ExportTemplate_format_idx" ON "ExportTemplate"("format");
CREATE INDEX "ExportTemplate_isPublic_idx" ON "ExportTemplate"("isPublic");

CREATE INDEX "ExportHistory_userId_idx" ON "ExportHistory"("userId");
CREATE INDEX "ExportHistory_exportJobId_idx" ON "ExportHistory"("exportJobId");
CREATE INDEX "ExportHistory_createdAt_idx" ON "ExportHistory"("createdAt");

CREATE INDEX "ExportAnalytics_userId_idx" ON "ExportAnalytics"("userId");
CREATE INDEX "ExportAnalytics_format_idx" ON "ExportAnalytics"("format");
CREATE INDEX "ExportAnalytics_createdAt_idx" ON "ExportAnalytics"("createdAt");

CREATE INDEX "ExportSchedule_userId_idx" ON "ExportSchedule"("userId");
CREATE INDEX "ExportSchedule_isActive_idx" ON "ExportSchedule"("isActive");
CREATE INDEX "ExportSchedule_nextRunAt_idx" ON "ExportSchedule"("nextRunAt");

CREATE INDEX "FormatRating_userId_idx" ON "FormatRating"("userId");
CREATE INDEX "FormatRating_customFormatId_idx" ON "FormatRating"("customFormatId");
CREATE INDEX "FormatRating_exportTemplateId_idx" ON "FormatRating"("exportTemplateId");

-- Create unique constraints
ALTER TABLE "FormatRating" ADD CONSTRAINT "FormatRating_userId_customFormatId_key" UNIQUE ("userId", "customFormatId");
ALTER TABLE "FormatRating" ADD CONSTRAINT "FormatRating_userId_exportTemplateId_key" UNIQUE ("userId", "exportTemplateId");