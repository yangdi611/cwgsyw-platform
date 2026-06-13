# CMDB Tier 2 — 完整指南

> 模块：CMDB（配置管理数据库）/ 关联增强 + CSV 批量导入 + 影响分析
> 对应 Flyway V24–V26，后端 API 已完成（前端待开发）
> 前置：[CMDB Tier 1 指南](./cmdb-tier1.md)

---

## 目录

1. [概述](#概述)
2. [数据模型变更](#数据模型变更)
3. [API 参考](#api-参考)
4. [权限控制（RBAC）](#权限控制rbac)
5. [审计日志](#审计日志)
6. [核心业务逻辑](#核心业务逻辑)
7. [设计决策与注意事项](#设计决策与注意事项)
8. [使用教程](#使用教程)

---

## 概述

CMDB Tier 2 在 Tier 1（模型+属性+实例+关联+拓扑）基础上，新增三大功能：

- **关联元数据增强**：关联关系可携带结构化扩展属性（如连接的端口号、带宽），Schema 通过 `ci_association_attr_def` 定义，创建/更新关联时自动校验
- **CSV 批量导入**：支持上传 CSV 文件批量创建/更新 CI 实例，提供预览→确认→进度查询的完整流程，支持编码检测、冲突策略、失败行下载
- **影响分析**：从指定实例出发，BFS/递归 CTE 遍历关联关系，按层级返回受影响的节点和边，支持方向控制和超时截断

### 模块文件结构

```
后端（新增/变更）:
module/cmdb/
  controller/
    CiAssociationAttrDefController.java   # /api/cmdb/association-kinds/{kind}/attributes
    CiRelationController.java             # 变更：新增 PUT 端点
    CsvImportController.java              # /api/cmdb/instances/import
    ImpactAnalysisController.java         # /api/cmdb/instances/{id}/impact
  service/
    CiAssociationAttrDefService.java      # 关联扩展属性 CRUD
    CiRelationService.java                # 变更：支持 metadata + update
    CiInstanceService.java                # 变更：SchemaValidator 扩展 validateAssociationAttrs
    CsvImportService.java                 # CSV 导入全流程
    ImpactAnalysisService.java            # 影响分析（CTE + Java BFS 混合策略）
  entity/
    CiAssociationAttrDef.java             # 关联扩展属性定义
    CiInstanceRel.java                    # 变更：新增 metadata JSONB 字段
  mapper/
    CiAssociationAttrDefMapper.java       # listByKind 查询
  dto/
    association/                          # CiAssociationAttrDefVO, Create/UpdateAssociationAttrRequest
    csv/                                  # CsvImportPreviewVO, CsvImportResultVO, CsvImportProgressVO, CsvFailedRowVO, CsvImportExecuteRequest
    impact/                               # ImpactAnalysisRequest, ImpactAnalysisResultVO, ImpactLayerVO, ImpactNodeVO, ImpactEdgeVO
    relation/                             # 变更：CiRelationVO 新增 metadata, UpdateRelationRequest, CreateRelationRequest 新增 metadata
  util/
    CsvParser.java                        # CSV 解析 + 编码检测 + CSV 注入防护

数据库迁移:
  V24  ci_instance_rel.metadata JSONB + ci_association_attr_def 表
  V25  CSV 导入权限 seed（cmdb_instance:import）
  V26  影响分析权限 seed（cmdb_instance:impact）

新增依赖 (pom.xml):
  commons-csv:1.11.0                      # CSV 解析
  juniversalchardet:1.0.3                 # 编码检测（UTF-8/GBK）
```

---

## 数据模型变更

### V24 — ci_instance_rel 新增 metadata

`ci_instance_rel` 表新增 `metadata JSONB` 列：

```sql
ALTER TABLE ci_instance_rel
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ci_rel_metadata ON ci_instance_rel USING GIN(metadata);
```

**向后兼容**：现有数据 `metadata = '{}'`，无需迁移。Tier 1 的关联查询、拓扑查询完全兼容。

CiInstanceRel 实体新增字段：

```java
@TableField(typeHandler = JacksonTypeHandler.class)
private Map<String, Object> metadata = new LinkedHashMap<>();
```

### V24 — ci_association_attr_def 新表

关联类型的扩展属性定义表，结构类似 `ci_attribute`，但绑定到 `association_kind` 而非 `model_id`。

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | BIGSERIAL PK | 自增主键 |
| `tenant_id` | VARCHAR(64) | 租户 ID，默认 `default` |
| `association_kind` | VARCHAR(64) | 关联类型编码（软引用 ci_association_kind.code） |
| `field_key` | VARCHAR(64) | 字段标识（如 `listen_port`） |
| `name` | VARCHAR(128) | 字段名称（如 "监听端口"） |
| `field_type` | VARCHAR(32) | 字段类型：singlechar/int/enum/bool/date/user/list |
| `is_required` | BOOLEAN | 是否必填，默认 false |
| `enum_options` | TEXT | enum 类型的可选值 JSON 数组 |
| `default_value` | VARCHAR(512) | 默认值 |
| `sort_order` | INT | 排序序号，默认 0 |
| `is_deleted` | BOOLEAN | 软删除标记 |
| `deleted_at` / `deleted_by` | TIMESTAMP / BIGINT | 删除信息 |
| `created_at` / `updated_at` / `created_by` / `updated_by` | — | 审计字段 |

**唯一约束：** `idx_ci_assoc_attr_kind_key` — `(tenant_id, association_kind, field_key) WHERE NOT is_deleted`

**设计说明：**
- `association_kind` 是软引用（非 FK），指向 `ci_association_kind.code`
- 每个 `association_kind` 可独立定义扩展属性 schema（如 `connect` 类型可定义 `bandwidth`、`latency`）
- 字段类型与 `ci_attribute` 一致，复用 `SchemaValidator`

### ER 关系更新

```
ci_association_kind (1) ──── (N) ci_association_attr_def    [Tier 2 新增]
ci_instance_rel:
  新增 metadata JSONB → 校验 schema 由 ci_association_attr_def 定义
```

---

## API 参考

### 关联扩展属性管理 — `/api/cmdb/association-kinds/{kind}/attributes`

管理关联类型的扩展属性 Schema。定义后，创建/更新关联时会自动校验 metadata 字段。

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/association-kinds/{kind}/attributes` | `cmdb_model:read` | 获取关联类型的扩展属性列表 |
| POST | `/api/cmdb/association-kinds/{kind}/attributes` | `cmdb_model:update` | 创建扩展属性 |
| PUT | `/api/cmdb/association-kinds/{kind}/attributes/{attrId}` | `cmdb_model:update` | 更新扩展属性 |
| DELETE | `/api/cmdb/association-kinds/{kind}/attributes/{attrId}` | `cmdb_model:update` | 删除扩展属性（软删除） |

#### GET /api/cmdb/association-kinds/{kind}/attributes

**路径参数：**

| 参数 | 说明 |
|------|------|
| `kind` | 关联类型编码（如 `connect`、`run`） |

**响应：** `R<List<CiAssociationAttrDefVO>>`

```json
[
  {
    "id": 1,
    "associationKind": "connect",
    "fieldKey": "bandwidth",
    "name": "带宽(Mbps)",
    "fieldType": "int",
    "isRequired": false,
    "enumOptions": null,
    "defaultValue": "1000",
    "sortOrder": 1
  }
]
```

#### POST /api/cmdb/association-kinds/{kind}/attributes

**请求体：**

```json
{
  "fieldKey": "bandwidth",
  "name": "带宽(Mbps)",
  "fieldType": "int",
  "isRequired": false,
  "defaultValue": "1000",
  "sortOrder": 1
}
```

| 字段 | 类型 | 必填 | 校验 | 说明 |
|------|------|------|------|------|
| `fieldKey` | String | 是 | `^[a-z][a-z0-9_]*$` | 字段标识 |
| `name` | String | 是 | — | 字段名称 |
| `fieldType` | String | 是 | singlechar/int/enum/list/bool/user/date | 字段类型 |
| `isRequired` | Boolean | 否 | 默认 false | 是否必填 |
| `enumOptions` | String | 否 | enum 类型必填 | JSON 数组字符串 |
| `defaultValue` | String | 否 | — | 默认值 |
| `sortOrder` | Integer | 否 | 默认 0 | 排序序号 |

**校验规则：**
- `kind` 必须存在于 `ci_association_kind`
- `fieldKey` 在同一 `association_kind` 内唯一
- `enum` 类型必须提供 `enumOptions`

#### PUT /api/cmdb/association-kinds/{kind}/attributes/{attrId}

**请求体：** 所有字段可选。

```json
{
  "name": "带宽(Gbps)",
  "isRequired": true
}
```

**约束：**
- `fieldKey` 不可修改
- `fieldType` 不可修改
- 属性必须属于指定的 `kind`

#### DELETE /api/cmdb/association-kinds/{kind}/attributes/{attrId}

- 逻辑删除（`is_deleted = true`）
- 历史关联的 metadata 中该字段值保留（不自动清理）

---

### 关联管理（扩展） — `/api/cmdb/instances/{id}/relations`

Tier 2 在 Tier 1 基础上新增 **PUT** 端点和 **metadata** 支持。

#### PUT /api/cmdb/instances/{id}/relations/{relationId} — 编辑关联元数据（新增）

| 权限 | 说明 |
|------|------|
| `cmdb_relation:update` | 新增 action（V24 seed） |

**请求体：**

```json
{
  "metadata": {
    "bandwidth": 10000,
    "latency": 5
  }
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `metadata` | Map<String, Object> | 否 | 增量合并（patch semantics） |

**校验流程：**
1. 验证关联关系存在且属于指定实例
2. 加载该 `association_kind` 的 `ci_association_attr_def` 列表
3. 对合并后的 metadata 执行 `SchemaValidator.validateAssociationAttrs` 校验
4. Merge 策略：新值覆盖旧值，未提及的字段保持不变
5. 记录审计日志（before = 旧 metadata，after = 新 metadata）

#### POST /api/cmdb/instances/{id}/relations（变更）

创建关联请求新增可选 `metadata` 字段：

```json
{
  "dstInstanceId": 5,
  "associationKind": "connect",
  "metadata": {
    "bandwidth": 1000,
    "port": "eth0"
  }
}
```

创建时同样会校验 metadata 是否符合 `ci_association_attr_def` 定义的 schema。

#### GET /api/cmdb/instances/{id}/relations（变更）

响应中的 `CiRelationVO` 新增 `metadata` 字段：

```json
{
  "id": 1,
  "srcInstanceId": 1,
  "srcInstanceName": "web-server-01",
  "dstInstanceId": 5,
  "dstInstanceName": "switch-core",
  "associationKind": "connect",
  "metadata": {
    "bandwidth": 1000,
    "port": "eth0"
  },
  "createdAt": "2026-06-13T10:00:00"
}
```

---

### CSV 批量导入 — `/api/cmdb/instances/import`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/api/cmdb/instances/import/template` | `cmdb_instance:read` | 下载导入模板 |
| POST | `/api/cmdb/instances/import/preview` | `cmdb_instance:create` + `cmdb_instance:update` | 上传 CSV 并预览 |
| POST | `/api/cmdb/instances/import/execute` | `cmdb_instance:create` + `cmdb_instance:update` | 确认执行导入 |
| GET | `/api/cmdb/instances/import/{batchId}/progress` | `cmdb_instance:read` | 查询导入进度 |
| GET | `/api/cmdb/instances/import/{batchId}/failed-rows` | `cmdb_instance:read` | 下载失败行 CSV |

#### GET /api/cmdb/instances/import/template

**请求参数：**

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `model` | String | 是 | 模型标识（如 `host`） |

**响应：** CSV 文件下载

- 表头为模型中 `is_required = true` 或 `is_list_show = true` 的属性字段
- 枚举字段表头格式：`field_key (["online","offline","maintenance"])`
- 文件名：`{model}_import_template.csv`
- 编码：UTF-8

**示例模板（host 模型）：**

```csv
sn,hostname,inner_ip,outer_ip,cpu,memory,disk,status (["online","offline","maintenance"])
```

#### POST /api/cmdb/instances/import/preview

**请求格式：** `multipart/form-data`

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | MultipartFile | 是 | CSV 文件，最大 10MB |
| `model` | String | 是 | 模型标识 |
| `conflictStrategy` | String | 否 | `override`（默认）/ `skip` / `error` |
| `uniqueKeyFields` | String | 否 | 逗号分隔的唯一键字段（如 `hostname,idc`） |
| `encoding` | String | 否 | UTF-8/GBK，默认自动检测 |

**冲突策略说明：**

| 策略 | 行为 |
|------|------|
| `override` | 用 CSV 数据覆盖已存在的实例（merge fieldsData） |
| `skip` | 跳过已存在的实例，不更新 |
| `error` | 将冲突行标记为失败 |

**唯一键策略：**
- 如果指定 `uniqueKeyFields`，使用指定字段组合作为唯一键
- 如果未指定，自动使用模型中 `is_unique = true` 的属性
- 唯一键值为多字段用 `|` 连接

**编码检测流程：**
1. 如果指定 `encoding`，使用指定编码
2. 否则先验证是否为合法 UTF-8
3. 不是 UTF-8 则使用 juniversalchardet 库自动检测
4. 兜底使用 GBK

**响应：** `R<CsvImportPreviewVO>`

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "totalRows": 150,
  "toCreate": 120,
  "toUpdate": 25,
  "toSkip": 3,
  "failedRows": [
    {
      "rowNumber": 5,
      "reason": "字段 内网IP 不能为空",
      "rowData": { "hostname": "srv-05" }
    }
  ],
  "encoding": "UTF-8",
  "previewData": [
    { "hostname": "web-server-01", "inner_ip": "10.0.1.10", "cpu": 8 }
  ]
}
```

**限制：**
- 文件大小 ≤ 10MB
- 行数 ≤ 5000（超出报错："请分批导入，单次上限 5000 行"）
- 必填字段缺失：返回 400，列出缺失字段
- 模型不存在：返回 400

#### POST /api/cmdb/instances/import/execute

**请求体：**

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `batchId` | String | 是 | 来自 preview 步骤返回的 batchId |

**执行流程：**
1. 从 Redis 读取 preview 阶段解析结果（key: `cmdb:import:preview:{batchId}`，TTL 10 分钟）
2. 如 key 不存在，返回 400："预览数据已过期，请重新上传"
3. 每 100 条一个事务分段处理
4. 每条成功操作写 audit_log（`remark = "batch_id={batchId}"`）
5. 每段完成后更新 Redis 进度
6. 全部完成后删除 preview 数据

**响应：** `R<CsvImportResultVO>`

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "totalRows": 150,
  "created": 120,
  "updated": 25,
  "skipped": 3,
  "failed": 2,
  "failedRows": [
    {
      "rowNumber": 45,
      "reason": "实例不存在: 99",
      "rowData": { ... }
    }
  ],
  "durationMs": 3200
}
```

#### GET /api/cmdb/instances/import/{batchId}/progress

**响应：** `R<CsvImportProgressVO>`

```json
{
  "batchId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "running",
  "totalRows": 500,
  "processed": 320,
  "created": 300,
  "updated": 15,
  "skipped": 0,
  "failed": 5
}
```

| status | 说明 |
|--------|------|
| `running` | 正在处理中 |
| `completed` | 处理完成 |

**Redis 存储：**
- Key: `cmdb:import:progress:{batchId}`
- Type: Hash
- TTL: 600 秒（10 分钟）

#### GET /api/cmdb/instances/import/{batchId}/failed-rows

下载失败行 CSV 文件，包含原始数据和失败原因。

**响应：** CSV 文件下载

- 文件名：`import_failed_{batchId}.csv`

---

### 影响分析 — `/api/cmdb/instances/{id}/impact`

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/api/cmdb/instances/{id}/impact` | `cmdb_instance:read` + `cmdb_instance:impact` | 执行影响分析 |

#### POST /api/cmdb/instances/{id}/impact

**请求体：**（可为空，使用默认值）

```json
{
  "direction": "downstream",
  "maxDepth": 3
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `direction` | String | 否 | `upstream` / `downstream` / `bidirectional`（默认） |
| `maxDepth` | Integer | 否 | 1–5，默认 3 |

**方向说明：**

| 方向 | 遍历逻辑 |
|------|----------|
| `upstream` | 沿着 `dst → src` 方向遍历（查找"谁依赖我"） |
| `downstream` | 沿着 `src → dst` 方向遍历（查找"我依赖谁"） |
| `bidirectional` | 双向遍历（默认） |

**响应：** `R<ImpactAnalysisResultVO>`

```json
{
  "rootId": 1,
  "rootName": "web-server-01",
  "rootModelId": "host",
  "direction": "bidirectional",
  "maxDepth": 3,
  "truncated": false,
  "layers": [
    {
      "depth": 0,
      "nodes": [
        {
          "id": 1,
          "name": "web-server-01",
          "modelId": "host",
          "modelName": "主机",
          "status": "online",
          "businessLevel": null
        }
      ]
    },
    {
      "depth": 1,
      "nodes": [
        {
          "id": 5,
          "name": "order-service",
          "modelId": "app",
          "modelName": "应用",
          "status": "online",
          "businessLevel": "core"
        },
        {
          "id": 10,
          "name": "switch-core",
          "modelId": "host",
          "modelName": "主机",
          "status": "online",
          "businessLevel": null
        }
      ]
    }
  ],
  "edges": [
    {
      "src": 1,
      "dst": 5,
      "kind": "run",
      "label": "运行"
    },
    {
      "src": 10,
      "dst": 1,
      "kind": "connect",
      "label": "连接"
    }
  ]
}
```

**响应字段说明：**

| 字段 | 说明 |
|------|------|
| `truncated` | `true` 表示超时（5 秒）或节点过多，返回的是部分结果 |
| `layers` | 按深度分层，depth=0 为根节点 |
| `layers[].nodes` | 该层所有节点 |
| `edges` | 所有关联边（去重） |

**ImpactNodeVO 字段：**

| 字段 | 说明 |
|------|------|
| `id` | 实例 ID（权限不足时为 null） |
| `name` | 实例名称（权限不足时为 `"[已隐藏]"`） |
| `modelId` | 模型标识（权限不足时为 `"hidden"`） |
| `modelName` | 模型显示名称 |
| `status` | 实例状态 |
| `businessLevel` | 从 `fields_data.business_level` 提取（如存在） |

**ImpactEdgeVO 字段：**

| 字段 | 说明 |
|------|------|
| `src` | 源实例 ID |
| `dst` | 目标实例 ID |
| `kind` | 关联类型编码 |
| `label` | 关联类型显示名称 |

---

## 权限控制（RBAC）

### 新增权限（V24–V26 Seed）

| 权限代码 | 名称 | 来源 | 说明 |
|----------|------|------|------|
| `cmdb_relation:update` | 更新关联 | V24 | 编辑关联元数据 |
| `cmdb_instance:import` | CSV 导入实例 | V25 | 批量导入 |
| `cmdb_instance:impact` | 影响分析 | V26 | 执行影响分析 |

### 角色权限矩阵（Tier 2 新增部分）

| 权限代码 | super_admin | admin | group_leader | member | doc_admin |
|----------|:-----------:|:-----:|:------------:|:------:|:---------:|
| `cmdb_relation:update` | ✓ | ✓ | ✓ | — | — |
| `cmdb_instance:import` | ✓ | ✓ | ✓ | — | — |
| `cmdb_instance:impact` | ✓ | ✓ | ✓ | ✓ | — |

### 完整 CMDB 权限矩阵（Tier 1 + Tier 2）

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
| `cmdb_instance:import` | ✓ | ✓ | ✓ | — | — |
| `cmdb_instance:impact` | ✓ | ✓ | ✓ | ✓ | — |
| `cmdb_relation:create` | ✓ | ✓ | ✓ | — | — |
| `cmdb_relation:read` | ✓ | ✓ | ✓ | ✓ | — |
| `cmdb_relation:update` | ✓ | ✓ | ✓ | — | — |
| `cmdb_relation:delete` | ✓ | ✓ | — | — | — |

### Controller 注解

- 关联扩展属性管理：复用 `cmdb_model:read` 和 `cmdb_model:update`
- 关联编辑（PUT）：`cmdb_relation:update`（新增）
- CSV 导入预览/执行：`cmdb_instance:create` AND `cmdb_instance:update`
- CSV 进度/模板/失败行下载：`cmdb_instance:read`
- 影响分析：`cmdb_instance:read` AND `cmdb_instance:impact`

---

## 审计日志

所有 Tier 2 写操作记录到 `audit_log`，`module = 'cmdb'`。

### 新增审计动作

| action | target_type | 说明 |
|--------|-------------|------|
| `create_association_attr` | `ci_association_attr_def` | 创建关联扩展属性 |
| `update_association_attr` | `ci_association_attr_def` | 更新关联扩展属性 |
| `delete_association_attr` | `ci_association_attr_def` | 删除关联扩展属性 |
| `update_relation` | `ci_instance_rel` | 更新关联元数据 |
| `import_create` | `ci_instance` | CSV 导入创建实例 |
| `import_update` | `ci_instance` | CSV 导入更新实例 |

### CSV 导入审计说明

- `import_create` / `import_update` 的 `afterJson` 字段存储 `batch_id={batchId}` 而非对象快照
- 可通过 `batch_id` 聚合查询某次导入的所有操作记录
- 导入不使用独立的 batch 表，所有历史通过 audit_log 追溯

---

## 核心业务逻辑

### SchemaValidator — validateAssociationAttrs（新增方法）

复用 Tier 1 的 `SchemaValidator` 内部类，新增 `validateAssociationAttrs` 静态方法：

```java
public static void validateAssociationAttrs(
    Map<String, Object> metadata,
    List<CiAssociationAttrDef> attrDefs)
```

**校验流程：**
1. 遍历 `ci_association_attr_def` 中该 `association_kind` 的所有属性定义
2. 必填检查：`is_required = true` 的字段，metadata 中必须有值
3. 类型检查：复用 `validateFieldType` 方法（singlechar/int/bool/enum/list/user/date）
4. 不校验唯一性（metadata 无唯一性需求）

### 关联元数据 Merge 策略

更新关联时，metadata 采用增量合并（与实例 fieldsData 策略一致）：

```java
Map<String, Object> merged = new LinkedHashMap<>();
if (rel.getMetadata() != null) merged.putAll(rel.getMetadata());
merged.putAll(req.getMetadata());  // 新值覆盖旧值
```

合并后对完整 merged 数据重新执行 schema 校验。

### CSV 导入 Pipeline

完整流程分为三步：**模板下载 → 上传预览 → 确认执行**

#### 步骤 1：模板生成

1. 加载模型属性列表
2. 筛选 `is_required = true` 或 `is_list_show = true` 的属性
3. 生成 CSV 表头行（enum 字段附可选值）
4. 返回 UTF-8 编码的空模板

#### 步骤 2：上传预览

1. **文件验证**：非空、≤ 10MB
2. **编码检测**：指定编码 → UTF-8 验证 → juniversalchardet → GBK 兜底
3. **CSV 解析**：Apache Commons CSV，≤ 5000 行
4. **表头校验**：必填字段必须出现在 CSV 表头中
5. **逐行校验**：
   - 必填检查：`is_required` 字段不能为空
   - 类型检查：int/bool/enum 类型值格式校验
6. **唯一键匹配**：
   - 构建唯一键（默认 `is_unique` 属性，或用户指定字段）
   - 预加载现有实例的 `fieldsData` 构建唯一键→实例映射
   - 匹配到已有实例 → 按冲突策略分类（override/skip/error）
7. **类型转换**：int → Integer，bool → Boolean，其他 → sanitize 后 String
8. **存储到 Redis**：解析结果序列化为 JSON，key `cmdb:import:preview:{batchId}`，TTL 10 分钟
9. **返回预览**：前 10 行数据 + 统计信息

#### 步骤 3：确认执行

1. 从 Redis 读取 preview 数据
2. 初始化 Redis 进度（`cmdb:import:progress:{batchId}`）
3. 每 100 条一个事务分段：
   - `create`：构建 CiInstance，insert，写审计
   - `update`：加载现有实例，merge fieldsData，update，写审计
   - `skip`：跳过
   - 异常：记录为 failedRow，继续处理下一条
4. 更新进度
5. 完成后删除 preview 数据，标记 progress 为 completed

### CSV 注入防护

`CsvParser.sanitize` 方法防止 CSV 注入（公式注入）：

```java
// 如果值以 = + - @ \t \r 开头，前置单引号
if (first == '=' || first == '+' || first == '-' || first == '@' || first == '\t' || first == '\r') {
    return "'" + value;
}
```

### 影响分析 — CTE + Java BFS 混合策略

**策略选择：**

| 条件 | 策略 |
|------|------|
| `maxDepth ≤ 3` 且预估节点 < 200 | 递归 CTE（数据库层 BFS） |
| `maxDepth > 3` 或预估节点 ≥ 200 | Java BFS + visited set |

**预估节点算法：**
- 计算根节点的直接关联数（branching factor）
- 按 branching factor^depth 估算总节点数

#### CTE 策略

使用 PostgreSQL 递归 CTE：

```sql
WITH RECURSIVE impact AS (
    SELECT id, src_instance_id, dst_instance_id, association_kind, 0 AS depth
    FROM ci_instance_rel
    WHERE (src_instance_id = ? OR dst_instance_id = ?)
      AND NOT is_deleted AND tenant_id = ?
    UNION ALL
    SELECT r.id, r.src_instance_id, r.dst_instance_id, r.association_kind, i.depth + 1
    FROM ci_instance_rel r
    INNER JOIN impact i ON {joinCondition}
    WHERE i.depth < ? AND NOT r.is_deleted AND r.tenant_id = ?
)
SELECT DISTINCT src_instance_id AS src, dst_instance_id AS dst,
                association_kind AS kind, depth
FROM impact
```

`joinCondition` 根据 direction 变化：
- `downstream`：`r.src_instance_id = i.dst_instance_id`
- `upstream`：`r.dst_instance_id = i.src_instance_id`
- `bidirectional`：`(r.src_instance_id = i.dst_instance_id OR r.dst_instance_id = i.src_instance_id)`

#### Java BFS 策略

```
queue = [(rootId, 0)]
visited = {rootId}
depthMap = {0: [rootId]}

while queue not empty:
    if timeout (5s): truncated = true; break
    (nodeId, depth) = queue.poll()
    if depth >= maxDepth: continue
    neighbors = queryNeighbors(nodeId, direction)
    for each neighbor:
        if not visited:
            visited.add(neighbor)
            depthMap[depth+1].add(neighbor)
            queue.add((neighbor, depth+1))
            deduplicate edges
```

#### 超时机制

- 硬超时 5000ms
- 超时后返回已收集的部分结果 + `truncated = true`
- CTE 超时捕获异常后降级为仅根节点的部分结果

#### 权限过滤（预留多租户）

MVP 阶段所有节点可见。基础设施已就位，未来多租户模式：
- 无权限节点：`id = null`，`name = "[已隐藏]"`，`modelId = "hidden"`
- 边仍保留，确保路径连通性（A → [隐藏] → C 仍然可见）

#### 节点信息丰富

遍历完成后批量加载所有节点的详细信息：
1. `selectBatchIds` 批量加载实例
2. 加载模型显示名称（去重查询）
3. 加载关联类型标签（一次性查询）
4. 提取 `fields_data.business_level`（如存在）
5. 设置边的 label

---

## 设计决策与注意事项

### 1. 关联元数据使用 JSONB 而非独立表

**决策：** 在 `ci_instance_rel` 新增 `metadata JSONB` 列。

**理由：**
- 关联元数据查询频率低，主要用于展示（拓扑悬浮、详情查看）
- JSONB 与现有 `ci_instance.fields_data` 模式一致，复用 SchemaValidator
- 避免 N+1 JOIN；单表查询即可获取关联全部信息
- 向后兼容：现有数据 `metadata = '{}'`，无需迁移

### 2. CSV 导入使用同步处理 + Redis 中间存储

**决策：** 上传同步解析，确认同步执行，进度存 Redis。

**理由：**
- MVP 单节点部署，轮询（1s 间隔）足够
- WebSocket/SSE 引入额外复杂度（连接管理、断线重连）
- Phase 4 如需长任务导出，再统一升级 SSE

### 3. CSV 唯一键策略

**决策：**
- 默认使用模型中 `is_unique = true` 的属性作为唯一键
- 导入时可临时指定组合唯一键（如 `hostname,idc`）
- 唯一键值为多字段 `|` 连接

### 4. 影响分析混合策略

**决策：** 小图用 CTE，大图用 Java BFS。

**理由：**
- CTE 深度 > 3 时递归开销大，且难以控制内存
- Java BFS 可精确控制 visited set 和超时
- 预估节点数避免对大图使用 CTE

### 5. 不新建 batch 表

CSV 导入历史通过 `audit_log` 的 `remark` 字段（`batch_id={batchId}`）聚合查询，无需独立的导入历史表。这简化了数据模型，但缺点是导入结果的 Redis 进度 TTL 过期后无法再查询详细统计。

### 6. 新增 Maven 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| `commons-csv` | 1.11.0 | Apache Commons CSV 解析 |
| `juniversalchardet` | 1.0.3 | Mozilla 通用编码检测库 |

### 7. 前端待开发

CMDB Tier 2 当前仅完成后端 API。前端页面需要：
- 关联扩展属性管理界面（在关联类型详情中）
- 关联编辑弹窗（支持 metadata 字段）
- CSV 导入向导（模板下载 → 上传预览 → 确认 → 进度）
- 影响分析可视化（层级图/辐射图）
- 失败行下载

---

## 使用教程

### 教程 1：为 `connect` 关联类型定义扩展属性

**场景**：网络连接关联需要记录带宽和端口信息。

**步骤：**

1. **创建扩展属性"带宽"**

```bash
curl -X POST /api/cmdb/association-kinds/connect/attributes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer {token}" \
  -d '{
    "fieldKey": "bandwidth",
    "name": "带宽(Mbps)",
    "fieldType": "int",
    "isRequired": false,
    "defaultValue": "1000",
    "sortOrder": 1
  }'
```

2. **创建扩展属性"端口"**

```bash
curl -X POST /api/cmdb/association-kinds/connect/attributes \
  -H "Content-Type: application/json" \
  -d '{
    "fieldKey": "port",
    "name": "端口",
    "fieldType": "singlechar",
    "isRequired": false,
    "sortOrder": 2
  }'
```

3. **创建关联时携带元数据**

```bash
curl -X POST /api/cmdb/instances/1/relations \
  -d '{
    "dstInstanceId": 10,
    "associationKind": "connect",
    "metadata": {
      "bandwidth": 10000,
      "port": "eth0"
    }
  }'
```

4. **更新关联元数据**

```bash
curl -X PUT /api/cmdb/instances/1/relations/42 \
  -d '{
    "metadata": {
      "bandwidth": 25000
    }
  }'
```

### 教程 2：批量导入主机实例

**场景**：从资产管理 Excel 导出 CSV，批量导入到 host 模型。

**步骤：**

1. **下载模板**

```bash
curl -O /api/cmdb/instances/import/template?model=host \
  -H "Authorization: Bearer {token}"
```

2. **填写 CSV 数据**

```csv
sn,hostname,inner_ip,cpu,memory,status (["online","offline","maintenance"])
SRV-001,web-server-01,10.0.1.10,8,32,online
SRV-002,web-server-02,10.0.1.11,16,64,online
SRV-003,db-server-01,10.0.2.10,32,128,online
```

3. **上传预览**

```bash
curl -X POST /api/cmdb/instances/import/preview \
  -F "file=@hosts.csv" \
  -F "model=host" \
  -F "conflictStrategy=override"
```

检查返回的 `toCreate`、`toUpdate`、`failedRows`。

4. **确认导入**

```bash
curl -X POST /api/cmdb/instances/import/execute \
  -d '{"batchId": "从 preview 返回的 batchId"}'
```

5. **查看进度**（如导入量大）

```bash
curl /api/cmdb/instances/import/{batchId}/progress
```

6. **下载失败行**（如有失败）

```bash
curl -O /api/cmdb/instances/import/{batchId}/failed-rows
```

### 教程 3：影响分析

**场景**：核心交换机宕机，分析影响范围。

**步骤：**

1. **下游影响分析**（我影响谁）

```bash
curl -X POST /api/cmdb/instances/10/impact \
  -d '{"direction": "downstream", "maxDepth": 3}'
```

2. **上游依赖分析**（谁依赖我）

```bash
curl -X POST /api/cmdb/instances/10/impact \
  -d '{"direction": "upstream", "maxDepth": 3}'
```

3. **双向影响分析**（默认）

```bash
curl -X POST /api/cmdb/instances/10/impact
```

**结果解读：**
- `layers[0]` = 根节点（指定实例）
- `layers[1]` = 直接关联的实例
- `layers[N]` = N 跳关联的实例
- `truncated = true` 表示结果被截断，可降低 `maxDepth` 重试
- 前端可将 `layers` 渲染为同心圆/层级图，`edges` 渲染为连线
