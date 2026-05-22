-- V9: 变更文档系统

CREATE TABLE change_doc (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    change_no       VARCHAR(32) NOT NULL,          -- CHG-YYYY-MMDD-NNN, unique per tenant
    title           VARCHAR(255) NOT NULL,
    status          VARCHAR(32) NOT NULL DEFAULT 'draft',  -- draft|pending|approved|rejected
    -- 变更申请单字段
    applicant_id    BIGINT NOT NULL,
    apply_time      TIMESTAMP NOT NULL DEFAULT NOW(),
    change_desc     TEXT,                          -- 变更内容描述
    impact_scope    TEXT,                          -- 影响范围
    change_window   VARCHAR(255),                  -- 变更时间窗口
    resource_support TEXT,                         -- 资源支持说明
    -- 变更方案字段 (AI 辅助生成，用户可编辑)
    background      TEXT,                          -- 背景与目的
    steps           TEXT,                          -- 详细操作步骤 (富文本)
    risk_assessment TEXT,                          -- 风险评估与应对措施
    rollback_plan   TEXT,                          -- 回滚计划
    verify_method   TEXT,                          -- 验证方法
    contacts        TEXT,                          -- 相关人员联系方式
    -- 审批结果
    approved_at     TIMESTAMP,
    approver_id     BIGINT,
    approver_comment TEXT,
    -- 软删除
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by      BIGINT NOT NULL,
    UNIQUE(tenant_id, change_no)
);
CREATE INDEX idx_change_doc_tenant_status ON change_doc(tenant_id, status, created_at DESC);
CREATE INDEX idx_change_doc_applicant ON change_doc(applicant_id, created_at DESC);

-- 每次保存都记录完整快照
CREATE TABLE change_doc_snapshot (
    id              BIGSERIAL PRIMARY KEY,
    change_doc_id   BIGINT NOT NULL REFERENCES change_doc(id),
    snapshot_json   TEXT NOT NULL,                 -- 完整 ChangeDoc JSON
    operator_id     BIGINT NOT NULL,
    remark          VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_change_doc_snapshot_doc ON change_doc_snapshot(change_doc_id, created_at DESC);

-- RBAC
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('change_doc', '变更文档', '["create","read","update","delete","approve","export"]', 60);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'change_doc';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'change_doc:%'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'group_leader' AND p.code IN ('change_doc:create','change_doc:read','change_doc:update','change_doc:approve','change_doc:export')
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code = 'member' AND p.code IN ('change_doc:create','change_doc:read','change_doc:update')
ON CONFLICT DO NOTHING;
