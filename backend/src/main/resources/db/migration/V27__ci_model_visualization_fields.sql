-- V27: ci_model 新增可视化字段（color + enable_2d_view）

ALTER TABLE ci_model
ADD COLUMN IF NOT EXISTS color VARCHAR(7),
ADD COLUMN IF NOT EXISTS enable_2d_view BOOLEAN NOT NULL DEFAULT FALSE;

-- 为内置模型分配默认颜色
UPDATE ci_model SET color = '#1890FF' WHERE name = 'host' AND color IS NULL;
UPDATE ci_model SET color = '#52C41A' WHERE name = 'app'  AND color IS NULL;

-- 主机模型默认启用 2D 视图（有 idc/rack 属性，适合网格展示）
UPDATE ci_model SET enable_2d_view = TRUE WHERE name = 'host';
