-- V11: 水印配置默认值
INSERT INTO sys_config (tenant_id, config_key, config_value, description) VALUES
('default', 'watermark.text',    'IT运维平台',  '水印文字内容'),
('default', 'watermark.opacity', '0.15',        '水印透明度 0.0-1.0'),
('default', 'watermark.angle',   '45',          '水印角度（度）'),
('default', 'watermark.font_size','36',          '水印字体大小（pt）')
ON CONFLICT (tenant_id, config_key) DO NOTHING;
