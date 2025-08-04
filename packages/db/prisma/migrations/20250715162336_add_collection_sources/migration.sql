-- CreateTable
CREATE TABLE "CollectionSource" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "username" TEXT,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "metadata" JSONB,
    "lastSynced" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectionSource_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CollectionSource_userId_idx" ON "CollectionSource"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSource_userId_type_username_key" ON "CollectionSource"("userId", "type", "username");

-- AddForeignKey
ALTER TABLE "CollectionSource" ADD CONSTRAINT "CollectionSource_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
