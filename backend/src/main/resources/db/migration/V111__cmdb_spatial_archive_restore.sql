-- Archived spatial layouts retain history but no longer reserve their room CI.
-- An active room can therefore have one current layout while prior layouts remain auditable.
DROP INDEX uq_ci_spatial_layout_active_room;

CREATE UNIQUE INDEX uq_ci_spatial_layout_active_room
    ON ci_spatial_layout(tenant_id, room_instance_id)
    WHERE NOT is_deleted AND status = 'ACTIVE';
