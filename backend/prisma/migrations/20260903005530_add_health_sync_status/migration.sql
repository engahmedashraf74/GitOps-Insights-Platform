-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "healthStatus" TEXT NOT NULL DEFAULT 'Healthy',
ADD COLUMN     "syncStatus" TEXT NOT NULL DEFAULT 'Synced';
