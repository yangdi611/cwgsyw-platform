-- Preserve archived-name reuse while enforcing the API's trim-normalized active-name contract.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM sys_group
        WHERE NOT is_deleted
        GROUP BY tenant_id, btrim(name)
        HAVING COUNT(*) > 1
    ) THEN
        RAISE EXCEPTION 'GROUP_ACTIVE_NAME_CONFLICT: active duplicate group names require explicit remediation';
    END IF;
END;
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_sys_group_tenant_name_active
    ON sys_group (tenant_id, btrim(name))
    WHERE NOT is_deleted;
