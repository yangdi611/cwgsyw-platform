-- V20: CMDB - 主机模型增加内置属性：序列号 (sn)
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, is_list_show, sort_order)
VALUES ('default', 'host', 'sn', '序列号', 'base', 'singlechar', TRUE, FALSE, TRUE, TRUE, TRUE, 0)
ON CONFLICT (tenant_id, model_id, field_key) DO UPDATE SET
    is_deleted  = FALSE,
    is_built_in = TRUE,
    is_editable = FALSE,
    is_required = TRUE,
    is_unique   = TRUE,
    updated_at  = NOW();
