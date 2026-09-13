-- Deduplicate projects before unique constraint
DELETE FROM "Project" a
USING "Project" b
WHERE a.id > b.id
  AND a.name = b.name
  AND a."organizationId" IS NOT DISTINCT FROM b."organizationId";

CREATE UNIQUE INDEX IF NOT EXISTS "Project_organizationId_name_key" ON "Project"("organizationId", "name");

-- Move duplicate applications' children, then drop extras
DELETE FROM "Deployment" WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "Application" b
    ON a.id > b.id AND a."projectId" = b."projectId" AND a.name = b.name
);
DELETE FROM "Environment" WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "Application" b
    ON a.id > b.id AND a."projectId" = b."projectId" AND a.name = b.name
);
DELETE FROM "ApplicationEvent" WHERE "applicationId" IN (
  SELECT a.id FROM "Application" a
  INNER JOIN "Application" b
    ON a.id > b.id AND a."projectId" = b."projectId" AND a.name = b.name
);
DELETE FROM "Application" a
USING "Application" b
WHERE a.id > b.id
  AND a."projectId" = b."projectId"
  AND a.name = b.name;

CREATE UNIQUE INDEX IF NOT EXISTS "Application_projectId_name_key" ON "Application"("projectId", "name");

DELETE FROM "Environment" a
USING "Environment" b
WHERE a.id > b.id
  AND a."applicationId" = b."applicationId"
  AND a.name = b.name;

CREATE UNIQUE INDEX IF NOT EXISTS "Environment_applicationId_name_key" ON "Environment"("applicationId", "name");
