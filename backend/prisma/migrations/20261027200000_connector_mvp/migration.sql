-- Outbound connector enrollment. Stores hashes only, never Argo CD or Kubernetes tokens.
CREATE TYPE "ConnectorStatus" AS ENUM ('pending', 'connected', 'disconnected', 'error', 'revoked');

CREATE TABLE "Connector" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "argoUrl" TEXT NOT NULL,
    "customCa" BOOLEAN NOT NULL DEFAULT false,
    "status" "ConnectorStatus" NOT NULL DEFAULT 'pending',
    "credentialHash" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastError" TEXT,
    "applicationsSeen" INTEGER NOT NULL DEFAULT 0,
    "projectsSeen" INTEGER NOT NULL DEFAULT 0,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Connector_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConnectorEnrollment" (
    "id" SERIAL NOT NULL,
    "connectorId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectorEnrollment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Connector_credentialHash_key" ON "Connector"("credentialHash");
CREATE INDEX "Connector_organizationId_idx" ON "Connector"("organizationId");
CREATE UNIQUE INDEX "ConnectorEnrollment_tokenHash_key" ON "ConnectorEnrollment"("tokenHash");
CREATE INDEX "ConnectorEnrollment_connectorId_idx" ON "ConnectorEnrollment"("connectorId");

ALTER TABLE "Connector" ADD CONSTRAINT "Connector_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConnectorEnrollment" ADD CONSTRAINT "ConnectorEnrollment_connectorId_fkey" FOREIGN KEY ("connectorId") REFERENCES "Connector"("id") ON DELETE CASCADE ON UPDATE CASCADE;
