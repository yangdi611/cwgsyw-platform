# 技术 Spec: CMDB Tier 1 — 架构设计

> 基于 PRD: `specs/2026-06-12-cmdb-tier1-prd.md`
> 日期: 2026-06-12
> 作者: Architect
> 状态: Draft — 等待工程审查

---

## 1. 架构决策

### AD-1: 模块结构 — 新建 `module/cmdb/` 子包

在现有 Spring Boot 模块包 `com.cwgsyw.platform.module.cmdb` 下新建完整的 CMDB 子模块，包含 controller / service / mapper / entity / dto 层。不拆分独立 Maven 模块——当前规模不足以引入模块间依赖管理的复杂度。

**包结构:**
```
module/cmdb/
├── controller/
│   ├── CiModelController.java        # 模型 CRUD
│   ├── CiAttributeController.java    # 字段定义 CRUD
│   ├── CiInstanceController.java     # 实例 CRUD + 搜索
│   ├── CiRelationController.java     # 关联关系 CRUD
│   └── CiTopologyController.java     # 拓扑查询
├── service/
│   ├── CiModelService.java
│   ├── CiAttributeService.java
│   ├── CiInstanceService.java
│   ├── CiRelationService.java
│   └── CiTopologyService.java
├── mapper/
│   ├── CiModelMapper.java
│   ├── CiAttributeMapper.java
│   ├── CiAttributeGroupMapper.java
│   ├── CiInstanceMapper.java
│   ├── CiInstanceRelMapper.java
│   ├── CiAssociationKindMapper.java
│   ├── CiAssociationDefMapper.java
│   └── CiModelGroupMapper.java
├── entity/
│   ├── CiModel.java
│   ├── CiAttribute.java
│   ├── CiAttributeGroup.java
│   ├── CiInstance.java
│   ├── CiInstanceRel.java
│   ├── CiAssociationKind.java
│   ├── CiAssociationDef.java
│   └── CiModelGroup.java
└── dto/
    ├── model/
    │   ├── CreateModelRequest.java
    │   ├── UpdateModelRequest.java
    │   └── CiModelVO.java
    ├── attribute/
    │   ├── CreateAttributeRequest.java
    │   ├── UpdateAttributeRequest.java
    │   └── CiAttributeVO.java
    ├── instance/
    │   ├── CreateInstanceRequest.java
    │   ├── UpdateInstanceRequest.java
    │   ├── CiInstanceVO.java
    │   ├── CiInstanceSearchVO.java
    │   └── CiInstanceDetailVO.java
    ├── relation/
    │   ├── CreateRelationRequest.java
    │   └── CiRelationVO.java
    ├── topology/
    │   ├── TopologyNodeVO.java
    │   ├── TopologyEdgeVO.java
    │   └── TopologyResultVO.java
    └── history/
        └── ChangeHistoryVO.java
```

**依据**: 与现有模块（changedoc、user、device、audit）一致的包结构。

### AD-2: 变更历史复用平台 audit_log

CMDB 的变更历史写入现有 `audit_log` 表（`module="cmdb"`），不新建 `cmdb_change_log` 表。查询接口在 CMDB Controller 内提供，内部使用 `AuditLogMapper.queryPage()` 按 `module="cmdb"` + `target_type` + `target_id` 过滤。

**审计事件矩阵:**

| 操作 | action | target_type | beforeJson | afterJson |
|------|--------|-------------|------------|-----------|
| 创建模型 | create_model | ci_model | null | 模型定义快照 |
| 编辑模型 | update_model | ci_model | 编辑前快照 | 编辑后快照 |
| 删除模型 | delete_model | ci_model | 模型快照 | null |
| 新增字段 | create_attribute | ci_attribute | null | 字段定义快照 |
| 编辑字段 | update_attribute | ci_attribute | 编辑前快照 | 编辑后快照 |
| 删除字段 | delete_attribute | ci_attribute | 字段快照 | null |
| 创建实例 | create_instance | ci_instance | null | 实例完整数据 |
| 编辑实例 | update_instance | ci_instance | 编辑前 fields_data | 编辑后 fields_data |
| 删除实例 | delete_instance | ci_instance | 实例完整数据 | null |

**依据**: PRD 明确指定复用 audit_log；V1 已有完整的表结构和 AuditLogMapper。

### AD-3: fields_data JSONB 的 schema 校验策略

使用**服务端校验**（不依赖数据库 JSON Schema 约束）：在 `CiInstanceService` 中，创建/更新实例时：
1. 加载该模型的 `ci_attribute` 列表
2. 校验 required 字段是否存在
3. 校验 field_type 匹配（string/number/enum/json/boolean）
4. 校验 enum 值在 `enum_options` 范围内
5. 校验通过后将 `fields_data` 序列化写入 `ci_instance.fields_data`

