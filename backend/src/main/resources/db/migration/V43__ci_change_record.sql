-- V43: CMDB domain change record table — decouple from audit_log
-- Context (Issue #64 AC6 / AD-6): CMDB change history/stats previously read from
-- the generic audit_log table, which is shared across all modules and stores
-- coarse beforeJson/afterJson snapshots. The CMDB domain needs a stable,
-- structured field-level diff. This migration introduces ci_change_record as the
-- canonical source for CMDB change history. During the dual-write period,
-- CiInstanceService still writes audit_log (for cross-module audit views) AND
-- ci_change_record (for CMDB change history/stats).
--
-- Column semantics:
--   action         — canonical action: create | update | delete | relate
--   field_changes  — structured field-level diff JSONB: [{"field","before","after"}]
--                    (null before = added field; null after = removed field)
--   model_code     — CiModel.name (e.g. host / app), denormalised for SQL-side filtering

CREATE TABLE IF NOT EXISTS ci_change_record (
    id             BIGSERIAL    PRIMARY KEY,
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT 'default',
    instance_id    BIGINT       NOT NULL,
    model_code     VARCHAR(64)  NOT NULL,
    action         VARCHAR(32)  NOT NULL,
    field_changes  JSONB,
    operator_id    BIGINT,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

-- Query path indexes (mirrors audit_log cmdb access patterns)
CREATE INDEX IF NOT EXISTS idx_ccr_instance_id ON ci_change_record(instance_id);
CREATE INDEX IF NOT EXISTS idx_ccr_model_code  ON ci_change_record(model_code);
CREATE INDEX IF NOT EXISTS idx_ccr_action       ON ci_change_record(action);
CREATE INDEX IF NOT EXISTS idx_ccr_created_at   ON ci_change_record(created_at);
CREATE INDEX IF NOT EXISTS idx_ccr_tenant_id    ON ci_change_record(tenant_id);
