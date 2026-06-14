-- V37: ci_attribute_group 表补全缺失列
-- V14 建表时遗漏了 code、updated_at、created_by、updated_by、deleted_at、deleted_by
-- 导致 MyBatis Plus 自动 SELECT 时抛出 column not found 异常

ALTER TABLE ci_attribute_group ADD COLUMN IF NOT EXISTS code        VARCHAR(64);
ALTER TABLE ci_attribute_group ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE ci_attribute_group ADD COLUMN IF NOT EXISTS created_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_attribute_group ADD COLUMN IF NOT EXISTS updated_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_attribute_group ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP;
ALTER TABLE ci_attribute_group ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;

-- 为已有记录设置 code = group_id（兼容性回填）
UPDATE ci_attribute_group SET code = group_id WHERE code IS NULL;