**依据**: PostgreSQL JSON Schema 验证（如 jsonb_validator）需要扩展安装，增加部署复杂度。服务端校验灵活且易于调试。

### AD-4: 拓扑查询使用 BFS + 递归 CTE

拓扑查询 `GET /api/cmdb/topology/{instanceId}?depth=N` 使用 PostgreSQL 递归 CTE 在数据库层面完成 BFS 遍历（避免 Java 层 N+1 查询），深度限制通过 CTE 的 level 字段控制。

```sql
WITH RECURSIVE topo AS (
    SELECT id, src_instance_id, dst_instance_id, association_kind, 0 AS depth
    FROM ci_instance_rel
    WHERE src_instance_id = :rootId OR dst_instance_id = :rootId
      AND NOT is_deleted
    UNION ALL
    SELECT r.id, r.src_instance_id, r.dst_instance_id, r.association_kind, t.depth + 1
    FROM ci_instance_rel r
    INNER JOIN topo t ON (r.src_instance_id = t.dst_instance_id OR r.dst_instance_id = t.src_instance_id)
    WHERE t.depth < :maxDepth
      AND NOT r.is_deleted
)
SELECT DISTINCT * FROM topo;
```

**依据**: 10k 实例规模下递归 CTE 性能可接受（P95 < 200ms），避免 Java 层图遍历的 O(N) 内存开销。

### AD-5: 关联关系 — 使用现有 ci_instance_rel 表

PRD 已明确：使用已有 `ci_instance_rel` 表（src_instance_id → dst_instance_id → association_kind），5 种关联类型（bk_mainline/belong/run/connect/depend）通过 `ci_association_kind` 表管理。

### AD-6: 模型管理混合策略

- **内置模型**（host、app）通过 Flyway seed 管理，UI 不可删除
- **自定义模型**通过 UI 创建/编辑/删除，`is_built_in` 字段区分
- 内置模型的字段（`is_built_in=TRUE`）不可删除，但可新增自定义字段

### AD-7: Flyway V14–V19 重建策略

从生产 DB dump 反向生成迁移文件。每个文件使用 `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` 防护。V14-V19 对应现有 8 张 CI 表的创建和 seed 数据。新环境执行 V1–V22（含新增）后 schema 与生产等价。

**迁移文件命名规划:**
- V14: `ci_model_group` + `ci_model` 表
- V15: `ci_attribute_group` + `ci_attribute` 表
- V16: `ci_instance` 表
- V17: `ci_association_kind` + `ci_association_def` + `ci_instance_rel` 表
- V18: seed 数据（host 模型 + 13 属性 + app 模型 + 5 属性 + 5 种关联类型 + 5 个模型分组）
- V19: 索引和约束补充

---

## 2. API 契约

### 2.1 模型管理

#### GET /api/cmdb/models — 模型列表

```
Permission: cmdb_model:read

Query Params:
  keyword:  string  (optional, 搜索 name/display_name)
  group:    string  (optional, 按分组过滤)
  page:     int     (default=1)
  size:     int     (default=20)

Response: R<PageResult<CiModelVO>>
  CiModelVO:
    id:           Long
    name:         string       (唯一标识, e.g. "host")
    displayName:  string       (显示名, e.g. "主机")
    group:        string       (分组, e.g. "infra")
    groupName:    string       (分组显示名)
    isBuiltIn:    boolean
    instanceCount: int         (关联实例数量, 用于删除保护提示)
    attributes:   List<CiAttributeVO>  (字段列表, 可选加载)
    createdAt:    LocalDateTime
    updatedAt:    LocalDateTime
```

#### POST /api/cmdb/models — 创建模型

```
Permission: cmdb_model:create

Request (CreateModelRequest):
  name:         string  @NotBlank @Pattern("^[a-z][a-z0-9_]*$")
  displayName:  string  @NotBlank @Size(max=128)
  group:        string  @NotBlank

Response: R<CiModelVO>

Validation:
  - name 全局唯一 (同一 tenant_id)
  - name 不与保留字冲突 (id, created_at, updated_at, is_deleted, tenant_id)
  - group 必须存在于 ci_model_group
```

#### PUT /api/cmdb/models/{id} — 编辑模型

```
Permission: cmdb_model:update

Request (UpdateModelRequest):
  displayName:  string?
  group:        string?
  description:  string?

Response: R<CiModelVO>

Constraint: name 不允许修改 (405 Method Not Allowed if name in body)
```

#### DELETE /api/cmdb/models/{id} — 删除模型

```
Permission: cmdb_model:delete

Response: R<Void>
  - 存在实例时 → 409 Conflict, body: { "message": "...", "instanceCount": N }
  - is_built_in = true 时 → 403 Forbidden
  - 无实例 → 逻辑删除模型 + 关联字段
```

### 2.2 字段（属性）管理

#### GET /api/cmdb/models/{modelId}/attributes — 字段列表

