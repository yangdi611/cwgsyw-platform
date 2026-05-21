-- V5: 修复 sys_role 表缺失的 BaseEntity 字段

ALTER TABLE sys_role
    ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
    ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
    ADD COLUMN IF NOT EXISTS created_by  BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by  BIGINT,
    ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;
