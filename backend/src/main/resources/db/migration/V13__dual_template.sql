-- V13: dual-template support for change_doc

-- 1. Add doc_type to change_doc_template
ALTER TABLE change_doc_template ADD COLUMN IF NOT EXISTS doc_type VARCHAR(32) NOT NULL DEFAULT 'general';

-- Seed existing templates with doc_type based on name heuristic
UPDATE change_doc_template SET doc_type = 'application' WHERE name LIKE '%申请%';
UPDATE change_doc_template SET doc_type = 'plan' WHERE name LIKE '%方案%';
-- Default template gets doc_type = general (shows in both selectors)

-- 2. Add application_template_id and plan_template_id to change_doc
ALTER TABLE change_doc ADD COLUMN IF NOT EXISTS application_template_id BIGINT REFERENCES change_doc_template(id);
ALTER TABLE change_doc ADD COLUMN IF NOT EXISTS plan_template_id BIGINT REFERENCES change_doc_template(id);

-- 3. Migrate existing template_id → application_template_id (best-effort)
UPDATE change_doc SET application_template_id = template_id WHERE template_id IS NOT NULL;

-- Note: template_id column is kept for now (backward compat), not dropped in this migration
