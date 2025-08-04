-- CreateEnum
CREATE TYPE "BulkOperationType" AS ENUM ('import', 'export', 'delete', 'move', 'clone', 'tag', 'analyze', 'optimize', 'share', 'privacy');

-- CreateEnum
CREATE TYPE "BulkOperationStatus" AS ENUM ('pending', 'processing', 'completed', 'failed', 'cancelled');

-- CreateTable
CREATE TABLE "BulkOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "BulkOperationType" NOT NULL,
    "deckIds" TEXT[],
    "parameters" JSONB NOT NULL DEFAULT '{}',
    "status" "BulkOperationStatus" NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "canUndo" BOOLEAN NOT NULL DEFAULT false,
    "undoData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "BulkOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UndoOperation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "originalOperationId" TEXT NOT NULL,
    "operationType" "BulkOperationType" NOT NULL,
    "undoData" JSONB NOT NULL,
    "canRedo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UndoOperation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BulkOperation_userId_idx" ON "BulkOperation"("userId");

-- CreateIndex
CREATE INDEX "BulkOperation_status_idx" ON "BulkOperation"("status");

-- CreateIndex
CREATE INDEX "BulkOperation_type_idx" ON "BulkOperation"("type");

-- CreateIndex
CREATE INDEX "BulkOperation_createdAt_idx" ON "BulkOperation"("createdAt");

-- CreateIndex
CREATE INDEX "UndoOperation_userId_idx" ON "UndoOperation"("userId");

-- CreateIndex
CREATE INDEX "UndoOperation_originalOperationId_idx" ON "UndoOperation"("originalOperationId");

-- AddForeignKey
ALTER TABLE "BulkOperation" ADD CONSTRAINT "BulkOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UndoOperation" ADD CONSTRAINT "UndoOperation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UndoOperation" ADD CONSTRAINT "UndoOperation_originalOperationId_fkey" FOREIGN KEY ("originalOperationId") REFERENCES "BulkOperation"("id") ON DELETE CASCADE ON UPDATE CASCADE;