```
Permission: cmdb_model:read

Response: R<List<CiAttributeVO>>
  CiAttributeVO:
    id:           Long
    modelId:      string       (e.g. "host")
    fieldKey:     string       (e.g. "inner_ip")
    name:         string       (显示名, e.g. "内网IP")
    groupId:      string       (属性分组, e.g. "base")
    groupName:    string       (分组显示名)
    fieldType:    string       (singlechar/int/enum/list/bool/user/date)
    isRequired:   boolean
    isEditable:   boolean
    isUnique:     boolean
    isBuiltIn:    boolean
    isListShow:   boolean
    defaultValue: string?
    enumOptions:  string?      (JSON array for enum type)
    sortOrder:    int
```

#### POST /api/cmdb/models/{modelId}/attributes — 新增字段

```
Permission: cmdb_model:update

Request (CreateAttributeRequest):
  fieldKey:      string  @NotBlank @Pattern("^[a-z][a-z0-9_]*$")
  name:          string  @NotBlank
  groupId:       string  @NotBlank
  fieldType:     string  @NotBlank (singlechar/int/enum/list/bool/user/date)
  isRequired:    boolean (default=false)
  isEditable:    boolean (default=true)
  isUnique:      boolean (default=false)
  isListShow:    boolean (default=false)
  defaultValue:  string?
  enumOptions:   string?  (JSON array, required when fieldType=enum)
  sortOrder:     int      (default=0)

Response: R<CiAttributeVO>

Validation:
  - fieldKey 在同一 model_id 内唯一
  - fieldKey 不与保留字冲突 (id, model_id, name, status, owner, description, created_at, updated_at, is_deleted, tenant_id)
  - fieldType=enum 时 enumOptions 不能为空
```

#### PUT /api/cmdb/models/{modelId}/attributes/{attrId} — 编辑字段

```
Permission: cmdb_model:update

Request (UpdateAttributeRequest):
  name:          string?
  isRequired:    boolean?
  isEditable:    boolean?
  isListShow:    boolean?
  defaultValue:  string?
  enumOptions:   string?
  sortOrder:     int?

Response: R<CiAttributeVO>

Constraint:
  - fieldKey 不可改
  - fieldType 不可改
  - is_built_in=true 的字段仅允许修改 isListShow
```

#### DELETE /api/cmdb/models/{modelId}/attributes/{attrId} — 删除字段

```
Permission: cmdb_model:update

Response: R<Void>
  - is_built_in=true → 403 Forbidden
  - 逻辑删除字段 (is_deleted=true)
  - 历史实例中该字段值保留（不自动清理 fields_data）
```

### 2.3 实例管理

#### GET /api/cmdb/instances — 实例列表

```
Permission: cmdb_instance:read

Query Params:
  model:    string  (required, 模型 name)
  keyword:  string  (optional, 搜索 name / 主键字段)
  status:   string  (optional, 在线/离线/维护中)
  page:     int     (default=1)
  size:     int     (default=20)

Response: R<PageResult<CiInstanceVO>>
  CiInstanceVO:
    id:           Long
    name:         string
    modelId:      string
    modelName:    string      (模型 displayName)
    status:       string      (online/offline/maintenance)
    owner:        string?     (关联用户/组)
    description:  string?
    fieldsData:   Map<String, Object>  (仅列表展示字段, is_list_show=true)
    createdAt:    LocalDateTime
    updatedAt:    LocalDateTime
```

#### POST /api/cmdb/instances — 创建实例

```
Permission: cmdb_instance:create

Request (CreateInstanceRequest):
  modelId:      string  @NotBlank
  name:         string  @NotBlank
  status:       string  (default="online")
  owner:        string?
  description:  string?
  fieldsData:   Map<String, Object>  @NotNull

Response: R<CiInstanceDetailVO>

Validation:
  - modelId 必须存在
  - fieldsData 按模型 schema 校验 (required/type/enum)
  - unique 字段值全局唯一
  - name 在同一模型内唯一
```

#### GET /api/cmdb/instances/{id} — 实例详情

```
Permission: cmdb_instance:read

Response: R<CiInstanceDetailVO>
  CiInstanceDetailVO:
    id:           Long
    name:         string
    modelId:      string
    modelName:    string
    status:       string
    owner:        string?
    description:  string?
    fieldsData:   Map<String, Object>  (完整 fields_data)
    attributes:   List<CiAttributeVO>  (模型字段定义, 供前端渲染)
    createdAt:    LocalDateTime
    updatedAt:    LocalDateTime
```

#### PUT /api/cmdb/instances/{id} — 更新实例

```
Permission: cmdb_instance:update

Request (UpdateInstanceRequest):
  name:         string?
  status:       string?
  owner:        string?
  description:  string?
  fieldsData:   Map<String, Object>?  (增量合并)

Response: R<CiInstanceDetailVO>

Validation:
  - 增量合并 fieldsData (patch semantics)
  - 合并后整体重新校验 schema
  - 记录变更历史 (before_json = 旧 fields_data, after_json = 新 fields_data)
```

