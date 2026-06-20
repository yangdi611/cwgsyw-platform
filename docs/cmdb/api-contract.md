# CMDB API Contract（当前态 + Canonical 目标）

> **来源**：基于实际 Controller / DTO Java 文件（`module/cmdb/controller/*`、`module/cmdb/dto/*`）与 Spec
> `docs/specs/2026-06-19-cmdb-architecture-debt-spec-glm52.md` §3（DTO Schema）+ §3.6（路由语义）+ AD-7（权限矩阵）。
> 标注 **canonical**（权威契约）/ **alias**（兼容窗口旧名）/ **target**（AD-7 目标，尚未在 controller 落地）。
>
> **关键事实**：后端全局 Jackson `property-naming-strategy: SNAKE_CASE` + `default-property-inclusion: non_null`
> （`application.yml:23-24`）。DTO 用 `@JsonNaming(LowerCamelCaseStrategy)` 显式覆盖才会序列化为 **camelCase**；
> 未标注的 DTO 遵循全局 **snake_case**。每个 schema 下标注其实际序列化命名。

---

## 0. 通用约定

### 0.1 响应信封 `R<T>`

所有 JSON 端点返回统一信封（字段为单词，snake/camel 无差异）：

```json
{ "code": 200, "message": "success", "data": <T> }
```

错误时 `code` 非 200（如 400/403/500），`data` 缺省（`non_null` 不输出）。

### 0.2 分页 `PageResult<T>`

```json
{ "records": [ ... ], "total": 128, "page": 1, "size": 20 }
```

> 分页 total 由 `selectCount` 单独计算（MyBatis-Plus 对 `@TableLogic` 字段的自动 count 有 bug，见 CLAUDE.md）。

### 0.3 JSON 命名规则（当前态，按 DTO 标注）

| DTO 命名 | 含义 | 实际 JSON key |
|---|---|---|
| `@JsonNaming(LowerCamelCase)` | 显式 camelCase | camelCase（如 `fieldKey`、`fieldsData`） |
| 无 `@JsonNaming`（全局 SNAKE_CASE） | 全局策略 | snake_case（如 `field_key`、`fields_data`） |
| 字段级 `@JsonProperty("x")` | 单字段钉死 | 该字段按注解值，其余走全局 |

> ⚠️ **命名尚未全局收敛**：Spec §3 的 canonical 目标是「全部 camelCase」，但当前只有部分 DTO 标了 `@JsonNaming`。
> 下文每个 schema 标注 **实际 key**。请求体详见各端点。

### 0.4 权限检查语义

- `@PreAuthorize("hasPermission('resource','action')")` —— 自定义 SpEL，校验 `resource:action` authority，
  `cmdb_model:write` 通过 V44 别名映射等价于 `cmdb_model:update`。
- `@PreAuthorize("hasAuthority('cmdb_change:read')")` —— 直接校验 authority 字符串。
- **注意**：当前多数 controller 仍用 `cmdb_instance` / `cmdb_model` 资源 gate 拓扑/影响分析/导入/属性端点，
  而 AD-7 把它们拆成独立资源（`cmdb_topology` / `cmdb_impact` / `cmdb_import` / `cmdb_attribute`）。
  这些独立资源已在 V44 seed 但 **controller 尚未切换**（见 §1.2 实际执行口径）。

---

## 1. AD-7 权限资源 / Action 矩阵

### 1.1 Canonical 资源矩阵（AD-7 目标 + V44 seed 现状）

| Resource | Actions | seed 来源 |
|---|---|---|
| `cmdb_model` | read, create, update, delete, **manage** | V14/V23 + V44(补 manage) |
| `cmdb_attribute` | read, create, update, delete | V44（**新增独立资源**） |
| `cmdb_instance` | read, create, update, delete, **export**, import*, impact* | V14/V23 + V25(import)/V26(impact) |
| `cmdb_relation` | read, create, **update**, delete | V23 + V24/V44(补 update) |
| `cmdb_topology` | read | V44（**新增**） |
| `cmdb_import` | read, execute | V44（**新增**） |
| `cmdb_impact` | read | V44（**新增**） |
| `cmdb_change` | read | V33 |
| `cmdb_alert` | read, acknowledge | （Prometheus 告警模块，独立 seed） |

