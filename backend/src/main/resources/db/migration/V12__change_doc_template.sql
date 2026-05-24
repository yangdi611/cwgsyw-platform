-- V12: 变更文档模板引擎

-- 模板版本表
CREATE TABLE change_doc_template (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    name        VARCHAR(255) NOT NULL,
    description VARCHAR(512),
    version     INTEGER      NOT NULL DEFAULT 1,
    is_active   BOOLEAN      NOT NULL DEFAULT TRUE,
    docx_key    VARCHAR(512),
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0
);
CREATE INDEX idx_change_doc_template_tenant ON change_doc_template(tenant_id, is_active) WHERE NOT is_deleted;

-- 字段配置表
CREATE TABLE change_doc_field (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64) NOT NULL DEFAULT 'default',
    template_id BIGINT      NOT NULL REFERENCES change_doc_template(id),
    field_key   VARCHAR(64) NOT NULL,
    label       VARCHAR(128) NOT NULL,
    field_type  VARCHAR(32) NOT NULL DEFAULT 'textarea',
    sort_order  INTEGER     NOT NULL DEFAULT 0,
    required    BOOLEAN     NOT NULL DEFAULT FALSE,
    in_form     BOOLEAN     NOT NULL DEFAULT TRUE,
    placeholder VARCHAR(255),
    UNIQUE(template_id, field_key)
);
CREATE INDEX idx_change_doc_field_template ON change_doc_field(template_id, sort_order);

-- Seed: default template
INSERT INTO change_doc_template (tenant_id, name, description, version, is_active, created_by)
VALUES ('default', '默认变更文档模板', '系统内置模板，字段与原有表单一致', 1, TRUE, 0);

INSERT INTO change_doc_field (tenant_id, template_id, field_key, label, field_type, sort_order, required, in_form)
SELECT 'default', t.id, f.field_key, f.label, f.field_type, f.sort_order, f.required, f.in_form
FROM change_doc_template t,
     (VALUES
       ('title',            '变更标题',         'text',     1,  TRUE,  TRUE),
       ('change_desc',      '变更内容描述',     'textarea', 2,  TRUE,  TRUE),
       ('impact_scope',     '影响范围',         'textarea', 3,  TRUE,  TRUE),
       ('change_window',    '变更时间窗口',     'text',     4,  TRUE,  TRUE),
       ('resource_support', '资源支持说明',     'textarea', 5,  FALSE, TRUE),
       ('background',       '背景与目的',       'textarea', 6,  FALSE, TRUE),
       ('steps',            '详细操作步骤',     'textarea', 7,  FALSE, TRUE),
       ('risk_assessment',  '风险评估与应对措施','textarea', 8,  FALSE, TRUE),
       ('rollback_plan',    '回滚计划',         'textarea', 9,  FALSE, TRUE),
       ('verify_method',    '验证方法',         'textarea', 10, FALSE, TRUE),
       ('contacts',         '相关人员联系方式', 'textarea', 11, FALSE, TRUE)
     ) AS f(field_key, label, field_type, sort_order, required, in_form)
WHERE t.name = '默认变更文档模板';

-- Add template ref + dynamic fields data to change_doc
ALTER TABLE change_doc
    ADD COLUMN template_id BIGINT REFERENCES change_doc_template(id),
    ADD COLUMN fields_data JSONB;

-- Migrate existing rows to fields_data
UPDATE change_doc cd
SET template_id = (SELECT id FROM change_doc_template WHERE name = '默认变更文档模板' LIMIT 1),
    fields_data = jsonb_build_object(
        'title',            cd.title,
        'change_desc',      cd.change_desc,
        'impact_scope',     cd.impact_scope,
        'change_window',    cd.change_window,
        'resource_support', cd.resource_support,
        'background',       cd.background,
        'steps',            cd.steps,
        'risk_assessment',  cd.risk_assessment,
        'rollback_plan',    cd.rollback_plan,
        'verify_method',    cd.verify_method,
        'contacts',         cd.contacts
    );

-- RBAC
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('change_doc_template', '变更文档模板', '["read","write"]', 65);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'change_doc_template';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'change_doc_template:%'
ON CONFLICT DO NOTHING;
