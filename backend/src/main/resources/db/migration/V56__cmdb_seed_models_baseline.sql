-- V56: CMDB 全面模型预制 baseline（硬件/数据库/中间件/IDC 模型 + 标量属性 + 维保字段 + 关联定义）
-- 阶段：P1。仅标量属性，不种 field_type='table'（前端表单 String 化陷阱，见 spec §0.12/§4）。
-- 全部 tenant_id='default'、is_built_in=TRUE。所有 INSERT 用 ON CONFLICT DO NOTHING 保证幂等。
-- canonical 收敛（spec §0.14）：host 的 sn(V20)/inner_ip/cpu_cores/mem_gb/disk_gb(V14) 全部沿用，绝不重插。
-- 注：icon/description/sort_order/placeholder/unit/default_val 实体不映射，但种子 SQL 直接写库有效。

-- ============================================================
-- 块 1：模型分组（ci_model_group）—— 新增 hardware / database
-- 复用现有：network / middleware / datacenter / host_manage。sort_order 8/9 避开运行时组 rack(6)/cloud_pool(7)。
-- ============================================================
INSERT INTO ci_model_group (tenant_id, code, name, icon, sort_order, is_built_in) VALUES
('default', 'hardware', '硬件设备', 'server',   8, TRUE),
('default', 'database', '数据库',   'database', 9, TRUE)
ON CONFLICT (tenant_id, code) DO NOTHING;

-- ============================================================
-- 块 2：新模型（ci_model）—— 必须同时写 name 与 display_name（spec §0.3）
-- ============================================================
INSERT INTO ci_model (tenant_id, model_id, name, display_name, icon, group_code, description, is_built_in, sort_order) VALUES
('default','storage',    '存储节点',      '存储节点',      'database','hardware',  '集中/分布式存储设备',  TRUE, 10),
('default','san_switch', 'SAN交换机节点', 'SAN交换机节点', 'network', 'network',   '光纤存储交换机',       TRUE, 11),
('default','net_switch', '网络交换机节点','网络交换机节点','network', 'network',   '以太网交换机/路由',    TRUE, 12),
('default','mysql',      'MySQL实例',     'MySQL实例',     'database','database',  'MySQL 数据库实例',     TRUE, 13),
('default','ob',         'OceanBase实例', 'OceanBase实例', 'database','database',  'OceanBase 实例',       TRUE, 14),
('default','oracle',     'Oracle实例',    'Oracle实例',    'database','database',  'Oracle 数据库实例',    TRUE, 15),
('default','redis',      'Redis',         'Redis',         'database','middleware','Redis 缓存',           TRUE, 16),
('default','kafka',      'Kafka',         'Kafka',         'database','middleware','Kafka 消息队列',       TRUE, 17),
('default','nginx',      'Nginx',         'Nginx',         'app',     'middleware','Nginx 网关/代理',      TRUE, 18),
('default','building',   '楼宇',          '楼宇',          'building','datacenter','机房楼宇',             TRUE, 19),
('default','idc_room',   '机房',          '机房',          'building','datacenter','数据中心机房',         TRUE, 20),
('default','rack',       'RACK机柜',      'RACK机柜',      'server',  'datacenter','机柜（2D 视图）',      TRUE, 21)
ON CONFLICT (tenant_id, model_id) DO NOTHING;

-- 配色（拓扑/机柜图用）
UPDATE ci_model SET color='#1890FF' WHERE tenant_id='default' AND model_id='host'       AND color IS NULL;
UPDATE ci_model SET color='#13C2C2' WHERE tenant_id='default' AND model_id='storage'    AND color IS NULL;
UPDATE ci_model SET color='#722ED1' WHERE tenant_id='default' AND model_id='san_switch' AND color IS NULL;
UPDATE ci_model SET color='#2F54EB' WHERE tenant_id='default' AND model_id='net_switch' AND color IS NULL;
UPDATE ci_model SET color='#FA8C16' WHERE tenant_id='default' AND model_id='mysql'      AND color IS NULL;
UPDATE ci_model SET color='#FA541C' WHERE tenant_id='default' AND model_id='ob'         AND color IS NULL;
UPDATE ci_model SET color='#F5222D' WHERE tenant_id='default' AND model_id='oracle'     AND color IS NULL;
UPDATE ci_model SET color='#EB2F96' WHERE tenant_id='default' AND model_id='redis'      AND color IS NULL;
UPDATE ci_model SET color='#52C41A' WHERE tenant_id='default' AND model_id='kafka'      AND color IS NULL;
UPDATE ci_model SET color='#A0D911' WHERE tenant_id='default' AND model_id='nginx'      AND color IS NULL;
UPDATE ci_model SET color='#8C8C8C' WHERE tenant_id='default' AND model_id='building'   AND color IS NULL;
UPDATE ci_model SET color='#595959' WHERE tenant_id='default' AND model_id='idc_room'   AND color IS NULL;
UPDATE ci_model SET color='#1F1F1F' WHERE tenant_id='default' AND model_id='rack'       AND color IS NULL;
-- rack 启用 2D 视图（机柜图 §5 用它判定）
UPDATE ci_model SET enable_2d_view=TRUE WHERE tenant_id='default' AND model_id='rack';

