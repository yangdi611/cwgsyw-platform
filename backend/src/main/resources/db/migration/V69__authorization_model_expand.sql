-- Unified authorization model: expand-only schema.
-- This migration must not rewrite existing accounts, passwords, legacy role links, or sessions.

ALTER TABLE sys_role
    ADD COLUMN IF NOT EXISTS role_type VARCHAR(16) NOT NULL DEFAULT 'functional',
    ADD COLUMN IF NOT EXISTS is_builtin BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_legacy BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE sys_role
SET role_type = CASE WHEN code IN ('super_admin', 'admin') THEN 'management' ELSE 'functional' END,
    is_builtin = code IN ('super_admin', 'admin', 'group_leader', 'member', 'doc_admin'),
    is_legacy = code IN ('group_leader', 'member', 'doc_admin')
WHERE code IN ('super_admin', 'admin', 'group_leader', 'member', 'doc_admin');

ALTER TABLE sys_role
    DROP CONSTRAINT IF EXISTS ck_sys_role_type;
ALTER TABLE sys_role
    ADD CONSTRAINT ck_sys_role_type CHECK (role_type IN ('management', 'functional'));

CREATE TABLE sys_user_group_membership (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'default',
    user_id             BIGINT NOT NULL REFERENCES sys_user(id),
    group_id            BIGINT NOT NULL REFERENCES sys_group(id),
    membership_role     VARCHAR(16) NOT NULL DEFAULT 'member',
    is_primary          BOOLEAN NOT NULL DEFAULT FALSE,
    origin_type         VARCHAR(16) NOT NULL DEFAULT 'manual',
    origin_key          VARCHAR(255),
    migration_run_id    VARCHAR(64),
    created_by          BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP,
    deleted_by          BIGINT,
    CONSTRAINT ck_user_group_membership_role
        CHECK (membership_role IN ('leader', 'member')),
    CONSTRAINT ck_user_group_membership_origin
        CHECK (origin_type IN ('manual', 'migration', 'compatibility'))
);

CREATE UNIQUE INDEX uq_user_group_membership_active
    ON sys_user_group_membership(tenant_id, user_id, group_id)
    WHERE NOT is_deleted;
CREATE UNIQUE INDEX uq_user_primary_group_active
    ON sys_user_group_membership(tenant_id, user_id)
    WHERE is_primary AND NOT is_deleted;
CREATE UNIQUE INDEX uq_user_group_membership_origin
    ON sys_user_group_membership(origin_type, origin_key)
    WHERE origin_key IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_user_group_membership_group
    ON sys_user_group_membership(tenant_id, group_id)
    WHERE NOT is_deleted;

CREATE TABLE sys_role_assignment (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL DEFAULT 'default',
    user_id             BIGINT NOT NULL REFERENCES sys_user(id),
    role_id             BIGINT NOT NULL REFERENCES sys_role(id),
    scope_type          VARCHAR(16) NOT NULL,
    scope_id            BIGINT,
    valid_from          TIMESTAMP,
    valid_until         TIMESTAMP,
    origin_type         VARCHAR(16) NOT NULL DEFAULT 'manual',
    origin_key          VARCHAR(255),
    migration_run_id    VARCHAR(64),
    created_by          BIGINT,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by          BIGINT,
    is_deleted          BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at          TIMESTAMP,
    deleted_by          BIGINT,
    CONSTRAINT ck_role_assignment_scope
        CHECK (scope_type IN ('platform', 'tenant', 'group', 'project')),
    CONSTRAINT ck_role_assignment_scope_id
        CHECK (
            (scope_type IN ('platform', 'tenant') AND scope_id IS NULL)
            OR (scope_type IN ('group', 'project') AND scope_id IS NOT NULL)
        ),
    CONSTRAINT ck_role_assignment_origin
        CHECK (origin_type IN ('manual', 'migration', 'compatibility'))
);

CREATE UNIQUE INDEX uq_role_assignment_active
    ON sys_role_assignment(tenant_id, user_id, role_id, scope_type, (COALESCE(scope_id, 0)))
    WHERE NOT is_deleted;
CREATE UNIQUE INDEX uq_role_assignment_origin
    ON sys_role_assignment(origin_type, origin_key)
    WHERE origin_key IS NOT NULL AND NOT is_deleted;
CREATE INDEX idx_role_assignment_user
    ON sys_role_assignment(tenant_id, user_id)
    WHERE NOT is_deleted;

CREATE TABLE authorization_migration_run (
    run_id              VARCHAR(64) PRIMARY KEY,
    migration_type      VARCHAR(64) NOT NULL,
    source_snapshot_at  TIMESTAMP NOT NULL,
    source_count        BIGINT NOT NULL DEFAULT 0,
    migrated_count      BIGINT NOT NULL DEFAULT 0,
    skipped_count       BIGINT NOT NULL DEFAULT 0,
    error_count         BIGINT NOT NULL DEFAULT 0,
    status              VARCHAR(24) NOT NULL,
    started_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    finished_at         TIMESTAMP,
    approved_by         BIGINT,
    approved_at         TIMESTAMP,
    report_uri          VARCHAR(512),
    CONSTRAINT ck_authorization_migration_run_status
        CHECK (status IN ('prepared', 'running', 'reconciled', 'approved', 'rolled_back', 'failed'))
);

