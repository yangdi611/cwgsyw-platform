-- Shared-file upload lifecycle: canonical name and active-file uniqueness.
ALTER TABLE shared_file ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(255);

UPDATE shared_file
SET normalized_name = lower(btrim(original_name))
WHERE normalized_name IS NULL
  AND source_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_file_active_normalized_root
    ON shared_file (tenant_id, normalized_name)
    WHERE folder_id IS NULL AND source_type IS NULL AND NOT is_deleted;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_file_active_normalized_folder
    ON shared_file (tenant_id, folder_id, normalized_name)
    WHERE folder_id IS NOT NULL AND source_type IS NULL AND NOT is_deleted;
