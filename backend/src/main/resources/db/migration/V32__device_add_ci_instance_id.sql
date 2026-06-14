-- V27: Add ci_instance_id to device table for CMDB ↔ device association

ALTER TABLE device ADD COLUMN ci_instance_id BIGINT;
