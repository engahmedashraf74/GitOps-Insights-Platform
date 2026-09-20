-- Persist cancel-at-period-end for Billing V1 portal / renewal display
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false;
