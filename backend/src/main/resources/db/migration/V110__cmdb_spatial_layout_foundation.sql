-- CMDB spatial layout foundation.
-- This migration is additive: existing CMDB instances, relations, rack layout,
-- topology, alerts, and their contracts remain the authoritative sources.

CREATE TABLE ci_spatial_layout (
    id                   BIGSERIAL PRIMARY KEY,
    tenant_id            VARCHAR(64)  NOT NULL DEFAULT 'default',
    room_instance_id     BIGINT       NOT NULL REFERENCES ci_instance(id),
    name                 VARCHAR(128) NOT NULL,
    status               VARCHAR(16)  NOT NULL DEFAULT 'ACTIVE',
    draft_version_id     BIGINT,
    published_version_id BIGINT,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by           BIGINT       NOT NULL DEFAULT 0,
    updated_by           BIGINT       NOT NULL DEFAULT 0,
    is_deleted           BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at           TIMESTAMP,
    deleted_by           BIGINT,
    CONSTRAINT ck_ci_spatial_layout_status CHECK (status IN ('ACTIVE', 'ARCHIVED'))
);

CREATE UNIQUE INDEX uq_ci_spatial_layout_active_room
    ON ci_spatial_layout(tenant_id, room_instance_id)
    WHERE NOT is_deleted;
CREATE INDEX idx_ci_spatial_layout_tenant_status
    ON ci_spatial_layout(tenant_id, status)
    WHERE NOT is_deleted;

CREATE TABLE ci_spatial_layout_version (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    layout_id         BIGINT      NOT NULL REFERENCES ci_spatial_layout(id),
    state             VARCHAR(16) NOT NULL,
    version_no        INTEGER,
    revision          INTEGER     NOT NULL DEFAULT 0,
    schema_version    INTEGER     NOT NULL,
    document_json     JSONB       NOT NULL,
    document_checksum VARCHAR(64) NOT NULL,
    element_count     INTEGER     NOT NULL DEFAULT 0,
    source_version_id BIGINT      REFERENCES ci_spatial_layout_version(id),
    change_summary    VARCHAR(500),
    published_at      TIMESTAMP,
    published_by      BIGINT,
    created_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
    created_by        BIGINT      NOT NULL DEFAULT 0,
    updated_by        BIGINT      NOT NULL DEFAULT 0,
    CONSTRAINT ck_ci_spatial_layout_version_state CHECK (state IN ('DRAFT', 'PUBLISHED')),
    CONSTRAINT ck_ci_spatial_layout_version_revision CHECK (revision >= 0),
    CONSTRAINT ck_ci_spatial_layout_version_schema CHECK (schema_version > 0),
    CONSTRAINT ck_ci_spatial_layout_version_element_count CHECK (element_count >= 0 AND element_count <= 2000),
    CONSTRAINT ck_ci_spatial_layout_version_publish_data CHECK (
        (state = 'DRAFT' AND version_no IS NULL AND published_at IS NULL AND published_by IS NULL)
        OR
        (state = 'PUBLISHED' AND version_no IS NOT NULL AND published_at IS NOT NULL AND published_by IS NOT NULL)
    )
);

CREATE UNIQUE INDEX uq_ci_spatial_layout_single_draft
    ON ci_spatial_layout_version(layout_id)
    WHERE state = 'DRAFT';
CREATE UNIQUE INDEX uq_ci_spatial_layout_published_version_no
    ON ci_spatial_layout_version(layout_id, version_no)
    WHERE state = 'PUBLISHED';
CREATE INDEX idx_ci_spatial_layout_version_lookup
    ON ci_spatial_layout_version(tenant_id, layout_id, state);

ALTER TABLE ci_spatial_layout
    ADD CONSTRAINT fk_ci_spatial_layout_draft_version
        FOREIGN KEY (draft_version_id) REFERENCES ci_spatial_layout_version(id),
    ADD CONSTRAINT fk_ci_spatial_layout_published_version
        FOREIGN KEY (published_version_id) REFERENCES ci_spatial_layout_version(id);