> `import*` / `impact*`：当前仍挂在 `cmdb_instance` action 上（V25/V26），AD-7 计划提升为独立资源（V44 已 seed `cmdb_import`/`cmdb_impact`，但 controller 未切换）。
> `write`（V14 残留）**deprecated** → 统一 `update`；V44 把所有持 `cmdb_model:write` 的角色补授 `cmdb_model:update`（别名映射）。

### 1.2 Controller 实际执行口径（当前态）

下表列出每个端点 **实际 `@PreAuthorize`**，并标注与 AD-7 canonical 的差异（`⚠` = controller 仍用旧资源，AD-7 目标资源尚未强制）：

| 端点组 | 实际权限 | AD-7 目标 | 差异 |
|---|---|---|---|
| 实例 CRUD | `cmdb_instance:{read,create,update,delete}` | 同 | ✅ 一致 |
| 实例 history / changes | `cmdb_change:read`（hasAuthority） | 同 | ✅ 一致 |
| 模型 CRUD | `cmdb_model:{read,create,update,delete}` | 同 | ✅ 一致 |
| 关联 CRUD | `cmdb_relation:{read,create,update,delete}` | 同 | ✅ 一致 |
| 属性 CRUD | `cmdb_model:read` / `cmdb_model:update` | `cmdb_attribute:*` | ⚠ 未切换 |
| 关联扩展属性 def CRUD | `cmdb_model:read` / `cmdb_model:update` | `cmdb_attribute:*` | ⚠ 未切换 |
| 拓扑 / 拓扑对比 | `cmdb_instance:read` | `cmdb_topology:read` | ⚠ 未切换 |
| 影响分析 | `cmdb_instance:read` + `cmdb_instance:impact` | `cmdb_impact:read` | ⚠ 未切换 |
| CSV 导入 preview/execute | `cmdb_instance:create` + `cmdb_instance:update` | `cmdb_import:execute` | ⚠ 未切换 |
| CSV 模板/进度/失败行 | `cmdb_instance:read` | `cmdb_import:read` | ⚠ 未切换 |
| 关联种类 list | `cmdb_relation:read` | 同 | ✅ 一致 |
| 实例凭据 | `device:view_password`（hasAuthority） | — | 设备模块，非 CMDB |

> AD-7 的 `cmdb_model:manage`、`cmdb_instance:export` 当前 **无任何 controller 端点引用**（保留/预留 action）。

### 1.3 角色授权（V44 之后的 seed 结果）

| 角色 | cmdb_model | cmdb_attribute | cmdb_instance | cmdb_relation | cmdb_topology | cmdb_import | cmdb_impact | cmdb_change |
|---|---|---|---|---|---|---|---|---|
| `super_admin` / `admin` | 全部 + manage | 全部 | 全部 + import + impact | 全部 | read | read + execute | read | read |
| `group_leader` | read | read | create/read/update/delete + import | read/create/update | read | read + execute | read | read |
| `member` | read | read | read + impact | read | read | — | read | read |
| `viewer` | read | — | read | read | — | — | — | — |
| `doc_admin` | read | — | read | read | — | — | — | — |

（来源：V23/V25/V26/V33/V44 seed 的 `sys_role_permission` 插入。）

---

## 2. 完整路由表

### 2.1 实例 — `CiInstanceController`（`/api/cmdb/instances`）

| # | Method | Path | 权限 | 请求 | 响应 |
|---|---|---|---|---|---|
| 1 | GET | `/` | `cmdb_instance:read` | query: `model`(必), `keyword?`, `status?`, `page?=1`, `size?=20` | `PageResult<CiInstanceVO>` |
| 2 | GET | `/search` | `cmdb_instance:read` | query: `keyword`(必), `size?=10` | `PageResult<CiInstanceSearchVO>` |
| 3 | GET | `/2d-view` | `cmdb_instance:read` | query: `modelId`(必), `groupBy`(必) | `TwoDimensionViewVO` |
| 4 | GET | `/{id}` | `cmdb_instance:read` | path: `id` | `CiInstanceDetailVO` |
| 5 | POST | `/` | `cmdb_instance:create` | body: `CreateInstanceRequest` | `CiInstanceDetailVO` |
| 6 | PUT | `/{id}` | `cmdb_instance:update` | body: `UpdateInstanceRequest` | `CiInstanceDetailVO` |
| 7 | DELETE | `/{id}` | `cmdb_instance:delete` | path: `id` | `R<Void>` |
| 8 | GET | `/{id}/history` | `cmdb_change:read` | query: `from?`, `to?`, `operatorId?`, `action?`, `page?`, `size?` | `PageResult<ChangeHistoryV2VO>` |
| 9 | GET | `/changes` | `cmdb_change:read` | query: `model?`, `operatorId?`, `startDate?`, `endDate?`, `action?`, `page?`, `size?` | `PageResult<ChangeHistoryV2VO>` |
| 10 | GET | `/{id}/devices` | `cmdb_instance:read` | path: `id` | `List<DeviceVO>` |
| 11 | GET | `/{id}/change-docs` | `cmdb_instance:read` | path: `id` | `List<LinkedChangeDocVO>` |
| 12 | GET | `/{id}/daily-reports` | `cmdb_instance:read` | path: `id` | `List<DailyReportBriefVO>` |
| 13 | GET | `/{id}/credentials` | `device:view_password` | path: `id` | `List<CredentialVO>` |

