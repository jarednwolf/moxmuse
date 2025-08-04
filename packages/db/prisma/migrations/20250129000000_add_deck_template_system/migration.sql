-- CreateTable
CREATE TABLE "DeckTemplateVersion" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "changes" TEXT NOT NULL,
    "categories" JSONB NOT NULL DEFAULT '[]',
    "coreCards" JSONB NOT NULL DEFAULT '[]',
    "flexSlots" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeckTemplateVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplateRating" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplateRating_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeckTemplateVersion_templateId_version_key" ON "DeckTemplateVersion"("templateId", "version");

-- CreateIndex
CREATE INDEX "DeckTemplateVersion_templateId_idx" ON "DeckTemplateVersion"("templateId");

-- CreateIndex
CREATE INDEX "DeckTemplateVersion_createdAt_idx" ON "DeckTemplateVersion"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TemplateRating_userId_templateId_key" ON "TemplateRating"("userId", "templateId");

-- CreateIndex
CREATE INDEX "TemplateRating_userId_idx" ON "TemplateRating"("userId");

-- CreateIndex
CREATE INDEX "TemplateRating_templateId_idx" ON "TemplateRating"("templateId");

-- CreateIndex
CREATE INDEX "TemplateRating_rating_idx" ON "TemplateRating"("rating");

-- CreateIndex
CREATE INDEX "TemplateRating_createdAt_idx" ON "TemplateRating"("createdAt");

-- AddForeignKey
ALTER TABLE "DeckTemplateVersion" ADD CONSTRAINT "DeckTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DeckTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRating" ADD CONSTRAINT "TemplateRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplateRating" ADD CONSTRAINT "TemplateRating_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "DeckTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;