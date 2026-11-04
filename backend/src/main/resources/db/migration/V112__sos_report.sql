-- YAN-109: SOS 报告解析、字段映射规则与 CMDB 入库申请。
-- 只新增对象，不修改现有表。

CREATE TABLE sos_report (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64)  NOT NULL DEFAULT 'default',
    file_name         VARCHAR(255) NOT NULL,
    file_size         BIGINT       NOT NULL,
    content_sha256    VARCHAR(64)  NOT NULL,
    -- 原始压缩包可能含凭据，解析进入终态后删除对象并清空此列。
    object_key        VARCHAR(512),
    status            VARCHAR(20)  NOT NULL DEFAULT 'pending',
    attempt_count     INT          NOT NULL DEFAULT 0,
    next_attempt_at   TIMESTAMP,
    error_code        VARCHAR(64),
    error_message     VARCHAR(500),
    parser_version    INT,
    sos_version       VARCHAR(64),
    hostname          VARCHAR(255),
    serial_number     VARCHAR(255),
    primary_ip        VARCHAR(64),
    system_uuid       VARCHAR(64),
    collected_at      VARCHAR(64),
    parsed_at         TIMESTAMP,
    facts             JSONB,
    warnings          JSONB,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT,
    is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    CONSTRAINT ck_sos_report_status CHECK (status IN ('pending', 'parsing', 'parsed', 'failed'))
);

CREATE UNIQUE INDEX uq_sos_report_content
    ON sos_report (tenant_id, content_sha256) WHERE is_deleted = FALSE;
CREATE INDEX idx_sos_report_list
    ON sos_report (tenant_id, created_at DESC) WHERE is_deleted = FALSE;
CREATE INDEX idx_sos_report_due
    ON sos_report (next_attempt_at) WHERE status IN ('pending', 'parsing') AND is_deleted = FALSE;
CREATE INDEX idx_sos_report_uuid
    ON sos_report (tenant_id, system_uuid) WHERE is_deleted = FALSE AND system_uuid IS NOT NULL;

COMMENT ON TABLE sos_report IS 'sosreport 上传记录与解析得到的结构化事实';
COMMENT ON COLUMN sos_report.object_key IS '原始压缩包的对象存储 key，解析终态后清空';
COMMENT ON COLUMN sos_report.facts IS '白名单文件解析出的结构化事实，不含原始文件内容';

CREATE TABLE sos_field_mapping (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_code        VARCHAR(64)  NOT NULL,
    field_key         VARCHAR(128) NOT NULL,
    -- suggested: AI 建议，未生效；confirmed: 已确认；unmappable: 确认无法从报告取得
    status            VARCHAR(20)  NOT NULL,
    source            VARCHAR(20)  NOT NULL,
    fact_key          VARCHAR(128),
    transform         VARCHAR(32),
    transform_args    JSONB,
    field_fingerprint VARCHAR(64),
    ai_verdict        VARCHAR(20),
    ai_confidence     NUMERIC(4, 3),
    ai_reason         VARCHAR(500),
    confirmed_by      BIGINT,
    confirmed_at      TIMESTAMP,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by        BIGINT,
    updated_by        BIGINT,
    is_deleted        BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at        TIMESTAMP,
    deleted_by        BIGINT,
    CONSTRAINT ck_sos_field_mapping_status CHECK (status IN ('suggested', 'confirmed', 'unmappable')),
    CONSTRAINT ck_sos_field_mapping_source CHECK (source IN ('manual', 'ai'))
);

CREATE UNIQUE INDEX uq_sos_field_mapping_field
    ON sos_field_mapping (tenant_id, model_code, field_key) WHERE is_deleted = FALSE;

COMMENT ON TABLE sos_field_mapping IS 'sosreport 事实到 CMDB 字段的映射规则';
COMMENT ON COLUMN sos_field_mapping.field_fingerprint IS '确认时字段类型和枚举选项的指纹，变化后规则失效';

CREATE TABLE sos_cmdb_request (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64)  NOT NULL DEFAULT 'default',
    report_id           BIGINT       NOT NULL REFERENCES sos_report (id),
    model_code          VARCHAR(64)  NOT NULL,
    action              VARCHAR(20)  NOT NULL,
    target_instance_id  BIGINT,
    instance_name       VARCHAR(255) NOT NULL,
    proposed_fields     JSONB        NOT NULL,
    -- 提交时的字段来源快照，含哪些字段来自 AI 建议的规则。规则后来变化也不影响审批内容。
    field_details       JSONB,
    status              VARCHAR(20)  NOT NULL,
    result_instance_id  BIGINT,
    failure_message     VARCHAR(500),
    process_instance_id VARCHAR(64),
    submitter_id        BIGINT       NOT NULL,
    decided_by          BIGINT,
    decided_at          TIMESTAMP,
    decision_comment    VARCHAR(500),
    created_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by          BIGINT,
    updated_by          BIGINT,
    is_deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP,
    deleted_by          BIGINT,
    CONSTRAINT ck_sos_cmdb_request_action CHECK (action IN ('create', 'update')),
    CONSTRAINT ck_sos_cmdb_request_status
        CHECK (status IN ('pending_approval', 'applied', 'rejected', 'apply_failed'))
);

-- 同一份报告同时只能有一个审批中的申请。
CREATE UNIQUE INDEX uq_sos_cmdb_request_pending
    ON sos_cmdb_request (tenant_id, report_id)
    WHERE status = 'pending_approval' AND is_deleted = FALSE;
CREATE INDEX idx_sos_cmdb_request_report
    ON sos_cmdb_request (tenant_id, report_id, created_at DESC) WHERE is_deleted = FALSE;

COMMENT ON TABLE sos_cmdb_request IS 'sosreport 入库 CMDB 的审批申请';
COMMENT ON COLUMN sos_cmdb_request.proposed_fields IS '提交时确认的字段值，审批通过后写入 CI';

INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('sos_report', 'SOS 报告', '["read","upload","delete","submit","approve","manage_mapping"]'::jsonb, 62)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    actions = EXCLUDED.actions,
    sort_order = EXCLUDED.sort_order;

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT resource.id, action.value, resource.code || ':' || action.value,
       resource.name || '-' || action.value
FROM sys_resource resource
CROSS JOIN LATERAL jsonb_array_elements_text(resource.actions) action(value)
WHERE resource.code = 'sos_report'
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code LIKE 'sos_report:%'
WHERE role.code IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code IN ('sos_report:read', 'sos_report:upload', 'sos_report:submit')
WHERE role.code = 'group_leader'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code IN ('sos_report:read', 'sos_report:upload')
WHERE role.code = 'member'
ON CONFLICT DO NOTHING;
