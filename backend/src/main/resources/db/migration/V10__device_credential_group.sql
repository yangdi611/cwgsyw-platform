-- V10: 设备凭据按运维组分区

ALTER TABLE device_credential ADD COLUMN group_id BIGINT;

COMMENT ON COLUMN device_credential.group_id IS '所属运维组，NULL 表示通用凭据（仅管理员可见）';

CREATE INDEX idx_device_credential_group ON device_credential(device_id, group_id) WHERE NOT is_deleted;
