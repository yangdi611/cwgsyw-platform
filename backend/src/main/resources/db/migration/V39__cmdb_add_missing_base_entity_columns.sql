-- V39: CMDB 元数据表补全缺失的 BaseEntity 列
-- V14 建表时多个表遗漏了 created_by / updated_by / updated_at / deleted_at / deleted_by
-- 导致 MyBatis Plus 自动 SELECT 时抛出 column not found 异常（GET /api/cmdb/models 返回 500）
-- 各表当前状态（is_deleted 全表已有，本次不重复添加）：
--   ci_model            已有 created_at/updated_at/created_by  → 补 updated_by/deleted_at/deleted_by
--   ci_attribute        已有 created_at/updated_at/created_by  → 补 updated_by/deleted_at/deleted_by
--   ci_model_group      已有 created_at/updated_at/created_by  → 补 updated_by/deleted_at/deleted_by
--   ci_association_kind 已有 created_at                        → 补 created_by/updated_at/updated_by/deleted_at/deleted_by
--   ci_association_def  已有 created_at                        → 补 created_by/updated_at/updated_by/deleted_at/deleted_by

-- ci_model
ALTER TABLE ci_model ADD COLUMN IF NOT EXISTS updated_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_model ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP;
ALTER TABLE ci_model ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;

-- ci_attribute
ALTER TABLE ci_attribute ADD COLUMN IF NOT EXISTS updated_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_attribute ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP;
ALTER TABLE ci_attribute ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;

-- ci_model_group
ALTER TABLE ci_model_group ADD COLUMN IF NOT EXISTS updated_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_model_group ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP;
ALTER TABLE ci_model_group ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;

-- ci_association_kind
ALTER TABLE ci_association_kind ADD COLUMN IF NOT EXISTS created_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_association_kind ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE ci_association_kind ADD COLUMN IF NOT EXISTS updated_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_association_kind ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP;
ALTER TABLE ci_association_kind ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;

-- ci_association_def
ALTER TABLE ci_association_def ADD COLUMN IF NOT EXISTS created_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_association_def ADD COLUMN IF NOT EXISTS updated_at  TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE ci_association_def ADD COLUMN IF NOT EXISTS updated_by  BIGINT    NOT NULL DEFAULT 0;
ALTER TABLE ci_association_def ADD COLUMN IF NOT EXISTS deleted_at  TIMESTAMP;
ALTER TABLE ci_association_def ADD COLUMN IF NOT EXISTS deleted_by  BIGINT;