#### DELETE /api/cmdb/instances/{id} — 删除实例

```
Permission: cmdb_instance:delete

Response: R<Void>
  - 逻辑删除 (is_deleted=true)
  - 记录变更历史 (before_json = 实例完整数据)
  - 关联关系 (ci_instance_rel) 同步逻辑删除
```

### 2.4 搜索（供 changedoc 兼容）

#### GET /api/cmdb/instances/search — 跨模型搜索

```
Permission: cmdb_instance:read

Query Params:
  keyword:  string  @NotBlank
  size:     int     (default=10)

Response: R<PageResult<CiInstanceSearchVO>>
  CiInstanceSearchVO:
    id:         Long
    name:       string
    modelId:    string      (模型 name)
    modelName:  string      (模型 displayName)

Compatibility: 响应结构兼容当前 changedoc 前端 ci_selector 消费
  - res.data.data.records[] → ci.id, ci.name, ci.model_id, ci.model_name
```

### 2.5 关联关系

#### POST /api/cmdb/instances/{id}/relations — 创建关联

```
Permission: cmdb_relation:create

Request (CreateRelationRequest):
  dstInstanceId:     Long    @NotNull
  associationKind: string  @NotBlank (bk_mainline/belong/run/connect/depend)

Response: R<CiRelationVO>

Validation:
  - 两个实例必须存在且未删除
  - 不重复关联 (同一 src+dst+kind 唯一)
  - associationKind 必须存在于 ci_association_kind
```

#### DELETE /api/cmdb/instances/{id}/relations/{relationId} — 删除关联

```
Permission: cmdb_relation:delete

Response: R<Void>
  - 逻辑删除 ci_instance_rel 记录
```

#### GET /api/cmdb/instances/{id}/relations — 查询关联

```
Permission: cmdb_relation:read

Query Params:
  kind:  string  (optional, 过滤关联类型)

Response: R<List<CiRelationVO>>
  CiRelationVO:
    id:               Long
    srcInstanceId:    Long
    srcInstanceName:  string
    dstInstanceId:    Long
    dstInstanceName:  string
    associationKind:  string
    createdAt:        LocalDateTime
```

### 2.6 拓扑查询

#### GET /api/cmdb/topology/{instanceId} — 拓扑展开

```
Permission: cmdb_instance:read

Query Params:
  depth:  int  (default=5, max=10)

Response: R<TopologyResultVO>
  TopologyResultVO:
    nodes:  List<TopologyNodeVO>
      id:         Long
      name:       string
      modelId:    string
      modelName:  string
      isRoot:     boolean     (仅根实例为 true)
    edges:  List<TopologyEdgeVO>
      src:        Long        (src_instance_id)
      dst:        Long        (dst_instance_id)
      kind:       string      (association_kind)
      label:      string      (关联类型显示名)

Compatibility: 兼容 changedoc 前端 ci_selector 拓扑消费
  - nodes[].id, nodes[].name, nodes[].model_id, nodes[].model_name, nodes[].is_root
  - edges[].src, edges[].dst, edges[].kind
```

### 2.7 变更历史

#### GET /api/cmdb/instances/{id}/history — 实例变更历史

```
Permission: cmdb_instance:read

Query Params:
  page:  int  (default=1)
  size:  int  (default=20)

Response: R<PageResult<ChangeHistoryVO>>
  ChangeHistoryVO:
    id:           Long
    action:       string       (create_instance/update_instance/delete_instance)
    operatorId:   Long
    operatorName: string       (从 sys_user 解析 real_name)
    beforeJson:   Map?         (变更前的 fields_data)
    afterJson:    Map?         (变更后的 fields_data)
    createdAt:    LocalDateTime

Implementation: 查询 audit_log WHERE module='cmdb' AND target_type='ci_instance' AND target_id=:id
```

#### GET /api/cmdb/changes — 全局变更流（审计员）

```
Permission: cmdb_instance:read

Query Params:
  model:      string  (optional, 按模型过滤)
  operatorId: Long    (optional, 按操作人过滤)
  startDate:  string  (optional, ISO date)
  endDate:    string  (optional, ISO date)
  page:       int     (default=1)
  size:       int     (default=20)

Response: R<PageResult<ChangeHistoryVO>>
```

---

## 3. 数据模型

### 3.1 现有 CI 表（V14–V19 已创建）

