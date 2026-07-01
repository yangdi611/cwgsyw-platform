-- V62: 流程中心统一接入 —— 模板 / 模板实例 / 业务绑定 / 业务流程实例关联
-- 对应 docs/plan/flow_enhancement/{PRD,SPEC}.md 第 5 节数据库设计

-- ============================================================
-- 1. workflow_template 模板定义（内置 + 未来可扩展）
-- ============================================================
CREATE TABLE workflow_template (
    id                        BIGSERIAL PRIMARY KEY,
    code                      VARCHAR(100) NOT NULL UNIQUE,
    name                      VARCHAR(255) NOT NULL,
    description               TEXT,
    template_version          INT NOT NULL DEFAULT 1,
    supported_business_types  TEXT NOT NULL DEFAULT '[]',
    config_schema             TEXT NOT NULL,
    enabled                   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at                TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. workflow_template_instance 模板实例（业务管理员基于模板创建的具体流程）
-- ============================================================
CREATE TABLE workflow_template_instance (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   VARCHAR(64) NOT NULL DEFAULT 'default',
    template_code               VARCHAR(100) NOT NULL REFERENCES workflow_template(code),
    name                         VARCHAR(255) NOT NULL,
    process_key                  VARCHAR(255) NOT NULL,
    business_type                VARCHAR(100) NOT NULL,
    description                  TEXT,
    config                        TEXT NOT NULL DEFAULT '{}',
    latest_process_definition_id VARCHAR(255),
    latest_version                INT,
    status                        VARCHAR(32) NOT NULL DEFAULT 'draft'
                                       CHECK (status IN ('draft','active','deprecated','deleted')),
    created_by                   BIGINT,
    created_at                    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by                    BIGINT,
    updated_at                    TIMESTAMP NOT NULL DEFAULT NOW(),
    is_deleted                    BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at                    TIMESTAMP,
    deleted_by                    BIGINT,
    UNIQUE (tenant_id, process_key)
);
CREATE INDEX idx_wf_template_instance_tenant ON workflow_template_instance(tenant_id) WHERE NOT is_deleted;
CREATE INDEX idx_wf_template_instance_business_type ON workflow_template_instance(tenant_id, business_type) WHERE NOT is_deleted;

-- ============================================================
-- 3. workflow_process_binding 业务模块 -> 流程定义版本绑定
-- ============================================================
CREATE TABLE workflow_process_binding (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   VARCHAR(64) NOT NULL DEFAULT 'default',
    business_type               VARCHAR(100) NOT NULL,
    process_definition_id       VARCHAR(255) NOT NULL,
    process_definition_key      VARCHAR(255) NOT NULL,
    process_definition_version  INT NOT NULL,
    template_instance_id        BIGINT REFERENCES workflow_template_instance(id),
    enabled                     BOOLEAN NOT NULL DEFAULT TRUE,
    created_by                  BIGINT,
    created_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by                  BIGINT,
    updated_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (tenant_id, business_type)
);
CREATE INDEX idx_wf_binding_tenant ON workflow_process_binding(tenant_id);

-- ============================================================
-- 4. workflow_business_instance 业务流程实例关联（用于回写、巡检、追溯）
-- ============================================================
CREATE TABLE workflow_business_instance (
    id                          BIGSERIAL PRIMARY KEY,
    tenant_id                   VARCHAR(64) NOT NULL DEFAULT 'default',
    business_type               VARCHAR(100) NOT NULL,
    business_id                 VARCHAR(100) NOT NULL,
    business_key                VARCHAR(255) NOT NULL,
    process_instance_id         VARCHAR(255) NOT NULL,
    process_definition_id       VARCHAR(255) NOT NULL,
    process_definition_key      VARCHAR(255) NOT NULL,
    process_definition_version  INT NOT NULL,
    status                      VARCHAR(32) NOT NULL DEFAULT 'running'
                                     CHECK (status IN ('running','approved','rejected','cancelled','failed')),
    submitter_id                BIGINT,
    started_at                  TIMESTAMP NOT NULL DEFAULT NOW(),
    ended_at                    TIMESTAMP,
    result                      VARCHAR(32),
    UNIQUE (tenant_id, business_key, process_instance_id)
);
CREATE INDEX idx_wf_business_instance_lookup ON workflow_business_instance(tenant_id, business_type, business_id);
CREATE INDEX idx_wf_business_instance_pi ON workflow_business_instance(process_instance_id);
CREATE INDEX idx_wf_business_instance_status ON workflow_business_instance(tenant_id, status);

-- ============================================================
-- 5. RBAC 说明：模板/绑定管理复用现有 workflow:configure 权限，
--    无需新增资源或权限记录。
-- ============================================================

-- ============================================================
-- 6. 内置模板种子（3 个 MVP 模板）
-- ============================================================
INSERT INTO workflow_template (code, name, description, template_version, supported_business_types, config_schema, enabled)
VALUES
('single_approval', '单人审批',
 '单个指定审批人审批通过或拒绝，适用于 Wiki 发布、简单设备权限申请、小型变更申请。',
 1,
 '["wiki_page","device_access","change_doc"]',
 '{"fields":[
     {"key":"approverSource","label":"审批人来源","type":"select","options":["specific_user"],"required":true,"default":"specific_user"},
     {"key":"approverUserId","label":"指定审批人","type":"user","required":true},
     {"key":"taskName","label":"任务名称","type":"string","required":true,"default":"审批"},
     {"key":"allowReject","label":"允许拒绝","type":"boolean","default":true}
 ]}',
 TRUE),
('group_any_approval', '组内任一人审批',
 '组内任意一名候选人审批即可通过（或签），适用于日报审批、Wiki 空间管理员审批、普通组内申请。',
 1,
 '["daily_report","wiki_page","change_doc"]',
 '{"fields":[
     {"key":"candidateSource","label":"候选组来源","type":"select","options":["submitter_group_leaders","submitter_group","specific_group"],"required":true,"default":"submitter_group_leaders"},
     {"key":"taskName","label":"任务名称","type":"string","required":true,"default":"组内审批"},
     {"key":"completionPolicy","label":"完成策略","type":"select","options":["any_one"],"required":true,"default":"any_one"},
     {"key":"rejectTo","label":"拒绝后状态","type":"string","required":false,"default":"draft"}
 ]}',
 TRUE),
('two_level_approval', '两级审批',
 '一级审批通过后进入二级审批，两级均通过才最终通过，适用于变更文档审批、设备权限申请、高影响操作申请。',
 1,
 '["change_doc","device_access"]',
 '{"fields":[
     {"key":"firstApproverSource","label":"一级审批人来源","type":"select","options":["submitter_group_leaders","specific_user","role"],"required":true,"default":"submitter_group_leaders"},
     {"key":"firstTaskName","label":"一级任务名称","type":"string","required":true,"default":"组长审批"},
     {"key":"secondApproverSource","label":"二级审批人来源","type":"select","options":["role","specific_user"],"required":true,"default":"role"},
     {"key":"secondApproverRole","label":"二级审批角色","type":"string","required":false,"default":"admin"},
     {"key":"secondTaskName","label":"二级任务名称","type":"string","required":true,"default":"管理员审批"}
 ]}',
 TRUE)
ON CONFLICT (code) DO NOTHING;
