-- A backup entry is a catalog record for a physical archive. Deleting or
-- rotating an archive is terminal: there is no restore-deleted-record API and
-- the platform audit log retains the operator/action history. Remove generic
-- soft-delete and update columns inherited only through BaseEntity, and make
-- catalog removal physical to match its actual lifecycle.
ALTER TABLE backup_record
    DROP COLUMN is_deleted,
    DROP COLUMN deleted_at,
    DROP COLUMN deleted_by,
    DROP COLUMN updated_at,
    DROP COLUMN updated_by;
