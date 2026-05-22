-- V8: AI 网关配置 + 调用日志

CREATE TABLE ai_provider_config (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    provider        VARCHAR(32) NOT NULL,
    api_key_enc     TEXT NOT NULL DEFAULT '',
    base_url        VARCHAR(255) NOT NULL,
    model           VARCHAR(128) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    system_prompt   TEXT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);

INSERT INTO ai_provider_config (tenant_id, provider, api_key_enc, base_url, model, enabled, system_prompt) VALUES
('default', 'kimi',     '', 'https://api.moonshot.cn/v1',           'moonshot-v1-8k', false,
 '你是一个专业的IT运维工程师助手，帮助用户撰写变更文档。请用中文回答，内容专业、简洁。'),
('default', 'deepseek', '', 'https://api.deepseek.com/v1',          'deepseek-chat',  false,
 '你是一个专业的IT运维工程师助手，帮助用户撰写变更文档。请用中文回答，内容专业、简洁。'),
('default', 'glm',      '', 'https://open.bigmodel.cn/api/paas/v4', 'glm-4-flash',    false,
 '你是一个专业的IT运维工程师助手，帮助用户撰写变更文档。请用中文回答，内容专业、简洁。');

CREATE TABLE ai_call_log (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'default',
    provider            VARCHAR(32) NOT NULL,
    model               VARCHAR(128),
    prompt_tokens       INTEGER DEFAULT 0,
    completion_tokens   INTEGER DEFAULT 0,
    duration_ms         INTEGER DEFAULT 0,
    success             BOOLEAN NOT NULL DEFAULT TRUE,
    error_msg           TEXT,
    ref_type            VARCHAR(64),
    ref_id              BIGINT,
    operator_id         BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_ai_call_log_tenant ON ai_call_log(tenant_id, created_at DESC);
CREATE INDEX idx_ai_call_log_operator ON ai_call_log(operator_id, created_at DESC);

-- RBAC
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('ai_config', 'AI网关配置', '["read","write"]', 95);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code = 'ai_config';

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id
FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin') AND p.code LIKE 'ai_config:%'
ON CONFLICT DO NOTHING;
