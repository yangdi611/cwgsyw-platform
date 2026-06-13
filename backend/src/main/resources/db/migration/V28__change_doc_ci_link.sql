-- V28: change_doc_ci_link — CMDB ↔ 变更文档 (Change Document) association

CREATE TABLE change_doc_ci_link (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL DEFAULT 'default',
    change_doc_id BIGINT NOT NULL REFERENCES change_doc(id),
    instance_id BIGINT NOT NULL REFERENCES ci_instance(id),
    impact_level VARCHAR(32),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT
);
CREATE INDEX idx_cdcl_change_doc ON change_doc_ci_link(change_doc_id);
CREATE INDEX idx_cdcl_instance ON change_doc_ci_link(instance_id);
-- Ensure no duplicate links
CREATE UNIQUE INDEX idx_cdcl_unique ON change_doc_ci_link(change_doc_id, instance_id) WHERE is_deleted = FALSE;
