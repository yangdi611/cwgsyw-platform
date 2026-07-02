-- 变更文档模板表格字段增强
-- 来源 SPEC: docs/plan/changereivew/enhancement1/SPEC.md 第 5 节
-- 说明：
--   * change_doc_field.config 存储字段级 JSON 配置（普通字段为 {}，table 字段存表格模式/列定义）
--   * change_doc.fields_data 已是 JSONB，无需改列类型；仅 Java 侧从 Map<String,String> 升级为 Map<String,Object>

ALTER TABLE change_doc_field
  ADD COLUMN IF NOT EXISTS config JSONB NOT NULL DEFAULT '{}'::jsonb;
