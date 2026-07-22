ALTER TABLE workflow_process_binding
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

ALTER TABLE workflow_process_binding
    DROP CONSTRAINT IF EXISTS workflow_process_binding_tenant_id_business_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS uq_workflow_binding_tenant_business_active
    ON workflow_process_binding (tenant_id, business_type)
    WHERE NOT is_deleted;

CREATE INDEX IF NOT EXISTS idx_workflow_binding_tenant_history
    ON workflow_process_binding (tenant_id, business_type, is_deleted);
