-- V22: 修复主机 inner_ip 属性——非必填、可编辑
UPDATE ci_attribute
SET is_required = FALSE, is_editable = TRUE
WHERE model_id = 'host' AND field_key = 'inner_ip';
