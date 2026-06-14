# CMDB Tier 2 — 完整指南

> 模块：CMDB / 关联关系管理 + 关联元数据 + CSV 批量导入 + 影响分析 + 拓扑图增强
> 对应 Flyway V24–V26，后端 API + 前端页面均已实现（注：当前存在 P0 bug t_12cb786a，ci_model 表缺少 display_name 列，导致 API 返回 500，修复后功能可用）

---

## 目录

1. [概述](#概述)
2. [功能清单](#功能清单)
3. [数据模型](#数据模型)
4. [API 参考](#api-参考)
   - [关联关系 CRUD](#1-关联关系-crud)
   - [关联扩展属性定义](#2-关联扩展属性定义)
   - [CSV 批量导入](#3-csv-批量导入)
   - [影响分析](#4-影响分析)
5. [前端页面与组件](#前端页面与组件)
6. [权限控制（RBAC）](#权限控制rbac)
7. [核心业务逻辑](#核心业务逻辑)
8. [设计决策与注意事项](#设计决策与注意事项)
9. [已知问题](#已知问题)

---

## 概述

CMDB Tier 2 在 Tier 1 的基础上扩展了 CMDB 的「关系维度」和「批量操作能力」：

- **关联关系 CRUD** — 管理实例之间的关联（创建、更新、删除、查询），支持关联去重和元数据校验
- **关联扩展属性定义** — 为关联类型定义自定义字段（如带宽、权重等），实例关联时需校验
- **CSV 批量导入** — 通过 CSV 文件批量创建/更新 CI 实例，支持预览、冲突策略、进度查询、失败行下载
- **影响分析** — 从指定实例出发，BFS/CTE 双策略遍历关联图，分析上游/下游影响范围
- **拓扑图** — 从 Tier 1 的基础拓扑增强，支持深度选择和节点详情

### 模块文件结构

```
后端 (module/cmdb/):
  controller/
    CiRelationController.java          # /api/cmdb/instances/{id}/relations
    CiAssociationAttrDefController.java # /api/cmdb/association-kinds/{kind}/attributes
    CsvImportController.java           # /api/cmdb/instances/import
    ImpactAnalysisController.java      # /api/cmdb/instances/{id}/impact
  service/
    CiRelationService.java             # 关联 CRUD + 去重 + 元数据校验
    CiAssociationAttrDefService.java   # 关联扩展属性 CRUD
    CsvImportService.java              # CSV 导入（预览→执行→进度→失败行）
    ImpactAnalysisService.java         # CTE + BFS 双策略影响分析
  util/
    CsvParser.java                     # 编码检测 + CSV 解析 + 注入防护
  dto/
    relation/                          # CreateRelationRequest, UpdateRelationRequest, CiRelationVO
    association/                       # CreateAssociationAttrRequest, UpdateAssociationAttrRequest, CiAssociationAttrDefVO
    csv/                               # CsvImportPreviewVO, CsvImportProgressVO, CsvImportResultVO, CsvImportExecuteRequest, CsvFailedRowVO
    impact/                            # ImpactAnalysisRequest, ImpactAnalysisResultVO, ImpactLayerVO, ImpactNodeVO, ImpactEdgeVO
  entity/
    CiAssociationAttrDef.java          # 关联扩展属性实体

前端 (src/app/(dashboard)/cmdb/):
  instances/by-model/[modelId]/[id]/associations/page.tsx  # 关联关系管理
  instances/by-model/[modelId]/[id]/associations/new/page.tsx # 新建关联
  impact/[instanceId]/page.tsx                            # 影响分析页面
  topology/[instanceId]/page.tsx                          # 拓扑图页面
  components/cmdb/
    CsvImportDialog.tsx    # CSV 导入弹窗（上传→预览→执行→结果）
    CiTopologyGraph.tsx    # 拓扑图渲染组件
    CiLinkSelector.tsx     # CI 实例选择器

数据库迁移:
  V24  ci_instance_rel.metadata JSONB + ci_association_attr_def 表 + cmdb_relation:update 权限
  V25  cmdb_instance:import 权限
  V26  cmdb_instance:impact 权限
```

---

## 功能清单

| # | 功能 | 后端 | 前端 | 说明 |
|---|------|------|------|------|
| 1 | 关联关系 CRUD | ✅ | ✅ | 创建/更新/删除/查询实例间关联，含去重和元数据校验 |
| 2 | 关联扩展属性定义 | ✅ | ✅ | 为关联类型定义自定义字段（如带宽、权重） |
| 3 | CSV 批量导入 | ✅ | ✅ | 5 个 API 端点：模板下载→预览→执行→进度→失败行下载 |
| 4 | 影响分析 | ✅ | ✅ | BFS/CTE 双策略，支持方向（上游/下游/双向）和深度控制 |
| 5 | 拓扑图 | ✅ | ✅ | 从实例出发的关联拓扑可视化，支持深度选择 |

---

## 数据模型

### ci_instance_rel（扩展，V24）

Tier 1 已创建此表，Tier 2 新增 `metadata` JSONB 列：

| 列名 | 类型 | 说明 |
|------|------|------|
| metadata | JSONB NOT NULL DEFAULT '{}' | 关联扩展属性值，按 ci_association_attr_def 定义的 schema 存储 |

索引：`idx_ci_rel_metadata` (GIN) — 支持对 metadata 字段的高效 JSON 查询。

### ci_association_attr_def（新增，V24）

关联类型的扩展属性定义表，类似 `ci_attribute` 但作用于关联而非模型：

| 列名 | 类型 | 说明 |
|------|------|------|
| id | BIGSERIAL PK | |
| tenant_id | VARCHAR(64) | 租户隔离 |
| association_kind | VARCHAR(64) | 关联类型 code（如 `run_on`, `connects_to`） |
| field_key | VARCHAR(64) | 字段标识（小写字母+数字+下划线） |
| name | VARCHAR(128) | 字段显示名称 |
| field_type | VARCHAR(32) | 字段类型：singlechar/int/enum/list/bool/user/date |
| is_required | BOOLEAN | 是否必填 |
| enum_options | TEXT | 枚举选项（JSON 数组，仅 enum 类型） |
| default_value | VARCHAR(512) | 默认值 |
| sort_order | INT | 排序权重 |
| is_deleted / deleted_at / deleted_by | 软删除 | |

唯一索引：`(tenant_id, association_kind, field_key) WHERE NOT is_deleted`

---

## API 参考

### 1. 关联关系 CRUD

**Base path:** `/api/cmdb/instances/{id}/relations`

#### 创建关联

```
POST /api/cmdb/instances/{id}/relations
Permission: cmdb_relation:create
```

**Request Body** (`CreateRelationRequest`):
```json
{
  "dstInstanceId": 42,
  "associationKind": "run_on",
  "metadata": {
    "bandwidth": "1000Mbps",
    "priority": "high"
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| dstInstanceId | Long | 是 | 目标实例 ID |
| associationKind | String | 是 | 关联类型 code |
| metadata | Map<String, Object> | 否 | 关联扩展属性（按 attr def schema 校验） |

**Response** (`CiRelationVO`):
```json
{
  "id": 1,
  "srcInstanceId": 10,
  "srcInstanceName": "web-server-01",
  "dstInstanceId": 42,
  "dstInstanceName": "app-pod-3",
  "associationKind": "run_on",
  "metadata": { "bandwidth": "1000Mbps", "priority": "high" },
  "createdAt": "2026-06-14T12:00:00"
}
```

**业务逻辑：**
- 校验源实例和目标实例存在且属于同一租户
- 校验关联类型存在
- **去重检查**：同源→同目标 + 同关联类型不可重复
- **元数据校验**：按 `ci_association_attr_def` 定义的 schema 验证 metadata（必填、类型、枚举值）
- 写入审计日志（action=`create_relation`）

#### 更新关联

```
PUT /api/cmdb/instances/{id}/relations/{relationId}
Permission: cmdb_relation:update
```

**Request Body** (`UpdateRelationRequest`):
```json
{
  "metadata": {
    "priority": "medium"
  }
}
```

**业务逻辑：**
- Patch merge：仅更新 metadata 中传入的字段，不覆盖未传入的
- 校验关联属于该实例（源或目标）
- 重新校验合并后的 metadata

#### 删除关联

```
DELETE /api/cmdb/instances/{id}/relations/{relationId}
Permission: cmdb_relation:delete
```

软删除（设置 `is_deleted=true`, `deleted_at`, `deleted_by`）。

#### 查询关联列表

```
GET /api/cmdb/instances/{id}/relations?kind=run_on
Permission: cmdb_relation:read
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| kind | String | 否 | 关联类型过滤 |

返回所有以该实例为源或目标的关联（双向查询），按创建时间倒序。

---

### 2. 关联扩展属性定义

**Base path:** `/api/cmdb/association-kinds/{kind}/attributes`

复用 `cmdb_model:read` 和 `cmdb_model:update` 权限。

#### 列表

```
GET /api/cmdb/association-kinds/{kind}/attributes
Permission: cmdb_model:read
```

返回指定关联类型下的所有扩展属性定义。

#### 创建

```
POST /api/cmdb/association-kinds/{kind}/attributes
Permission: cmdb_model:update
```

**Request Body** (`CreateAssociationAttrRequest`):
```json
{
  "fieldKey": "bandwidth",
  "name": "带宽",
  "fieldType": "singlechar",
  "isRequired": false,
  "defaultValue": "100Mbps",
  "sortOrder": 0
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| fieldKey | String | 是 | 正则 `^[a-z][a-z0-9_]*$` |
| name | String | 是 | 显示名称 |
| fieldType | String | 是 | singlechar/int/enum/list/bool/user/date |
| isRequired | Boolean | 否 | 默认 false |
| enumOptions | String | 条件必填 | enum 类型时必填（JSON 数组） |
| defaultValue | String | 否 | |
| sortOrder | Integer | 否 | 默认 0 |

**校验：**
- 关联类型必须存在
- fieldKey 在同一 association_kind 下唯一
- fieldType 在允许列表中
- enum 类型必须提供 enumOptions

#### 更新

```
PUT /api/cmdb/association-kinds/{kind}/attributes/{attrId}
Permission: cmdb_model:update
```

**Request Body** (`UpdateAssociationAttrRequest`): 支持部分更新 name/isRequired/enumOptions/defaultValue/sortOrder。

#### 删除

```
DELETE /api/cmdb/association-kinds/{kind}/attributes/{attrId}
Permission: cmdb_model:update
```

软删除。

---

### 3. CSV 批量导入

**Base path:** `/api/cmdb/instances/import`

#### 下载导入模板

```
GET /api/cmdb/instances/import/template?model=host
Permission: cmdb_instance:read
```

返回 CSV 文件（`Content-Type: text/csv; charset=UTF-8`），包含模型所有必填或列表显示的属性列头。enum 类型列头附带可选值提示，如 `status (["online","offline"])`。

#### 预览导入

```
POST /api/cmdb/instances/import/preview
Permission: cmdb_instance:create AND cmdb_instance:update
Content-Type: multipart/form-data
```

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| file | MultipartFile | — | CSV 文件（最大 10MB） |
| model | String | — | 模型标识 |
| conflictStrategy | String | `override` | 冲突策略：`override`/`skip`/`error` |
| uniqueKeyFields | String | 自动 | 唯一键字段（逗号分隔，为空时用模型 `isUnique` 属性） |
| encoding | String | 自动检测 | 文件编码（为空时自动检测 UTF-8/GBK） |

**Response** (`CsvImportPreviewVO`):
```json
{
  "batchId": "uuid-string",
  "totalRows": 100,
  "toCreate": 80,
  "toUpdate": 15,
  "toSkip": 3,
  "failedRows": [
    { "rowNumber": 5, "reason": "字段 host_name 不能为空" }
  ],
  "encoding": "UTF-8",
  "previewData": [ { "name": "server-01", "ip": "10.0.0.1" } ]
}
```

**业务逻辑：**
1. 文件大小校验（≤10MB）
2. 编码检测（优先 UTF-8 验证，回退 juniversalchardet，默认 GBK）
3. CSV 解析（Apache Commons CSV，最大 5000 行）
4. 必填列头校验
5. 逐行类型校验（int/bool/enum）
6. 唯一键匹配：查询已有实例，判断 create/update/skip/error
7. 解析数据存入 Redis（TTL 10 分钟），返回 batchId 供后续执行

#### 执行导入

```
POST /api/cmdb/instances/import/execute
Permission: cmdb_instance:create AND cmdb_instance:update
```

**Request Body** (`CsvImportExecuteRequest`):
```json
{
  "batchId": "uuid-string"
}
```

**Response** (`CsvImportResultVO`):
```json
{
  "batchId": "uuid-string",
  "totalRows": 100,
  "created": 80,
  "updated": 15,
  "skipped": 3,
  "failed": 2,
  "failedRows": [ { "rowNumber": 5, "reason": "..." } ],
  "durationMs": 1234
}
```

**业务逻辑：**
1. 从 Redis 加载预览数据（过期则报错）
2. 分批处理（每批 100 行），每批独立事务
3. create → 插入新实例 + 审计日志
4. update → 合并 fieldsData + 审计日志
5. skip → 跳过
6. 异常逐行捕获，记入 failedRows
7. 实时更新 Redis 进度
8. 完成后清理 Redis 预览数据

#### 查询导入进度

```
GET /api/cmdb/instances/import/{batchId}/progress
Permission: cmdb_instance:read
```

**Response** (`CsvImportProgressVO`):
```json
{
  "batchId": "uuid-string",
  "status": "processing",
  "totalRows": 100,
  "processed": 50,
  "created": 40,
  "updated": 8,
  "skipped": 1,
  "failed": 1
}
```

status 取值：`processing` / `completed`。

#### 下载失败行

```
GET /api/cmdb/instances/import/{batchId}/failed-rows
Permission: cmdb_instance:read
```

返回 CSV 文件，包含导入中失败的行数据。

---

### 4. 影响分析

```
POST /api/cmdb/instances/{id}/impact
Permission: cmdb_instance:read AND cmdb_instance:impact
```

**Request Body** (`ImpactAnalysisRequest`，可选):
```json
{
  "direction": "bidirectional",
  "maxDepth": 3
}
```

| 字段 | 类型 | 默认 | 约束 | 说明 |
|------|------|------|------|------|
| direction | String | `bidirectional` | bidirectional/upstream/downstream | 遍历方向 |
| maxDepth | Integer | 3 | 1–5 | 最大遍历深度 |

**Response** (`ImpactAnalysisResultVO`):
```json
{
  "rootId": 1,
  "rootName": "core-db-01",
  "rootModelId": "database",
  "direction": "bidirectional",
  "maxDepth": 3,
  "truncated": false,
  "layers": [
    {
      "depth": 0,
      "nodes": [{ "id": 1, "name": "core-db-01", "modelId": "database", "modelName": "数据库", "status": "running", "businessLevel": "core" }]
    },
    {
      "depth": 1,
      "nodes": [{ "id": 2, "name": "app-server-01", "modelId": "application", "modelName": "应用", "status": "running" }]
    }
  ],
  "edges": [
    { "src": 1, "dst": 2, "kind": "connects_to", "label": "连接" }
  ]
}
```

**Response 字段说明：**

| 字段 | 类型 | 说明 |
|------|------|------|
| rootId | Long | 根实例 ID |
| rootName | String | 根实例名称 |
| rootModelId | String | 根实例模型标识 |
| direction | String | 实际使用的方向 |
| maxDepth | int | 实际使用的最大深度 |
| truncated | boolean | 是否因超时被截断 |
| layers | List<ImpactLayerVO> | 按深度分层的节点列表 |
| edges | List<ImpactEdgeVO> | 去重后的边列表 |

**ImpactLayerVO:**

| 字段 | 类型 | 说明 |
|------|------|------|
| depth | int | 层级深度（0 = 根） |
| nodes | List<ImpactNodeVO> | 该层的节点列表 |

**ImpactNodeVO:**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 实例 ID |
| name | String | 实例名称 |
| modelId | String | 模型标识 |
| modelName | String | 模型显示名称 |
| status | String | 实例状态 |
| businessLevel | String | 业务级别（从 fieldsData.business_level 提取） |

**ImpactEdgeVO:**

| 字段 | 类型 | 说明 |
|------|------|------|
| src | Long | 源实例 ID |
| dst | Long | 目标实例 ID |
| kind | String | 关联类型 code |
| label | String | 关联类型显示名称 |

**双策略架构：**

| 条件 | 策略 | 说明 |
|------|------|------|
| maxDepth ≤ 3 且预估节点 < 200 | PostgreSQL 递归 CTE | 单次 SQL 查询，性能最优 |
| maxDepth > 3 或预估节点 ≥ 200 | Java BFS | 逐层遍历，可中断超时 |

两种策略都有 5 秒超时保护（`TIMEOUT_MS = 5000`），超时后返回 `truncated=true` 的部分结果。

---

## 前端页面与组件

### 关联关系管理

**路径：** `/cmdb/instances/by-model/[modelId]/[id]/associations`

- 列出实例的所有关联（双向），按关联类型分组
- 支持按关联类型筛选
- 创建新关联（跳转到 `/associations/new`）
- 删除关联（需 `cmdb_relation:delete` 权限）
- 显示对端实例名称、模型和方向（源→目标 / 目标→源）

**新建关联页面：** `/cmdb/instances/by-model/[modelId]/[id]/associations/new`
- 选择关联类型 + 目标实例（通过 CiLinkSelector 组件）
- 填写关联扩展属性（根据 attr def 动态渲染表单）

### CSV 导入弹窗

**组件：** `CsvImportDialog.tsx`（299 行）

三步流程：
1. **上传**（step=0）— 选择文件、冲突策略、编码
2. **预览**（step=1）— 显示创建/更新/跳过/失败统计 + 前 10 行预览数据
3. **执行/结果**（step=2）— 实时进度轮询 + 最终结果

### 影响分析页面

**路径：** `/cmdb/impact/[instanceId]`（306 行）

- 方向选择器（双向/上游/下游）
- 深度选择器（1–5）
- 分层树形展示（可折叠各层级）
- 每个节点显示名称、模型、状态 Badge、业务级别
- 截断警告提示（`truncated=true` 时显示）
- 边列表展示关联类型标签

### 拓扑图页面

**路径：** `/cmdb/topology/[instanceId]`（139 行）

- 深度选择器（默认 2）
- 使用 `CiTopologyGraph` 组件渲染交互式拓扑图
- 节点点击查看详情
- 依赖 Tier 1 的 `/api/cmdb/topology` API

### 复用组件

| 组件 | 用途 |
|------|------|
| `CiLinkSelector.tsx` | CI 实例选择器（搜索+选择目标实例） |
| `CiTopologyGraph.tsx` | 拓扑图渲染（基于 D3/Force Graph） |
| `CsvImportDialog.tsx` | CSV 导入弹窗 |

所有页面均使用 `usePermission` hook 做客户端权限守卫，无权限时重定向到首页。

---

## 权限控制（RBAC）

### Tier 2 新增权限

| 权限 Code | 资源 | Action | 说明 | 迁移 |
|-----------|------|--------|------|------|
| `cmdb_relation:update` | cmdb_relation | update | 更新关联 | V24 |
| `cmdb_instance:import` | cmdb_instance | import | CSV 导入实例 | V25 |
| `cmdb_instance:impact` | cmdb_instance | impact | 影响分析 | V26 |

### 权限矩阵

| 权限 | super_admin | admin | group_leader | member |
|------|:-----------:|:-----:|:------------:|:------:|
| cmdb_relation:create | ✅ | ✅ | ✅ | ❌ |
| cmdb_relation:read | ✅ | ✅ | ✅ | ✅ |
| cmdb_relation:update | ✅ | ✅ | ✅ | ❌ |
| cmdb_relation:delete | ✅ | ✅ | ✅ | ❌ |
| cmdb_instance:import | ✅ | ✅ | ✅ | ❌ |
| cmdb_instance:impact | ✅ | ✅ | ✅ | ✅ |

CSV 导入预览/执行需要 `cmdb_instance:create` AND `cmdb_instance:update` 双权限。

---

## 核心业务逻辑

### 关联去重

同一 (srcInstanceId, dstInstanceId, associationKind) 组合不可重复。创建时查询 `ci_instance_rel` 表，若已存在未删除的同组合记录则抛出 `IllegalArgumentException("关联关系已存在")`。

### 关联元数据校验

创建/更新关联时，metadata 字段按 `ci_association_attr_def` 中对应 associationKind 的定义进行校验：

```java
CiInstanceService.SchemaValidator.validateAssociationAttrs(metadata, attrDefs);
```

校验规则：
- isRequired=true 的字段必须提供
- fieldType 类型匹配（int→数字，bool→布尔，enum→在 enumOptions 中）
- 不在 attr def 定义中的额外字段被忽略

### CSV 导入冲突策略

| 策略 | 行为 |
|------|------|
| `override`（默认） | 覆盖已有实例的 fieldsData（patch merge） |
| `skip` | 跳过，不修改 |
| `error` | 记入 failedRows |

唯一键确定方式：
1. 若 `uniqueKeyFields` 参数提供，使用指定的字段组合
2. 否则使用模型中 `isUnique=true` 的属性字段
3. 若两者皆无，所有行视为新建

### CSV 注入防护

`CsvParser.sanitize()` 对所有字符串值进行 CSV injection 防护：若值以 `= + - @ \t \r` 开头，自动添加前缀 `'`。

### 影响分析策略选择

```
estimatedNodes = 估计的图节点数（基于直接邻居数 × 深度的幂）

if maxDepth ≤ 3 AND estimatedNodes < 200:
    → PostgreSQL 递归 CTE（单次 SQL）
else:
    → Java BFS（逐层遍历）
```

**CTE 方向条件：**
- downstream: `r.src_instance_id = i.dst_instance_id`（沿源→目标方向）
- upstream: `r.dst_instance_id = i.src_instance_id`（沿目标→源方向）
- bidirectional: 两个方向都遍历

**超时保护：** 两种策略都有 5 秒超时。CTE 超时返回仅含根节点的部分结果；BFS 超时返回已遍历的部分层。

### Redis 缓存策略

| Key | 数据 | TTL | 用途 |
|-----|------|-----|------|
| `cmdb:import:preview:{batchId}` | 预览解析数据 JSON | 600s (10min) | 预览→执行之间的数据传递 |
| `cmdb:import:progress:{batchId}` | Hash: 导入进度 | 600s | 实时进度查询 |

---

## 设计决策与注意事项

1. **关联扩展属性独立表设计** — `ci_association_attr_def` 类似模型的 `ci_attribute`，但作用于关联类型。关联实例的 metadata 存储在 `ci_instance_rel.metadata` JSONB 中，查询时按 schema 校验。

2. **CSV 导入 Redis 中转** — 预览和执行之间通过 Redis 传递数据（而非重新上传文件），避免文件重复解析。代价是 10 分钟 TTL 后预览数据过期，需重新上传。

3. **CSV 逐行异常隔离** — 单行失败不中断整个导入，记入 failedRows 继续处理。每批 100 行独立事务，某批失败不影响已提交的批次。

4. **影响分析双策略** — CTE 适合小图（快，单 SQL），BFS 适合大图（可控，可中断）。自动选择策略避免 CTE 在大图上产生笛卡尔积爆炸。

5. **影响分析深度上限 5** — maxDepth 被钳制在 [1, 5]，防止过深的图遍历消耗过多资源。

6. **权限复用** — 关联扩展属性管理复用 `cmdb_model:update` 权限（不新增独立权限），因为这些属性本质上是模型层面的定义。

7. **审计日志** — 所有写操作（关联 CRUD、关联属性 CRUD、CSV 导入 create/update）均写入 audit_log，action 包括：`create_relation`、`update_relation`、`delete_relation`、`create_association_attr`、`update_association_attr`、`delete_association_attr`、`import_create`、`import_update`。

---

## 已知问题

### P0 — ci_model 表缺少 display_name 列（Bug t_12cb786a）

`CiModel.java` 实体类的 `displayName` 字段被 MyBatis Plus 映射为 `display_name` SQL 列，但 V14 迁移未创建此列。导致所有涉及模型的 API（包括 T2 的关联查询、CSV 模板生成、影响分析节点 enrichment）返回 500 错误。

**修复方案：** 新增 V35 迁移添加 `display_name` 列。

**影响范围：**
- GET /api/cmdb/models
- GET /api/cmdb/instances
- GET /api/cmdb/association-kinds/{kind}/attributes
- POST /api/cmdb/instances/import/preview
- POST /api/cmdb/instances/{id}/impact

修复后需重新部署并重新验收 T2 全部功能。
