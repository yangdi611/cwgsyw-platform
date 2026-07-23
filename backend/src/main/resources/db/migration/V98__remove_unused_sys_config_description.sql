-- Configuration descriptions are historical seed annotations only.
-- Runtime configuration contracts expose and persist key/value pairs exclusively.
ALTER TABLE sys_config
    DROP COLUMN description;