### 2.2 模型 — `CiModelController`（`/api/cmdb/models`）

| # | Method | Path | 权限 | 请求 | 响应 |
|---|---|---|---|---|---|
| 14 | GET | `/` | `cmdb_model:read` | query: `keyword?`, `group?`, `page?=1`, `size?=20` | `PageResult<CiModelVO>` |
| 15 | GET | `/{id}` | `cmdb_model:read` | path: `id` | `CiModelVO`（含 `attributes`） |
| 16 | POST | `/` | `cmdb_model:create` | body: `CreateModelRequest` | `CiModelVO` |
| 17 | PUT | `/{id}` | `cmdb_model:update` | body: `UpdateModelRequest` | `CiModelVO` |
| 18 | DELETE | `/{id}` | `cmdb_model:delete` | path: `id` | `R<Void>` |

### 2.3 实例关联 — `CiRelationController`（`/api/cmdb/instances/{id}/relations`）

| # | Method | Path | 权限 | 请求 | 响应 |
|---|---|---|---|---|---|
| 19 | POST | `/` | `cmdb_relation:create` | body: `CreateRelationRequest` | `CiRelationVO` |
| 20 | GET | `/applicable-defs` | `cmdb_relation:read` | path: `id` | `List<CiAssociationDef>`（当前实例可作 src 建立的 def 列表） |
| 21 | PUT | `/{relationId}` | `cmdb_relation:update` | body: `UpdateRelationRequest` | `CiRelationVO` |
| 22 | DELETE | `/{relationId}` | `cmdb_relation:delete` | path: `relationId` | `R<Void>` |
| 23 | GET | `/` | `cmdb_relation:read` | query: `kind?` | `List<CiRelationVO>` |

### 2.4 模型属性 — `CiAttributeController`（`/api/cmdb/models/{modelId}/attributes`）

| # | Method | Path | 权限（实际） | 请求 | 响应 |
|---|---|---|---|---|---|
| 24 | GET | `/` | `cmdb_model:read` ⚠ | path: `modelId` | `List<CiAttributeVO>` |
| 25 | POST | `/` | `cmdb_model:update` ⚠ | body: `CreateAttributeRequest` | `CiAttributeVO` |
| 26 | PUT | `/{attrId}` | `cmdb_model:update` ⚠ | body: `UpdateAttributeRequest` | `CiAttributeVO` |
| 27 | DELETE | `/{attrId}` | `cmdb_model:update` ⚠ | path: `attrId` | `R<Void>` |

### 2.5 拓扑 — `CiTopologyController`（`/api/cmdb/topology`）

| # | Method | Path | 权限（实际） | 请求 | 响应 |
|---|---|---|---|---|---|
| 28 | GET | `/{instanceId}` | `cmdb_instance:read` ⚠ | query: `depth?=5` | `TopologyResultVO` |
| 29 | GET | `/{instanceId}/compare` | `cmdb_instance:read` ⚠ | query: `fromTime`(必), `toTime`(必), `depth?=5` | `TopologyCompareVO` |

### 2.6 影响分析 — `ImpactAnalysisController`（`/api/cmdb/instances/{id}/impact`）

| # | Method | Path | 权限（实际） | 请求 | 响应 |
|---|---|---|---|---|---|
| 30 | POST | `/` | `cmdb_instance:read` + `cmdb_instance:impact` ⚠ | body?: `ImpactAnalysisRequest` | `ImpactAnalysisResultVO` |

### 2.7 CSV 导入 — `CsvImportController`（`/api/cmdb/instances/import`）

