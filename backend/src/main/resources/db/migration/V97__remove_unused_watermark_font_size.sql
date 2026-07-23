-- PDF watermark font size has no administration or presentation contract.
-- Keep the established 36pt rendering default in ExportService instead.
DELETE FROM sys_config
WHERE config_key = 'watermark.font_size';
