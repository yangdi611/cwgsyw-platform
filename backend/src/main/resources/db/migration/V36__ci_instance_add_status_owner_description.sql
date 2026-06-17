-- V36: ci_instance 表新增 status/owner/description 列
-- CiInstance.java 实体定义了这些字段，但 V15 建表时遗漏了
-- 导致 MyBatis Plus 生成的 SQL 引用了不存在的列，所有相关 API 返回 500

ALTER TABLE ci_instance
  ADD COLUMN IF NOT EXISTS status      VARCHAR(64),
  ADD COLUMN IF NOT EXISTS owner       VARCHAR(255),
  ADD COLUMN IF NOT EXISTS description VARCHAR(512);

-- 从 attrs JSONB 中提取值回填
UPDATE ci_instance
  SET status      = attrs->>'status',
      owner       = attrs->>'owner',
      description = attrs->>'description'
  WHERE attrs->>'status'      IS NOT NULL
     OR attrs->>'owner'       IS NOT NULL
     OR attrs->>'description' IS NOT NULL;

COMMENT ON COLUMN ci_instance.status      IS '实例状态';
COMMENT ON COLUMN ci_instance.owner       IS '责任人';
COMMENT ON COLUMN ci_instance.description IS '描述';