-- ============================================================
-- 块 3：属性分组（ci_attribute_group）—— 写 group_id 与 code 双列（spec §0.2）
-- host 已有 base/hardware/network（V14），仅追加缺失组。is_default=TRUE 每模型仅一个（base）。
-- ============================================================
INSERT INTO ci_attribute_group (tenant_id, model_id, group_id, code, name, is_default, is_built_in, sort_order) VALUES
-- host 追加组（base/hardware/network 已存在，不重插）
('default','host','location',  'location',  '位置信息',   FALSE, TRUE, 4),
('default','host','os',        'os',        '操作系统',   FALSE, TRUE, 5),
('default','host','software',  'software',  '软件服务',   FALSE, TRUE, 7),
('default','host','account',   'account',   '账号权限',   FALSE, TRUE, 8),
('default','host','security',  'security',  '安全基线',   FALSE, TRUE, 9),
('default','host','ha_backup', 'ha_backup', '高可用备份', FALSE, TRUE, 10),
('default','host','ops',       'ops',       '运维信息',   FALSE, TRUE, 11),
-- storage 专属组
('default','storage','base',     'base',     '基本信息', TRUE,  TRUE, 1),
('default','storage','location', 'location', '位置信息', FALSE, TRUE, 2),
('default','storage','capacity', 'capacity', '容量信息', FALSE, TRUE, 3),
-- san_switch 专属组
('default','san_switch','base',     'base',     '基本信息', TRUE,  TRUE, 1),
('default','san_switch','location', 'location', '位置信息', FALSE, TRUE, 2),
('default','san_switch','fabric',   'fabric',   'Fabric',   FALSE, TRUE, 3),
-- net_switch 专属组
('default','net_switch','base',     'base',     '基本信息', TRUE,  TRUE, 1),
('default','net_switch','location', 'location', '位置信息', FALSE, TRUE, 2),
('default','net_switch','net',      'net',      '网络信息', FALSE, TRUE, 3),
-- mysql / ob / oracle 专属组
('default','mysql', 'base',   'base',   '基本信息', TRUE,  TRUE, 1),
('default','mysql', 'engine', 'engine', '引擎配置', FALSE, TRUE, 2),
('default','ob',    'base',   'base',   '基本信息', TRUE,  TRUE, 1),
('default','ob',    'engine', 'engine', '引擎配置', FALSE, TRUE, 2),
('default','oracle','base',   'base',   '基本信息', TRUE,  TRUE, 1),
('default','oracle','engine', 'engine', '引擎配置', FALSE, TRUE, 2),
-- redis / kafka / nginx 专属组
('default','redis','base',   'base',   '基本信息', TRUE,  TRUE, 1),
('default','redis','engine', 'engine', '引擎配置', FALSE, TRUE, 2),
('default','kafka','base',   'base',   '基本信息', TRUE,  TRUE, 1),
('default','kafka','engine', 'engine', '引擎配置', FALSE, TRUE, 2),
('default','nginx','base',   'base',   '基本信息', TRUE,  TRUE, 1),
('default','nginx','engine', 'engine', '引擎配置', FALSE, TRUE, 2),
-- IDC 三模型专属组
('default','building','base',     'base',     '基本信息', TRUE,  TRUE, 1),
('default','idc_room','base',     'base',     '基本信息', TRUE,  TRUE, 1),
('default','idc_room','env_grp',  'env_grp',  '机电环境', FALSE, TRUE, 2),
('default','rack',    'base',     'base',     '基本信息', TRUE,  TRUE, 1),
('default','rack',    'location', 'location', '位置信息', FALSE, TRUE, 2)
ON CONFLICT (tenant_id, model_id, group_id) DO NOTHING;

