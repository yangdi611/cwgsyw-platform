-- V38: 为 color IS NULL 的 ci_model 回填默认颜色
-- V27 仅设置了 name = 'host' 和 name = 'app' 的颜色，
-- 其他已有模型 color 为 NULL → 全局 Jackson non_null 配置导致客户端收不到 color 字段

UPDATE ci_model
SET color = CASE
    WHEN name = 'host'    THEN '#1890FF'
    WHEN name = 'app'     THEN '#52C41A'
    WHEN name = 'router'  THEN '#722ED1'
    WHEN name = 'switch'  THEN '#13C2C2'
    WHEN name = 'db'      THEN '#FA8C16'
    WHEN name = 'middleware' THEN '#EB2F96'
    WHEN name = 'loadbalancer' THEN '#2F54EB'
    WHEN name = 'firewall' THEN '#F5222D'
    WHEN name = 'storage' THEN '#A0D911'
    ELSE '#1890FF'
END
WHERE color IS NULL AND is_deleted = FALSE;
