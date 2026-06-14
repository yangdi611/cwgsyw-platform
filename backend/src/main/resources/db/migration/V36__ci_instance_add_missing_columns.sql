-- V36: ci_instance add missing status/owner/description columns
-- CiInstance.java entity references these fields but V15 didn't include them
-- The fields_data column should have been named attrs in V15; entity maps fieldsData to attrs

ALTER TABLE ci_instance ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'online';
ALTER TABLE ci_instance ADD COLUMN IF NOT EXISTS owner VARCHAR(128);
ALTER TABLE ci_instance ADD COLUMN IF NOT EXISTS description TEXT;

COMMENT ON COLUMN ci_instance.status IS 'instance status';
COMMENT ON COLUMN ci_instance.owner IS 'responsible person';
COMMENT ON COLUMN ci_instance.description IS 'description';
