-- AlterTable User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerified" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

-- New users are unverified; existing rows stay verified from the default above.
ALTER TABLE "User" ALTER COLUMN "emailVerified" SET DEFAULT false;

-- AlterTable Organization
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "subscriptionPlan" TEXT NOT NULL DEFAULT 'FREE';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "subscriptionStatus" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;

-- CreateEnum (PostgreSQL)
DO $$ BEGIN
  CREATE TYPE "SubscriptionPlan" AS ENUM ('FREE', 'PRO');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('inactive', 'active', 'trialing', 'past_due', 'canceled');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Organization" ALTER COLUMN "subscriptionPlan" DROP DEFAULT;
ALTER TABLE "Organization" ALTER COLUMN "subscriptionStatus" DROP DEFAULT;

ALTER TABLE "Organization"
  ALTER COLUMN "subscriptionPlan" TYPE "SubscriptionPlan"
  USING ("subscriptionPlan"::"SubscriptionPlan");
ALTER TABLE "Organization"
  ALTER COLUMN "subscriptionStatus" TYPE "SubscriptionStatus"
  USING ("subscriptionStatus"::"SubscriptionStatus");

ALTER TABLE "Organization" ALTER COLUMN "subscriptionPlan" SET DEFAULT 'FREE';
ALTER TABLE "Organization" ALTER COLUMN "subscriptionStatus" SET DEFAULT 'active';

CREATE TABLE IF NOT EXISTS "EmailVerificationToken" (
  "id" SERIAL NOT NULL,
  "token" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "userId" INTEGER NOT NULL,
  CONSTRAINT "EmailVerificationToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EmailVerificationToken_token_key" ON "EmailVerificationToken"("token");
CREATE INDEX IF NOT EXISTS "EmailVerificationToken_userId_idx" ON "EmailVerificationToken"("userId");

DO $$ BEGIN
  ALTER TABLE "EmailVerificationToken"
    ADD CONSTRAINT "EmailVerificationToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "BillingCustomer" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "stripeCustomerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_organizationId_key" ON "BillingCustomer"("organizationId");

DO $$ BEGIN
  ALTER TABLE "BillingCustomer"
    ADD CONSTRAINT "BillingCustomer_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "BillingCheckoutSession" (
  "id" SERIAL NOT NULL,
  "organizationId" INTEGER NOT NULL,
  "userId" INTEGER NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'stub',
  "providerRef" TEXT NOT NULL,
  "plan" "SubscriptionPlan" NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'created',
  "url" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BillingCheckoutSession_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingCheckoutSession_organizationId_createdAt_idx"
  ON "BillingCheckoutSession"("organizationId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "BillingCheckoutSession"
    ADD CONSTRAINT "BillingCheckoutSession_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