```
ci_model_group          — 模型分组
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  code            VARCHAR(64) NOT NULL       -- e.g. "infra"
  name            VARCHAR(128) NOT NULL      -- e.g. "基础设施"
  sort_order      INT DEFAULT 0
  is_deleted      BOOLEAN DEFAULT FALSE
  created_at      TIMESTAMP DEFAULT NOW()
  updated_at      TIMESTAMP DEFAULT NOW()

ci_model              — 配置模型定义
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  name            VARCHAR(64) NOT NULL       -- 唯一标识 e.g. "host"
  display_name    VARCHAR(128) NOT NULL      -- 显示名 e.g. "主机"
  group_id        BIGINT REFERENCES ci_model_group(id)
  is_built_in     BOOLEAN DEFAULT FALSE
  is_deleted      BOOLEAN DEFAULT FALSE
  created_at      TIMESTAMP DEFAULT NOW()
  updated_at      TIMESTAMP DEFAULT NOW()
  created_by      BIGINT
  updated_by      BIGINT
  UNIQUE(tenant_id, name) WHERE NOT is_deleted

ci_attribute_group    — 属性分组
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  model_id        VARCHAR(64) NOT NULL       -- 引用 ci_model.name
  code            VARCHAR(64) NOT NULL       -- e.g. "base"
  name            VARCHAR(128) NOT NULL      -- e.g. "基础属性"
  sort_order      INT DEFAULT 0
  is_deleted      BOOLEAN DEFAULT FALSE

ci_attribute          — 字段定义
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  model_id        VARCHAR(64) NOT NULL       -- 引用 ci_model.name
  field_key       VARCHAR(64) NOT NULL
  name            VARCHAR(128) NOT NULL      -- 显示名
  group_id        VARCHAR(64)                -- 引用 ci_attribute_group.code
  field_type      VARCHAR(32) NOT NULL       -- singlechar/int/enum/list/bool/user/date
  is_required     BOOLEAN DEFAULT FALSE
  is_editable     BOOLEAN DEFAULT TRUE
  is_unique       BOOLEAN DEFAULT FALSE
  is_built_in     BOOLEAN DEFAULT FALSE
  is_list_show    BOOLEAN DEFAULT FALSE
  default_value   VARCHAR(512)
  enum_options    TEXT                       -- JSON array for enum
  sort_order      INT DEFAULT 0
  is_deleted      BOOLEAN DEFAULT FALSE
  created_at      TIMESTAMP DEFAULT NOW()
  updated_at      TIMESTAMP DEFAULT NOW()
  UNIQUE(tenant_id, model_id, field_key) WHERE NOT is_deleted

ci_instance           — 实例数据
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  model_id        VARCHAR(64) NOT NULL       -- 引用 ci_model.name
  name            VARCHAR(256) NOT NULL
  status          VARCHAR(32) DEFAULT 'online'  -- online/offline/maintenance
  owner           VARCHAR(128)
  description     TEXT
  fields_data     JSONB                      -- 自定义字段值
  is_deleted      BOOLEAN DEFAULT FALSE
  created_at      TIMESTAMP DEFAULT NOW()
  updated_at      TIMESTAMP DEFAULT NOW()
  created_by      BIGINT
  updated_by      BIGINT

ci_association_kind   — 关联类型定义
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  code            VARCHAR(64) NOT NULL       -- e.g. "run"
  name            VARCHAR(128) NOT NULL      -- e.g. "运行"
  is_built_in     BOOLEAN DEFAULT TRUE
  is_deleted      BOOLEAN DEFAULT FALSE

ci_association_def    — 关联定义（模型间允许的关联）
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  src_model_id    VARCHAR(64) NOT NULL
  dst_model_id    VARCHAR(64) NOT NULL
  association_kind VARCHAR(64) NOT NULL
  is_deleted      BOOLEAN DEFAULT FALSE

ci_instance_rel       — 实例间关联关系
  id              BIGSERIAL PK
  tenant_id       VARCHAR(64) NOT NULL DEFAULT 'default'
  src_instance_id BIGINT NOT NULL REFERENCES ci_instance(id)
  dst_instance_id BIGINT NOT NULL REFERENCES ci_instance(id)
  association_kind VARCHAR(64) NOT NULL
  is_deleted      BOOLEAN DEFAULT FALSE
  created_at      TIMESTAMP DEFAULT NOW()
  created_by      BIGINT
```

### 3.2 新增 Migration (V23+)

#### V23: CMDB 权限 seed 数据

```sql
-- 资源
INSERT INTO sys_resource (code, name, sort_order) VALUES
  ('cmdb_model', 'CMDB 模型管理', 50),
  ('cmdb_instance', 'CMDB 实例管理', 51),
  ('cmdb_relation', 'CMDB 关联关系', 52);

-- 权限
INSERT INTO sys_permission (resource_id, action, code, name)
SELECT r.id, a.action, r.code || ':' || a.action, a.name
FROM sys_resource r
CROSS JOIN (VALUES
  ('cmdb_model', 'create', '创建模型'),
  ('cmdb_model', 'read', '查看模型'),
  ('cmdb_model', 'update', '编辑模型'),
  ('cmdb_model', 'delete', '删除模型'),
  ('cmdb_instance', 'create', '创建实例'),
  ('cmdb_instance', 'read', '查看实例'),
  ('cmdb_instance', 'update', '编辑实例'),
  ('cmdb_instance', 'delete', '删除实例'),
  ('cmdb_relation', 'create', '创建关联'),
  ('cmdb_relation', 'read', '查看关联'),
  ('cmdb_relation', 'delete', '删除关联')
) AS a(resource_code, action, name)
WHERE r.code = a.resource_code;

-- 将 cmdb_instance:read 分配给默认角色 (如有)
-- 具体角色分配策略由管理员在 RBAC 管理页配置
```

