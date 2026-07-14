-- Production authorization cutover metadata. This migration is expand-only:
-- it does not move users, rewrite memberships, or change legacy authorization data.

ALTER TABLE sys_group
    ADD COLUMN IF NOT EXISTS code VARCHAR(64),
    ADD COLUMN IF NOT EXISTS group_type VARCHAR(16) NOT NULL DEFAULT 'business',
    ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE sys_group
SET code = 'group_' || id
WHERE code IS NULL OR BTRIM(code) = '';

ALTER TABLE sys_group
    ALTER COLUMN code SET NOT NULL;

ALTER TABLE sys_group
    DROP CONSTRAINT IF EXISTS ck_sys_group_type;
ALTER TABLE sys_group
    ADD CONSTRAINT ck_sys_group_type
        CHECK (group_type IN ('business', 'unassigned'));
ALTER TABLE sys_group
    DROP CONSTRAINT IF EXISTS ck_sys_group_unassigned_shape;
ALTER TABLE sys_group
    ADD CONSTRAINT ck_sys_group_unassigned_shape
        CHECK (group_type <> 'unassigned' OR (is_builtin AND leader_id IS NULL AND code = 'unassigned'));

CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_group_tenant_code_active
    ON sys_group(tenant_id, code)
    WHERE NOT is_deleted;

WITH tenants AS (
    SELECT tenant_id FROM sys_user WHERE NOT is_deleted
    UNION
    SELECT tenant_id FROM sys_group WHERE NOT is_deleted
)
INSERT INTO sys_group
    (tenant_id, code, name, description, group_type, is_builtin, leader_id,
     is_deleted, created_at, updated_at)
SELECT tenant_id, 'unassigned', '未分配组',
       '仅用于标记尚未归属业务组的账户，不得承载资源归属或组作用域授权',
       'unassigned', TRUE, NULL, FALSE, NOW(), NOW()
FROM tenants
ON CONFLICT (tenant_id, code) WHERE NOT is_deleted DO UPDATE
SET group_type = 'unassigned',
    is_builtin = TRUE,
    leader_id = NULL,
    updated_at = NOW();

CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_group_unassigned_active
    ON sys_group(tenant_id)
    WHERE group_type = 'unassigned' AND NOT is_deleted;

CREATE TABLE authorization_tenant_cutover (
    tenant_id           VARCHAR(64) PRIMARY KEY,
    status              VARCHAR(16) NOT NULL DEFAULT 'preparing',
    cutover_epoch       BIGINT NOT NULL DEFAULT 0,
    last_preflight_at   TIMESTAMP,
    enforced_at         TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by          BIGINT,
    CONSTRAINT ck_authorization_tenant_cutover_status
        CHECK (status IN ('preparing', 'frozen', 'enforced', 'rollback'))
);

INSERT INTO authorization_tenant_cutover (tenant_id, status)
SELECT tenant_id, 'preparing'
FROM (
    SELECT tenant_id FROM sys_user WHERE NOT is_deleted
    UNION
    SELECT tenant_id FROM sys_group WHERE NOT is_deleted
) tenants
ON CONFLICT (tenant_id) DO NOTHING;
