-- V68: CMDB metadata unique keys must ignore soft-deleted rows.
-- V14 created table-level UNIQUE constraints before the BaseEntity soft-delete
-- convention was fully applied. Those constraints still reserve business keys
-- after a row is logically deleted, so recreating a custom model with the same
-- model_id fails with a duplicate-key 500. Replace them with partial unique
-- indexes that only apply to active rows.

ALTER TABLE ci_model_group
    DROP CONSTRAINT IF EXISTS ci_model_group_tenant_id_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_model_group_active_code
    ON ci_model_group(tenant_id, code)
    WHERE NOT is_deleted;

ALTER TABLE ci_model
    DROP CONSTRAINT IF EXISTS ci_model_tenant_id_model_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_model_active_model_id
    ON ci_model(tenant_id, model_id)
    WHERE NOT is_deleted;

ALTER TABLE ci_attribute_group
    DROP CONSTRAINT IF EXISTS ci_attribute_group_tenant_id_model_id_group_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_attribute_group_active_group_id
    ON ci_attribute_group(tenant_id, model_id, group_id)
    WHERE NOT is_deleted;

ALTER TABLE ci_attribute
    DROP CONSTRAINT IF EXISTS ci_attribute_tenant_id_model_id_field_key_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_attribute_active_field_key
    ON ci_attribute(tenant_id, model_id, field_key)
    WHERE NOT is_deleted;

ALTER TABLE ci_association_kind
    DROP CONSTRAINT IF EXISTS ci_association_kind_tenant_id_kind_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_association_kind_active_kind_id
    ON ci_association_kind(tenant_id, kind_id)
    WHERE NOT is_deleted;

ALTER TABLE ci_association_def
    DROP CONSTRAINT IF EXISTS ci_association_def_tenant_id_def_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_ci_association_def_active_def_id
    ON ci_association_def(tenant_id, def_id)
    WHERE NOT is_deleted;