-- maintenance（维保）组：对所有预制模型批量插（unnest），sort_order=20 置末尾
INSERT INTO ci_attribute_group (tenant_id, model_id, group_id, code, name, is_default, is_built_in, sort_order)
SELECT 'default', m.model_id, 'maintenance', 'maintenance', '维保信息', FALSE, TRUE, 20
FROM (VALUES
  ('host'),('storage'),('san_switch'),('net_switch'),
  ('mysql'),('ob'),('oracle'),('redis'),('kafka'),('nginx'),
  ('building'),('idc_room'),('rack')
) AS m(model_id)
WHERE EXISTS (SELECT 1 FROM ci_model cm WHERE cm.tenant_id='default' AND cm.model_id=m.model_id AND NOT cm.is_deleted)
ON CONFLICT (tenant_id, model_id, group_id) DO NOTHING;

-- ============================================================
-- 块 4：标量属性（ci_attribute）—— 列序同 V14
-- 仅标量类型（singlechar/longchar/int/float/bool/enum/enummulti/objuser/date）。不种 table。
-- host：仅追加新键，canonical 字段（sn/inner_ip/cpu_cores/mem_gb/disk_gb）绝不重插（spec §0.14）。
-- ============================================================
-- 块 4a：host 追加标量（§7B A/B/C/F/I/J/K 区中尚不存在的字段）
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
-- 身份与资产（base 组，避开保留键 status/owner/name）
('default','host','asset_no',       '资产编号',     'base',     'singlechar', FALSE, TRUE, TRUE,  TRUE, 20),
('default','host','host_type',      '主机类型',     'base',     'enum',       FALSE, TRUE, FALSE, TRUE, 21),
('default','host','manufacturer',   '厂商',         'base',     'singlechar', FALSE, TRUE, FALSE, TRUE, 22),
('default','host','product_model',  '型号',         'base',     'singlechar', FALSE, TRUE, FALSE, TRUE, 23),
('default','host','op_team',        '运维团队',     'base',     'singlechar', FALSE, TRUE, FALSE, TRUE, 24),
('default','host','biz_system',     '所属业务系统', 'base',     'singlechar', FALSE, TRUE, FALSE, TRUE, 25),
('default','host','lifecycle',      '生命周期',     'base',     'enum',       FALSE, TRUE, FALSE, TRUE, 26),
('default','host','purchase_date',  '采购日期',     'base',     'date',       FALSE, TRUE, FALSE, TRUE, 27),
('default','host','import_date',    '上架日期',     'base',     'date',       FALSE, TRUE, FALSE, TRUE, 28),
-- 位置（location 组）
('default','host','u_start',        '开始U位',      'location', 'int',        FALSE, TRUE, FALSE, TRUE, 30),
('default','host','u_end',          '结束U位',      'location', 'int',        FALSE, TRUE, FALSE, TRUE, 31),
('default','host','mgmt_ip',        '管理IP',       'location', 'singlechar', FALSE, TRUE, FALSE, TRUE, 32),
('default','host','region',         '区域',         'location', 'singlechar', FALSE, TRUE, FALSE, TRUE, 33),
('default','host','az',             '可用区',       'location', 'singlechar', FALSE, TRUE, FALSE, TRUE, 34),
('default','host','cloud_account',  '云账号',       'location', 'singlechar', FALSE, TRUE, FALSE, TRUE, 35),
-- 硬件（hardware 组，cpu_cores/mem_gb/disk_gb 已存在不重插）
('default','host','cpu_model',      'CPU型号',      'hardware', 'singlechar', FALSE, TRUE, FALSE, TRUE, 40),
('default','host','cpu_sockets',    '物理CPU数',    'hardware', 'int',        FALSE, TRUE, FALSE, TRUE, 41),
('default','host','mem_slots',      '内存插槽',     'hardware', 'singlechar', FALSE, TRUE, FALSE, TRUE, 42),
-- 操作系统（os 组）
('default','host','kernel_version', '内核版本',     'os',       'singlechar', FALSE, TRUE, FALSE, TRUE, 50),
('default','host','arch',           'CPU架构',      'os',       'enum',       FALSE, TRUE, FALSE, TRUE, 51),
('default','host','os_install_date','OS安装日期',   'os',       'date',       FALSE, TRUE, FALSE, TRUE, 52),
('default','host','timezone',       '时区',         'os',       'singlechar', FALSE, TRUE, FALSE, TRUE, 53),
('default','host','boot_mode',      '启动模式',     'os',       'enum',       FALSE, TRUE, FALSE, TRUE, 54),
('default','host','selinux',        'SELinux',      'os',       'enum',       FALSE, TRUE, FALSE, TRUE, 55),
('default','host','swap_gb',        'Swap(GB)',     'os',       'int',        FALSE, TRUE, FALSE, TRUE, 56),
-- 网络（network 组）
('default','host','dns_servers',    'DNS服务器',    'network',  'singlechar', FALSE, TRUE, FALSE, TRUE, 60),
('default','host','ntp_servers',    'NTP服务器',    'network',  'singlechar', FALSE, TRUE, FALSE, TRUE, 61),
('default','host','default_gateway','默认网关',     'network',  'singlechar', FALSE, TRUE, FALSE, TRUE, 62),
-- 安全基线（security 组）
('default','host','patch_level',     '补丁基线',    'security', 'singlechar', FALSE, TRUE, FALSE, TRUE, 70),
('default','host','last_patch_date', '最近打补丁',  'security', 'date',       FALSE, TRUE, FALSE, TRUE, 71),
('default','host','antivirus',       '杀毒软件',    'security', 'singlechar', FALSE, TRUE, FALSE, TRUE, 72),
('default','host','compliance_status','合规状态',   'security', 'enum',       FALSE, TRUE, FALSE, TRUE, 73),
('default','host','cve_open_count',  '未修复高危',  'security', 'int',        FALSE, TRUE, FALSE, TRUE, 74),
-- 高可用备份（ha_backup 组）
('default','host','ha_role',         '高可用角色',  'ha_backup','enum',       FALSE, TRUE, FALSE, TRUE, 80),
('default','host','cluster_name',    '所属集群',    'ha_backup','singlechar', FALSE, TRUE, FALSE, TRUE, 81),
('default','host','monitor_status',  '监控纳管',    'ha_backup','bool',       FALSE, TRUE, FALSE, TRUE, 82),
('default','host','dr_site',         '容灾站点',    'ha_backup','singlechar', FALSE, TRUE, FALSE, TRUE, 83),
-- 运维（ops 组）
('default','host','criticality',     '重要等级',    'ops',      'enum',       FALSE, TRUE, FALSE, TRUE, 90),
('default','host','sla_level',       'SLA等级',     'ops',      'singlechar', FALSE, TRUE, FALSE, TRUE, 91),
('default','host','doc_url',         '文档链接',    'ops',      'singlechar', FALSE, TRUE, FALSE, TRUE, 92),
('default','host','data_source',     '数据来源',    'ops',      'enum',       FALSE, TRUE, FALSE, TRUE, 93),
('default','host','change_window',   '变更窗口',    'ops',      'singlechar', FALSE, TRUE, FALSE, TRUE, 94)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4b：硬件公共标量（storage/san_switch/net_switch 各一份，§5）—— host 已在 4a 单独处理
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order)
SELECT 'default', m.model_id, f.field_key, f.name, f.group_id, f.field_type, FALSE, TRUE, f.is_unique, TRUE, f.sort_order
FROM (VALUES ('storage'),('san_switch'),('net_switch')) AS m(model_id)
CROSS JOIN (VALUES
  ('asset_no',   '资产编号', 'base',     'singlechar', TRUE,  1),
  ('sn',         '序列号',   'base',     'singlechar', FALSE, 2),
  ('brand',      '品牌',     'base',     'singlechar', FALSE, 3),
  ('model_spec', '型号规格', 'base',     'singlechar', FALSE, 4),
  ('hw_status',  '设备状态', 'base',     'enum',       FALSE, 5),
  ('mgmt_ip',    '管理IP',   'location', 'singlechar', FALSE, 10),
  ('u_start',    '开始U位',  'location', 'int',        FALSE, 11),
  ('u_end',      '结束U位',  'location', 'int',        FALSE, 12)
) AS f(field_key, name, group_id, field_type, is_unique, sort_order)
WHERE EXISTS (SELECT 1 FROM ci_model cm WHERE cm.tenant_id='default' AND cm.model_id=m.model_id AND NOT cm.is_deleted)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4c：storage 专属标量
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default','storage','storage_type',        '存储类型',   'base',     'enum',       FALSE, TRUE, FALSE, TRUE, 20),
('default','storage','controller_count',    '控制器数',   'base',     'int',        FALSE, TRUE, FALSE, TRUE, 21),
('default','storage','firmware_version',    '微码版本',   'base',     'singlechar', FALSE, TRUE, FALSE, TRUE, 22),
('default','storage','raw_capacity_tb',     '裸容量(TB)', 'capacity', 'float',      FALSE, TRUE, FALSE, TRUE, 30),
('default','storage','usable_capacity_tb',  '可用容量(TB)','capacity','float',      FALSE, TRUE, FALSE, TRUE, 31),
('default','storage','cache_gb',            '缓存(GB)',   'capacity', 'int',        FALSE, TRUE, FALSE, TRUE, 32)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4d：san_switch 专属标量
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default','san_switch','fabric_name', '所属Fabric', 'fabric','singlechar', FALSE, TRUE, FALSE, TRUE, 20),
('default','san_switch','os_name',     '交换机OS',   'fabric','singlechar', FALSE, TRUE, FALSE, TRUE, 21),
('default','san_switch','os_version',  'OS版本',     'fabric','singlechar', FALSE, TRUE, FALSE, TRUE, 22),
('default','san_switch','domain_id',   'Domain ID',  'fabric','int',        FALSE, TRUE, FALSE, TRUE, 23),
('default','san_switch','port_total',  '端口总数',   'fabric','int',        FALSE, TRUE, FALSE, TRUE, 24),
('default','san_switch','port_speed',  '端口速率',   'fabric','enum',       FALSE, TRUE, FALSE, TRUE, 25)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4e：net_switch 专属标量
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default','net_switch','switch_role', '交换机角色', 'net','enum',       FALSE, TRUE, FALSE, TRUE, 20),
('default','net_switch','os_name',     '交换机OS',   'net','singlechar', FALSE, TRUE, FALSE, TRUE, 21),
('default','net_switch','os_version',  'OS版本',     'net','singlechar', FALSE, TRUE, FALSE, TRUE, 22),
('default','net_switch','port_total',  '端口总数',   'net','int',        FALSE, TRUE, FALSE, TRUE, 23),
('default','net_switch','port_speed',  '端口速率',   'net','enum',       FALSE, TRUE, FALSE, TRUE, 24),
('default','net_switch','is_stack',    '是否堆叠',   'net','bool',       FALSE, TRUE, FALSE, TRUE, 25)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4f：数据库公共标量（mysql/ob/oracle 各一份，§7D）
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order)
SELECT 'default', m.model_id, f.field_key, f.name, f.group_id, f.field_type, FALSE, TRUE, FALSE, TRUE, f.sort_order
FROM (VALUES ('mysql'),('ob'),('oracle')) AS m(model_id)
CROSS JOIN (VALUES
  ('db_port',       '端口',     'base',   'int',        1),
  ('db_version',    '版本',     'base',   'singlechar', 2),
  ('instance_role', '实例角色', 'base',   'enum',       3),
  ('char_set',      '字符集',   'base',   'singlechar', 4),
  ('data_dir',      '数据目录', 'engine', 'singlechar', 5),
  ('db_owner',      '负责人',   'base',   'objuser',    6),
  ('deploy_mode',   '部署模式', 'base',   'enum',       7),
  ('data_size_gb',  '数据量(GB)','engine','int',        8)
) AS f(field_key, name, group_id, field_type, sort_order)
WHERE EXISTS (SELECT 1 FROM ci_model cm WHERE cm.tenant_id='default' AND cm.model_id=m.model_id AND NOT cm.is_deleted)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4g：DB 引擎特有标量
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default','mysql','binlog_mode',       'Binlog模式',    'engine','enum',       FALSE, TRUE, FALSE, TRUE, 10),
('default','mysql','gtid_mode',         'GTID模式',      'engine','bool',       FALSE, TRUE, FALSE, TRUE, 11),
('default','mysql','innodb_buffer_gb',  'InnoDB缓冲(GB)','engine','int',        FALSE, TRUE, FALSE, TRUE, 12),
('default','mysql','max_conn',          '最大连接数',    'engine','int',        FALSE, TRUE, FALSE, TRUE, 13),
('default','ob','cluster_name',         '集群名',        'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 10),
('default','ob','zone',                 'Zone',          'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 11),
('default','ob','tenant_name',          '租户名',        'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 12),
('default','ob','rs_list',              'RS列表',        'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 13),
('default','oracle','sid',              'SID',           'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 10),
('default','oracle','service_name',     '服务名',        'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 11),
('default','oracle','pdb_name',         'PDB名',         'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 12),
('default','oracle','cdb_mode',         'CDB模式',       'engine','bool',       FALSE, TRUE, FALSE, TRUE, 13),
('default','oracle','sga_gb',           'SGA(GB)',       'engine','int',        FALSE, TRUE, FALSE, TRUE, 14),
('default','oracle','archive_mode',     '归档模式',      'engine','bool',       FALSE, TRUE, FALSE, TRUE, 15)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4h：中间件公共标量（redis/kafka/nginx 各一份，§7D）
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order)
SELECT 'default', m.model_id, f.field_key, f.name, f.group_id, f.field_type, FALSE, TRUE, FALSE, TRUE, f.sort_order
FROM (VALUES ('redis'),('kafka'),('nginx')) AS m(model_id)
CROSS JOIN (VALUES
  ('mw_version',   '版本',     'base',   'singlechar', 1),
  ('install_path', '安装路径', 'engine', 'singlechar', 2),
  ('listen_port',  '监听端口', 'base',   'int',        3),
  ('runtime_user', '运行用户', 'engine', 'singlechar', 4),
  ('cluster_mode', '集群模式', 'base',   'enum',       5)
) AS f(field_key, name, group_id, field_type, sort_order)
WHERE EXISTS (SELECT 1 FROM ci_model cm WHERE cm.tenant_id='default' AND cm.model_id=m.model_id AND NOT cm.is_deleted)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4i：中间件引擎特有标量
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
('default','redis','maxmemory_mb',   '最大内存(MB)', 'engine','int',        FALSE, TRUE, FALSE, TRUE, 10),
('default','redis','persist_mode',   '持久化模式',   'engine','enum',       FALSE, TRUE, FALSE, TRUE, 11),
('default','kafka','broker_count',   'Broker数',     'engine','int',        FALSE, TRUE, FALSE, TRUE, 10),
('default','kafka','zk_address',     'ZK地址',       'engine','singlechar', FALSE, TRUE, FALSE, TRUE, 11),
('default','nginx','worker_count',   'Worker数',     'engine','int',        FALSE, TRUE, FALSE, TRUE, 10)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- 块 4j：IDC 三模型标量
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order) VALUES
-- building
('default','building','building_code', '楼宇编码', 'base','singlechar', FALSE, TRUE, TRUE,  TRUE, 1),
('default','building','address',       '地址',     'base','singlechar', FALSE, TRUE, FALSE, TRUE, 2),
('default','building','floors',        '楼层数',   'base','int',        FALSE, TRUE, FALSE, TRUE, 3),
-- idc_room
('default','idc_room','room_code',     '机房编码', 'base',   'singlechar', FALSE, TRUE, TRUE,  TRUE, 1),
('default','idc_room','floor',         '所在楼层', 'base',   'singlechar', FALSE, TRUE, FALSE, TRUE, 2),
('default','idc_room','area_sqm',      '面积(㎡)', 'base',   'float',      FALSE, TRUE, FALSE, TRUE, 3),
('default','idc_room','power_kw',      '总功率(kW)','env_grp','float',     FALSE, TRUE, FALSE, TRUE, 10),
('default','idc_room','cooling_type',  '制冷方式', 'env_grp','enum',       FALSE, TRUE, FALSE, TRUE, 11),
('default','idc_room','pue',           'PUE',      'env_grp','float',      FALSE, TRUE, FALSE, TRUE, 12),
-- rack
('default','rack','rack_height_u',     '机柜U数',  'base',    'int',        FALSE, TRUE, FALSE, TRUE, 1),
('default','rack','rack_no',           '机柜编号', 'base',    'singlechar', FALSE, TRUE, TRUE,  TRUE, 2),
('default','rack','power_capacity_w',  '供电容量(W)','base',  'int',        FALSE, TRUE, FALSE, TRUE, 3),
('default','rack','owner_team',        '归属团队', 'base',    'singlechar', FALSE, TRUE, FALSE, TRUE, 4),
('default','rack','rack_row',          '所在列',   'location','singlechar', FALSE, TRUE, FALSE, TRUE, 10),
('default','rack','rack_position',     '位置坐标', 'location','singlechar', FALSE, TRUE, FALSE, TRUE, 11)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- ============================================================
-- 块 5：维保字段批量插（§7C）—— 对所有预制模型 unnest 笛卡尔积
-- maintenance 组已在块 3 批量建。K8s/resource_pool 的维保字段由启动期 seeder 单独处理（spec §3）。
-- ============================================================
INSERT INTO ci_attribute (tenant_id, model_id, field_key, name, group_id, field_type, is_required, is_editable, is_unique, is_built_in, sort_order)
SELECT 'default', m.model_id, f.field_key, f.name, 'maintenance', f.field_type, FALSE, TRUE, FALSE, TRUE, f.sort_order
FROM (VALUES
  ('host'),('storage'),('san_switch'),('net_switch'),
  ('mysql'),('ob'),('oracle'),('redis'),('kafka'),('nginx'),
  ('building'),('idc_room'),('rack')
) AS m(model_id)
CROSS JOIN (VALUES
  ('vendor',            '维保厂商',   'singlechar', 1),
  ('maint_level',       '维保级别',   'enum',       2),
  ('maint_status',      '维保状态',   'enum',       3),
  ('maint_start',       '维保起始',   'date',       4),
  ('maint_expire',      '维保到期',   'date',       5),
  ('maint_contract_no', '维保合同号', 'singlechar', 6),
  ('maint_contact',     '维保联系人', 'singlechar', 7),
  ('maint_response_sla','响应SLA',    'singlechar', 8),
  ('maint_remark',      '维保备注',   'longchar',   9)
) AS f(field_key, name, field_type, sort_order)
WHERE EXISTS (SELECT 1 FROM ci_model cm WHERE cm.tenant_id='default' AND cm.model_id=m.model_id AND NOT cm.is_deleted)
ON CONFLICT (tenant_id, model_id, field_key) DO NOTHING;

-- ============================================================
-- 块 6：enum option 回填（UPDATE ... option）—— JSONB 数组，键 id/name/is_default（V14 惯例）
-- 不带 model_id 的 UPDATE 会更新所有模型同名字段（维保字段正需如此）；专属 enum 加 AND model_id=...
-- ============================================================
-- 维保级别 / 维保状态（全模型统一）
UPDATE ci_attribute SET option='[
  {"id":"oem","name":"原厂","is_default":true},
  {"id":"gold","name":"金牌","is_default":false},
  {"id":"silver","name":"银牌","is_default":false},
  {"id":"thirdparty","name":"第三方","is_default":false},
  {"id":"none","name":"无维保","is_default":false}
]'::jsonb WHERE tenant_id='default' AND field_key='maint_level';

UPDATE ci_attribute SET option='[
  {"id":"active","name":"在保","is_default":false},
  {"id":"expiring","name":"即将到期","is_default":false},
  {"id":"expired","name":"已过保","is_default":false},
  {"id":"none","name":"未维保","is_default":true}
]'::jsonb WHERE tenant_id='default' AND field_key='maint_status';

-- 设备状态（storage/san_switch/net_switch 公共 hw_status）
UPDATE ci_attribute SET option='[
  {"id":"in_use","name":"在用","is_default":true},
  {"id":"standby","name":"备用","is_default":false},
  {"id":"offline","name":"下线","is_default":false},
  {"id":"fault","name":"故障","is_default":false}
]'::jsonb WHERE tenant_id='default' AND field_key='hw_status';

-- host 专属 enum
UPDATE ci_attribute SET option='[
  {"id":"physical","name":"物理机","is_default":true},
  {"id":"virtual","name":"虚拟机","is_default":false},
  {"id":"cloud","name":"云主机","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='host_type';
UPDATE ci_attribute SET option='[
  {"id":"in_use","name":"在用","is_default":true},
  {"id":"standby","name":"备用","is_default":false},
  {"id":"offline","name":"下线","is_default":false},
  {"id":"scrapped","name":"报废","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='lifecycle';
UPDATE ci_attribute SET option='[
  {"id":"x86_64","name":"x86_64","is_default":true},
  {"id":"arm64","name":"arm64","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='arch';
UPDATE ci_attribute SET option='[
  {"id":"uefi","name":"UEFI","is_default":true},
  {"id":"bios","name":"BIOS","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='boot_mode';
UPDATE ci_attribute SET option='[
  {"id":"enforcing","name":"enforcing","is_default":false},
  {"id":"permissive","name":"permissive","is_default":false},
  {"id":"disabled","name":"disabled","is_default":true}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='selinux';
UPDATE ci_attribute SET option='[
  {"id":"compliant","name":"合规","is_default":false},
  {"id":"non_compliant","name":"不合规","is_default":false},
  {"id":"unchecked","name":"未核查","is_default":true}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='compliance_status';
UPDATE ci_attribute SET option='[
  {"id":"master","name":"主","is_default":false},
  {"id":"standby","name":"备","is_default":false},
  {"id":"single","name":"单点","is_default":true}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='ha_role';
UPDATE ci_attribute SET option='[
  {"id":"core","name":"核心","is_default":false},
  {"id":"important","name":"重要","is_default":false},
  {"id":"normal","name":"一般","is_default":true}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='criticality';
UPDATE ci_attribute SET option='[
  {"id":"manual","name":"手工","is_default":true},
  {"id":"script","name":"脚本导入","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='host' AND field_key='data_source';

-- storage / 交换机专属 enum
UPDATE ci_attribute SET option='[
  {"id":"centralized","name":"集中式","is_default":true},
  {"id":"distributed","name":"分布式","is_default":false},
  {"id":"nas","name":"NAS","is_default":false},
  {"id":"san","name":"SAN","is_default":false},
  {"id":"object","name":"对象存储","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='storage' AND field_key='storage_type';
UPDATE ci_attribute SET option='[
  {"id":"8g","name":"8G","is_default":false},
  {"id":"16g","name":"16G","is_default":true},
  {"id":"32g","name":"32G","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='san_switch' AND field_key='port_speed';
UPDATE ci_attribute SET option='[
  {"id":"core","name":"核心","is_default":false},
  {"id":"aggregation","name":"汇聚","is_default":false},
  {"id":"access","name":"接入","is_default":true},
  {"id":"tor","name":"ToR","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='net_switch' AND field_key='switch_role';
UPDATE ci_attribute SET option='[
  {"id":"1g","name":"1G","is_default":false},
  {"id":"10g","name":"10G","is_default":true},
  {"id":"25g","name":"25G","is_default":false},
  {"id":"40g","name":"40G","is_default":false},
  {"id":"100g","name":"100G","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='net_switch' AND field_key='port_speed';

-- DB 公共 enum（instance_role / deploy_mode 三引擎统一）+ mysql binlog
UPDATE ci_attribute SET option='[
  {"id":"primary","name":"主","is_default":true},
  {"id":"standby","name":"备","is_default":false},
  {"id":"readonly","name":"只读","is_default":false}
]'::jsonb WHERE tenant_id='default' AND field_key='instance_role';
UPDATE ci_attribute SET option='[
  {"id":"single","name":"单机","is_default":true},
  {"id":"master_slave","name":"主从","is_default":false},
  {"id":"cluster","name":"集群","is_default":false}
]'::jsonb WHERE tenant_id='default' AND field_key='deploy_mode';
UPDATE ci_attribute SET option='[
  {"id":"row","name":"ROW","is_default":true},
  {"id":"statement","name":"STATEMENT","is_default":false},
  {"id":"mixed","name":"MIXED","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='mysql' AND field_key='binlog_mode';

-- 中间件 enum（cluster_mode 三模型统一）+ redis 持久化
UPDATE ci_attribute SET option='[
  {"id":"standalone","name":"单机","is_default":true},
  {"id":"cluster","name":"集群","is_default":false}
]'::jsonb WHERE tenant_id='default' AND field_key='cluster_mode';
UPDATE ci_attribute SET option='[
  {"id":"rdb","name":"RDB","is_default":true},
  {"id":"aof","name":"AOF","is_default":false},
  {"id":"both","name":"RDB+AOF","is_default":false},
  {"id":"none","name":"无","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='redis' AND field_key='persist_mode';

-- idc_room 制冷方式
UPDATE ci_attribute SET option='[
  {"id":"precision_ac","name":"精密空调","is_default":true},
  {"id":"chilled_water","name":"冷冻水","is_default":false},
  {"id":"freecooling","name":"自然冷却","is_default":false}
]'::jsonb WHERE tenant_id='default' AND model_id='idc_room' AND field_key='cooling_type';

-- ============================================================
-- 块 7：关联定义（ci_association_def）—— src/dst 用 ASCII model_id（spec §0.1）
-- kind_id 用 V14 内置（bk_mainline/run）。connect 类（host↔netsw 等）留 V58 与 endpoint_link 同期。
-- ============================================================
INSERT INTO ci_association_def (tenant_id, def_id, kind_id, src_model_id, dst_model_id, name, mapping, on_delete, is_built_in) VALUES
-- IDC 主线包含层级：building ⊃ idc_room ⊃ rack ⊃ {host,storage,san_switch,net_switch}
('default','building_contains_room','bk_mainline','building','idc_room',  '楼宇包含机房',     '1:n','none',TRUE),
('default','room_contains_rack',    'bk_mainline','idc_room','rack',      '机房包含机柜',     '1:n','none',TRUE),
('default','rack_contains_host',    'bk_mainline','rack','host',          '机柜装服务器',     '1:n','none',TRUE),
('default','rack_contains_storage', 'bk_mainline','rack','storage',       '机柜装存储',       '1:n','none',TRUE),
('default','rack_contains_san',     'bk_mainline','rack','san_switch',    '机柜装SAN交换机',  '1:n','none',TRUE),
('default','rack_contains_netsw',   'bk_mainline','rack','net_switch',    '机柜装网络交换机', '1:n','none',TRUE),
-- DB/中间件运行在主机
('default','mysql_runs_on_host',    'run','mysql','host',  'MySQL运行在主机',  'n:1','none',TRUE),
('default','ob_runs_on_host',       'run','ob','host',     'OB运行在主机',     'n:1','none',TRUE),
('default','oracle_runs_on_host',   'run','oracle','host', 'Oracle运行在主机', 'n:1','none',TRUE),
('default','redis_runs_on_host',    'run','redis','host',  'Redis运行在主机',  'n:1','none',TRUE),
('default','kafka_runs_on_host',    'run','kafka','host',  'Kafka运行在主机',  'n:1','none',TRUE),
('default','nginx_runs_on_host',    'run','nginx','host',  'Nginx运行在主机',  'n:1','none',TRUE)
ON CONFLICT (tenant_id, def_id) DO NOTHING;

-- V56 结束。connect 类关联 def + ci_endpoint_link 表见 V58（P3）。







