-- V83: seed built-in unified task templates in the existing database.
-- 包含：简易任务模板、工作日报模板

-- ============================================================
-- 1. 简易任务模板（用于快速创建）
-- ============================================================
INSERT INTO task_template (
    tenant_id, code, name, category, description, status, builtin, scope_type
) VALUES (
    'default',
    'simple_task',
    '简易任务',
    '通用',
    '用于快速创建一次性简单任务',
    'published',
    TRUE,
    'tenant'
);

-- 获取刚插入的模板 ID（通过 CTE）
WITH template AS (
    SELECT id FROM task_template WHERE code = 'simple_task' AND tenant_id = 'default'
)
INSERT INTO task_template_version (
    tenant_id,
    template_id,
    version,
    status,
    name_snapshot,
    description_snapshot,
    instructions,
    layout_schema,
    published_by,
    published_at
) SELECT
    'default',
    t.id,
    1,
    'published',
    '简易任务',
    '用于快速创建一次性简单任务',
    '<p>请填写任务内容并完成</p>',
    '{
        "sections": [
            {
                "key": "basic",
                "title": "基本信息",
                "columns": 1
            }
        ]
    }'::jsonb,
    0,
    NOW()
FROM template t;

-- 添加简易任务字段
WITH version AS (
    SELECT tv.id
    FROM task_template_version tv
    JOIN task_template t ON tv.template_id = t.id
    WHERE t.code = 'simple_task' AND t.tenant_id = 'default' AND tv.version = 1
)
INSERT INTO task_template_field (
    tenant_id, template_version_id, field_key, label, field_type, sort_order, required,
    validation_config, display_config, visibility_config, analytics_config
)
SELECT
    'default',
    v.id,
    'content',
    '任务内容',
    'textarea',
    1,
    TRUE,
    '{"maxLength": 2000}'::jsonb,
    '{"rows": 5, "placeholder": "请描述任务内容"}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": false}'::jsonb
FROM version v
UNION ALL
SELECT
    'default',
    v.id,
    'attachments',
    '相关附件',
    'file',
    2,
    FALSE,
    '{"maxCount": 10, "maxSize": 52428800, "allowedTypes": ["*"]}'::jsonb,
    '{"accept": "*"}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": false}'::jsonb
FROM version v;

-- 更新模板的 latest_version_id
UPDATE task_template t
SET latest_version_id = (
    SELECT tv.id
    FROM task_template_version tv
    WHERE tv.template_id = t.id AND tv.version = 1
)
WHERE t.code = 'simple_task' AND t.tenant_id = 'default';

-- ============================================================
-- 2. 工作日报模板
-- ============================================================
INSERT INTO task_template (
    tenant_id, code, name, category, description, status, builtin, scope_type
) VALUES (
    'default',
    'daily_work_report',
    '工作日报',
    '日常汇报',
    '每日工作完成情况、问题和明日计划',
    'published',
    TRUE,
    'tenant'
);

-- 日报模板版本
WITH template AS (
    SELECT id FROM task_template WHERE code = 'daily_work_report' AND tenant_id = 'default'
)
INSERT INTO task_template_version (
    tenant_id,
    template_id,
    version,
    status,
    name_snapshot,
    description_snapshot,
    instructions,
    layout_schema,
    published_by,
    published_at
) SELECT
    'default',
    t.id,
    1,
    'published',
    '工作日报',
    '每日工作完成情况、问题和明日计划',
    '<p>请填写今日工作完成情况、遇到的问题和明日计划</p>',
    '{
        "sections": [
            {
                "key": "work",
                "title": "工作内容",
                "columns": 1
            },
            {
                "key": "time",
                "title": "时间与资源",
                "columns": 2
            }
        ]
    }'::jsonb,
    0,
    NOW()
FROM template t;

-- 添加日报字段
WITH version AS (
    SELECT tv.id
    FROM task_template_version tv
    JOIN task_template t ON tv.template_id = t.id
    WHERE t.code = 'daily_work_report' AND t.tenant_id = 'default' AND tv.version = 1
)
INSERT INTO task_template_field (
    tenant_id, template_version_id, field_key, label, field_type, sort_order, required,
    validation_config, display_config, visibility_config, analytics_config
)
SELECT
    'default',
    v.id,
    'completed_items',
    '今日完成事项',
    'textarea',
    1,
    TRUE,
    '{"maxLength": 2000}'::jsonb,
    '{"rows": 5, "placeholder": "请列出今日完成的主要工作"}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": true, "role": ["dimension"], "aggregation": "count"}'::jsonb
FROM version v
UNION ALL
SELECT
    'default',
    v.id,
    'issues',
    '遇到的问题',
    'textarea',
    2,
    FALSE,
    '{"maxLength": 1000}'::jsonb,
    '{"rows": 3, "placeholder": "遇到的问题或困难（可选）"}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": true, "role": ["dimension"], "aggregation": "count"}'::jsonb
FROM version v
UNION ALL
SELECT
    'default',
    v.id,
    'tomorrow_plan',
    '明日计划',
    'textarea',
    3,
    TRUE,
    '{"maxLength": 1000}'::jsonb,
    '{"rows": 3, "placeholder": "请列出明日工作计划"}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": false}'::jsonb
FROM version v
UNION ALL
SELECT
    'default',
    v.id,
    'work_hours',
    '工时（小时）',
    'number',
    4,
    FALSE,
    '{"min": 0, "max": 24, "scale": 1}'::jsonb,
    '{"placeholder": "实际工作时长", "width": 6}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": true, "role": ["metric"], "unit": "小时", "aggregation": "sum", "additivity": "additive"}'::jsonb
