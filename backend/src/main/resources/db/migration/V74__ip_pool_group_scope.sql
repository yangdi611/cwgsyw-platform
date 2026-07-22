ALTER TABLE ip_pool ADD COLUMN group_id BIGINT REFERENCES sys_group(id);

CREATE INDEX idx_ip_pool_tenant_group_active
    ON ip_pool(tenant_id, group_id)
    WHERE is_deleted = FALSE;

CREATE TRIGGER trg_ip_pool_active_group
    BEFORE INSERT OR UPDATE ON ip_pool
    FOR EACH ROW EXECUTE FUNCTION enforce_active_group_scalar_reference('group_id');
