-- V35: ci_model 新增 display_name 列
-- CiModel.java 实体类有 displayName 字段，但 V14 创建表时遗漏了该列
-- 导致所有涉及 CiModel 的 API（如 GET /api/cmdb/models）返回 500

ALTER TABLE ci_model ADD COLUMN IF NOT EXISTS display_name VARCHAR(256);
COMMENT ON COLUMN ci_model.display_name IS '模型显示名称';

-- 为已有记录设置默认值：使用 name 作为 display_name
UPDATE ci_model SET display_name = name WHERE display_name IS NULL;