CREATE TABLE authorization_migration_exception (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              VARCHAR(64) NOT NULL REFERENCES authorization_migration_run(run_id),
    tenant_id           VARCHAR(64) NOT NULL,
    user_id             BIGINT,
    source_type         VARCHAR(32) NOT NULL,
    source_key          VARCHAR(255) NOT NULL,
    reason_code         VARCHAR(64) NOT NULL,
    source_snapshot_json JSONB NOT NULL DEFAULT '{}',
    resolution_status   VARCHAR(24) NOT NULL DEFAULT 'open',
    resolution_note     VARCHAR(500),
    resolved_by         BIGINT,
    resolved_at         TIMESTAMP,
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_authorization_migration_exception_status
        CHECK (resolution_status IN ('open', 'resolved', 'accepted_legacy')),
    UNIQUE(run_id, source_type, source_key)
);

CREATE TABLE authorization_migration_lineage (
    id                  BIGSERIAL PRIMARY KEY,
    run_id              VARCHAR(64) NOT NULL REFERENCES authorization_migration_run(run_id),
    tenant_id           VARCHAR(64) NOT NULL,
    source_type         VARCHAR(32) NOT NULL,
    source_key          VARCHAR(255) NOT NULL,
    target_type         VARCHAR(32) NOT NULL,
    target_id           BIGINT NOT NULL,
    source_hash         VARCHAR(128) NOT NULL,
    migrated_at         TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE(run_id, source_type, source_key)
);

CREATE TABLE authorization_account_rollout (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL,
    user_id             BIGINT NOT NULL REFERENCES sys_user(id),
    module              VARCHAR(64) NOT NULL,
    migration_state     VARCHAR(16) NOT NULL DEFAULT 'legacy',
    last_reconciled_at  TIMESTAMP,
    reconciliation_hash VARCHAR(128),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_authorization_account_rollout_state
        CHECK (migration_state IN ('legacy', 'shadow', 'eligible', 'enforced', 'exception')),
    UNIQUE(tenant_id, user_id, module)
);

CREATE TABLE authorization_decision_diff (
    id                  BIGSERIAL PRIMARY KEY,
    tenant_id           VARCHAR(64) NOT NULL,
    user_id             BIGINT NOT NULL,
    module              VARCHAR(64) NOT NULL,
    permission_code     VARCHAR(128) NOT NULL,
    resource_type       VARCHAR(32) NOT NULL,
    resource_id         BIGINT NOT NULL,
    legacy_allowed      BOOLEAN NOT NULL,
    new_allowed         BOOLEAN NOT NULL,
    new_reason_code     VARCHAR(64),
    observed_at         TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_authorization_decision_diff_open
    ON authorization_decision_diff(tenant_id, module, observed_at DESC)
    WHERE legacy_allowed <> new_allowed;

CREATE TABLE resource_acl_entry (
    id              BIGSERIAL PRIMARY KEY,
    tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default',
    resource_type   VARCHAR(32) NOT NULL,
    resource_id     BIGINT NOT NULL,
    entry_type      VARCHAR(16) NOT NULL DEFAULT 'access',
    subject_type    VARCHAR(16) NOT NULL,
    subject_id      BIGINT NOT NULL,
    permissions     SMALLINT NOT NULL,
    created_by      BIGINT,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_by      BIGINT,
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CONSTRAINT ck_resource_acl_resource_type
        CHECK (resource_type IN ('wiki_space', 'wiki_page', 'shared_folder', 'shared_file')),
    CONSTRAINT ck_resource_acl_entry_type
        CHECK (entry_type IN ('access', 'default')),
    CONSTRAINT ck_resource_acl_subject_type
        CHECK (subject_type IN ('user', 'group')),
    CONSTRAINT ck_resource_acl_permissions
        CHECK (permissions BETWEEN 0 AND 7)
);

CREATE UNIQUE INDEX uq_resource_acl_entry_active
    ON resource_acl_entry(
        tenant_id, resource_type, resource_id,
        entry_type, subject_type, subject_id
    ) WHERE NOT is_deleted;

ALTER TABLE wiki_space
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS owner_group_id BIGINT,
    ADD COLUMN IF NOT EXISTS permission_mode SMALLINT,
    ADD COLUMN IF NOT EXISTS access_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE wiki_page
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS owner_group_id BIGINT,
    ADD COLUMN IF NOT EXISTS permission_mode SMALLINT,
    ADD COLUMN IF NOT EXISTS access_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shared_folder
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS owner_group_id BIGINT,
    ADD COLUMN IF NOT EXISTS permission_mode SMALLINT,
    ADD COLUMN IF NOT EXISTS access_version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE shared_file
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS owner_group_id BIGINT,
    ADD COLUMN IF NOT EXISTS permission_mode SMALLINT,
    ADD COLUMN IF NOT EXISTS access_version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE wiki_space ADD CONSTRAINT ck_wiki_space_permission_mode
    CHECK (permission_mode IS NULL OR (permission_mode >= 0 AND (permission_mode & 1535) = permission_mode));
ALTER TABLE wiki_page ADD CONSTRAINT ck_wiki_page_permission_mode
    CHECK (permission_mode IS NULL OR (permission_mode >= 0 AND (permission_mode & 1535) = permission_mode));
ALTER TABLE shared_folder ADD CONSTRAINT ck_shared_folder_permission_mode
    CHECK (permission_mode IS NULL OR (permission_mode >= 0 AND (permission_mode & 1535) = permission_mode));
ALTER TABLE shared_file ADD CONSTRAINT ck_shared_file_permission_mode
    CHECK (permission_mode IS NULL OR (permission_mode >= 0 AND (permission_mode & 1535) = permission_mode));
