ALTER TABLE daily_report ADD COLUMN ci_instance_ids JSONB DEFAULT '[]'::jsonb;
COMMENT ON COLUMN daily_report.ci_instance_ids IS '关联的 CI 实例 ID 列表';
