# CMDB Tier 2 — 完整指南

> 模块：CMDB / 关联元数据增强 + CSV 批量导入 + 影响分析
> 版本：V24–V26 迁移，前后端均已实现
> 验证状态：15/21 验收标准通过（1 失败、3 部分实现）
> 前置：[CMDB Tier 1 指南](./cmdb-tier1.md)

---

## 目录

1. [概述](#1-概述)
2. [验证状态与已知问题](#2-验证状态与已知问题)
3. [数据模型变更](#3-数据模型变更)
4. [API 参考](#4-api-参考)
5. [前端 UI](#5-前端-ui)
6. [权限控制（RBAC）](#6-权限控制rbac)
7. [审计日志](#7-审计日志)
8. [核心业务逻辑](#8-核心业务逻辑)
9. [设计决策](#9-设计决策)
10. [教程](#10-教程)
11. [常见问题](#11-常见问题)

---

## 1. 概述

CMDB Tier 2 在 Tier 1（模型 + 属性 + 实例 + 关联 + 拓扑）基础上新增三大功能：

### 1.1 关联元数据增强

关联关系可携带结构化扩展属性（如连接的端口号、带宽），Schema 通过 `ci_association_attr_def` 表定义。创建/更新关联时自动校验类型、必填和枚举值。

- 前端：实例详情页「关联关系」Tab 内，新建/编辑关联弹窗动态渲染扩展字段表单
- 后端：`CiAssociationAttrDefController` CRUD + `CiRelationService` Schema 校验

### 1.2 CSV 批量导入

支持上传 CSV 文件批量创建/更新 CI 实例，提供模板下载 → 上传预览 → 确认执行 → 进度查询 → 失败行下载的完整流程。

- 前端：`CsvImportDialog` 三步向导组件（上传 → 预览 → 结果）
- 后端：`CsvImportController` + `CsvImportService` + `CsvParser`（编码检测 + CSV 注入防护）
- 进度：Redis 存储（`cmdb:import:progress:{batchId}`，TTL 10 分钟），前端 1.5s 轮询

### 1.3 影响分析

从指定 CI 实例出发，沿关联关系遍历，按层级返回受影响的节点和边。支持方向控制（上游/下游/双向）和深度限制（1-5 跳）。

- 前端：实例详情页「影响分析」Tab，方向/深度选择 + 分层展示 + 路径表
- 后端：`ImpactAnalysisController` + `ImpactAnalysisService`（混合 CTE + Java BFS 策略，5s 超时）

### 1.2 文件结构

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
    CiRelationService.java                # 变更：metadata 校验 + patch merge
    CsvImportService.java                 # CSV 导入全流程
    ImpactAnalysisService.java            # CTE + Java BFS 混合策略
  entity/
    CiAssociationAttrDef.java             # 关联扩展属性定义
    CiInstanceRel.java                    # 变更：新增 metadata JSONB 字段
  mapper/
    CiAssociationAttrDefMapper.java       # listByKind 查询
  dto/
    association/                          # CiAssociationAttrDefVO, Create/UpdateAssociationAttrRequest
    csv/                                  # CsvImportPreviewVO, CsvImportResultVO, CsvImportProgressVO, CsvFailedRowVO, CsvImportExecuteRequest
    impact/                               # ImpactAnalysisRequest, ImpactAnalysisResultVO, ImpactLayerVO, ImpactNodeVO, ImpactEdgeVO
    relation/                             # 变更：CiRelationVO 新增 metadata, UpdateRelationRequest
  util/
    CsvParser.java                        # CSV 解析 + 编码检测 + CSV 注入防护

前端（新增）:
src/
  app/(dashboard)/cmdb/instances/[id]/page.tsx  # 实例详情页（含关联/拓扑/影响分析/变更历史 Tab）
  components/cmdb/
    CsvImportDialog.tsx                          # CSV 导入三步向导
    CiInstanceSelect.tsx                          # CI 实例搜索选择器
    CiLinkSelector.tsx                            # CI 关联选择器（跨模块引用）

数据库迁移:
  V24  ci_instance_rel.metadata JSONB + ci_association_attr_def 表 + cmdb_relation:update 权限
  V25  CSV 导入权限 seed（cmdb_instance:import）
  V26  影响分析权限 seed（cmdb_instance:impact）

新增依赖 (pom.xml):
  commons-csv:1.11.0                      # CSV 解析
  juniversalchardet:1.0.3                 # 编码检测（UTF-8/GBK）
```

---

## 2. 验证状态与已知问题

> 基于 UI 验证报告（2026-06-13），21 项验收标准中 15 项通过、1 项失败、3 项部分实现。

### 2.1 验证结果概览

| 类别              | 测试项 | 通过 | 失败 | 部分实现 |
|-------------------|--------|------|------|----------|
| AC-1 关联元数据   | 5      | 4    | 0    | 1        |
| AC-2 CSV 导入     | 9      | 8    | 0    | 1        |
| AC-3 影响分析     | 7      | 4    | 1    | 1        |
| **总计**          | **21** | **15** | **1** | **3**  |

### 2.2 已知问题

#### 问题 1：影响分析 PNG 导出未实现 [AC-3.6]

- **状态**：❌ 失败
- **描述**：前端无「导出图片」按钮或 svg-to-png 库引用；后端无 `GET /api/cmdb/instances/{id}/impact/export` 端点
- **影响**：用户无法将影响分析结果导出为 PNG 图片
- **Bug 任务**：t_28ef007a

#### 问题 2：拓扑图 metadata hover tooltip 缺失 [AC-1.3]

- **状态**：⚠️ 部分实现
- **描述**：`TopologyView` 组件渲染树状拓扑，显示节点名/模型名/边 Label，但未实现悬浮 tooltip 展示关联 metadata key/value
- **影响**：用户在拓扑图中无法查看关联的扩展属性
- **Bug 任务**：t_2acb3ab8

#### 问题 3：association-kinds API 返回 500 [AC-未编号]

- **状态**：⚠️ 后端缺失
- **描述**：`GET /api/cmdb/association-kinds` 无对应 Controller，返回 500 错误。前端用 `KIND_MAP` 常量绕过
- **影响**：未来动态扩展关联类型时受限
- **Bug 任务**：t_8ee156e2

#### 问题 4：CSV 导入进度轮询无自动切换 [AC-2.9]

- **状态**：⚠️ 部分实现
- **描述**：进度条基本实现（1.5s 轮询、processed/total 显示），但 30s 超时时无自动切换机制
- **影响**：大量数据导入超时时用户体验不佳

#### 问题 5：影响分析拓扑子图未复用 [AC-3.3]

- **状态**：⚠️ 部分实现
- **描述**：影响分析结果展示为 edges 表格，未复用 `TopologyView` 组件渲染可视化子图
- **影响**：影响分析结果不够直观

### 2.3 已通过的验收标准

**AC-1 关联元数据**（4/5 通过）：
- AC-1.1 关联扩展属性定义 API（CRUD 完整）
- AC-1.2 关联可填写扩展字段（前端动态表单 + 后端 Schema 校验）
- AC-1.4 审计日志（before/after 记录）
- AC-1.5 内置 5 个 association_kind 默认无扩展属性

**AC-2 CSV 导入**（8/9 通过）：
- AC-2.1 导入按钮 + CSV 上传
- AC-2.2 预览统计（总行/新建/更新/跳过/失败行）
- AC-2.3 下载失败行 CSV
- AC-2.4 冲突策略（override/skip/error）
- AC-2.5 5000 行 / 10MB 上限
- AC-2.6 审计日志
- AC-2.7 下载 CSV 模板
- AC-2.8 枚举字段校验

**AC-3 影响分析**（4/7 通过）：
- AC-3.1 实例详情页影响分析按钮
- AC-3.2 分层展示
- AC-3.5 REST API（POST /api/cmdb/instances/{id}/impact）
- AC-3.7 软删除实例不参与

---

## 3. 数据模型变更

### 3.1 V24 — ci_instance_rel 新增 metadata

```sql
ALTER TABLE ci_instance_rel
ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_ci_rel_metadata
ON ci_instance_rel USING GIN(metadata);
```

**向后兼容**：现有数据 `metadata = '{}'`，无需迁移。Tier 1 的关联查询、拓扑查询完全兼容。

CiInstanceRel 实体新增字段：

```java
@TableField(typeHandler = JacksonTypeHandler.class)
private Map<String, Object> metadata = new LinkedHashMap<>();
```

### 3.2 V24 — ci_association_attr_def 新表

关联类型的扩展属性定义表，结构类似 `ci_attribute`，但绑定到 `association_kind` 而非 `model_id`。

| 字段                  | 类型          | 说明                                          |
|-----------------------|---------------|-----------------------------------------------|
| `id`                  | BIGSERIAL PK  | 自增主键                                      |
| `tenant_id`           | VARCHAR(64)   | 租户 ID，默认 `default`                       |
| `association_kind`    | VARCHAR(64)   | 关联类型编码（软引用 ci_association_kind.code）|
| `field_key`           | VARCHAR(64)   | 字段标识（如 `listen_port`）                   |
| `name`                | VARCHAR(128)  | 字段名称（如 "监听端口"）                      |
| `field_type`          | VARCHAR(32)   | 字段类型：singlechar/int/enum/bool/date/user/list |
| `is_required`         | BOOLEAN       | 是否必填，默认 false                          |
| `enum_options`        | TEXT          | enum 类型的可选值 JSON 数组                   |
| `default_value`       | VARCHAR(512)  | 默认值                                        |
| `sort_order`          | INT           | 排序序号，默认 0                              |
| `is_deleted`          | BOOLEAN       | 软删除标记                                    |
| `deleted_at/deleted_by` | —           | 删除信息                                      |
| `created_at/updated_at/created_by/updated_by` | — | 审计字段                          |

**唯一约束**：`idx_ci_assoc_attr_kind_key` — `(tenant_id, association_kind, field_key) WHERE NOT is_deleted`

**设计说明**：
- `association_kind` 是软引用（非 FK），指向 `ci_association_kind.code`
- 每个 `association_kind` 可独立定义扩展属性 schema
- 字段类型与 `ci_attribute` 一致，复用 `SchemaValidator`

### 3.3 V25 — CSV 导入权限

```sql
INSERT INTO sys_permission (...) VALUES ('cmdb_instance', 'import', '导入CI实例');
-- 分配给 super_admin, admin, group_leader
```

### 3.4 V26 — 影响分析权限

```sql
INSERT INTO sys_permission (...) VALUES ('cmdb_instance', 'impact', '影响分析');
-- 分配给 super_admin, admin, group_leader, member
```

### 3.5 ER 关系更新

```
ci_model 1───* ci_attribute          (模型属性)
ci_model 1───* ci_instance           (模型实例)
ci_instance *──* ci_instance          (通过 ci_instance_rel)
                              │
                              ├── metadata JSONB          [V24 新增]
                              └── (关联类型 ci_association_kind)
                                      │
                                      └── * ci_association_attr_def  [V24 新增]
                                              (关联类型扩展属性定义)
```

---

## 4. API 参考

### 4.1 关联扩展属性

#### 列出关联类型的扩展属性

```
GET /api/cmdb/association-kinds/{kind}/attributes
```

**权限**：`cmdb_relation:read`

**响应**：
```json
[
  {
    "id": 1,
    "associationKind": "connect",
    "fieldKey": "bandwidth",
    "name": "带宽(Mbps)",
    "fieldType": "int",
    "isRequired": false,
    "defaultValue": "1000",
    "sortOrder": 1
  }
]
```

#### 创建扩展属性

```
POST /api/cmdb/association-kinds/{kind}/attributes
```

**权限**：`cmdb_relation:update`

**请求体**：
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

#### 更新扩展属性

```
PUT /api/cmdb/association-kinds/{kind}/attributes/{id}
```

**权限**：`cmdb_relation:update`

#### 删除扩展属性

```
DELETE /api/cmdb/association-kinds/{kind}/attributes/{id}
```

**权限**：`cmdb_relation:update`（软删除）

### 4.2 关联管理（含 metadata）

#### 创建关联

```
POST /api/cmdb/instances/{id}/relations
```

**权限**：`cmdb_relation:create`

**请求体**：
```json
{
  "dstInstanceId": 10,
  "associationKind": "connect",
  "metadata": {
    "bandwidth": 10000,
    "port": "eth0"
  }
}
```

**说明**：metadata 会根据 `ci_association_attr_def` 定义的 Schema 进行校验（类型、必填、枚举）。

#### 更新关联（含 metadata）

```
PUT /api/cmdb/instances/{id}/relations/{relationId}
```

**权限**：`cmdb_relation:update`

**请求体**：
```json
{
  "metadata": {
    "bandwidth": 25000
  }
}
```

**说明**：metadata 采用 patch 语义（增量合并），仅更新提供的字段，未提供的字段保持不变。

#### 删除关联

```
DELETE /api/cmdb/instances/{id}/relations/{relationId}
```

**权限**：`cmdb_relation:delete`（软删除）

### 4.3 CSV 导入

#### 下载 CSV 模板

```
GET /api/cmdb/instances/import/template?model={modelCode}
```

**权限**：`cmdb_instance:import`

**响应**：CSV 文件流，包含模型的所有属性字段名作为表头

#### 上传预览

```
POST /api/cmdb/instances/import/preview
Content-Type: multipart/form-data
```

**权限**：`cmdb_instance:import`

**参数**：
- `file` — CSV 文件
- `model` — 模型编码（如 `host`）
- `conflictStrategy` — 冲突策略：`override`（覆盖）/ `skip`（跳过）/ `error`（报错）

**响应**：
```json
{
  "batchId": "uuid-xxx",
  "totalRows": 150,
  "toCreate": 120,
  "toUpdate": 25,
  "toSkip": 0,
  "failedRows": [
    {"rowNum": 42, "reason": "hostname 不能为空", "rawData": "..."}
  ],
  "previewData": [
    {"sn": "SRV-001", "hostname": "web-01", "inner_ip": "10.0.1.10"}
  ]
}
```

#### 确认执行

```
POST /api/cmdb/instances/import/execute
Content-Type: application/json
```

**权限**：`cmdb_instance:import`

**请求体**：
```json
{"batchId": "uuid-xxx"}
```

**响应**：
```json
{
  "batchId": "uuid-xxx",
  "created": 120,
  "updated": 25,
  "failed": 5,
  "status": "completed"
}
```

#### 查询导入进度

```
GET /api/cmdb/instances/import/{batchId}/progress
```

**权限**：`cmdb_instance:import`

**响应**：
```json
{
  "batchId": "uuid-xxx",
  "processed": 80,
  "total": 150,
  "status": "processing",
  "percentage": 53
}
```

**说明**：数据存储在 Redis（`cmdb:import:progress:{batchId}`，TTL 10 分钟）。前端每 1.5 秒轮询。

#### 下载失败行

```
GET /api/cmdb/instances/import/{batchId}/failed-rows
```

**权限**：`cmdb_instance:import`

**响应**：CSV 文件流，包含失败行 + 失败原因列

### 4.4 影响分析

#### 执行影响分析

```
POST /api/cmdb/instances/{id}/impact
Content-Type: application/json
```

**权限**：`cmdb_instance:read` AND `cmdb_instance:impact`

**请求体**：
```json
{
  "direction": "both",
  "maxDepth": 3
}
```

**参数说明**：
- `direction` — 方向：`upstream`（谁依赖我）/ `downstream`（我影响谁）/ `both`（双向，默认）
- `maxDepth` — 最大深度：1-5，默认 3

**响应**：
```json
{
  "rootInstanceId": 10,
  "direction": "both",
  "maxDepth": 3,
  "truncated": false,
  "layers": [
    {
      "depth": 0,
      "nodes": [
        {"instanceId": 10, "name": "core-switch-01", "modelName": "network"}
      ]
    },
    {
      "depth": 1,
      "nodes": [
        {"instanceId": 15, "name": "web-server-01", "modelName": "host"}
      ]
    }
  ],
  "edges": [
    {
      "srcInstanceId": 10,
      "dstInstanceId": 15,
      "associationKind": "connect",
      "srcName": "core-switch-01",
      "dstName": "web-server-01"
    }
  ]
}
```

**说明**：
- `layers[0]` = 根节点（指定实例）
- `layers[N]` = N 跳关联的实例
- `truncated = true` 表示结果被截断（节点数超限或超时），可降低 `maxDepth` 重试
- 策略：maxDepth <= 3 且预估节点 < 200 用递归 CTE；否则用 Java BFS
- 超时：5 秒

---

## 5. 前端 UI

### 5.1 实例详情页

路径：`/cmdb/instances/[id]`

实例详情页是 CMDB Tier 2 的核心前端入口，包含 5 个 Tab：

| Tab           | 功能                                     |
|---------------|------------------------------------------|
| 基本信息      | 实例属性、模型信息                       |
| 关联关系      | 关联列表、新建/编辑/删除关联（含 metadata）|
| 拓扑图        | 树状拓扑可视化（TopologyView 内联组件）   |
| 影响分析      | 方向/深度选择 + 分层节点展示 + 路径表     |
| 变更历史      | 审计日志时间线                           |

#### 关联关系 Tab

- 关联列表表格，显示目标实例、关联类型、metadata 摘要
- 「新建关联」弹窗：
  - 选择目标实例（CiInstanceSelect 搜索组件）
  - 选择关联类型（从 `KIND_MAP` 常量）
  - 根据 `associationKind` 动态加载 `assocAttrDefs`，渲染扩展字段表单
  - 支持 enum（下拉选择）、int（数字输入）、singlechar（文本输入）类型
- 「编辑关联属性」弹窗：
  - 编辑 metadata JSON（patch 语义）
  - 根据 `CiAssociationAttrDefVO` 定义渲染表单

#### 拓扑图 Tab

- `TopologyView` 内联组件，渲染树状拓扑
- 显示节点名称、模型名称、边 Label
- **已知限制**：无 hover tooltip 展示 metadata（参见问题 2）

#### 影响分析 Tab

- 方向选择：`both` / `upstream` / `downstream`
- 深度选择：1-5
- 「开始分析」按钮触发 API 调用
- 结果按层级（depth）分组展示，每层显示层级号和节点数
- 每个节点可点击跳转到实例详情页
- 路径表（edges）展示源 → 关系 → 目标
- **已知限制**：结果为表格展示，未复用 TopologyView 可视化（参见问题 5）
- **已知限制**：无 PNG 导出按钮（参见问题 1）

### 5.2 CSV 导入对话框

组件：`CsvImportDialog.tsx`（299 行）

三步向导：

| 步骤    | 内容                                         |
|---------|----------------------------------------------|
| Step 0  | 上传 CSV 文件 + 选择冲突策略                  |
| Step 1  | 预览统计（总行/新建/更新/跳过）+ 失败行展开   |
| Step 2  | 执行结果 + 进度条（1.5s 轮询）                |

**触发入口**：实例列表页「导入 CSV」按钮（需先选择模型）

**功能**：
- 模板下载（GET /api/cmdb/instances/import/template）
- 冲突策略选择（override/skip/error）
- 失败行下载（GET /api/cmdb/instances/import/{batchId}/failed-rows）
- 进度条显示 processed/total

### 5.3 CI 实例选择器

组件：`CiInstanceSelect.tsx`（120 行）

可搜索的 CI 实例自动完成选择器，用于关联创建时选择目标实例。支持：
- 按名称/属性模糊搜索
- 显示模型名称和实例名称
- 选中后返回 instanceId

### 5.4 CI 关联选择器

组件：`CiLinkSelector.tsx`（168 行）

多选 CI 关联选择器，支持影响级别标注。用于变更文档、日报等模块引用 CI 实例。

---

## 6. 权限控制（RBAC）

### 新增权限

| resource          | action   | 说明           | 分配角色                              |
|-------------------|----------|----------------|---------------------------------------|
| `cmdb_relation`   | `update` | 编辑关联属性   | super_admin, admin                    |
| `cmdb_instance`   | `import` | CSV 批量导入   | super_admin, admin, group_leader      |
| `cmdb_instance`   | `impact` | 影响分析       | super_admin, admin, group_leader, member |

### 权限映射

| 操作                     | 所需权限                                      |
|--------------------------|-----------------------------------------------|
| 查看关联扩展属性          | `cmdb_relation:read`                          |
| 创建/更新/删除扩展属性    | `cmdb_relation:update`                        |
| 创建关联                 | `cmdb_relation:create`                        |
| 更新关联（含 metadata）   | `cmdb_relation:update`                        |
| 删除关联                 | `cmdb_relation:delete`                        |
| CSV 模板下载             | `cmdb_instance:import`                        |
| CSV 预览/执行/进度/失败行 | `cmdb_instance:import`                        |
| 影响分析                 | `cmdb_instance:read` + `cmdb_instance:impact` |

---

## 7. 审计日志

所有写操作在同一事务内写入 `audit_log`：

| 操作              | module    | action   | beforeJson  | afterJson             |
|-------------------|-----------|----------|-------------|-----------------------|
| 创建扩展属性       | `cmdb`    | `create` | null        | 属性定义 JSON          |
| 更新扩展属性       | `cmdb`    | `update` | 旧属性 JSON  | 新属性 JSON            |
| 删除扩展属性       | `cmdb`    | `delete` | 属性 JSON    | null                  |
| 创建关联（含metadata）| `cmdb` | `create` | null        | 关联 JSON（含metadata）|
| 更新关联metadata   | `cmdb`    | `update` | 旧metadata   | 新metadata             |
| 删除关联           | `cmdb`    | `delete` | 关联 JSON    | null                  |
| CSV 导入（每行）   | `cmdb`    | `create`/`update` | null/旧实例 | 新实例，remark 带 `batch_id=<uuid>` |

---

## 8. 核心业务逻辑

### 8.1 关联 metadata 校验流程

```
用户提交关联（含 metadata）
  │
  ├─ CiRelationService.create() / update()
  │
  ├─ 查询 ci_association_attr_def WHERE association_kind = {kind}
  │
  ├─ SchemaValidator.validateAssociationAttrs(metadata, attrDefs)
  │   ├─ 检查必填字段（is_required）
  │   ├─ 检查字段类型（int/singlechar/enum/bool/date/user/list）
  │   ├─ 检查枚举值范围（enum_options）
  │   └─ 校验失败 → 抛出 ValidationException
  │
  ├─ metadata patch merge（update 时增量合并）
  │
  └─ 写入 ci_instance_rel.metadata JSONB
```

### 8.2 CSV 导入流程

```
1. 下载模板 → 用户填写 CSV
2. 上传预览 (preview)
   ├─ CsvParser 解析（编码检测：UTF-8 → juniversalchardet → GBK fallback）
   ├─ 5000 行 / 10MB 限制检查
   ├─ CSV 注入防护（=, +, -, @ 开头的单元格）
   ├─ SchemaValidator 校验每行数据
   ├─ 唯一键匹配（is_unique=true 的属性）
   ├─ 冲突策略判定（override/skip/error）
   ├─ 结果存 Redis（cmdb:import:preview:{batchId}，TTL 10min）
   └─ 返回预览统计
3. 确认执行 (execute)
   ├─ 从 Redis 读取预览数据
   ├─ 分批处理（100 条/批）
   ├─ 每条 insert/update 写 audit_log（remark: batch_id=<uuid>）
   ├─ 进度实时更新到 Redis（cmdb:import:progress:{batchId}）
   └─ 返回最终统计
4. 进度轮询（前端 1.5s 间隔）
5. 失败行下载（如有）
```

### 8.3 影响分析策略

```
POST /api/cmdb/instances/{id}/impact
  │
  ├─ 参数验证（direction, maxDepth 1-5）
  │
  ├─ 预估节点数（COUNT 关联表）
  │
  ├─ 策略选择：
  │   ├─ maxDepth <= 3 AND 预估节点 < 200
  │   │   → 递归 CTE 查询（WITH RECURSIVE）
  │   │
  │   └─ maxDepth > 3 OR 预估节点 >= 200
  │       → Java BFS 遍历
  │
  ├─ 超时控制：5 秒
  │
  ├─ 结果处理：
  │   ├─ 过滤已软删除的实例
  │   ├─ 按 depth 分层
  │   ├─ 富化节点信息（名称、模型）
  │   └─ 标记 truncated（如果超时或节点超限）
  │
  └─ 返回 layers + edges
```

---

## 9. 设计决策

### 9.1 关联 metadata 使用 JSONB

- 查询频率低，主要用于展示（拓扑悬浮、详情查看）
- JSONB 与现有 `ci_instance.fields_data` 模式一致，复用 SchemaValidator
- 避免 N+1 JOIN；单表查询即可获取关联全部信息
- 向后兼容：现有数据 `metadata = '{}'`

### 9.2 CSV 导入使用同步处理 + Redis 中间存储

- MVP 单节点部署，轮询（1.5s 间隔）足够
- WebSocket/SSE 引入额外复杂度（连接管理、断线重连）
- Phase 4 如需长任务导出，再统一升级 SSE

### 9.3 CSV 唯一键策略

- 默认使用模型中 `is_unique = true` 的属性作为唯一键
- 导入时可临时指定组合唯一键（如 `hostname,idc`）
- 唯一键值为多字段 `|` 连接

### 9.4 影响分析混合策略

- CTE 深度 > 3 时递归开销大，且难以控制内存
- Java BFS 可精确控制 visited set 和超时
- 预估节点数避免对大图使用 CTE

### 9.5 不新建 batch 表

CSV 导入历史通过 `audit_log` 的 `remark` 字段（`batch_id={batchId}`）聚合查询，无需独立的导入历史表。简化数据模型，但 Redis 进度 TTL 过期后无法查询详细统计。

### 9.6 新增 Maven 依赖

| 依赖                   | 版本   | 用途                        |
|------------------------|--------|-----------------------------|
| `commons-csv`          | 1.11.0 | Apache Commons CSV 解析     |
| `juniversalchardet`    | 1.0.3  | Mozilla 通用编码检测库      |

---

## 10. 教程

### 教程 1：为 connect 关联类型定义扩展属性

**场景**：网络连接关联需要记录带宽和端口信息。

**步骤**：

1. **创建扩展属性「带宽」**

```bash
curl -X POST /api/cmdb/association-kinds/connect/attributes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fieldKey": "bandwidth",
    "name": "带宽(Mbps)",
    "fieldType": "int",
    "isRequired": false,
    "defaultValue": "1000",
    "sortOrder": 1
  }'
```

2. **创建扩展属性「端口」**

```bash
curl -X POST /api/cmdb/association-kinds/connect/attributes \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "fieldKey": "port",
    "name": "端口",
    "fieldType": "singlechar",
    "isRequired": false,
    "sortOrder": 2
  }'
```

3. **在 UI 中创建关联**：进入实例详情页 → 关联关系 Tab → 新建关联 → 选择 connect 类型 → 表单自动显示带宽和端口字段。

4. **通过 API 更新关联元数据**

```bash
curl -X PUT /api/cmdb/instances/1/relations/42 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"metadata": {"bandwidth": 25000}}'
```

### 教程 2：批量导入主机实例

**场景**：从资产管理 Excel 导出 CSV，批量导入到 host 模型。

**步骤**：

1. **在 UI 中操作**：进入 CMDB → CI 资源 → 选择 host 模型 → 点击「导入 CSV」

2. **下载模板**

```bash
curl -O /api/cmdb/instances/import/template?model=host \
  -H "Authorization: Bearer $TOKEN"
```

3. **填写 CSV 数据**

```csv
sn,hostname,inner_ip,cpu,memory,status
SRV-001,web-server-01,10.0.1.10,8,32,online
SRV-002,web-server-02,10.0.1.11,16,64,online
SRV-003,db-server-01,10.0.2.10,32,128,online
```

4. **上传预览**

```bash
curl -X POST /api/cmdb/instances/import/preview \
  -H "Authorization: Bearer $TOKEN" \
  -F "file=@hosts.csv" \
  -F "model=host" \
  -F "conflictStrategy=override"
```

5. **确认导入**

```bash
curl -X POST /api/cmdb/instances/import/execute \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"batchId": "从 preview 返回的 batchId"}'
```

6. **查看进度**（大批量时）

```bash
curl /api/cmdb/instances/import/{batchId}/progress \
  -H "Authorization: Bearer $TOKEN"
```

7. **下载失败行**（如有失败）

```bash
curl -O /api/cmdb/instances/import/{batchId}/failed-rows \
  -H "Authorization: Bearer $TOKEN"
```

### 教程 3：影响分析

**场景**：核心交换机宕机，分析影响范围。

**步骤**：

1. **在 UI 中操作**：进入核心交换机的实例详情页 → 影响分析 Tab → 选择方向和深度 → 点击「开始分析」

2. **通过 API 下游影响分析**（我影响谁）

```bash
curl -X POST /api/cmdb/instances/10/impact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"direction": "downstream", "maxDepth": 3}'
```

3. **上游依赖分析**（谁依赖我）

```bash
curl -X POST /api/cmdb/instances/10/impact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"direction": "upstream", "maxDepth": 3}'
```

4. **双向影响分析**（默认）

```bash
curl -X POST /api/cmdb/instances/10/impact \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN"
```

**结果解读**：
- `layers[0]` = 根节点（指定实例）
- `layers[1]` = 直接关联的实例
- `layers[N]` = N 跳关联的实例
- `truncated = true` → 结果被截断，可降低 `maxDepth` 重试

---

## 11. 常见问题

### Q: CSV 导入支持哪些编码？

A: 自动检测。优先 UTF-8，然后使用 juniversalchardet 检测（支持 GBK/GB2312/Big5 等），最后 fallback 到 GBK。

### Q: CSV 导入有大小限制吗？

A: 有。最大 5000 行、10MB 文件大小。超限会在预览阶段被拒绝。

### Q: CSV 导入冲突策略有什么区别？

| 策略       | 行为                                       |
|------------|--------------------------------------------|
| `override` | 覆盖现有实例的属性（唯一键匹配到时）        |
| `skip`     | 跳过已存在的实例（唯一键匹配到时）          |
| `error`    | 报错并标记为失败行（唯一键匹配到时）        |

### Q: 影响分析的超时是多少？

A: 5 秒。超时后返回已遍历的部分结果，`truncated` 标记为 `true`。

### Q: 影响分析为什么有两种策略？

A: 小图（depth <= 3 且节点 < 200）使用 PostgreSQL 递归 CTE，性能更好。大图使用 Java BFS，可精确控制内存和超时。

### Q: 关联 metadata 的 patch 语义是什么？

A: 更新关联时，metadata 采用增量合并（patch semantics）。仅更新请求体中提供的字段，未提供的字段保持不变。例如现有 metadata 为 `{"bandwidth": 10000, "port": "eth0"}`，更新请求 `{"bandwidth": 25000}` 后结果为 `{"bandwidth": 25000, "port": "eth0"}`。

### Q: 已知问题什么时候修复？

A: 3 个 Bug 任务已创建：
- t_28ef007a — 影响分析 PNG 导出
- t_2acb3ab8 — 拓扑图 metadata hover tooltip
- t_8ee156e2 — association-kinds API 500 错误

---

## 附录：新增 Bean / 服务

| Bean                        | 位置                                           | 说明                          |
|-----------------------------|------------------------------------------------|-------------------------------|
| `CiAssociationAttrDefService` | `module/cmdb/service/`                       | 关联扩展属性 CRUD + 校验       |
| `CiRelationService`         | `module/cmdb/service/`                         | 关联生命周期（含 metadata）    |
| `CsvImportService`          | `module/cmdb/service/`                         | CSV 导入全流程                |
| `CsvParser`                 | `module/cmdb/util/`                            | CSV 解析 + 编码检测 + 注入防护 |
| `ImpactAnalysisService`     | `module/cmdb/service/`                         | 影响分析（CTE + BFS 混合）    |
