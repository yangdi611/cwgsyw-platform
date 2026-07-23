-- Backup creation and upload are both manual operations. No scheduler, query,
-- API, UI, retention policy, or restore behavior distinguishes backup_type.
-- Retaining a permanently fixed 'manual' value adds no domain information.
ALTER TABLE backup_record DROP COLUMN backup_type;
