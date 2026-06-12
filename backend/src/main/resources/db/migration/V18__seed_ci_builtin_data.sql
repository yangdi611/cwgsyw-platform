-- V18: 内置模型、属性、关联类型 seed 数据

-- 模型分组
INSERT INTO ci_model_group (code, name, sort_order) VALUES
    ('infra',    '基础设施', 1),
    ('biz',      '业务应用', 2),
    ('network',  '网络设备', 3),
    ('security', '安全设备', 4),
    ('cloud',    '云资源',   5);

-- 模型
INSERT INTO ci_model (name, display_name, group_id, is_built_in) VALUES
    ('host', '主机', (SELECT id FROM ci_model_group WHERE code = 'infra'), TRUE),
    ('app',  '应用', (SELECT id FROM ci_model_group WHERE code = 'biz'),  TRUE);

-- 属性分组
INSERT INTO ci_attribute_group (model_id, code, name, sort_order) VALUES
    ('host', 'base',     '基础属性', 1),
    ('host', 'location', '位置属性', 2),
    ('app',  'base',     '基础属性', 1);

-- host 属性 (12)
INSERT INTO ci_attribute (model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, is_list_show, sort_order, enum_options) VALUES
    ('host', 'hostname',  '主机名',   'base', 'singlechar', TRUE,  TRUE, TRUE,  TRUE, TRUE,  1,  NULL),
    ('host', 'inner_ip',  '内网IP',   'base', 'singlechar', TRUE,  TRUE, TRUE,  TRUE, TRUE,  2,  NULL),
    ('host', 'outer_ip',  '外网IP',   'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, TRUE,  3,  NULL),
    ('host', 'os_type',   '操作系统', 'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 4,  NULL),
    ('host', 'cpu',       'CPU核心数','base', 'int',        FALSE, TRUE, FALSE, TRUE, FALSE, 5,  NULL),
    ('host', 'memory',    '内存(GB)', 'base', 'int',        FALSE, TRUE, FALSE, TRUE, FALSE, 6,  NULL),
    ('host', 'disk',      '磁盘(GB)', 'base', 'int',        FALSE, TRUE, FALSE, TRUE, FALSE, 7,  NULL),
    ('host', 'asset_id',  '资产编号', 'base', 'singlechar', FALSE, TRUE, TRUE,  TRUE, FALSE, 8,  NULL),
    ('host', 'rack',      '机架位置', 'location', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 9,  NULL),
    ('host', 'idc',       '机房',     'location', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 10, NULL),
    ('host', 'status',    '运行状态', 'base', 'enum',       FALSE, TRUE, FALSE, TRUE, TRUE,  11, '["online","offline","maintenance"]'),
    ('host', 'comment',   '备注',     'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 12, NULL);

-- app 属性 (5)
INSERT INTO ci_attribute (model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, is_list_show, sort_order) VALUES
    ('app', 'name',        '应用名称', 'base', 'singlechar', TRUE,  TRUE, FALSE, TRUE, TRUE,  1),
    ('app', 'version',     '版本',     'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 2),
    ('app', 'language',    '开发语言', 'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 3),
    ('app', 'framework',   '框架',     'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 4),
    ('app', 'description', '描述',     'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, FALSE, 5);

-- 关联类型 (5)
INSERT INTO ci_association_kind (code, name, is_built_in) VALUES
    ('bk_mainline', '主线拓扑', TRUE),
    ('belong',      '属于',     TRUE),
    ('run',         '运行',     TRUE),
    ('connect',     '连接',     TRUE),
    ('depend',      '依赖',     TRUE);