| # | Method | Path | 权限（实际） | 请求 | 响应 |
|---|---|---|---|---|---|
| 31 | GET | `/template` | `cmdb_instance:read` | query: `model`(必) | CSV（`text/csv` 附件） |
| 32 | POST | `/preview` | `cmdb_instance:create` + `cmdb_instance:update` ⚠ | multipart: `file`, `model`, `conflictStrategy?=override`, `uniqueKeyFields?`, `encoding?` | `CsvImportPreviewVO` |
| 33 | POST | `/execute` | `cmdb_instance:create` + `cmdb_instance:update` ⚠ | body: `CsvImportExecuteRequest` | `CsvImportResultVO` |
| 34 | GET | `/{batchId}/progress` | `cmdb_instance:read` | path: `batchId` | `CsvImportProgressVO` |
| 35 | GET | `/{batchId}/failed-rows` | `cmdb_instance:read` | path: `batchId` | CSV（`text/csv` 附件） |

### 2.8 变更历史 / 统计 — `CiChangeController`（`/api/cmdb`）

| # | Method | Path | 权限 | 请求 | 响应 |
|---|---|---|---|---|---|
| 36 | GET | `/changes` | `cmdb_change:read` | query: `entityType?=ci_instance`, `entityId?`, `modelId?`, `from?`, `to?`, `operatorId?`, `action?`, `page?`, `size?` | `PageResult<ChangeHistoryV2VO>` |
| 37 | GET | `/changes/stats` | `cmdb_change:read` | query: `from?`, `to?`, `modelId?` | `ChangeStatsVO` |

### 2.9 关联种类 — `CiAssociationKindController`（`/api/cmdb/association-kinds`）

| # | Method | Path | 权限 | 请求 | 响应 |
|---|---|---|---|---|---|
| 38 | GET | `/` | `cmdb_relation:read` | — | `List<CiAssociationKindVO>` |

### 2.10 关联扩展属性定义 — `CiAssociationAttrDefController`（`/api/cmdb/association-kinds/{kind}/attributes`）

| # | Method | Path | 权限（实际） | 请求 | 响应 |
|---|---|---|---|---|---|
| 39 | GET | `/` | `cmdb_model:read` ⚠ | path: `kind` | `List<CiAssociationAttrDefVO>` |
| 40 | POST | `/` | `cmdb_model:update` ⚠ | body: `CreateAssociationAttrRequest` | `CiAssociationAttrDefVO` |
| 41 | PUT | `/{attrId}` | `cmdb_model:update` ⚠ | body: `UpdateAssociationAttrRequest` | `CiAssociationAttrDefVO` |
| 42 | DELETE | `/{attrId}` | `cmdb_model:update` ⚠ | path: `attrId` | `R<Void>` |

> Prometheus 告警端点（`/api/cmdb/alerts`，`CmdbAlertController`，`cmdb_alert:{read,acknowledge}`）属独立告警模块，不在本契约核心范围。

---

## 3. DTO Schema（请求 + 响应，按实际 JSON key）

### 3.1 `CiInstanceDetailVO`（响应，camelCase）— Spec §3.1