### 3.3 索引设计

```sql
-- ci_instance 查询优化
CREATE INDEX idx_ci_instance_model ON ci_instance(tenant_id, model_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_instance_name ON ci_instance(tenant_id, model_id, name) WHERE NOT is_deleted;
CREATE INDEX idx_ci_instance_fields ON ci_instance USING GIN(fields_data);

-- ci_instance_rel 拓扑查询优化
CREATE INDEX idx_ci_rel_src ON ci_instance_rel(src_instance_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_dst ON ci_instance_rel(dst_instance_id) WHERE NOT is_deleted;
CREATE INDEX idx_ci_rel_kind ON ci_instance_rel(association_kind) WHERE NOT is_deleted;

-- audit_log CMDB 历史查询优化
CREATE INDEX idx_audit_cmdb_target ON audit_log(tenant_id, module, target_type, target_id, created_at DESC)
  WHERE module = 'cmdb';
```

---

## 4. 数据流

### 4.1 创建实例（含 schema 校验 + 变更历史）

```
┌──────────────┐  POST /api/cmdb/instances          ┌──────────────────────────────────────┐
│  Frontend    │ ─────────────────────────────────> │  CiInstanceController.create()       │
│  (动态表单)   │  { modelId, name, status,           │       │                              │
│              │    owner, fieldsData }              │       ▼                              │
└──────────────┘                                    │  CiInstanceService.create()          │
                                                    │   1. ciModelMapper.selectByName(modelId)
                                                    │   2. ciAttributeMapper.listByModel(modelId)
                                                    │   3. ★ SchemaValidator.validate(     │
                                                    │        fieldsData, attributes)        │
                                                    │      - check required fields          │
                                                    │      - check field types              │
                                                    │      - check enum values              │
                                                    │      - check unique constraints       │
                                                    │   4. new CiInstance(), set all fields │
                                                    │   5. ciInstanceMapper.insert(instance)│
                                                    │   6. ★ 审计日志写入                    │
                                                    │      auditLogMapper.insert(           │
                                                    │        module="cmdb",                 │
                                                    │        action="create_instance",      │
                                                    │        targetId=instance.id,          │
                                                    │        target_type="ci_instance",     │
                                                    │        afterJson=instanceSnapshot)    │
                                                    │   7. return CiInstanceDetailVO        │
                                                    └──────────────────────────────────────┘
```

### 4.2 搜索实例（跨模型）

```
┌──────────────┐  GET /api/cmdb/instances/search     ┌──────────────────────────────────────┐
│  Frontend    │  ?keyword=web&size=10               │  CiInstanceController.search()       │
│  ci_selector │ ──────────────────────────────────> │       │                              │
│              │                                      │       ▼                              │
│  消费字段:    │                                      │  CiInstanceService.searchAcrossModels │
│  id, name,   │ <── R<PageResult<CiInstanceSearchVO>>│   1. LambdaQueryWrapper<CiInstance>  │
│  model_id,   │   records[].id                      │   2. .eq(tenantId)                   │
│  model_name  │   records[].name                    │   3. .like(name, keyword)            │
│              │   records[].modelId                  │   4. .or().jsonbSearch(fieldsData,   │
│              │   records[].modelName                │         keyword)  -- 可选             │
│              │                                      │   5. ciInstanceMapper.selectPage()   │
│              │                                      │   6. JOIN ci_model 获取 modelName    │
│              │                                      │   7. return PageResult<SearchVO>     │
└──────────────┘                                      └──────────────────────────────────────┘

兼容性保证:
  CiInstanceSearchVO 字段名与 changedoc 前端消费一致:
  - id → ci.id
  - name → ci.name
  - modelId → ci.model_id  (JSON: model_id via @JsonProperty)
  - modelName → ci.model_name (JSON: model_name via @JsonProperty)
```

### 4.3 拓扑查询