CREATE TABLE ci_spatial_binding (
    id                   BIGSERIAL PRIMARY KEY,
    tenant_id            VARCHAR(64)  NOT NULL DEFAULT 'default',
    layout_id            BIGINT       NOT NULL REFERENCES ci_spatial_layout(id),
    layout_version_id    BIGINT       NOT NULL REFERENCES ci_spatial_layout_version(id) ON DELETE CASCADE,
    room_instance_id     BIGINT       NOT NULL REFERENCES ci_instance(id),
    element_id           UUID         NOT NULL,
    element_type         VARCHAR(32)  NOT NULL,
    ci_instance_id       BIGINT       NOT NULL REFERENCES ci_instance(id),
    ci_model_id_snapshot VARCHAR(64)  NOT NULL,
    display_name_snapshot VARCHAR(128) NOT NULL,
    created_at           TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by           BIGINT       NOT NULL DEFAULT 0,
    CONSTRAINT ck_ci_spatial_binding_element_type CHECK (element_type IN ('RACK_SLOT', 'FACILITY')),
    CONSTRAINT uq_ci_spatial_binding_element UNIQUE (layout_version_id, element_id),
    CONSTRAINT uq_ci_spatial_binding_ci UNIQUE (layout_version_id, ci_instance_id)
);

CREATE INDEX idx_ci_spatial_binding_ci
    ON ci_spatial_binding(tenant_id, ci_instance_id, layout_version_id);
CREATE INDEX idx_ci_spatial_binding_room
    ON ci_spatial_binding(tenant_id, room_instance_id, layout_version_id);

CREATE TABLE ci_spatial_asset (
    id             BIGSERIAL PRIMARY KEY,
    tenant_id      VARCHAR(64)  NOT NULL DEFAULT 'default',
    layout_id      BIGINT       NOT NULL REFERENCES ci_spatial_layout(id),
    asset_type     VARCHAR(24)  NOT NULL,
    object_key     VARCHAR(500) NOT NULL UNIQUE,
    original_name  VARCHAR(255) NOT NULL,
    content_type   VARCHAR(100) NOT NULL,
    byte_size      BIGINT       NOT NULL,
    sha256         VARCHAR(64)  NOT NULL,
    pixel_width    INTEGER      NOT NULL,
    pixel_height   INTEGER      NOT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by     BIGINT       NOT NULL DEFAULT 0,
    is_deleted     BOOLEAN      NOT NULL DEFAULT FALSE,
    deleted_at     TIMESTAMP,
    deleted_by     BIGINT,
    CONSTRAINT ck_ci_spatial_asset_type CHECK (asset_type IN ('REFERENCE_IMAGE', 'THUMBNAIL')),
    CONSTRAINT ck_ci_spatial_asset_size CHECK (byte_size > 0),
    CONSTRAINT ck_ci_spatial_asset_dimensions CHECK (pixel_width > 0 AND pixel_height > 0)
);

CREATE UNIQUE INDEX uq_ci_spatial_asset_content
    ON ci_spatial_asset(tenant_id, layout_id, sha256, asset_type)
    WHERE NOT is_deleted;
CREATE INDEX idx_ci_spatial_asset_layout
    ON ci_spatial_asset(tenant_id, layout_id)
    WHERE NOT is_deleted;

CREATE TABLE ci_spatial_version_asset (
    id                BIGSERIAL PRIMARY KEY,
    tenant_id         VARCHAR(64) NOT NULL DEFAULT 'default',
    layout_version_id BIGINT      NOT NULL REFERENCES ci_spatial_layout_version(id) ON DELETE CASCADE,
    asset_id          BIGINT      NOT NULL REFERENCES ci_spatial_asset(id),
    usage             VARCHAR(24) NOT NULL,
    created_at        TIMESTAMP   NOT NULL DEFAULT NOW(),
    created_by        BIGINT      NOT NULL DEFAULT 0,
    CONSTRAINT ck_ci_spatial_version_asset_usage CHECK (usage IN ('REFERENCE_BACKGROUND')),
    CONSTRAINT uq_ci_spatial_version_asset_usage UNIQUE (layout_version_id, asset_id, usage)
);

CREATE INDEX idx_ci_spatial_version_asset_asset
    ON ci_spatial_version_asset(tenant_id, asset_id);

-- Dedicated spatial layout permissions. Existing CMDB permissions are unchanged.
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('cmdb_spatial', 'CMDB 空间布局', '["read","create","update","publish","delete"]'::jsonb, 59)
ON CONFLICT (code) DO UPDATE
SET name = EXCLUDED.name,
    actions = EXCLUDED.actions,
    sort_order = EXCLUDED.sort_order;

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT resource.id, action.value, resource.code || ':' || action.value,
       resource.name || '-' || action.value
FROM sys_resource resource
CROSS JOIN LATERAL jsonb_array_elements_text(resource.actions) action(value)
WHERE resource.code = 'cmdb_spatial'
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code LIKE 'cmdb_spatial:%'
WHERE role.code IN ('super_admin', 'admin')
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT role.id, permission.id
FROM sys_role role
JOIN sys_permission permission ON permission.code = 'cmdb_spatial:read'
WHERE role.code IN ('group_leader', 'member')
ON CONFLICT DO NOTHING;
