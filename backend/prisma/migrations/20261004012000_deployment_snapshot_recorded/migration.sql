-- stateRecorded means both health and sync were stored for this revision.
-- It does not describe Result, and this migration does not change health, sync, or result.
--
-- The previous sync writer always wrote those two columns together:
--   the newest revision received the live pair
--   every older revision received the placeholder pair Unknown/Unknown
-- No legacy row has only one of the two columns set.
--
-- A row is recorded only when both columns hold a value and that pair is not
-- the placeholder. Requiring both values to be something other than Unknown
-- would drop a live pair that includes one real Unknown. Unknown/Unknown stays
-- unrecorded. Null or blank columns were not written by that sync path.
ALTER TABLE "Deployment" ADD COLUMN "stateRecorded" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Deployment"
SET "stateRecorded" = true
WHERE COALESCE(BTRIM("healthStatus"), '') <> ''
  AND COALESCE(BTRIM("syncStatus"), '') <> ''
  AND NOT (
    BTRIM("healthStatus") = 'Unknown'
    AND BTRIM("syncStatus") = 'Unknown'
  );
