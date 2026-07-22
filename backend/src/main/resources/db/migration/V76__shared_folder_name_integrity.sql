-- Enforce the same normalized sibling-name contract used by the folder service.
ALTER TABLE shared_folder ADD COLUMN IF NOT EXISTS normalized_name VARCHAR(255);

UPDATE shared_folder
SET normalized_name = lower(btrim(name))
WHERE normalized_name IS NULL;

ALTER TABLE shared_folder ALTER COLUMN normalized_name SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_folder_root_normalized_name
    ON shared_folder (tenant_id, normalized_name)
    WHERE parent_id IS NULL AND NOT is_deleted;

CREATE UNIQUE INDEX IF NOT EXISTS uq_shared_folder_child_normalized_name
    ON shared_folder (tenant_id, parent_id, normalized_name)
    WHERE parent_id IS NOT NULL AND NOT is_deleted;
