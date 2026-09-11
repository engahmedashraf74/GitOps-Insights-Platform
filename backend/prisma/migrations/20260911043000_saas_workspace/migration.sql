-- CreateEnum
CREATE TYPE "OrgRole" AS ENUM ('owner', 'admin', 'member');

-- CreateEnum
CREATE TYPE "IntegrationProvider" AS ENUM ('argocd', 'github', 'gitlab', 'bitbucket', 'slack');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('connected', 'disconnected', 'coming_soon');

-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "username" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- CreateTable Organization
CREATE TABLE IF NOT EXISTS "Organization" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" INTEGER,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Organization_slug_key" ON "Organization"("slug");

-- CreateTable OrganizationMember
CREATE TABLE IF NOT EXISTS "OrganizationMember" (
    "id" SERIAL NOT NULL,
    "role" "OrgRole" NOT NULL DEFAULT 'owner',
    "organizationId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");
CREATE INDEX IF NOT EXISTS "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateTable UserPreference
CREATE TABLE IF NOT EXISTS "UserPreference" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'dark',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "defaultProjectId" INTEGER,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT true,
    "deploymentFailures" BOOLEAN NOT NULL DEFAULT true,
    "weeklySummary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "UserPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPreference_userId_key" ON "UserPreference"("userId");

-- AlterTable Project
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "organizationId" INTEGER;
ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Project_organizationId_idx" ON "Project"("organizationId");
CREATE INDEX IF NOT EXISTS "Project_userId_idx" ON "Project"("userId");

-- AlterTable Application
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE INDEX IF NOT EXISTS "Application_projectId_idx" ON "Application"("projectId");

-- AlterTable Environment
CREATE INDEX IF NOT EXISTS "Environment_applicationId_idx" ON "Environment"("applicationId");

-- AlterTable Deployment
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "commitSha" TEXT;
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "committedAt" TIMESTAMP(3);
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);
ALTER TABLE "Deployment" ADD COLUMN IF NOT EXISTS "environmentId" INTEGER;
CREATE INDEX IF NOT EXISTS "Deployment_applicationId_idx" ON "Deployment"("applicationId");
CREATE INDEX IF NOT EXISTS "Deployment_deployedAt_idx" ON "Deployment"("deployedAt");
CREATE INDEX IF NOT EXISTS "Deployment_status_idx" ON "Deployment"("status");

-- CreateTable Integration
CREATE TABLE IF NOT EXISTS "Integration" (
    "id" SERIAL NOT NULL,
    "provider" "IntegrationProvider" NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'disconnected',
    "url" TEXT,
    "credentialsEncrypted" TEXT,
    "organizationId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Integration_organizationId_provider_key" ON "Integration"("organizationId", "provider");

-- CreateTable Notification
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "href" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'info',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organizationId" INTEGER NOT NULL,
    "applicationId" INTEGER,
    "actorUserId" INTEGER,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Notification_organizationId_createdAt_idx" ON "Notification"("organizationId", "createdAt");

-- CreateTable ApplicationEvent
CREATE TABLE IF NOT EXISTS "ApplicationEvent" (
    "id" SERIAL NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applicationId" INTEGER NOT NULL,

    CONSTRAINT "ApplicationEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ApplicationEvent_applicationId_createdAt_idx" ON "ApplicationEvent"("applicationId", "createdAt");

-- Backfill one organization per existing user
INSERT INTO "Organization" ("name", "slug", "createdById", "createdAt", "updatedAt")
SELECT
  'Platform workspace',
  'org-' || "id",
  "id",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "User"
WHERE NOT EXISTS (
  SELECT 1 FROM "Organization" o WHERE o."createdById" = "User"."id"
);

INSERT INTO "OrganizationMember" ("role", "organizationId", "userId", "createdAt")
SELECT
  'owner'::"OrgRole",
  o."id",
  u."id",
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Organization" o ON o."createdById" = u."id"
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationMember" m
  WHERE m."userId" = u."id" AND m."organizationId" = o."id"
);

INSERT INTO "UserPreference" ("userId")
SELECT u."id" FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "UserPreference" p WHERE p."userId" = u."id"
);

UPDATE "Project" p
SET "organizationId" = o."id"
FROM "Organization" o
WHERE p."userId" = o."createdById"
  AND p."organizationId" IS NULL;

-- Foreign keys
ALTER TABLE "Organization" DROP CONSTRAINT IF EXISTS "Organization_createdById_fkey";
ALTER TABLE "Organization"
  ADD CONSTRAINT "Organization_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember" DROP CONSTRAINT IF EXISTS "OrganizationMember_organizationId_fkey";
ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OrganizationMember" DROP CONSTRAINT IF EXISTS "OrganizationMember_userId_fkey";
ALTER TABLE "OrganizationMember"
  ADD CONSTRAINT "OrganizationMember_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserPreference" DROP CONSTRAINT IF EXISTS "UserPreference_userId_fkey";
ALTER TABLE "UserPreference"
  ADD CONSTRAINT "UserPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Project" DROP CONSTRAINT IF EXISTS "Project_organizationId_fkey";
ALTER TABLE "Project"
  ADD CONSTRAINT "Project_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Deployment" DROP CONSTRAINT IF EXISTS "Deployment_environmentId_fkey";
ALTER TABLE "Deployment"
  ADD CONSTRAINT "Deployment_environmentId_fkey"
  FOREIGN KEY ("environmentId") REFERENCES "Environment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Integration" DROP CONSTRAINT IF EXISTS "Integration_organizationId_fkey";
ALTER TABLE "Integration"
  ADD CONSTRAINT "Integration_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_organizationId_fkey";
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_applicationId_fkey";
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_actorUserId_fkey";
ALTER TABLE "Notification"
  ADD CONSTRAINT "Notification_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ApplicationEvent" DROP CONSTRAINT IF EXISTS "ApplicationEvent_applicationId_fkey";
ALTER TABLE "ApplicationEvent"
  ADD CONSTRAINT "ApplicationEvent_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
