-- AlterTable
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "argoUid" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "namespace" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "cluster" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "healthStatus" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "revision" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "lastObservedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "Application_argoUid_idx" ON "Application"("argoUid");
CREATE INDEX IF NOT EXISTS "Application_name_idx" ON "Application"("name");

ALTER TABLE "Integration" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);