FROM version v
UNION ALL
SELECT
    'default',
    v.id,
    'related_ci',
    '关联配置项',
    'ci_scope',
    5,
    FALSE,
    '{"allowModelGroups": true, "allowModels": true, "allowInstances": true, "maxCount": 20}'::jsonb,
    '{"placeholder": "选择相关的 CMDB 配置项", "width": 6}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": true, "role": ["dimension"]}'::jsonb
FROM version v
UNION ALL
SELECT
    'default',
    v.id,
    'attachments',
    '相关附件',
    'file',
    6,
    FALSE,
    '{"maxCount": 10, "maxSize": 52428800, "allowedTypes": ["*"]}'::jsonb,
    '{"accept": "*", "width": 12}'::jsonb,
    '{"executor": "read_write", "approver": "read", "copied": "read", "analytics": true, "export": true}'::jsonb,
    '{"enabled": true, "role": ["attachment"]}'::jsonb
FROM version v;

-- 更新日报模板的 latest_version_id
UPDATE task_template t
SET latest_version_id = (
    SELECT tv.id
    FROM task_template_version tv
    WHERE tv.template_id = t.id AND tv.version = 1
)
WHERE t.code = 'daily_work_report' AND t.tenant_id = 'default';

-- ============================================================
-- 3. 基础巡检模板
-- ============================================================
INSERT INTO task_template (
    tenant_id, code, name, category, description, status, builtin, scope_type
) VALUES (
    'default',
    'basic_inspection',
    '基础巡检',
    '巡检',
    '记录巡检结果、次数、问题、CI 范围和附件',
    'published',
    TRUE,
    'tenant'
);

WITH template AS (
    SELECT id FROM task_template WHERE code = 'basic_inspection' AND tenant_id = 'default'
)
INSERT INTO task_template_version (
    tenant_id, template_id, version, status, name_snapshot, description_snapshot,
    instructions, layout_schema, published_by, published_at
) SELECT
    'default',
    template.id,
    1,
    'published',
    '基础巡检',
    '记录巡检结果、次数、问题、CI 范围和附件',
    '<p>请选择巡检范围并如实填写结果，发现异常时补充问题说明和附件。</p>',
    '{"sections":[{"key":"result","title":"巡检结果","columns":2},{"key":"detail","title":"问题与附件","columns":1}]}'::jsonb,
    0,
    NOW()
FROM template;

WITH version AS (
    SELECT task_template_version.id
    FROM task_template_version
    JOIN task_template ON task_template.id = task_template_version.template_id
    WHERE task_template.code = 'basic_inspection'
      AND task_template.tenant_id = 'default'
      AND task_template_version.version = 1
)
INSERT INTO task_template_field (
    tenant_id, template_version_id, field_key, label, field_type, sort_order, required,
    validation_config, display_config, visibility_config, analytics_config
)
SELECT 'default', version.id, 'inspection_result', '巡检结果', 'select', 1, TRUE,
       '{"options":[{"value":"normal","label":"正常"},{"value":"abnormal","label":"异常"}]}'::jsonb,
       '{"width":6}'::jsonb,
       '{"executor":"read_write","approver":"read","copied":"read","analytics":true,"export":true}'::jsonb,
       '{"enabled":true,"role":["dimension"]}'::jsonb
FROM version
UNION ALL
SELECT 'default', version.id, 'inspection_count', '巡检次数', 'number', 2, TRUE,
       '{"min":0,"scale":0}'::jsonb,
       '{"width":6}'::jsonb,
       '{"executor":"read_write","approver":"read","copied":"read","analytics":true,"export":true}'::jsonb,
       '{"enabled":true,"role":["metric"],"unit":"次","aggregation":"sum","additivity":"additive"}'::jsonb
FROM version
UNION ALL
SELECT 'default', version.id, 'findings', '问题说明', 'textarea', 3, FALSE,
       '{"maxLength":2000}'::jsonb,
       '{"rows":4}'::jsonb,
       '{"executor":"read_write","approver":"read","copied":"read","analytics":true,"export":true}'::jsonb,
       '{"enabled":true,"role":["dimension"],"aggregation":"count"}'::jsonb
FROM version
UNION ALL
SELECT 'default', version.id, 'related_ci', '巡检范围', 'ci_scope', 4, TRUE,
       '{"allowModelGroups":true,"allowModels":true,"allowInstances":true,"maxCount":200}'::jsonb,
       '{"width":12}'::jsonb,
       '{"executor":"read_write","approver":"read","copied":"read","analytics":true,"export":true}'::jsonb,
       '{"enabled":true,"role":["dimension"]}'::jsonb
FROM version
UNION ALL
SELECT 'default', version.id, 'attachments', '巡检附件', 'file', 5, FALSE,
       '{"maxCount":20,"maxSize":52428800,"allowedTypes":["*"]}'::jsonb,
       '{"accept":"*","width":12}'::jsonb,
       '{"executor":"read_write","approver":"read","copied":"read","analytics":true,"export":true}'::jsonb,
       '{"enabled":true,"role":["attachment"]}'::jsonb
FROM version;

UPDATE task_template
SET latest_version_id = (
    SELECT task_template_version.id
    FROM task_template_version
    WHERE task_template_version.template_id = task_template.id
      AND task_template_version.version = 1
)
WHERE code = 'basic_inspection' AND tenant_id = 'default';

-- ============================================================
-- 4. 说明
-- ============================================================
-- 内置模板：
--   1. simple_task: 简易任务（快速创建一次性任务）
--   2. daily_work_report: 工作日报（每日汇报）
--   3. basic_inspection: 基础巡检（CI 范围、计数、问题与附件）
--
-- 后续可通过管理界面：
--   - 复制这些模板创建自定义版本
--   - 创建周报、月报、巡检等其他模板
--   - 配置审批方案和周期计划