```
┌──────────────┐  GET /api/cmdb/topology/{id}?depth=2  ┌──────────────────────────────────────┐
│  Frontend    │ ─────────────────────────────────────> │  CiTopologyController.getTopology()  │
│  ci_selector │                                        │       │                              │
│              │                                        │       ▼                              │
│  消费字段:    │ <── R<TopologyResultVO> ────────────── │  CiTopologyService.getTopology()     │
│  nodes[]:    │   { nodes: [...], edges: [...] }       │   1. 递归 CTE 查询 ci_instance_rel   │
│   id, name,  │                                        │      (BFS, depth <= maxDepth)        │
│   model_id,  │                                        │   2. 收集所有涉及的 instance_id      │
│   model_name,│                                        │   3. 批量查询 ci_instance 获取 name  │
│   is_root    │                                        │   4. 批量查询 ci_model 获取 modelName│
│  edges[]:    │                                        │   5. 组装 TopologyResultVO           │
│   src, dst,  │                                        │   6. 标记 root (isRoot=true)         │
│   kind       │                                        │   7. return result                   │
└──────────────┘                                        └──────────────────────────────────────┘

SQL (递归 CTE):
  WITH RECURSIVE topo AS (
    -- anchor: 根节点直接关联
    SELECT id, src_instance_id, dst_instance_id, association_kind, 0 AS depth
    FROM ci_instance_rel
    WHERE (src_instance_id = :rootId OR dst_instance_id = :rootId)
      AND NOT is_deleted
    UNION ALL
    -- recursive: 逐层展开
    SELECT r.id, r.src_instance_id, r.dst_instance_id, r.association_kind, t.depth + 1
    FROM ci_instance_rel r
    INNER JOIN topo t ON (r.src_instance_id = t.dst_instance_id
                      OR r.dst_instance_id = t.src_instance_id)
    WHERE t.depth < :maxDepth AND NOT r.is_deleted
  )
  SELECT DISTINCT id, src_instance_id, dst_instance_id, association_kind
  FROM topo;
```

### 4.4 更新实例（增量合并 + diff 审计）

```
CiInstanceService.update(instanceId, req, operatorId):
  │
  ├─ 1. 加载现有实例 (ciInstanceMapper.selectById)
  │
  ├─ 2. 快照 before (JSON 序列化当前 fields_data)
  │
  ├─ 3. 增量合并 fields_data
  │     existing.putAll(req.getFieldsData())
  │     -- patch semantics: 仅覆盖传入的 key
  │
  ├─ 4. 更新基础字段 (name, status, owner, description)
  │
  ├─ 5. ★ SchemaValidator.validate(合并后 fieldsData, attributes)
  │     -- 整体重新校验
  │
  ├─ 6. ciInstanceMapper.updateById(instance)
  │
  └─ 7. ★ 审计日志写入
        beforeJson = before 快照
        afterJson  = after 快照
        action     = "update_instance"
```

---

## 5. 前端影响范围（Tier 1 不做前端变更）

PRD 明确排除前端 changedoc ci_selector 的解耦迁移。Tier 1 仅保证 CMDB 端点存在并兼容当前消费格式。

**Tier 1 前端工作**: 无。前端页面在后续 PRD（`2026-06-10-changedoc-refactor-prd.md`）中处理。

**CMDB 管理前端**（如需）属于独立前端工作，不在本 spec 范围。

---

## 6. 实现影响范围

### 后端新增文件 (est. 30+ files)

| 类别 | 文件 | 说明 |
|------|------|------|
| Entity | `CiModel.java`, `CiAttribute.java`, `CiAttributeGroup.java`, `CiInstance.java`, `CiInstanceRel.java`, `CiAssociationKind.java`, `CiAssociationDef.java`, `CiModelGroup.java` | 8 个实体类, extends BaseEntity |
| Mapper | `CiModelMapper.java`, `CiAttributeMapper.java`, `CiInstanceMapper.java`, `CiInstanceRelMapper.java`, `CiModelGroupMapper.java`, `CiAttributeGroupMapper.java`, `CiAssociationKindMapper.java`, `CiAssociationDefMapper.java` | 8 个 MyBatis-Plus Mapper |
| Service | `CiModelService.java`, `CiAttributeService.java`, `CiInstanceService.java`, `CiRelationService.java`, `CiTopologyService.java` | 5 个 Service |
| Controller | `CiModelController.java`, `CiAttributeController.java`, `CiInstanceController.java`, `CiRelationController.java`, `CiTopologyController.java` | 5 个 Controller |
| DTO | `CreateModelRequest.java`, `UpdateModelRequest.java`, `CiModelVO.java`, `CreateAttributeRequest.java`, `UpdateAttributeRequest.java`, `CiAttributeVO.java`, `CreateInstanceRequest.java`, `UpdateInstanceRequest.java`, `CiInstanceVO.java`, `CiInstanceDetailVO.java`, `CiInstanceSearchVO.java`, `CreateRelationRequest.java`, `CiRelationVO.java`, `TopologyNodeVO.java`, `TopologyEdgeVO.java`, `TopologyResultVO.java`, `ChangeHistoryVO.java` | 17 个 DTO |
| Util | `SchemaValidator.java` | fields_data JSONB 校验工具 |
| Migration | `V23__cmdb_permissions_seed.sql` | 权限 seed 数据 |

