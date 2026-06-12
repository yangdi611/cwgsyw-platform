-- V19: 索引和约束补充

CREATE INDEX IF NOT EXISTS idx_ci_instance_model ON ci_instance(tenant_id, model_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_ci_instance_name ON ci_instance(tenant_id, model_id, name) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_ci_instance_fields ON ci_instance USING GIN(fields_data);
CREATE INDEX IF NOT EXISTS idx_ci_rel_src ON ci_instance_rel(src_instance_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_ci_rel_dst ON ci_instance_rel(dst_instance_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_ci_rel_kind ON ci_instance_rel(association_kind) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_audit_cmdb_target ON audit_log(tenant_id, module, target_type, target_id, created_at DESC) WHERE module = 'cmdb';
