-- V46: 补齐 changedoc / sharedfile 系列表缺失的 updated_by 列
-- 这些实体 extends BaseEntity（含 updatedBy → updated_by），但建表时漏了该列，
-- 导致 MyBatis-Plus 生成的 SELECT 含 updated_by 时报 "column updated_by does not exist" (500)。
-- 例：GET /api/cmdb/instances/{id}/change-docs → ChangeDocCiLinkMapper 查询崩溃。
-- （V39 只补了 CMDB 表，遗漏了 changedoc / sharedfile 表。）

ALTER TABLE change_doc          ADD COLUMN IF NOT EXISTS updated_by BIGINT NOT NULL DEFAULT 0;
ALTER TABLE change_doc_ci_link  ADD COLUMN IF NOT EXISTS updated_by BIGINT NOT NULL DEFAULT 0;
ALTER TABLE change_doc_template ADD COLUMN IF NOT EXISTS updated_by BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shared_file         ADD COLUMN IF NOT EXISTS updated_by BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shared_folder       ADD COLUMN IF NOT EXISTS updated_by BIGINT NOT NULL DEFAULT 0;
