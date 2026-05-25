-- V14: CMDB 元数据层

-- 模型分类（用于在 UI 中对模型分组展示）
CREATE TABLE ci_model_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    icon        VARCHAR(64),
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_built_in BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, code)
);

-- 模型定义
CREATE TABLE ci_model (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    icon        VARCHAR(64),
    group_code  VARCHAR(64),
    description VARCHAR(512),
    is_built_in BOOLEAN      NOT NULL DEFAULT FALSE,
    is_paused   BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by  BIGINT       NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, model_id)
);
CREATE INDEX idx_ci_model_tenant ON ci_model(tenant_id) WHERE NOT is_deleted;

-- 属性分组
CREATE TABLE ci_attribute_group (
    id          BIGSERIAL PRIMARY KEY,
    tenant_id   VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id    VARCHAR(64)  NOT NULL,
    group_id    VARCHAR(64)  NOT NULL,
    name        VARCHAR(128) NOT NULL,
    is_default  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_built_in BOOLEAN      NOT NULL DEFAULT FALSE,
    sort_order  INTEGER      NOT NULL DEFAULT 0,
    is_deleted  BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, model_id, group_id)
);

-- 属性定义
CREATE TABLE ci_attribute (
    id            BIGSERIAL PRIMARY KEY,
    tenant_id     VARCHAR(64)  NOT NULL DEFAULT 'default',
    model_id      VARCHAR(64)  NOT NULL,
    field_key     VARCHAR(64)  NOT NULL,
    name          VARCHAR(128) NOT NULL,
    group_id      VARCHAR(64),
    field_type    VARCHAR(32)  NOT NULL,
    option        JSONB,
    default_val   TEXT,
    placeholder   VARCHAR(255),
    unit          VARCHAR(32),
    is_required   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_editable   BOOLEAN      NOT NULL DEFAULT TRUE,
    is_unique     BOOLEAN      NOT NULL DEFAULT FALSE,
    is_built_in   BOOLEAN      NOT NULL DEFAULT FALSE,
    is_list_show  BOOLEAN      NOT NULL DEFAULT TRUE,
    sort_order    INTEGER      NOT NULL DEFAULT 0,
    is_deleted    BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    created_by    BIGINT       NOT NULL DEFAULT 0,
    UNIQUE(tenant_id, model_id, field_key)
);
CREATE INDEX idx_ci_attribute_model ON ci_attribute(tenant_id, model_id) WHERE NOT is_deleted;

-- 关联种类
CREATE TABLE ci_association_kind (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64)  NOT NULL DEFAULT 'default',
    kind_id      VARCHAR(64)  NOT NULL,
    name         VARCHAR(128) NOT NULL,
    src_to_dst   VARCHAR(64),
    dst_to_src   VARCHAR(64),
    is_built_in  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, kind_id)
);

-- 模型关联定义
CREATE TABLE ci_association_def (
    id           BIGSERIAL PRIMARY KEY,
    tenant_id    VARCHAR(64)  NOT NULL DEFAULT 'default',
    def_id       VARCHAR(128) NOT NULL,
    kind_id      VARCHAR(64)  NOT NULL,
    src_model_id VARCHAR(64)  NOT NULL,
    dst_model_id VARCHAR(64)  NOT NULL,
    name         VARCHAR(128),
    mapping      VARCHAR(8)   NOT NULL DEFAULT 'n:n',
    on_delete    VARCHAR(16)  NOT NULL DEFAULT 'none',
    is_built_in  BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted   BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, def_id)
);

-- ── 内置模型分类种子数据 ──────────────────────────────────────────────────────
INSERT INTO ci_model_group (tenant_id, code, name, icon, sort_order, is_built_in) VALUES
('default', 'host_manage',   '主机管理',   'server',     1, TRUE),
('default', 'network',       '网络设备',   'network',    2, TRUE),
('default', 'app_manage',    '应用管理',   'app',        3, TRUE),
('default', 'middleware',    '中间件',     'database',   4, TRUE),
('default', 'datacenter',    '数据中心',   'building',   5, TRUE);

-- ── 内置关联种类种子数据 ──────────────────────────────────────────────────────
INSERT INTO ci_association_kind (tenant_id, kind_id, name, src_to_dst, dst_to_src, is_built_in) VALUES
('default', 'bk_mainline', '主线拓扑', '属于',   '包含',   TRUE),
('default', 'belong',      '属于',     '属于',   '包含',   TRUE),
('default', 'run',         '运行',     '运行在', '运行着', TRUE),
('default', 'connect',     '连接',     '连接',   '连接',   TRUE),
('default', 'depend',      '依赖',     '依赖',   '被依赖', TRUE),
('default', 'deploy',      '部署',     '部署到', '部署着', TRUE);

-- ── 内置主机模型 ──────────────────────────────────────────────────────────────
INSERT INTO ci_model (tenant_id, model_id, name, icon, group_code, description, is_built_in, sort_order)
VALUES ('default', 'host', '主机', 'server', 'host_manage', '物理机/虚拟机', TRUE, 1);

INSERT INTO ci_attribute_group (tenant_id, model_id, group_id, name, is_default, is_built_in, sort_order)
VALUES
('default', 'host', 'base',     '基本信息', TRUE,  TRUE, 1),
('default', 'host', 'hardware', '硬件信息', FALSE, TRUE, 2),
('default', 'host', 'network',  '网络信息', FALSE, TRUE, 3);

INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default', 'host', 'inner_ip',    '内网IP',     'base',     'singlechar', TRUE,  FALSE, TRUE,  TRUE,  1),
('default', 'host', 'outer_ip',    '外网IP',     'network',  'singlechar', FALSE, TRUE,  FALSE, TRUE,  2),
('default', 'host', 'hostname',    '主机名',     'base',     'singlechar', FALSE, TRUE,  FALSE, TRUE,  3),
('default', 'host', 'os_type',     '操作系统',   'base',     'enum',       FALSE, TRUE,  FALSE, TRUE,  4),
('default', 'host', 'os_version',  'OS版本',     'base',     'singlechar', FALSE, TRUE,  FALSE, TRUE,  5),
('default', 'host', 'cpu_cores',   'CPU核心数',  'hardware', 'int',        FALSE, TRUE,  FALSE, TRUE,  6),
('default', 'host', 'mem_gb',      '内存(GB)',   'hardware', 'int',        FALSE, TRUE,  FALSE, TRUE,  7),
('default', 'host', 'disk_gb',     '磁盘(GB)',   'hardware', 'int',        FALSE, TRUE,  FALSE, TRUE,  8),
('default', 'host', 'operator',    '主要负责人', 'base',     'objuser',    FALSE, TRUE,  FALSE, TRUE,  9),
('default', 'host', 'env',         '环境',       'base',     'enum',       FALSE, TRUE,  FALSE, TRUE,  10),
('default', 'host', 'status',      '状态',       'base',     'enum',       FALSE, TRUE,  FALSE, TRUE,  11),
('default', 'host', 'comment',     '备注',       'base',     'longchar',   FALSE, TRUE,  FALSE, TRUE,  12);

UPDATE ci_attribute SET option = '[
  {"id":"linux",   "name":"Linux",   "is_default":true},
  {"id":"windows", "name":"Windows", "is_default":false},
  {"id":"aix",     "name":"AIX",     "is_default":false},
  {"id":"other",   "name":"其他",    "is_default":false}
]'::jsonb WHERE model_id='host' AND field_key='os_type';

UPDATE ci_attribute SET option = '[
  {"id":"prod",    "name":"生产",   "is_default":false},
  {"id":"staging", "name":"预发布", "is_default":false},
  {"id":"test",    "name":"测试",   "is_default":false},
  {"id":"dev",     "name":"开发",   "is_default":true}
]'::jsonb WHERE model_id='host' AND field_key='env';

UPDATE ci_attribute SET option = '[
  {"id":"running",  "name":"运行中", "is_default":true},
  {"id":"stopped",  "name":"已停机", "is_default":false},
  {"id":"fault",    "name":"故障",   "is_default":false},
  {"id":"maintain", "name":"维护中", "is_default":false}
]'::jsonb WHERE model_id='host' AND field_key='status';

-- ── 内置应用模型 ──────────────────────────────────────────────────────────────
INSERT INTO ci_model (tenant_id, model_id, name, icon, group_code, description, is_built_in, sort_order)
VALUES ('default', 'app', '应用', 'app', 'app_manage', '业务应用系统', TRUE, 2);

INSERT INTO ci_attribute_group (tenant_id, model_id, group_id, name, is_default, is_built_in, sort_order)
VALUES ('default', 'app', 'base', '基本信息', TRUE, TRUE, 1);

INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default', 'app', 'app_name',    '应用名称', 'base', 'singlechar', TRUE,  TRUE, TRUE,  TRUE, 1),
('default', 'app', 'app_code',    '应用代码', 'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, 2),
('default', 'app', 'owner',       '负责人',   'base', 'objuser',    FALSE, TRUE, FALSE, TRUE, 3),
('default', 'app', 'repo_url',    '代码仓库', 'base', 'singlechar', FALSE, TRUE, FALSE, TRUE, 4),
('default', 'app', 'description', '描述',     'base', 'longchar',   FALSE, TRUE, FALSE, TRUE, 5);

-- ── RBAC ─────────────────────────────────────────────────────────────────────
INSERT INTO sys_resource (code, name, actions, sort_order) VALUES
('cmdb_model',    'CMDB模型管理', '["read","write"]',                             70),
('cmdb_instance', 'CMDB实例管理', '["create","read","update","delete","export"]', 71);

INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, r.name || '-' || a.action
FROM sys_resource r,
     LATERAL jsonb_array_elements_text(r.actions) AS a(action)
WHERE r.code IN ('cmdb_model', 'cmdb_instance');

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code IN ('super_admin', 'admin')
  AND p.code LIKE 'cmdb_%'
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code IN ('group_leader', 'member', 'viewer')
  AND p.code IN ('cmdb_model:read', 'cmdb_instance:read')
ON CONFLICT DO NOTHING;

INSERT INTO sys_role_permission (role_id, permission_id)
SELECT r.id, p.id FROM sys_role r, sys_permission p
WHERE r.code IN ('group_leader', 'member')
  AND p.code IN ('cmdb_instance:create', 'cmdb_instance:update', 'cmdb_instance:delete')
ON CONFLICT DO NOTHING;
