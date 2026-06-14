-- V32: CI 实例生命周期字段 + 设备凭证 ↔ CI 实例关联
-- Adds lifecycle management columns to ci_instance and a direct
-- ci_instance_id link on device_credential for CI detail page display.

-- ─── ci_instance 生命周期字段 ────────────────────────────────────────────────
ALTER TABLE ci_instance ADD COLUMN lifecycle_status VARCHAR(32);
ALTER TABLE ci_instance ADD COLUMN lifecycle_stage VARCHAR(32);
ALTER TABLE ci_instance ADD COLUMN asset_category VARCHAR(64);
ALTER TABLE ci_instance ADD COLUMN purchase_date DATE;
ALTER TABLE ci_instance ADD COLUMN purchase_price DECIMAL(12,2);
ALTER TABLE ci_instance ADD COLUMN vendor VARCHAR(128);
ALTER TABLE ci_instance ADD COLUMN warranty_start DATE;
ALTER TABLE ci_instance ADD COLUMN warranty_end DATE;
ALTER TABLE ci_instance ADD COLUMN contract_no VARCHAR(64);

CREATE INDEX idx_ci_instance_lifecycle_status
    ON ci_instance(tenant_id, lifecycle_status) WHERE NOT is_deleted;

-- ─── device_credential ↔ CI 实例关联 ────────────────────────────────────────
ALTER TABLE device_credential ADD COLUMN ci_instance_id BIGINT REFERENCES ci_instance(id);
CREATE INDEX idx_device_credential_ci ON device_credential(ci_instance_id) WHERE NOT is_deleted;