> GET `/api/cmdb/instances/{id}` (#4)、POST (#5)、PUT (#6) 响应。

```json
{
  "id": 123,
  "name": "web-01",
  "modelCode": "host",                 // [canonical] (AD-4) = CiModel.name
  "modelId": "host",                   // [alias] = modelCode，兼容窗口期保留
  "displayName": "主机",               // [canonical] = CiModel.displayName
  "modelName": "主机",                 // = displayName（过渡后废弃）
  "status": "online",
  "owner": "alice",
  "description": "...",
  "fieldsData": { "inner_ip": "10.0.0.1" },   // [canonical] Map<String,Object>（DB ci_instance.attrs）
  "attributes": [ CiAttributeVO ],     // [canonical] 字段配置列表
  "createdAt": "2026-06-19T10:00:00",
  "updatedAt": "2026-06-19T10:00:00"
}
```

字段：`id, name, modelCode, modelId(alias), displayName, modelName, status, owner, description, fieldsData, attributes[], createdAt, updatedAt`。
`@JsonNaming(LowerCamelCase)` → 全 camelCase。

### 3.2 `CiInstanceVO`（响应，camelCase）— 列表项

> GET `/` (#1) 列表项。

```json
{
  "id": 123, "name": "web-01",
  "modelCode": "host",                 // [canonical]
  "modelId": "host",                   // [alias]
  "displayName": "主机", "modelName": "主机",
  "status": "online", "owner": "alice", "description": "...",
  "fieldsData": { "inner_ip": "10.0.0.1" },
  "createdAt": "...", "updatedAt": "..."
}
```

`@JsonInclude(NON_NULL)` + `@JsonNaming(LowerCamelCase)`。无 `attributes`（区别于 DetailVO）。

### 3.3 `CiInstanceSearchVO`（响应，**混合命名**）— Spec §3 跨模型搜索

> GET `/search` (#2)。字段级 `@JsonProperty` 显式钉死。

```json
{
  "id": 123,
  "name": "web-01",
  "modelCode": "host",     // [canonical] camelCase
  "model_id": "host",      // [alias] snake_case
  "model_name": "主机"      // snake_case
}
```

### 3.4 `CreateInstanceRequest`（请求，**snake_case**）— Spec §3 对应

> POST `/` (#5)。无 `@JsonNaming` → 全局 snake_case。

```json
{
  "model_id": "host",                  // [canonical] 引用 CiModel.name
  "name": "web-01",                    // [canonical] 必填
  "status": "online",                  // 默认 "online"
  "owner": "alice",
  "description": "...",
  "fields_data": { "inner_ip": "10.0.0.1" }   // [canonical] 必填 Map
}
```

> ⚠️ **与 Spec §3.2 的差异**：Spec 写请求 key 为 `fieldsData`（camelCase），但 `CreateInstanceRequest` 无 `@JsonNaming`，
> 实际接受的是 **`fields_data`**（snake_case，全局策略）。前端按 CLAUDE.md 约定 POST/PUT 用 snake_case。

### 3.5 `UpdateInstanceRequest`（请求，**snake_case**）— Spec §3.2

> PUT `/{id}` (#6)。无 `@JsonNaming` → 全局 snake_case。

```json
{
  "name": "...",            // 可选
  "status": "...",          // 可选
  "owner": "...",           // 可选
  "description": "...",     // 可选
  "fields_data": { ... }    // [canonical] 部分更新合并（实际 key 为 fields_data）
}
```

> Spec §3.2 canonical 目标为 `fieldsData`；当前实现接受 `fields_data`。

### 3.6 `CiModelVO`（响应，camelCase）— Spec §3 模型

> GET `/` (#14) 列表项 / GET `/{id}` (#15) 详情（含 `attributes`）。

```json
{
  "id": 1,
  "name": "host",                      // [canonical] = modelCode
  "displayName": "主机",               // [canonical]
  "group": "host_manage",
  "groupName": "主机管理",
  "isBuiltIn": true,
  "color": "#1890FF",
  "enable2dView": true,
  "instanceCount": 42,
  "attributes": [ CiAttributeVO ],     // 仅 getById 返回
  "createdAt": "...", "updatedAt": "..."
}
```

### 3.7 `CreateModelRequest` / `UpdateModelRequest`（请求，**snake_case**）

无 `@JsonNaming` → snake_case。

```json
// POST /models (#16)
{ "name": "router", "display_name": "路由器", "group": "network" }
// name: ^[a-z][a-z0-9_]*$ ；display_name max 128

// PUT /models/{id} (#17)
{ "display_name": "路由器", "group": "network", "description": "...",
  "color": "#722ED1", "enable_2d_view": true }
// color: ^#[0-9A-Fa-f]{6}$
```

### 3.8 `CiAttributeVO`（响应，camelCase）— Spec §3.3

> 嵌套于 `CiInstanceDetailVO.attributes` / `CiModelVO.attributes`，GET `/models/{modelId}/attributes` (#24)。

```json
{
  "id": 1,
  "modelId": "host",                   // [canonical]
  "fieldKey": "inner_ip",              // [canonical]
  "name": "内网IP",
  "groupId": "base",
  "groupName": "基本信息",
  "fieldType": "singlechar",           // [canonical] AD-5 枚举
  "isRequired": true,
  "isEditable": false,
  "isUnique": true,
  "isBuiltIn": true,
  "isListShow": true,
  "defaultValue": null,
  "option": [ {"id":"x","name":"X","isDefault":true} ],  // [canonical] JSONB 对象数组
  "enumOptions": null,                 // [deprecated] 旧 String 字段
  "sortOrder": 1
}
```

### 3.9 `CreateAttributeRequest`（请求，**混合命名**）

> POST `/models/{modelId}/attributes` (#25)。部分字段 `@JsonProperty` 钉 camelCase，其余全局 snake。

```json
{
  "fieldKey": "sn",            // [canonical] camelCase（@JsonProperty）
  "name": "序列号",             // camelCase（@JsonProperty）
  "groupId": "base",           // camelCase（@JsonProperty）
  "fieldType": "singlechar",   // camelCase（@JsonProperty）
  "is_required": false,         // snake（全局）
  "is_editable": true,
  "is_unique": false,
  "is_list_show": true,
  "default_value": null,
  "option": [ {"id":"x","name":"X","isDefault":true} ],   // [canonical]（@JsonProperty）
  "enumOptions": null,          // [deprecated]（@JsonProperty）
  "sort_order": 0
}
```

> ⚠️ 该请求 **混合** camelCase 与 snake_case key。`UpdateAttributeRequest`（无 `@JsonProperty`）则全 snake：
> `name, is_required, is_editable, is_list_show, default_value, option, enum_options, sort_order`。

### 3.10 `CiRelationVO`（响应，camelCase）— Spec §3 关联

> GET `/instances/{id}/relations` (#23) 列表项。

```json
{
  "id": 7,
  "srcInstanceId": 123, "srcInstanceName": "web-01",
  "dstInstanceId": 456, "dstInstanceName": "app-svc",
  "associationKind": "run",            // = def 的 kindId
  "metadata": { "since": "2026-01-01" },   // [canonical] 关联扩展属性
  "createdAt": "..."
}
```

### 3.11 `CreateRelationRequest`（请求，camelCase canonical + snake alias）— Spec §3.4

> POST `/instances/{id}/relations` (#19)。`@JsonNaming(LowerCamelCase)` + `@JsonAlias` 兼容 snake。

```json
{
  "defId": "host_run_vm",              // [canonical] 指向 ci_association_def.def_id
  "dstInstanceId": 456,                // [canonical] 必填
  "metadata": { "since": "2026-01-01" }  // 按 ci_association_attr_def 校验
}
// [alias, deprecated] "associationKind": "run"  —— defId 缺失时按 AD-3 推导
// snake 别名同样接受：def_id / dst_instance_id / association_kind
```

> 不再接收裸 `associationKind` 作为唯一依据；`associationKind` 仅作兼容 alias（AD-3）。

### 3.12 `UpdateRelationRequest`（请求，snake_case）

```json
{ "metadata": { "since": "2026-02-01" } }
```

### 3.13 `CiAssociationKindVO` / `CiAssociationAttrDefVO`（响应，camelCase）

```json
// GET /association-kinds (#38)
{ "id": 1, "code": "run", "name": "运行", "isBuiltIn": true }

// GET /association-kinds/{kind}/attributes (#39)
{ "id": 3, "associationKind": "run", "fieldKey": "since", "name": "建立时间",
  "fieldType": "date", "isRequired": false, "enumOptions": null,
  "defaultValue": null, "sortOrder": 1 }
```

> `CiAssociationAttrDefVO.enumOptions` 为 String（此 DTO 未走 AD-5 JSON 统一）。

### 3.14 `CreateAssociationAttrRequest` / `UpdateAssociationAttrRequest`（请求，混合命名）

```json
// POST (#40) — 混合：fieldKey/name/fieldType camelCase（@JsonProperty），其余 snake
{ "fieldKey": "since", "name": "建立时间", "fieldType": "date",
  "is_required": false, "enum_options": null, "default_value": null, "sort_order": 0 }

// PUT (#41) — 全 snake（无 @JsonProperty）
{ "name": "...", "is_required": ..., "enum_options": ..., "default_value": ..., "sort_order": ... }
```

### 3.15 `ChangeHistoryV2VO`（响应，camelCase）

> GET `/{id}/history` (#8)、GET `/changes` (#9/#36)。来源：`ci_change_record`（AD-6）。

```json
{
  "id": 99,
  "action": "update",                  // [canonical] create|update|delete|relate
  "operatorId": 1, "operatorName": "alice",
  "beforeJson": { "status": "stopped" },
  "afterJson": { "status": "running" },
  "changedFields": ["status"],
  "summary": "状态变更",
  "createdAt": "..."
}
```

### 3.16 `ChangeStatsVO`（响应，**snake_case**）— GET `/changes/stats` (#37)

> 无 `@JsonNaming` → snake_case。

```json
{
  "today":          { "created": 1, "updated": 3, "deleted": 0, "total": 4 },
  "this_week":      { "created": 5, "updated": 8, "deleted": 1, "total": 14 },
  "this_month":     { "created": 20, "updated": 30, "deleted": 2, "total": 52 },
  "daily_breakdown": [ { "date": "2026-06-19", "created": 1, "updated": 3, "deleted": 0 } ],
  "top10_instances": [ { "instance_id": 123, "instance_name": "web-01",
                         "model_id": "host", "model_name": "主机", "change_count": 9 } ]
}
```

### 3.17 `TopologyResultVO`（响应，snake_case）— GET `/topology/{instanceId}` (#28)

> 无 `@JsonNaming` → snake_case。

```json
{
  "nodes": [ { "id": 123, "name": "web-01", "model_id": "host", "model_name": "主机",
               "model_color": "#1890FF", "status": "running", "owner": "alice",
               "is_root": true, "key_attrs": { "inner_ip": "10.0.0.1" } } ],
  "edges": [ { "src": 123, "dst": 456, "kind": "run", "label": "运行在" } ]
}
```

### 3.18 `TopologyCompareVO`（响应，snake_case）— GET `/topology/{instanceId}/compare` (#29)

```json
{
  "added":     [ TopologyNodeV2VO ],   // 含 fieldsData 快照
  "removed":   [ TopologyNodeV2VO ],
  "modified":  [ TopologyNodeV2VO ],
  "unchanged": [ TopologyNodeV2VO ],
  "edges":     [ { "src": 123, "dst": 456, "kind": "run", "label": "运行于", "status": "added" } ]
}
```
`TopologyNodeV2VO` = TopologyNodeVO 字段 + `fieldsData`（snake：同 node 字段 + `fields_data`）。

### 3.19 `ImpactAnalysisRequest` / `ImpactAnalysisResultVO`（请求 snake / 响应 snake）

> POST `/instances/{id}/impact` (#30)。均无 `@JsonNaming` → snake_case。

```json
// 请求（可空 body）
{ "direction": "bidirectional", "max_depth": 3 }
// direction: bidirectional|upstream|downstream

// 响应
{
  "root_id": 123, "root_name": "web-01", "root_model_id": "host",
  "direction": "bidirectional", "max_depth": 3, "truncated": false,
  "layers": [ { "depth": 1, "nodes": [
      { "id": 456, "name": "app-svc", "model_id": "app", "model_name": "应用",
        "status": "running", "business_level": "L1" } ] } ],
  "edges": [ { "src": 123, "dst": 456, "kind": "run", "label": "运行于" } ]
}
```

### 3.20 CSV 导入 DTO（响应 snake）

> GET `/template`(#31) 返回 CSV；POST `/preview`(#32) / `/execute`(#33) / 进度(#34)。

```json
// CsvImportPreviewVO（preview 响应）
{ "batch_id": "b_abc", "total_rows": 100, "to_create": 80, "to_update": 15, "to_skip": 5,
  "failed_rows": [ { "row_number": 7, "reason": "必填缺失", "row_data": { "name": "" } } ],
  "encoding": "UTF-8", "preview_data": [ { "inner_ip": "10.0.0.7", "hostname": "w07" } ] }

// CsvImportExecuteRequest（execute 请求，snake）
{ "batch_id": "b_abc" }

// CsvImportResultVO（execute 响应）
{ "batch_id": "b_abc", "total_rows": 100, "created": 80, "updated": 15, "skipped": 3,
  "failed": 2, "failed_rows": [ ... ], "duration_ms": 1200 }

// CsvImportProgressVO（progress 响应）
{ "batch_id": "b_abc", "status": "RUNNING", "total_rows": 100, "processed": 60,
  "created": 48, "updated": 10, "skipped": 1, "failed": 1 }
```

### 3.21 `TwoDimensionViewVO`（响应 snake）— GET `/instances/2d-view` (#3)

```json
{
  "model_id": "host", "model_name": "主机", "group_by": "env",
  "groups": [ { "group_value": "prod", "instances": [
      { "id": 123, "name": "web-01", "status": "running", "owner": "alice" } ] } ],
  "groupable_attrs": [ { "field_key": "env", "name": "环境", "field_type": "enum" } ]
}
```

### 3.22 `CiInstanceBriefVO`（响应 camelCase）

> 用于跨模块关联引用（变更文档/日报 ↔ CI）。`@JsonNaming(LowerCamelCase)`。

```json
{ "id": 123, "name": "web-01", "modelId": "host", "modelName": "主机" }
```

---

## 4. Spec §3.6 路由参数语义（Canonical）

| 路由（前端） | 参数 | 语义 | 兼容 |
|---|---|---|---|
| `/cmdb/admin/models/[modelCode]` | `modelCode` | `CiModel.name`（模型编码） | 旧 `[modelId]` redirect 一版本 |
| `/cmdb/instances/by-model/[modelCode]` | `modelCode` | 同上 | 同上 |
| `/cmdb/instances/by-model/[modelCode]/[instanceId]` | `instanceId` | DB 主键 `Long` | `[id]` 保留为 alias |
| `/cmdb/topology/[instanceId]` | `instanceId` | DB 主键 | 不变 |
| `/cmdb/impact/[instanceId]` | `instanceId` | DB 主键 | 不变 |

> 后端 path 变量 `{id}`（实例）、`{modelId}`（模型编码字符串）、`{instanceId}`（拓扑/影响）均指 DB 主键或 `CiModel.name`，详见 §2 各路由。
> `modelCode`（= `CiModel.name`）与历史 `modelId` 同值（host/app 等），DTO 层同时返回两者作 alias。

---

## 5. 兼容窗口汇总（Spec §5.1）

| 变更 | 兼容策略 | 窗口 | 当前状态 |
|---|---|---|---|
| 前端 snake → camelCase | DTO 加 `@JsonNaming(LowerCamelCase)` | 1 版本 | **部分完成**：实例/模型/属性/关联 VO 已 camel；拓扑/影响/CSV/统计 VO 仍 snake |
| `attrs` payload → `fieldsData` | 前端改发 `fields_data`（后端 `CreateInstanceRequest` 认 snake） | 立即 | ✅ 后端实体已 `fieldsData`→`attrs` 列 |
| `modelId` → `modelCode`（DTO） | 后端同时返回两者（值相同） | 1 版本 | ✅ DetailVO/VO 已双发 |
| `[modelId]` 路由 → `[modelCode]` | Next.js 旧路径 redirect | 1 版本 | 前端路由层（AC10） |
| `associationKind` → `defId`（创建请求） | 后端兼容接收 `associationKind`，按 AD-3 推导 `defId` | 1 版本 | ✅ `CreateRelationRequest` 双字段 + `@JsonAlias` |
| `write` → `update`（权限） | V44 把持 `write` 的角色补授 `update` | 1 版本 | ✅ V44 alias 映射完成 |

---

## 6. 已知偏差（canonical target vs 当前实现）

| # | 偏差 | canonical target | 当前实现 | 来源 |
|---|---|---|---|---|
| D1 | 属性/关联扩展属性 controller 权限 | `cmdb_attribute:*` | `cmdb_model:read/update` | AD-7 vs `CiAttributeController`/`CiAssociationAttrDefController` |
| D2 | 拓扑 controller 权限 | `cmdb_topology:read` | `cmdb_instance:read` | AD-7 vs `CiTopologyController` |
| D3 | 影响分析 controller 权限 | `cmdb_impact:read` | `cmdb_instance:read` + `cmdb_instance:impact` | AD-7 vs `ImpactAnalysisController` |
| D4 | CSV 导入 controller 权限 | `cmdb_import:execute/read` | `cmdb_instance:create+update` / `read` | AD-7 vs `CsvImportController` |
| D5 | 拓扑/影响/CSV/统计响应命名 | 全 camelCase（Spec §3） | snake_case（无 `@JsonNaming`） | 各 DTO |
| D6 | `CreateInstanceRequest`/`UpdateInstanceRequest` 请求 key | `fieldsData`（Spec §3.2） | `fields_data`（全局 snake） | DTO 无 `@JsonNaming` |
| D7 | `CiAssociationAttrDefVO.enumOptions` / `ci_association_attr_def.enum_options` | AD-5 JSON 对象数组 | String / TEXT 列 | AD-5 vs V24 表设计 |
| D8 | `cmdb_model:manage` / `cmdb_instance:export` | AD-7 action | 无 controller 引用 | AD-7 预留 action |

> D1–D4：AD-7 资源已在 V44 seed，但 controller `@PreAuthorize` 未切换 —— 当前 **有效权限** 仍以 §1.2 实际口径为准。
> D5–D6：命名收敛是 AD-1/Spec §3 的进行中工作，尚未覆盖所有 DTO。
