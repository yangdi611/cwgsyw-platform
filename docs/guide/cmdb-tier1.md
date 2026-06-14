# CMDB Tier 1 — 完整指南

> 模块：CMDB（配置管理数据库）/ CI 模型 + 属性 + 实例 + 关联 + 拓扑
> 对应 Flyway V14–V20, V23，前后端均已完成

---

## 目录

1. [概述](#概述)
2. [数据模型](#数据模型)
3. [API 参考](#api-参考)
4. [权限控制（RBAC）](#权限控制rbac)
5. [审计日志](#审计日志)
6. [核心业务逻辑](#核心业务逻辑)
7. [内置种子数据](#内置种子数据)
8. [设计决策与注意事项](#设计决策与注意事项)
9. [前端页面与组件](#前端页面与组件)

---

## 概述

CMDB Tier 1 是平台的配置管理数据库基础层，实现了 CI（Configuration Item，配置项）的全生命周期管理：

- **模型管理**：定义 CI 类型（如主机、应用），每个模型归属于一个分组
- **属性管理**：为模型定义字段，支持多种字段类型（singlechar/int/enum/bool/date/user/list）
- **实例管理**：基于模型创建具体的 CI 实例，动态字段存储在 JSONB 中
- **关联管理**：定义 CI 实例之间的关系（属于、运行、连接、依赖等）
- **拓扑查询**：从指定实例出发，BFS 遍历关联关系，返回拓扑图数据
- **变更历史**：通过 audit_log 查询实例级别的变更记录

### 前端页面（已完成）

Tier 1 前端已全部实现，包含模型管理、实例管理、关联管理、拓扑可视化、变更历史等 8 个功能页面，详见 [前端页面与组件](#前端页面与组件) 章节。

### 模块文件结构

```
后端:
module/cmdb/
  controller/
    CiModelController.java          # /api/cmdb/models
    CiAttributeController.java      # /api/cmdb/models/{modelId}/attributes
    CiInstanceController.java       # /api/cmdb/instances
    CiRelationController.java       # /api/cmdb/instances/{id}/relations
    CiTopologyController.java       # /api/cmdb/topology
  service/
    CiModelService.java             # 模型 CRUD + 属性级联删除
    CiAttributeService.java         # 属性 CRUD + 字段校验
    CiInstanceService.java          # 实例 CRUD + schema 校验 + 变更历史
    CiRelationService.java          # 关联 CRUD + 去重
    CiTopologyService.java          # BFS 拓扑遍历
  entity/
    CiModelGroup.java               # 模型分组
    CiModel.java                    # 模型定义
    CiAttributeGroup.java           # 属性分组
    CiAttribute.java                # 属性定义
    CiInstance.java                 # CI 实例
    CiAssociationKind.java          # 关联类型
    CiAssociationDef.java           # 关联定义（模型级别）
    CiInstanceRel.java              # 实例关联
  mapper/
    CiModelGroupMapper.java
    CiModelMapper.java
    CiAttributeGroupMapper.java
    CiAttributeMapper.java
    CiInstanceMapper.java
    CiAssociationKindMapper.java
    CiAssociationDefMapper.java
    CiInstanceRelMapper.java
  dto/
    model/                          # CreateModelRequest, UpdateModelRequest, CiModelVO
    attribute/                      # CreateAttributeRequest, UpdateAttributeRequest, CiAttributeVO
    instance/                       # CreateInstanceRequest, UpdateInstanceRequest, CiInstanceVO, CiInstanceDetailVO, CiInstanceSearchVO
    relation/                       # CreateRelationRequest, CiRelationVO
    topology/                       # TopologyResultVO, TopologyNodeVO, TopologyEdgeVO
    history/                        # ChangeHistoryVO

数据库迁移:
  V14  ci_model_group + ci_model
  V15  ci_attribute_group + ci_attribute
  V16  ci_instance
  V17  ci_association_kind + ci_association_def + ci_instance_rel
  V18  内置 seed 数据（模型分组、模型、属性、关联类型）
  V19  索引和约束补充（含 GIN 索引）
  V20  主机模型增加 sn（序列号）属性
  V23  CMDB RBAC 权限 seed 数据
```

---

## 数据模型

### ER 关系概览

```
ci_model_group (1) ──── (N) ci_model
                              │
                              ├── (N) ci_attribute_group (1)──(N) ci_attribute
                              │
                              └── (N) ci_instance
                                        │
                                        └── ci_instance_rel (N-to-N via src/dst)

ci_association_kind ──── 定义关联类型（bk_mainline/belong/run/connect/depend）
ci_association_def ──── 模型级别的关联约束（预留）
```

### ci_model_group — 模型分组

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID，默认 `default` |
| `code` | VARCHAR(64) | 分组编码，租户内唯一 |
| `name` | VARCHAR(128) | 分组名称 |
| `sort_order` | INT | 排序序号 |
| `is_deleted` | BOOLEAN | 软删除标记 |
| `deleted_at` / `deleted_by` | TIMESTAMP / BIGINT | 删除信息 |
| `created_at` / `updated_at` / `created_by` / `updated_by` | — | 审计字段 |

**唯一约束：** `idx_ci_model_group_code` — `(tenant_id, code) WHERE NOT is_deleted`

### ci_model — 模型定义

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID |
| `name` | VARCHAR(64) | 模型标识（如 `host`、`app`），租户内唯一 |
| `display_name` | VARCHAR(128) | 显示名称（如 "主机"、"应用"） |
| `group_id` | BIGINT FK | 归属模型分组（ci_model_group.id） |
| `is_built_in` | BOOLEAN | 是否内置模型（内置不可删除） |
| `is_deleted` | BOOLEAN | 软删除标记 |
| `deleted_at` / `deleted_by` | — | 删除信息 |
| `created_at` / `updated_at` / `created_by` / `updated_by` | — | 审计字段 |

**唯一约束：** `idx_ci_model_name` — `(tenant_id, name) WHERE NOT is_deleted`

**业务规则：**
- `name` 必须匹配 `^[a-z][a-z0-9_]*$`（小写字母开头，仅小写字母/数字/下划线）
- 内置模型（`is_built_in = true`）不允许删除
- 模型下存在实例时不允许删除
- 删除模型时级联软删除其所有属性

### ci_attribute_group — 属性分组

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID |
| `model_id` | VARCHAR(64) | 所属模型标识（如 `host`） |
| `code` | VARCHAR(64) | 分组编码 |
| `name` | VARCHAR(128) | 分组名称 |
| `sort_order` | INT | 排序序号 |
| 软删除 + 审计字段 | — | 同上 |

**索引：** `idx_ci_attr_group_model` — `(tenant_id, model_id) WHERE NOT is_deleted`

### ci_attribute — 属性定义

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID |
| `model_id` | VARCHAR(64) | 所属模型标识（如 `host`） |
| `field_key` | VARCHAR(64) | 字段标识（如 `hostname`），模型内唯一 |
| `name` | VARCHAR(128) | 字段名称（如 "主机名"） |
| `group_id` | VARCHAR(64) | 所属属性分组编码（如 `base`） |
| `field_type` | VARCHAR(32) | 字段类型：singlechar/int/enum/bool/date/user/list |
| `is_required` | BOOLEAN | 是否必填 |
| `is_editable` | BOOLEAN | 是否可编辑 |
| `is_unique` | BOOLEAN | 是否唯一（创建/更新实例时校验） |
| `is_built_in` | BOOLEAN | 是否内置字段（内置仅允许改 isListShow） |
| `is_list_show` | BOOLEAN | 是否在列表页展示 |
| `default_value` | VARCHAR(512) | 默认值 |
| `enum_options` | TEXT | enum 类型的可选值 JSON 数组，如 `["online","offline"]` |
| `sort_order` | INT | 排序序号 |
| 软删除 + 审计字段 | — | 同上 |

**唯一约束：** `idx_ci_attribute_key` — `(tenant_id, model_id, field_key) WHERE NOT is_deleted`

**字段类型说明：**

| field_type | 说明 | 实例 fieldsData 中存储类型 |
|------------|------|---------------------------|
| `singlechar` | 单行文本 | String |
| `int` | 整数 | Number |
| `bool` | 布尔 | Boolean |
| `enum` | 枚举（必须提供 enumOptions） | String（必须在可选范围内） |
| `date` | 日期 | String |
| `user` | 用户引用 | String |
| `list` | 列表 | List |

**业务规则：**
- `field_key` 必须匹配 `^[a-z][a-z0-9_]*$`
- `field_key` 不能是保留字：`id`, `model_id`, `name`, `status`, `owner`, `description`, `created_at`, `updated_at`, `is_deleted`, `tenant_id`
- `enum` 类型必须提供 `enum_options`
- 内置字段（`is_built_in = true`）仅允许修改 `is_list_show`

### ci_instance — CI 实例

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID |
| `model_id` | VARCHAR(64) | 所属模型标识（如 `host`） |
| `name` | VARCHAR(256) | 实例名称，同模型内唯一 |
| `status` | VARCHAR(32) | 状态（如 `online`/`offline`/`maintenance`），默认 `online` |
| `owner` | VARCHAR(128) | 负责人 |
| `description` | TEXT | 描述 |
| `fields_data` | JSONB | 动态属性值，key=field_key，value 根据字段类型而定 |
| 软删除 + 审计字段 | — | 同上 |

**索引：**
- `idx_ci_instance_tenant_model` — `(tenant_id, model_id) WHERE NOT is_deleted`
- `idx_ci_instance_name` — `(tenant_id, model_id, name) WHERE NOT is_deleted`
- `idx_ci_instance_fields` — `GIN(fields_data)` （支持 JSONB 查询）

**业务规则：**
- 实例名称在同一模型内唯一
- `fields_data` 会经过 `SchemaValidator` 校验（必填检查 + 类型检查）
- 唯一字段值校验：查询 `fields_data->>'field_key'` 确保值不重复
- 更新时 fields_data 采用 merge 策略（新值覆盖旧值）
- 删除实例时级联软删除其所有关联关系

### ci_association_kind — 关联类型

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID |
| `code` | VARCHAR(64) | 关联类型编码，租户内唯一 |
| `name` | VARCHAR(128) | 显示名称 |
| `is_built_in` | BOOLEAN | 是否内置，默认 `true` |
| 软删除 + 审计字段 | — | 同上 |

**内置关联类型：**

| code | name | 说明 |
|------|------|------|
| `bk_mainline` | 主线拓扑 | 业务主线 |
| `belong` | 属于 | 归属关系 |
| `run` | 运行 | 运行关系 |
| `connect` | 连接 | 网络连接 |
| `depend` | 依赖 | 依赖关系 |

### ci_association_def — 关联定义（模型级别）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID |
| `src_model_id` | VARCHAR(64) | 源模型标识 |
| `dst_model_id` | VARCHAR(64) | 目标模型标识 |
| `association_kind` | VARCHAR(64) | 关联类型编码 |
| 软删除 + 审计字段 | — | 同上 |

> 注：ci_association_def 表已创建但当前未在 Service 层强制使用。预留用于 Tier 2 模型级别关联约束。

### ci_instance_rel — 实例关联

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID |
| `src_instance_id` | BIGINT | 源实例 ID |
| `dst_instance_id` | BIGINT | 目标实例 ID |
| `association_kind` | VARCHAR(64) | 关联类型编码 |
| 软删除 + 审计字段 | — | 同上 |

**索引：**
- `idx_ci_rel_src` — `(src_instance_id) WHERE NOT is_deleted`
- `idx_ci_rel_dst` — `(dst_instance_id) WHERE NOT is_deleted`
- `idx_ci_rel_kind` — `(association_kind) WHERE NOT is_deleted`

**业务规则：**
- 同一 (src, dst, kind) 组合不允许重复
- 关联类型必须存在于 `ci_association_kind`
- 查询时双向查找（src 或 dst 等于目标实例 ID）

---

## API 参考

### 模型管理 — `/api/cmdb/models`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/models` | `cmdb_model:read` | 分页查询模型列表 |
| GET | `/api/cmdb/models/{id}` | `cmdb_model:read` | 获取模型详情（含属性列表） |
| POST | `/api/cmdb/models` | `cmdb_model:create` | 创建模型 |
| PUT | `/api/cmdb/models/{id}` | `cmdb_model:update` | 更新模型 |
| DELETE | `/api/cmdb/models/{id}` | `cmdb_model:delete` | 删除模型（级联删除属性） |

#### GET /api/cmdb/models

**请求参数（Query）：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | String | 否 | 按模型标识或显示名搜索 |
| `group` | String | 否 | 按分组编码过滤 |
| `page` | int | 否 | 页码，默认 1 |
| `size` | int | 否 | 每页条数，默认 20 |

**响应：** `R<PageResult<CiModelVO>>`

```json
{
  "records": [
    {
      "id": 1,
      "name": "host",
      "displayName": "主机",
      "group": "infra",
      "groupName": "基础设施",
      "isBuiltIn": true,
      "instanceCount": 15,
      "attributes": null,
      "createdAt": "2026-06-13T10:00:00",
      "updatedAt": "2026-06-13T10:00:00"
    }
  ],
  "total": 2,
  "page": 1,
  "size": 20
}
```

> 列表模式下 `attributes` 为 null，需通过 GET `/{id}` 获取详情。

#### POST /api/cmdb/models

**请求体：**

```json
{
  "name": "database",
  "displayName": "数据库",
  "group": "infra"
}
```

| 字段 | 类型 | 必填 | 校验 | 说明 |
|------|------|------|------|------|
| `name` | String | 是 | `^[a-z][a-z0-9_]*$` | 模型标识 |
| `displayName` | String | 是 | max=128 | 显示名称 |
| `group` | String | 是 | 必须存在于 ci_model_group | 分组编码 |

#### PUT /api/cmdb/models/{id}

**请求体：**

```json
{
  "displayName": "数据库实例",
  "group": "biz"
}
```

所有字段均可选（null 表示不修改）。

#### DELETE /api/cmdb/models/{id}

- 内置模型不可删除
- 存在实例的模型不可删除
- 删除时级联软删除所有属性

---

### 属性管理 — `/api/cmdb/models/{modelId}/attributes`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/models/{modelId}/attributes` | `cmdb_model:read` | 获取模型的全部属性 |
| POST | `/api/cmdb/models/{modelId}/attributes` | `cmdb_model:update` | 创建属性 |
| PUT | `/api/cmdb/models/{modelId}/attributes/{attrId}` | `cmdb_model:update` | 更新属性 |
| DELETE | `/api/cmdb/models/{modelId}/attributes/{attrId}` | `cmdb_model:update` | 删除属性 |

> 注：`modelId` 路径参数使用模型标识（如 `host`），不是数字 ID。

#### GET /api/cmdb/models/{modelId}/attributes

**响应：** `R<List<CiAttributeVO>>`

```json
[
  {
    "id": 1,
    "modelId": "host",
    "fieldKey": "hostname",
    "name": "主机名",
    "groupId": "base",
    "groupName": "基础属性",
    "fieldType": "singlechar",
    "isRequired": true,
    "isEditable": true,
    "isUnique": true,
    "isBuiltIn": true,
    "isListShow": true,
    "defaultValue": null,
    "enumOptions": null,
    "sortOrder": 1
  }
]
```

#### POST /api/cmdb/models/{modelId}/attributes

**请求体：**

```json
{
  "fieldKey": "env",
  "name": "环境",
  "groupId": "base",
  "fieldType": "enum",
  "isRequired": true,
  "isEditable": true,
  "isUnique": false,
  "isListShow": true,
  "enumOptions": "[\"dev\",\"staging\",\"prod\"]",
  "sortOrder": 13
}
```

| 字段 | 类型 | 必填 | 校验 | 说明 |
|------|------|------|------|------|
| `fieldKey` | String | 是 | `^[a-z][a-z0-9_]*$`，非保留字 | 字段标识 |
| `name` | String | 是 | — | 字段名称 |
| `groupId` | String | 是 | 必须存在于 ci_attribute_group | 属性分组编码 |
| `fieldType` | String | 是 | 见字段类型表 | 字段类型 |
| `isRequired` | Boolean | 否 | 默认 false | 是否必填 |
| `isEditable` | Boolean | 否 | 默认 true | 是否可编辑 |
| `isUnique` | Boolean | 否 | 默认 false | 是否唯一 |
| `isListShow` | Boolean | 否 | 默认 false | 列表页是否展示 |
| `defaultValue` | String | 否 | — | 默认值 |
| `enumOptions` | String | 否 | enum 类型必填 | JSON 数组字符串 |
| `sortOrder` | Integer | 否 | 默认 0 | 排序序号 |

#### DELETE /api/cmdb/models/{modelId}/attributes/{attrId}

- 内置字段（`is_built_in = true`）不可删除

---

### 实例管理 — `/api/cmdb/instances`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/instances` | `cmdb_instance:read` | 分页查询实例列表 |
| GET | `/api/cmdb/instances/search` | `cmdb_instance:read` | 全模型关键字搜索 |
| GET | `/api/cmdb/instances/{id}` | `cmdb_instance:read` | 获取实例详情 |
| POST | `/api/cmdb/instances` | `cmdb_instance:create` | 创建实例 |
| PUT | `/api/cmdb/instances/{id}` | `cmdb_instance:update` | 更新实例 |
| DELETE | `/api/cmdb/instances/{id}` | `cmdb_instance:delete` | 删除实例 |
| GET | `/api/cmdb/instances/{id}/history` | `cmdb_instance:read` | 实例变更历史 |
| GET | `/api/cmdb/instances/changes` | `cmdb_instance:read` | 全局变更历史 |

#### GET /api/cmdb/instances

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | String | 是 | 模型标识（如 `host`） |
| `keyword` | String | 否 | 按实例名搜索 |
| `status` | String | 否 | 按状态过滤 |
| `page` | int | 否 | 页码，默认 1 |
| `size` | int | 否 | 每页条数，默认 20 |

**响应：** `R<PageResult<CiInstanceVO>>`

列表视图的 `fieldsData` 仅包含 `isListShow = true` 的字段。

#### GET /api/cmdb/instances/search

跨模型搜索，返回匹配关键字的实例（不区分模型类型）。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `keyword` | String | 是 | 搜索关键字 |
| `size` | int | 否 | 返回条数，默认 10 |

**响应：** `R<PageResult<CiInstanceSearchVO>>`

```json
{
  "records": [
    {
      "id": 1,
      "name": "web-server-01",
      "modelId": "host",
      "modelName": "主机"
    }
  ]
}
```

#### GET /api/cmdb/instances/{id}

**响应：** `R<CiInstanceDetailVO>`

```json
{
  "id": 1,
  "name": "web-server-01",
  "modelId": "host",
  "modelName": "主机",
  "status": "online",
  "owner": "张三",
  "description": "Web 前端服务器",
  "fieldsData": {
    "hostname": "web-server-01",
    "inner_ip": "10.0.1.10",
    "cpu": 8,
    "memory": 32,
    "sn": "SRV-2026-001"
  },
  "attributes": [ ... ],
  "createdAt": "2026-06-13T10:00:00",
  "updatedAt": "2026-06-13T14:30:00"
}
```

详情视图包含：
- 完整的 `fieldsData`（所有字段值）
- `attributes` 列表（模型属性定义，含 groupName 等元信息）

#### POST /api/cmdb/instances

**请求体：**

```json
{
  "modelId": "host",
  "name": "web-server-01",
  "status": "online",
  "owner": "张三",
  "description": "Web 前端服务器",
  "fieldsData": {
    "hostname": "web-server-01",
    "inner_ip": "10.0.1.10",
    "cpu": 8,
    "memory": 32
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `modelId` | String | 是 | 模型标识 |
| `name` | String | 是 | 实例名称 |
| `status` | String | 否 | 状态，默认 `online` |
| `owner` | String | 否 | 负责人 |
| `description` | String | 否 | 描述 |
| `fieldsData` | Map | 是 | 动态字段值 |

**校验流程：**
1. 模型必须存在
2. 实例名称在同模型内不能重复
3. `SchemaValidator` 校验：必填字段不能为空，字段值类型必须匹配字段定义
4. 唯一字段值校验：查询 JSONB 确保值不重复

#### PUT /api/cmdb/instances/{id}

**请求体：** 所有字段可选。

```json
{
  "status": "maintenance",
  "fieldsData": {
    "cpu": 16,
    "memory": 64
  }
}
```

`fieldsData` 更新采用 **merge 策略**：新值覆盖旧值，未提及的字段保持不变。合并后重新执行完整 schema 校验。

#### DELETE /api/cmdb/instances/{id}

删除实例时级联软删除其所有关联关系（src 或 dst 等于该实例 ID 的 `ci_instance_rel` 记录）。

#### GET /api/cmdb/instances/{id}/history

获取指定实例的变更历史（基于 audit_log）。

**响应：** `R<PageResult<ChangeHistoryVO>>`

```json
{
  "records": [
    {
      "id": 101,
      "action": "update_instance",
      "operatorId": 1,
      "operatorName": "管理员",
      "beforeJson": { "status": "online", "cpu": 8 },
      "afterJson": { "status": "maintenance", "cpu": 16 },
      "createdAt": "2026-06-13T14:30:00"
    }
  ]
}
```

#### GET /api/cmdb/instances/changes

获取全局 CMDB 变更历史（所有 `ci_*` 类型的 audit_log）。

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | String | 否 | 按模型过滤（注：当前实现未使用此参数） |
| `operatorId` | Long | 否 | 按操作人过滤 |
| `startDate` | String | 否 | 起始日期 |
| `endDate` | String | 否 | 结束日期 |
| `page` | int | 否 | 页码，默认 1 |
| `size` | int | 否 | 每页条数，默认 20 |

---

### 关联管理 — `/api/cmdb/instances/{id}/relations`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/instances/{id}/relations` | `cmdb_relation:read` | 获取实例关联列表 |
| POST | `/api/cmdb/instances/{id}/relations` | `cmdb_relation:create` | 创建关联 |
| DELETE | `/api/cmdb/instances/{id}/relations/{relationId}` | `cmdb_relation:delete` | 删除关联 |

#### POST /api/cmdb/instances/{id}/relations

路径参数 `id` 是源实例 ID。

**请求体：**

```json
{
  "dstInstanceId": 5,
  "associationKind": "run"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `dstInstanceId` | Long | 是 | 目标实例 ID |
| `associationKind` | String | 是 | 关联类型编码，必须存在于 ci_association_kind |

**校验：**
- 源实例和目标实例必须存在
- 关联类型必须有效
- 同一 (src, dst, kind) 不能重复

#### GET /api/cmdb/instances/{id}/relations

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `kind` | String | 否 | 按关联类型过滤 |

**响应：** `R<List<CiRelationVO>>`

```json
[
  {
    "id": 1,
    "srcInstanceId": 1,
    "srcInstanceName": "web-server-01",
    "dstInstanceId": 5,
    "dstInstanceName": "order-service",
    "associationKind": "run",
    "createdAt": "2026-06-13T10:00:00"
  }
]
```

查询双向返回：实例既可以作为源，也可以作为目标出现在关联中。

---

### 拓扑查询 — `/api/cmdb/topology`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/topology/{instanceId}` | `cmdb_instance:read` | 获取拓扑图数据 |

#### GET /api/cmdb/topology/{instanceId}

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `depth` | int | 否 | 遍历深度，默认 5，最大 10 |

**响应：** `R<TopologyResultVO>`

```json
{
  "nodes": [
    {
      "id": 1,
      "name": "web-server-01",
      "model_id": "host",
      "model_name": "主机",
      "is_root": true
    },
    {
      "id": 5,
      "name": "order-service",
      "model_id": "app",
      "model_name": "应用",
      "is_root": false
    }
  ],
  "edges": [
    {
      "src": 1,
      "dst": 5,
      "kind": "run",
      "label": "运行"
    }
  ]
}
```

**实现原理：**
- 以指定实例为根节点
- 通过 BFS 遍历 `ci_instance_rel` 表（Mapper 的 `findTopologyEdges` 递归 CTE）
- 收集所有关联实例 ID，批量加载实例和模型信息
- 去重边（同一条 src-dst-kind 只出现一次）
- 最大深度硬限制 10 层

---

## 权限控制（RBAC）

### CMDB 资源定义

| 资源代码 | 名称 | 动作 |
|----------|------|------|
| `cmdb_model` | CMDB 模型管理 | create, read, update, delete |
| `cmdb_instance` | CMDB 实例管理 | create, read, update, delete |
| `cmdb_relation` | CMDB 关联关系 | create, read, delete |

### 角色权限矩阵

| 权限代码 | super_admin | admin | group_leader | member | doc_admin |
|----------|:-----------:|:-----:|:------------:|:------:|:---------:|
| `cmdb_model:create` | ✓ | ✓ | — | — | — |
| `cmdb_model:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `cmdb_model:update` | ✓ | ✓ | — | — | — |
| `cmdb_model:delete` | ✓ | ✓ | — | — | — |
| `cmdb_instance:create` | ✓ | ✓ | ✓ | — | — |
| `cmdb_instance:read` | ✓ | ✓ | ✓ | ✓ | ✓ |
| `cmdb_instance:update` | ✓ | ✓ | ✓ | — | — |
| `cmdb_instance:delete` | ✓ | ✓ | — | — | — |
| `cmdb_relation:create` | ✓ | ✓ | ✓ | — | — |
| `cmdb_relation:read` | ✓ | ✓ | ✓ | ✓ | — |
| `cmdb_relation:delete` | ✓ | ✓ | — | — | — |

### Controller 注解

所有 Controller 方法使用 `@PreAuthorize("hasPermission('resource', 'action')")` 注解：

- 属性管理接口复用 `cmdb_model:read` 和 `cmdb_model:update` 权限
- 拓扑查询复用 `cmdb_instance:read` 权限

### 前端权限检查

前端已实现完善的权限守卫机制：
- CMDB 页面路由在 Sidebar 中通过 `resource + action` 权限过滤，无权限的菜单项不显示
- 每个页面组件使用 `PermissionGuard` 包裹或 `useEffect` + `hasPermission()` 检查，无权则 redirect 到首页
- 操作按钮（创建/编辑/删除）通过 `hasPermission('cmdb_model', 'create')` 等条件渲染

---

## 审计日志

所有 CMDB 写操作记录到 `audit_log`，`module = 'cmdb'`。

### 审计动作列表

| action | target_type | 说明 |
|--------|-------------|------|
| `create_model` | `ci_model` | 创建模型 |
| `update_model` | `ci_model` | 更新模型 |
| `delete_model` | `ci_model` | 删除模型 |
| `create_attribute` | `ci_attribute` | 创建属性 |
| `update_attribute` | `ci_attribute` | 更新属性 |
| `delete_attribute` | `ci_attribute` | 删除属性 |
| `create_instance` | `ci_instance` | 创建实例 |
| `update_instance` | `ci_instance` | 更新实例 |
| `delete_instance` | `ci_instance` | 删除实例 |
| `create_relation` | `ci_instance_rel` | 创建关联 |
| `delete_relation` | `ci_instance_rel` | 删除关联 |

### 审计专用索引

V19 创建了 CMDB 审计专用索引：

```sql
CREATE INDEX idx_audit_cmdb_target ON audit_log(
    tenant_id, module, target_type, target_id, created_at DESC
) WHERE module = 'cmdb';
```

### 审计数据格式

每个 Service 的 `writeAudit` 方法记录变更前后快照：

- **beforeJson**：操作前的对象快照（JSON）
- **afterJson**：操作后的对象快照（JSON），删除操作为 null
- **operatorId**：操作人 ID（0L = 系统操作）

---

## 核心业务逻辑

### SchemaValidator（字段校验器）

位于 `CiInstanceService` 内部静态类，在创建/更新实例时自动执行：

1. **必填检查**：`is_required = true` 的字段，`fieldsData` 中必须有值
2. **类型检查**：
   - `singlechar` / `user` / `date` → 必须是 String
   - `int` → 必须是 Number
   - `bool` → 必须是 Boolean
   - `enum` → 必须是 String 且在 `enumOptions` 范围内
   - `list` → 必须是 List
3. **唯一性检查**：`is_unique = true` 的字段，查询 `fields_data->>'field_key'` 确保值在模型内唯一

### 字段值唯一性校验实现

使用 PostgreSQL JSONB 查询：

```java
.apply("fields_data->>'" + attr.getFieldKey() + "' = {0}", value.toString())
```

这依赖 V19 创建的 `GIN(fields_data)` 索引来保证查询性能。

### 模型删除级联

删除模型时：
1. 检查是否内置模型（内置不可删）
2. 检查是否存在实例（有实例不可删）
3. 软删除模型本身
4. 遍历并软删除该模型下所有属性

### 实例删除级联

删除实例时：
1. 软删除实例本身
2. 查找所有 `src_instance_id = id OR dst_instance_id = id` 的关联记录
3. 批量软删除这些关联记录

### fieldsData Merge 策略

更新实例时，`fieldsData` 不是替换而是合并：

```java
Map<String, Object> merged = new LinkedHashMap<>();
if (inst.getFieldsData() != null) merged.putAll(inst.getFieldsData());
merged.putAll(req.getFieldsData());
inst.setFieldsData(merged);
```

合并后对完整的 merged 数据重新执行 schema 校验和唯一性校验。

---

## 内置种子数据

V18 和 V20 创建了以下内置数据：

### 模型分组（5 个）

| code | name | sort_order |
|------|------|:----------:|
| `infra` | 基础设施 | 1 |
| `biz` | 业务应用 | 2 |
| `network` | 网络设备 | 3 |
| `security` | 安全设备 | 4 |
| `cloud` | 云资源 | 5 |

### 模型（2 个）

| name | display_name | group | is_built_in |
|------|-------------|-------|:-----------:|
| `host` | 主机 | infra | true |
| `app` | 应用 | biz | true |

### host 模型属性（13 个）

| field_key | name | group | field_type | required | unique | list_show |
|-----------|------|-------|-----------|:--------:|:------:|:---------:|
| `sn` | 序列号 | base | singlechar | ✓ | ✓ | ✓ |
| `hostname` | 主机名 | base | singlechar | ✓ | ✓ | ✓ |
| `inner_ip` | 内网IP | base | singlechar | ✓ | ✓ | ✓ |
| `outer_ip` | 外网IP | base | singlechar | — | — | ✓ |
| `os_type` | 操作系统 | base | singlechar | — | — | — |
| `cpu` | CPU核心数 | base | int | — | — | — |
| `memory` | 内存(GB) | base | int | — | — | — |
| `disk` | 磁盘(GB) | base | int | — | — | — |
| `asset_id` | 资产编号 | base | singlechar | — | ✓ | — |
| `rack` | 机架位置 | location | singlechar | — | — | — |
| `idc` | 机房 | location | singlechar | — | — | — |
| `status` | 运行状态 | base | enum | — | — | ✓ |
| `comment` | 备注 | base | singlechar | — | — | — |

`status` 的 enum_options: `["online","offline","maintenance"]`

### app 模型属性（5 个）

| field_key | name | group | field_type | required | list_show |
|-----------|------|-------|-----------|:--------:|:---------:|
| `name` | 应用名称 | base | singlechar | ✓ | ✓ |
| `version` | 版本 | base | singlechar | — | — |
| `language` | 开发语言 | base | singlechar | — | — |
| `framework` | 框架 | base | singlechar | — | — |
| `description` | 描述 | base | singlechar | — | — |

### 属性分组（3 个）

| model_id | code | name | sort_order |
|----------|------|------|:----------:|
| host | base | 基础属性 | 1 |
| host | location | 位置属性 | 2 |
| app | base | 基础属性 | 1 |

---

## 设计决策与注意事项

### 1. JSONB 动态字段 vs EAV 模型

**决策：** 使用 `ci_instance.fields_data` JSONB 列存储动态属性值。

**理由：**
- 避免 EAV（Entity-Attribute-Value）模型的复杂 JOIN 查询
- PostgreSQL JSONB 支持索引（GIN）和高效查询（`fields_data->>'key'`）
- 单行查询即可获取实例全部属性，减少数据库往返
- 唯一性校验可通过 `apply("fields_data->>'key' = {0}", value)` 实现

### 2. model_id 使用 VARCHAR 而非 BIGINT FK

**决策：** `ci_attribute.model_id`、`ci_instance.model_id` 等字段存储模型标识字符串（如 `host`），而非 `ci_model.id` 数字外键。

**理由：**
- 代码中按模型标识查询更直观（`listByModel("host", tenantId)`）
- 避免在多表关联时需要先查模型 ID
- 内置 seed 数据不需要硬编码数字 ID

**注意：** 这意味着模型标识一旦创建不应被修改（虽然当前没有禁止修改 name 的逻辑）。

### 3. 内置数据保护

- 内置模型（`is_built_in = true`）不允许删除
- 内置属性仅允许修改 `is_list_show`，其他字段不可改、不可删
- 保留字（`id`, `model_id`, `name` 等）不允许作为自定义属性标识

### 4. 拓扑查询的实现

使用 Mapper 层的 `findTopologyEdges` 方法（基于递归 CTE），而非 Java 层 BFS。这确保了：
- 单次 SQL 查询获取所有关联边
- 数据库级别深度控制
- 性能优于 Java 层循环查询

### 5. 审计日志共用 cmdb module

所有 CMDB 操作（模型、属性、实例、关联）共用 `module = 'cmdb'`，通过 `target_type` 区分操作对象。变更历史查询通过 `target_type LIKE 'ci_%'` 过滤。

### 6. V20 修复说明

V20 使用 `ON CONFLICT DO NOTHING` 而非 `ON CONFLICT ... DO UPDATE SET`，因为 `ci_attribute` 表的唯一约束是复合索引 `(tenant_id, model_id, field_key)`，非单列唯一约束，`DO UPDATE SET` 语法不支持。

### 7. ci_association_def 表已创建但未启用

V17 创建了 `ci_association_def`（模型级别的关联约束定义），但当前 Tier 1 的 `CiRelationService` 未使用。这是为 Tier 2 预留的——未来可以约束「只有 host 和 app 之间允许 run 关联」等模型级别规则。

### 8. 前端实现

CMDB Tier 1 前端已全部实现。技术栈：Next.js 14 App Router + TypeScript + TanStack Query v5 + shadcn/ui + Tailwind CSS。详见下方 [前端页面与组件](#前端页面与组件) 章节。

---

## 前端页面与组件

### 前端文件结构

```
frontend/src/
  app/(dashboard)/cmdb/
    page.tsx                                    # 重定向 → /cmdb/models
    models/
      page.tsx                                  # 模型列表（CRUD + 分组筛选 + 搜索 + 分页）
      [modelId]/page.tsx                        # 重定向 → /cmdb/admin/models/{modelId}
    instances/
      page.tsx                                  # 实例列表（CRUD + 筛选 + 搜索 + CSV 导入）
      [modelId]/
        page.tsx                                # 按模型查看实例列表
        new/page.tsx                            # 新建实例（动态表单）
        [id]/
          page.tsx                              # 实例详情（属性编辑 + 关联面板 + 拓扑预览）
          associations/page.tsx                 # 实例关联全量管理
    topology/
      [instanceId]/page.tsx                     # 全屏拓扑图（深度选择 + 节点详情）
    changes/
      page.tsx                                  # 变更历史列表（筛选 + 分页）
    admin/
      page.tsx                                  # 管理页（模型管理 Tab + 关联定义 Tab）
      models/[modelId]/page.tsx                 # 模型详情 + 属性 CRUD
    associations/page.tsx                       # 重定向 → /cmdb/admin
  components/
    layout/Sidebar.tsx                          # 侧边栏（CMDB 导航 + 权限过滤）
    cmdb/
      CiTopologyGraph.tsx                       # 拓扑可视化组件（ReactFlow）
      CsvImportDialog.tsx                       # CSV 导入对话框（预览 + 执行）
      CiInstanceSelect.tsx                      # CI 实例选择器
      CiLinkSelector.tsx                        # CI 关联选择器（多选）
      ColumnPicker.tsx                          # 列选择器
```

### 页面清单（8 个功能页 + 4 个重定向/辅助页）

| # | 路由 | 文件 | 行数 | 功能 |
|---|------|------|:----:|------|
| 1 | `/cmdb` | cmdb/page.tsx | 9 | 重定向到 `/cmdb/models` |
| 2 | `/cmdb/models` | models/page.tsx | 287 | 模型列表：CRUD + 分组侧边栏 + 搜索 + 分页 |
| 3 | `/cmdb/models/[modelId]` | models/[modelId]/page.tsx | 6 | 重定向到 admin 详情页 |
| 4 | `/cmdb/admin/models/[modelId]` | admin/models/[modelId]/page.tsx | 210 | 模型详情：基本信息 + 属性分组展示 + 属性 CRUD |
| 5 | `/cmdb/instances` | instances/page.tsx | 420 | 实例列表：CRUD + 模型/状态筛选 + 动态表单 + CSV 导入 |
| 6 | `/cmdb/instances/[modelId]` | instances/[modelId]/page.tsx | 213 | 按模型筛选实例列表 |
| 7 | `/cmdb/instances/[modelId]/new` | instances/[modelId]/new/page.tsx | 170 | 新建实例：动态字段表单 |
| 8 | `/cmdb/instances/[modelId]/[id]` | instances/[modelId]/[id]/page.tsx | 485 | 实例详情：属性展示/内联编辑 + 关联面板 + 拓扑预览 |
| 9 | `/cmdb/instances/[modelId]/[id]/associations` | instances/[modelId]/[id]/associations/page.tsx | 169 | 实例关联管理：全量列表 + 按类型筛选 + 删除 |
| 10 | `/cmdb/topology/[instanceId]` | topology/[instanceId]/page.tsx | 139 | 全屏拓扑图：深度选择器 + 节点详情面板 |
| 11 | `/cmdb/changes` | changes/page.tsx | 127 | 变更历史：列表 + 模型筛选 + 日期范围 + 分页 |
| 12 | `/cmdb/admin` | admin/page.tsx | 325 | 管理中心：模型管理 Tab + 关联定义 Tab |
| 13 | `/cmdb/associations` | associations/page.tsx | 5 | 重定向到 admin 页 |

> **路径说明**：实例详情路径为 `/cmdb/instances/[modelId]/[id]`（含 modelId 和 id 两段动态参数），而非早期设计的 `/cmdb/instances/[instanceId]`。关联管理不使用独立的 `/cmdb/relations` 路径，而是集成在 admin 页面的 Tab 和实例详情页的折叠面板中。

---

### 页面功能详解

#### 1. 模型列表页 — `/cmdb/models`（287 行）

**权限守卫**：`cmdb_model:read`

**功能**：
- **模型列表**（Table）：标识 / 显示名 / 分组 / 内置标记 / 实例数 / 操作按钮
- **分组侧边栏筛选**：基础设施 / 业务应用 / 网络设备 / 安全设备 / 云资源
- **关键字搜索**：按模型标识或显示名过滤
- **分页**：每页 20 条，上一页/下一页
- **创建模型**（Dialog 表单）：标识（正则 `^[a-z][a-z0-9_]*$` 校验）/ 显示名 / 分组选择
- **编辑模型**（Dialog 回填）：修改显示名和分组
- **删除模型**（AlertDialog 确认）：内置模型禁用删除按钮
- **权限控制**：`PermissionGuard` + `usePermission` 控制创建/编辑/删除按钮可见性
- **数据获取**：TanStack Query — `GET /api/cmdb/models`

#### 2. 模型详情 + 属性管理 — `/cmdb/admin/models/[modelId]`（210 行）

**权限守卫**：`cmdb_model:read`（写操作需 `cmdb_model:write`）

**功能**：
- **模型基本信息**：名称 / ID / 内置标签
- **属性分组展示**：按 `attribute_groups` 分组渲染属性列表
- **添加属性**（内联表单）：fieldKey / 名称 / 字段类型（9 种：singlechar/longchar/int/float/enum/enummulti/date/bool/objuser）/ 分组 / 提示 / 单位 / 必填 / 唯一 / 列表显示
- **删除属性**（确认弹窗）：内置属性不可删除
- **返回按钮** + 查看实例快捷链接
- **数据获取**：`GET /api/cmdb/meta/models/{modelId}`

#### 3. 实例列表页 — `/cmdb/instances`（420 行）

**权限守卫**：`cmdb_instance:read`

**功能**：
- **实例列表**（Table）：ID / 名称 / 模型 / 状态 / 负责人 / 更新时间
- **模型筛选**（Select）：从 URL 参数 `?model=` 自动设置
- **关键字搜索**：按实例名搜索
- **状态筛选**：运行中 / 已停用 / 维护中
- **分页**：每页 20 条
- **新建实例**（Dialog）：选模型 → 动态字段表单（根据属性定义自动渲染 enum/int/bool/date/list 等类型）
- **删除实例**（AlertDialog 确认）
- **CSV 导入**（CsvImportDialog 组件）：上传 CSV → 预览 → 执行导入
- **权限守卫**：PermissionGuard + usePermission
- **数据获取**：`GET /api/cmdb/instances?model={model}&keyword={kw}&status={st}`

> **已知问题**：创建实例时前端发送 `model`（模型名称）而非 `modelId`（模型标识），可能导致后端校验失败。详见 [已知问题](#已知问题)。

#### 4. 实例详情页 — `/cmdb/instances/[modelId]/[id]`（485 行）

**权限守卫**：`cmdb_instance:read`

这是 CMDB 最核心的页面，集成了属性展示、编辑、关联管理和拓扑预览。

**功能**：
- **属性展示**（按 group 分组）：属性名称 + 值，支持多种字段类型
- **内联编辑模式**：点击编辑 → 字段变为可编辑 → 保存/取消
  - 支持：longchar（文本域）/ enum（下拉）/ enummulti（多选）/ bool（开关）/ date（日期）/ int（数字）/ float（浮点）
  - merge 策略：只发送变更字段
- **关联关系面板**（折叠面板）：
  - 展示关联列表，按关联类型分组
  - 方向标签：正向/反向
  - 删除关联
  - **添加关联**（Dialog）：选择关联定义 → 搜索目标实例 → 建立关联
- **拓扑图预览**（折叠面板）：
  - 使用 `CiTopologyGraph` 组件，深度 2
  - 全屏拓扑链接 → `/cmdb/topology/${id}`
- **全部关联管理**链接 → `/cmdb/instances/${modelId}/${id}/associations`

#### 5. 实例关联管理页 — `/cmdb/instances/[modelId]/[id]/associations`（169 行）

**权限守卫**：`cmdb_instance:read`

**功能**：
- 全量关联列表（实例的所有关联关系）
- 按关联类型筛选（Select 下拉）
- 方向标签：作为源/作为目标
- 删除关联（确认）
- 返回实例详情链接

#### 6. 拓扑查询页 — `/cmdb/topology/[instanceId]`（139 行）

**权限守卫**：`cmdb_instance:read`（isHydrated 检查）

**功能**：
- **全屏拓扑图**（CiTopologyGraph 组件，高度 `calc(100vh - 4rem)`）
- **深度选择器**：1 / 2 / 3 层
- **右侧节点详情面板**：名称 / 模型 / 根节点标记 / 实例链接
- **返回实例**按钮
- 加载/错误/空状态覆盖
- **数据获取**：`GET /api/cmdb/topology/{instanceId}?depth={depth}`

#### 7. 变更历史页 — `/cmdb/changes`（127 行）

**权限守卫**：`cmdb_instance:read`

**功能**：
- **变更列表**（Table）：操作类型（创建/更新/删除）/ 操作人 / 变更内容 / 时间
- **模型筛选**（Select）：加载全部模型列表供选择
- **日期范围筛选**：startDate / endDate
- **分页**：每页 20 条
- **数据获取**：`GET /api/cmdb/instances/changes?model=&startDate=&endDate=`

> **已知限制**：变更内容仅截取 JSON 前 100 字符展示，无 diff 对比视图。Tier 3 提供了增强的变更历史（字段级 diff），详见 cmdb-tier3 文档。

#### 8. 管理中心页 — `/cmdb/admin`（325 行）

**权限守卫**：`cmdb_model:write`

**功能**：
- **Tab 切换**：模型管理 / 关联定义
- **模型管理 Tab**：
  - 按组展示模型卡片（图标 + 名称 + 描述）
  - 新建模型表单（modelId / 名称 / 分组 / 描述 / 图标）
- **关联类型管理**：
  - 展示关联类型列表
  - 新建关联类型（kindId / 名称 / 正向描述 / 反向描述）
- **关联定义管理**：
  - 展示模型间关联定义
  - 新建关联定义（源模型 / 目标模型 / 类型 / 基数 1:1 / 1:n / n:n）
  - 删除关联定义

---

### 复用组件

| 组件 | 文件 | 用途 |
|------|------|------|
| `CiTopologyGraph` | components/cmdb/CiTopologyGraph.tsx (192 行) | 拓扑可视化，基于 ReactFlow（@xyflow/react），支持节点自定义渲染、模型颜色区分（host 蓝色 / app 绿色）、背景/控件/小地图 |
| `CsvImportDialog` | components/cmdb/CsvImportDialog.tsx (299 行) | CSV 导入全流程：上传 → 预览（冲突策略选择）→ 执行进度 → 结果统计 |
| `CiInstanceSelect` | components/cmdb/CiInstanceSelect.tsx | CI 实例单选下拉，用于关联创建时搜索目标实例 |
| `CiLinkSelector` | components/cmdb/CiLinkSelector.tsx | CI 关联选择器（多选 + 影响级别），用于变更文档关联 |
| `ColumnPicker` | components/cmdb/ColumnPicker.tsx | 列选择器，用于实例列表动态列展示 |

### CiTopologyGraph 组件详解

基于 `@xyflow/react`（ReactFlow）实现，核心特性：

- **自定义节点**（`CiNode`）：显示实例名称和模型名，按 model_id 分配颜色
- **颜色方案**：`host` → 蓝色系 / `app` → 绿色系 / 其他 → 灰色系
- **交互**：支持拖拽、缩放、点击选中节点
- **边样式**：带箭头标记（MarkerType.ArrowClosed），标签显示关联类型
- **辅助组件**：Background（网格背景）、Controls（缩放控件）、MiniMap（小地图）

### 侧边栏导航

CMDB 导航项注册在 `Sidebar.tsx` 中，每个菜单项携带 `resource + action` 权限标识：

```
{ href: '/cmdb/models',    label: 'CMDB 模型',  icon: ServerCog,   resource: 'cmdb_model',    action: 'read' }
{ href: '/cmdb/instances', label: 'CMDB 实例',  icon: Database,    resource: 'cmdb_instance', action: 'read' }
{ href: '/cmdb/changes',   label: 'CMDB 变更',  icon: History,     resource: 'cmdb_instance', action: 'read' }
```

权限过滤逻辑：Sidebar 组件遍历导航项时检查当前用户是否拥有对应 `resource:action` 权限，无权限的菜单项不渲染。活跃路径高亮通过 `pathname.startsWith(href)` 实现。

### 数据加载方式

所有 CMDB 页面使用 TanStack Query v5 加载和管理 API 数据：

- **useQuery**：GET 请求，支持缓存 key、自动重试、loading/error 状态
- **useMutation**：POST/PUT/DELETE 请求，成功后通过 `queryClient.invalidateQueries` 自动刷新关联查询
- **API 客户端**：统一使用 `@/lib/api`（Axios 实例），携带 JWT 认证头

### 技术依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Next.js | 14 | App Router 框架 |
| React | 18 | UI 库 |
| TanStack Query | 5 | 数据获取与缓存 |
| shadcn/ui | — | UI 组件库（Button/Input/Dialog/Table/Select 等） |
| Tailwind CSS | 3 | 原子化样式 |
| @xyflow/react | 12 | 拓扑图可视化 |
| lucide-react | — | 图标库 |
| sonner | — | Toast 通知 |

---

### 已知问题

1. **创建实例字段不匹配**：`instances/page.tsx` 创建实例时发送 `model`（模型显示名称）而非 `modelId`（模型标识），后端 DTO 期望 `modelId`。需要前端修正字段名。
2. **变更历史无 diff 视图**：`changes/page.tsx` 仅截取 JSON 前 100 字符展示，无字段级 diff 对比。Tier 3 的 `cmdb_change` 资源提供了增强版变更历史（含 JsonDiffView 组件），详见 cmdb-tier3 文档。
3. **路径与早期设计不一致**：实例详情使用 `[modelId]/[id]` 双段路径（非 `[instanceId]` 单段）；关联管理集成在 admin Tab 和实例详情中（无独立 `/cmdb/relations` 路由）；拓扑页使用 `[instanceId]` 动态参数。
