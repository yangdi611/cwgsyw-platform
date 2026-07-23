-- Correct the out-of-scope V93-V108 cleanup. The unified-task program owns
-- only legacy daily-report and ops-schedule objects; it must not remove
-- contracts belonging to AI, backup, configuration, notification, CMDB, RBAC,
-- Wiki, or shared-file modules. This is intentionally a forward repair so
-- databases that already applied V93-V108 regain the supported schemas.

-- AI call telemetry
CREATE TABLE IF NOT EXISTS ai_call_log (
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
CREATE INDEX IF NOT EXISTS idx_ai_call_log_tenant ON ai_call_log(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_call_log_operator ON ai_call_log(operator_id, created_at DESC);

-- Backup catalog, system configuration, notification, and CMDB contracts.
ALTER TABLE backup_record
    ADD COLUMN IF NOT EXISTS backup_type VARCHAR(32) NOT NULL DEFAULT 'manual',
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS updated_by BIGINT;

ALTER TABLE sys_config ADD COLUMN IF NOT EXISTS description VARCHAR(255);
INSERT INTO sys_config (tenant_id, config_key, config_value, description)
VALUES ('default', 'watermark.font_size', '36', '水印字体大小（pt）')
ON CONFLICT (tenant_id, config_key) DO NOTHING;

ALTER TABLE notification_message
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS created_by BIGINT,
    ADD COLUMN IF NOT EXISTS updated_by BIGINT;
CREATE INDEX IF NOT EXISTS idx_notification_user
    ON notification_message(user_id, is_read) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_notification_tenant
    ON notification_message(tenant_id, created_at DESC) WHERE NOT is_deleted;

ALTER TABLE cmdb_alert ADD COLUMN IF NOT EXISTS raw_labels TEXT;

-- Restore the independently owned authorization migration and legacy ACL
-- contracts. V93 already materialized the supported assignment/ACL records;
-- recover the original relationship rows where their meaning is reversible.
CREATE TABLE IF NOT EXISTS sys_user_role (
    user_id BIGINT NOT NULL REFERENCES sys_user(id),
    role_id BIGINT NOT NULL REFERENCES sys_role(id),
    PRIMARY KEY(user_id, role_id)
);

INSERT INTO sys_user_role (user_id, role_id)
SELECT assignment.user_id, assignment.role_id
FROM sys_role_assignment assignment
JOIN sys_user user_account ON user_account.id = assignment.user_id
JOIN sys_role role ON role.id = assignment.role_id
WHERE assignment.origin_type = 'migration'
  AND NOT assignment.is_deleted
  AND NOT user_account.is_deleted
  AND NOT role.is_deleted
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS wiki_space_acl (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    space_id     BIGINT      NOT NULL REFERENCES wiki_space(id),
    subject_type VARCHAR(16) NOT NULL,
    subject_id   BIGINT      NOT NULL,
    permissions  JSONB       NOT NULL DEFAULT '[]',
    created_by   BIGINT,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    deleted_by   BIGINT
);
CREATE INDEX IF NOT EXISTS idx_wiki_space_acl_space ON wiki_space_acl(space_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_wiki_space_acl_tenant ON wiki_space_acl(tenant_id) WHERE NOT is_deleted;

CREATE TABLE IF NOT EXISTS wiki_page_acl (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    page_id      BIGINT      NOT NULL,
    subject_type VARCHAR(16) NOT NULL,
    subject_id   BIGINT      NOT NULL,
    permissions  JSONB       NOT NULL DEFAULT '[]',
    created_by   BIGINT,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    deleted_by   BIGINT
);
CREATE INDEX IF NOT EXISTS idx_wiki_page_acl_page ON wiki_page_acl(page_id) WHERE NOT is_deleted;

ALTER TABLE shared_folder ADD COLUMN IF NOT EXISTS acl_inherited BOOLEAN NOT NULL DEFAULT TRUE;
CREATE TABLE IF NOT EXISTS shared_folder_acl (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64) NOT NULL DEFAULT 'default',
    folder_id    BIGINT      NOT NULL,
    subject_type VARCHAR(16) NOT NULL,
    subject_id   BIGINT      NOT NULL,
    permissions  JSONB       NOT NULL DEFAULT '[]',
    created_by   BIGINT,
    created_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    is_deleted   BOOLEAN     NOT NULL DEFAULT FALSE,
    deleted_at   TIMESTAMP,
    deleted_by   BIGINT
);
CREATE INDEX IF NOT EXISTS idx_sfa_folder ON shared_folder_acl(folder_id) WHERE NOT is_deleted;
CREATE INDEX IF NOT EXISTS idx_sfa_tenant ON shared_folder_acl(tenant_id) WHERE NOT is_deleted;

-- Rebuild the JSON ACL rows from the normalized bitset model when V93 has
-- already removed the source rows. Bit 4=read, 2=write, 1=manage/create.
INSERT INTO wiki_space_acl (tenant_id, space_id, subject_type, subject_id, permissions, created_by, created_at, updated_at)
SELECT tenant_id, resource_id, subject_type, subject_id,
       CASE WHEN permissions & 2 <> 0
            THEN '["create", "update", "delete", "publish"]'::jsonb
            ELSE '[]'::jsonb END,
       created_by, created_at, updated_at
FROM resource_acl_entry
WHERE resource_type = 'wiki_space' AND entry_type = 'access' AND NOT is_deleted;

INSERT INTO wiki_page_acl (tenant_id, page_id, subject_type, subject_id, permissions, created_by, created_at, updated_at)
SELECT tenant_id, resource_id, subject_type, subject_id,
       (CASE WHEN permissions & 4 <> 0 THEN '["read"]'::jsonb ELSE '[]'::jsonb END)
       || (CASE WHEN permissions & 2 <> 0 THEN '["write", "delete", "publish"]'::jsonb ELSE '[]'::jsonb END),
       created_by, created_at, updated_at
FROM resource_acl_entry
WHERE resource_type = 'wiki_page' AND entry_type = 'access' AND NOT is_deleted;

INSERT INTO shared_folder_acl (tenant_id, folder_id, subject_type, subject_id, permissions, created_by, created_at, updated_at)
SELECT tenant_id, resource_id, subject_type, subject_id,
       (CASE WHEN permissions & 4 <> 0 THEN '["read"]'::jsonb ELSE '[]'::jsonb END)
       || (CASE WHEN permissions & 2 <> 0 THEN '["write", "update", "delete"]'::jsonb ELSE '[]'::jsonb END),
       created_by, created_at, updated_at
FROM resource_acl_entry
WHERE resource_type = 'shared_folder' AND entry_type = 'access' AND NOT is_deleted;

CREATE TABLE IF NOT EXISTS authorization_migration_run (
    run_id VARCHAR(64) PRIMARY KEY,
    migration_type VARCHAR(64) NOT NULL,
    source_snapshot_at TIMESTAMP NOT NULL,
    source_count BIGINT NOT NULL DEFAULT 0,
    migrated_count BIGINT NOT NULL DEFAULT 0,
    skipped_count BIGINT NOT NULL DEFAULT 0,
    error_count BIGINT NOT NULL DEFAULT 0,
    status VARCHAR(24) NOT NULL,
    started_at TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMP,
    approved_by BIGINT,
    approved_at TIMESTAMP,
    report_uri VARCHAR(512),
    CONSTRAINT ck_authorization_migration_run_status
        CHECK (status IN ('prepared', 'running', 'reconciled', 'approved', 'rolled_back', 'failed'))
);
CREATE TABLE IF NOT EXISTS authorization_migration_exception (
    id BIGSERIAL PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES authorization_migration_run(run_id),
    tenant_id VARCHAR(64) NOT NULL,
    user_id BIGINT,
    source_type VARCHAR(32) NOT NULL,
    source_key VARCHAR(255) NOT NULL,
    reason_code VARCHAR(64) NOT NULL,
    source_snapshot_json JSONB NOT NULL DEFAULT '{}',
    resolution_status VARCHAR(24) NOT NULL DEFAULT 'open',
    resolution_note VARCHAR(500),
    resolved_by BIGINT,
    resolved_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_authorization_migration_exception_status
        CHECK (resolution_status IN ('open', 'resolved', 'accepted_legacy')),
    UNIQUE(run_id, source_type, source_key)
);
CREATE TABLE IF NOT EXISTS authorization_migration_lineage (
    id BIGSERIAL PRIMARY KEY,
    run_id VARCHAR(64) NOT NULL REFERENCES authorization_migration_run(run_id),
    tenant_id VARCHAR(64) NOT NULL,
    source_type VARCHAR(32) NOT NULL,
    source_key VARCHAR(255) NOT NULL,
    target_type VARCHAR(32) NOT NULL,
    target_id BIGINT NOT NULL,
    source_hash VARCHAR(128) NOT NULL,
    migrated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(run_id, source_type, source_key)
);
CREATE TABLE IF NOT EXISTS authorization_account_rollout (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL REFERENCES sys_user(id),
    module VARCHAR(64) NOT NULL,
    migration_state VARCHAR(16) NOT NULL DEFAULT 'legacy',
    last_reconciled_at TIMESTAMP,
    reconciliation_hash VARCHAR(128),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_authorization_account_rollout_state
        CHECK (migration_state IN ('legacy', 'shadow', 'eligible', 'enforced', 'exception')),
    UNIQUE(tenant_id, user_id, module)
);
CREATE TABLE IF NOT EXISTS authorization_decision_diff (
    id BIGSERIAL PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL,
    user_id BIGINT NOT NULL,
    module VARCHAR(64) NOT NULL,
    permission_code VARCHAR(128) NOT NULL,
    resource_type VARCHAR(32) NOT NULL,
    resource_id BIGINT NOT NULL,
    legacy_allowed BOOLEAN NOT NULL,
    new_allowed BOOLEAN NOT NULL,
    new_reason_code VARCHAR(64),
    observed_at TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_authorization_decision_diff_open
    ON authorization_decision_diff(tenant_id, module, observed_at DESC)
    WHERE legacy_allowed <> new_allowed;
CREATE TABLE IF NOT EXISTS authorization_tenant_cutover (
    tenant_id VARCHAR(64) PRIMARY KEY,
    status VARCHAR(16) NOT NULL DEFAULT 'preparing',
    cutover_epoch BIGINT NOT NULL DEFAULT 0,
    last_preflight_at TIMESTAMP,
    enforced_at TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by BIGINT,
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

-- The V72 functions remain in place; restore the active-group invariants that
-- V93 removed together with the legacy ACL tables.
DROP TRIGGER IF EXISTS trg_wiki_page_acl_active_group ON wiki_page_acl;
CREATE TRIGGER trg_wiki_page_acl_active_group
    BEFORE INSERT OR UPDATE ON wiki_page_acl
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('subject_id', 'acl');
DROP TRIGGER IF EXISTS trg_wiki_space_acl_active_group ON wiki_space_acl;
CREATE TRIGGER trg_wiki_space_acl_active_group
    BEFORE INSERT OR UPDATE ON wiki_space_acl
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('subject_id', 'acl');
DROP TRIGGER IF EXISTS trg_shared_folder_acl_active_group ON shared_folder_acl;
CREATE TRIGGER trg_shared_folder_acl_active_group
    BEFORE INSERT OR UPDATE ON shared_folder_acl
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('subject_id', 'acl');
