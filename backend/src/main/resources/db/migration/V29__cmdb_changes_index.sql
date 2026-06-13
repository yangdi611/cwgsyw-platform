-- V29: 变更历史查询索引（防御性补建）

-- V19 已建 idx_audit_cmdb_target 覆盖通用场景
-- 此处补建 partial index 专用于变更历史分页查询
CREATE INDEX IF NOT EXISTS idx_audit_cmdb_instance_changes
ON audit_log(tenant_id, target_type, target_id, created_at DESC)
WHERE module = 'cmdb' AND target_type = 'ci_instance';

-- 统计查询用索引
CREATE INDEX IF NOT EXISTS idx_audit_cmdb_stats
ON audit_log(tenant_id, target_type, action, created_at)
WHERE module = 'cmdb';
