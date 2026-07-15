-- V73: protect CMDB relation and device reference integrity.
-- The preflight aborts before adding constraints so operators can resolve legacy
-- conflicts explicitly rather than silently changing active assets.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM ci_instance_rel
        WHERE NOT is_deleted AND src_id = dst_id
    ) THEN
        RAISE EXCEPTION 'Cannot add CMDB self-relation constraint: active self-relations exist';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM device
        WHERE NOT is_deleted AND ci_instance_id IS NOT NULL
        GROUP BY tenant_id, ci_instance_id
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'Cannot add active device-to-CI uniqueness constraint: duplicate associations exist';
    END IF;
END $$;

ALTER TABLE ci_instance_rel
    ADD CONSTRAINT chk_ci_instance_rel_not_self
    CHECK (is_deleted OR src_id <> dst_id);

CREATE UNIQUE INDEX uq_device_active_ci_instance
    ON device(tenant_id, ci_instance_id)
    WHERE NOT is_deleted AND ci_instance_id IS NOT NULL;