### 后端修改文件

| 文件 | 变更 |
|------|------|
| 无 | Tier 1 不修改现有代码（向后兼容保证） |

### Flyway V14–V19 迁移文件

| 文件 | 内容 |
|------|------|
| `V14__create_ci_model_tables.sql` | ci_model_group + ci_model 表 |
| `V15__create_ci_attribute_tables.sql` | ci_attribute_group + ci_attribute 表 |
| `V16__create_ci_instance_table.sql` | ci_instance 表 |
| `V17__create_ci_relation_tables.sql` | ci_association_kind + ci_association_def + ci_instance_rel 表 |
| `V18__seed_ci_builtin_data.sql` | host(13属性) + app(5属性) + 5种关联类型 + 5个模型分组 |
| `V19__ci_indexes_and_constraints.sql` | 索引和约束补充 |

**注意**: V14–V19 的编号与现有 V20–V22 冲突。需要确认：
1. 生产 DB 是否已有 V14–V19 记录（如果有，需使用不同编号）
2. 或者 V14–V19 已存在于生产但本地仓库缺失（PRD 说"从 DB dump 反向重建"）

**策略**: 先确认 flyway_schema_history 表中 V14–V19 的记录。如果生产已有这些版本但本地缺失，则从 dump 反向生成对应文件。如果本地从未有 V14–V19，则使用 V23–V28 新建。

---

## 7. 风险评估

| # | 风险 | 影响 | 缓解措施 |
|---|------|------|---------|
| R1 | V14–V19 编号冲突 | 新环境 flyway migrate 失败 | 先检查 flyway_schema_history，确认编号策略 |
| R2 | 递归 CTE 性能退化 | 拓扑查询 P95 > 500ms | depth 上限 10，加索引；超限走 Java BFS |
| R3 | fields_data JSONB 校验遗漏 | 脏数据写入 | 单元测试覆盖所有 field_type 边界 |
| R4 | changedoc 前端直调 CMDB 端点变更 | ci_selector 功能不可用 | Tier 1 保证端点结构兼容，DTO 使用 @JsonProperty 控制字段名 |
| R5 | 模型删除后字段/实例孤立 | 数据一致性 | 事务保证：删除模型时级联逻辑删除字段，存在实例时 409 阻止 |
| R6 | 拓扑环检测 | 递归 CTE 无限循环 | 使用 visited set 或 depth limit 兜底 |

---

## 8. 技术债务

| # | 债务项 | 触发条件 | 解决方案 |
|---|--------|---------|---------|
| 1 | LIKE 搜索性能 | 实例 > 10k 或 P99 > 500ms | PostgreSQL GIN index on fields_data + trigram index on name |
| 2 | 字段变更历史数据迁移 | 字段删除后历史实例 | Tier 2 实现字段归档策略 |
| 3 | 拓扑查询缓存 | 并发拓扑查询 > 100 QPS | Redis 缓存 + TTL，写操作失效 |
| 4 | 模型版本管理 | 字段类型变更需求 | Tier 2 引入 schema versioning |

---

## 9. 安全检查点

- [ ] 所有写操作使用 `@PreAuthorize` 权限控制
- [ ] tenant_id 隔离：所有查询必须带 `tenant_id` 条件
- [ ] 审计日志 fields_data 中不包含敏感信息（CMDB 不涉及密码等）
- [ ] 搜索接口防 SQL 注入（MyBatis-Plus 参数化查询）
- [ ] 拓扑递归 CTE 有 depth 上限防止 DoS
- [ ] 实例删除时级联逻辑删除关联关系
- [ ] 模型删除保护：存在实例时 409 阻止

---

## 10. 开放问题（待工程反馈）

1. **V14–V19 编号策略**: 需确认生产 DB `flyway_schema_history` 中 V14–V19 的实际状态。如果已存在但本地缺失，从 dump 反向生成同名文件；如果从未存在，使用 V23–V28。
2. **ci_instance.name 唯一范围**: 同一模型内 name 唯一，还是全局唯一？PRD 未明确。建议同一 `model_id` 内唯一。
3. **fields_data 中 unique 字段校验**: 需要在 DB 层用 GIN index + unique partial index 还是仅 Java 层校验？建议 Java 层 + DB 层双保险。
4. **拓扑方向性**: ci_instance_rel 是有向图（src→dst）还是无向图？拓扑展开时是否双向遍历？PRD 暗示双向（BFS/DFS），但关联有方向语义（"运行在"是单向的）。建议存储有向、查询双向。

---

## 11. 下游 handoff

本 Spec 完成后：
- **Engineer** 按 API 契约实现后端代码（参照 `writing-plans` 拆解为 bite-sized tasks）
- **V14–V19 迁移文件**: Engineer 从生产 DB dump 反向生成
- **测试**: 集成测试覆盖所有 API 端点 + schema 校验边界 + 拓扑递归深度
