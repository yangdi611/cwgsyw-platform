# 技术 Spec: CMDB 前端全量补齐

> 基于 PRD: 本文件上半部分
> 日期: 2026-06-16
> 作者: Architect
> 状态: Ready_For_Dev

---

## 10. 开放问题闭环

| # | 问题 | 决策 | 理由 |
|---|------|------|------|
| OQ-1 | 关联定义查询端点缺失 | **前端适配**：从 `GET /cmdb/models/{modelId}` 返回的 `associationDefs` 字段获取，或直接调用 `GET /cmdb/instances/{id}/relations` 返回的元数据推断可用关联类型。**不改后端**。 | 后端已有 `CiAssociationDef` 实体和 Mapper，但 Controller 未暴露独立查询端点。`CiRelationController` 的 `GET /cmdb/instances/{id}/relations` 返回 `CiRelationVO` 中包含关联类型信息。前端可以调用 `GET /cmdb/models` 列表，用 `associationDefs` 字段做客户端过滤。 |
| OQ-2 | 实例详情 Tab vs 折叠面板 | **改为 Tab 布局**（shadcn/ui `Tabs`）。 | PRD 已明确要求 Tab 化重构（AC-2.1），更有利于懒加载（AC-2.5）。 |
| OQ-3 | 关联权限 | **前端对齐后端**：关联 CRUD 使用 `cmdb_relation:create/read/update/delete`。 | 后端 `CiRelationController` 使用 `cmdb_relation:*` 权限注解。 |
| OQ-4 | 告警导航位置 | **CMDB 分组下**，作为可折叠 NavGroup。 | PRD AC-7.2 已明确。告警强绑 CI 实例。 |
| OQ-5 | CSV 导入组件 | **适配现有 CsvImportDialog**，API 路径已正确，只需集成到实例列表页。 | 审计确认 CsvImportDialog 的 5 个 API 调用路径全部与后端 `CsvImportController` 匹配，无需修改。 |

---

## 11. API 路径全量映射表（前端当前 → 后端实际 → 修正方案）

### 11.1 P0 — 必须修正的 API 路径（实例详情页 + 关联 CRUD + 模型查询）

| 前端当前路径 | 后端实际路径 | 修正动作 | 影响文件 |
|---|---|---|---|
| `GET /cmdb/instances/${modelId}/${id}` | `GET /cmdb/instances/{id}` | 去掉 modelId 路径段 | `instances/by-model/[modelId]/[id]/page.tsx` L91, `associations/page.tsx` L50, `associations/new/page.tsx` L52 |
| `PUT /cmdb/instances/${modelId}/${id}` | `PUT /cmdb/instances/{id}` | 去掉 modelId 路径段 | `instances/by-model/[modelId]/[id]/page.tsx` L109 |
| `DELETE /cmdb/instances/${modelId}/${id}` | `DELETE /cmdb/instances/{id}` | 去掉 modelId 路径段 | `instances/by-model/[modelId]/page.tsx` L57 |
| `GET /cmdb/meta/models/${modelId}` | `GET /cmdb/models/{id}` | 替换 `/meta/models/` → `/models/` | `[id]/page.tsx` L96, `[modelId]/page.tsx` L47, `new/page.tsx` L41, `admin/models/[modelId]/page.tsx` L47 |
| `GET /cmdb/rel/${id}` | `GET /cmdb/instances/{id}/relations` | 完全替换路径 | `[id]/page.tsx` L120, `associations/page.tsx` L58 |
| `POST /cmdb/rel` body `{def_id,src_id,dst_id}` | `POST /cmdb/instances/{id}/relations` body `{dstInstanceId, associationKind}` | 完全替换路径+body | `[id]/page.tsx` L163 |
| `DELETE /cmdb/rel/${relId}` | `DELETE /cmdb/instances/{id}/relations/{relationId}` | 完全替换路径 | `[id]/page.tsx` L154, `associations/page.tsx` L62 |
| `GET /cmdb/meta/association-defs` | (无独立端点) | 从 `GET /cmdb/models/{id}` 的 `associationDefs` 字段获取，或使用关联返回数据推断 | `[id]/page.tsx` L132, `associations/new/page.tsx` L60, `admin/page.tsx` L199 |
| `GET /cmdb/rel/search` | `GET /cmdb/instances/search` | 替换路径 | `[id]/page.tsx` L147, `associations/new/page.tsx` L75 |
| `POST /cmdb/instances` body `{model,...}` | `POST /cmdb/instances` body `{modelId,...}` | 参数名 `model` → `modelId` | `instances/page.tsx` L122 |
| `GET /cmdb/instances/${modelId}` (path param) | `GET /cmdb/instances?model=${modelId}` (query param) | 改为 query param 方式 | `[modelId]/page.tsx` L52 |
| `GET /cmdb/meta/models` | `GET /cmdb/models` | 替换路径 | `admin/page.tsx` L89, L200 |
| `POST /cmdb/meta/models` | `POST /cmdb/models` | 替换路径 | `admin/page.tsx` L93 |
| `POST /cmdb/meta/models/${modelId}/attributes` | `POST /cmdb/models/{modelId}/attributes` | 替换路径 | `admin/models/[modelId]/page.tsx` L51 |
| `DELETE /cmdb/meta/attributes/${attrId}` | `DELETE /cmdb/models/{modelId}/attributes/{attrId}` | 替换路径，需补充 modelId | `admin/models/[modelId]/page.tsx` L68 |
| `GET /cmdb/meta/association-kinds` | (无独立端点) | 从 `CiAssociationKind` 实体通过已有数据推断；如后端有 seed 数据则通过 `/cmdb/models` 返回的关联信息获取 | `admin/page.tsx` L198 |
| `POST /cmdb/meta/association-kinds` | (无独立端点) | 移除此功能或标记为待后端补充 | `admin/page.tsx` L203 |
| `POST /cmdb/meta/association-defs` | (无独立端点) | 移除此功能或标记为待后端补充 | `admin/page.tsx` L209 |
| `DELETE /cmdb/meta/association-defs/${id}` | (无独立端点) | 移除此功能 | `admin/page.tsx` L215 |

### 11.2 已正确的 API 路径（无需修改）

| 前端路径 | 后端端点 | 状态 |
|---|---|---|
| `GET /cmdb/models` | CiModelController.list | ✅ 正确 |
| `POST /cmdb/models` | CiModelController.create | ✅ 正确 |
| `PUT /cmdb/models/${id}` | CiModelController.update | ✅ 正确 |
| `DELETE /cmdb/models/${id}` | CiModelController.delete | ✅ 正确 |
| `GET /cmdb/models/${id}/attributes` | CiAttributeController.list | ✅ 正确 |
| `GET /cmdb/instances/search` | CiInstanceController.search | ✅ 正确 |
| `GET /cmdb/instances/2d-view` | CiInstanceController.twoDView | ✅ 正确 |
| `POST /cmdb/instances/${instanceId}/impact` | ImpactAnalysisController.analyze | ✅ 正确 |
| `GET /cmdb/topology/${instanceId}` | CiTopologyController.getTopology | ✅ 正确 |
| `GET /cmdb/topology/${instanceId}/compare` | CiTopologyController.compare | ✅ 正确 |
| `GET /cmdb/changes` | CiChangeController.globalChanges | ✅ 正确 |
| `GET /cmdb/changes/stats` | CiChangeController.stats | ✅ 正确 |
| CSV 导入全部 5 个端点 | CsvImportController | ✅ 正确 |

### 11.3 新增需对接的 API 路径（P1 — 后端已就绪）

| 后端端点 | 用途 | 需新增的前端调用位置 |
|---|---|---|
| `GET /cmdb/instances/{id}/history` | 实例变更历史 tab | 实例详情页 Tab「变更历史」 |
| `GET /cmdb/instances/{id}/devices` | 关联设备凭证 | 实例详情页 Tab「关联资源」 |
| `GET /cmdb/instances/{id}/change-docs` | 关联变更文档 | 实例详情页 Tab「关联资源」 |
| `GET /cmdb/instances/{id}/daily-reports` | 关联日报 | 实例详情页 Tab「关联资源」 |
| `GET /cmdb/alerts` | 全局告警列表 | 新页面 `/cmdb/alerts` |
| `GET /cmdb/alerts/by-instance/{instanceId}` | 实例告警 | 实例详情页 Tab「告警」 |
| `POST /cmdb/alerts/{id}/acknowledge` | 确认告警 | 告警列表页 + 实例详情告警 Tab |
| `GET /cmdb/association-kinds/{kind}/attributes` | 关联属性定义 | 配置管理页 |
| `POST /cmdb/association-kinds/{kind}/attributes` | 新增关联属性定义 | 配置管理页 |
| `PUT /cmdb/association-kinds/{kind}/attributes/{attrId}` | 编辑关联属性定义 | 配置管理页 |
| `DELETE /cmdb/association-kinds/{kind}/attributes/{attrId}` | 删除关联属性定义 | 配置管理页 |

---

## 12. 架构决策

### AD-1: 实例详情页 Tab 化重构

**决策**: 完全重构 `instances/by-model/[modelId]/[id]/page.tsx`，从折叠面板改为 shadcn/ui `Tabs` 布局。

**Tab 结构**:
```
[基本信息]（默认）| [关联关系] | [变更历史] | [告警] | [关联资源]
```

**懒加载策略**: 每个 Tab 内容用 `useState` 控制 `activeTab`，仅在 `activeTab === 'xxx'` 时才触发对应的 `useQuery`（`enabled` 条件）。

**数据流**:
```
GET /cmdb/instances/{id}
  ↓
基本信息 Tab（属性分组展示 + 编辑模式）
  ↓ activeTab === 'relations'
GET /cmdb/instances/{id}/relations → 关联关系 Tab
  ↓ activeTab === 'history'
GET /cmdb/instances/{id}/history → 变更历史 Tab
  ↓ activeTab === 'alerts'
GET /cmdb/alerts/by-instance/{id} → 告警 Tab
  ↓ activeTab === 'resources'
GET /cmdb/instances/{id}/devices
GET /cmdb/instances/{id}/change-docs
GET /cmdb/instances/{id}/daily-reports → 关联资源 Tab
```

**组件拆分**: 从 800+ 行的单文件页面拆为 Tab 子组件，各自管理 query + 状态：

```
components/cmdb/instance-detail/
├── InstanceBasicTab.tsx        # 基本信息 + 属性编辑
├── InstanceRelationsTab.tsx    # 关联关系列表 + 增删
├── InstanceHistoryTab.tsx      # 变更历史时间线
├── InstanceAlertsTab.tsx       # 告警列表 + acknowledge
└── InstanceResourcesTab.tsx    # 关联凭证/变更单/日报
```

### AD-2: API 路径统一 — 废弃 `/cmdb/meta/*` 命名空间

**决策**: 前端全面切换到后端实际的 API 路径：
- `/cmdb/meta/models` → `/cmdb/models`
- `/cmdb/meta/association-defs` → 从模型数据推断（OQ-1 决策）
- `/cmdb/meta/association-kinds` → 从模型数据推断
- `/cmdb/rel/*` → `/cmdb/instances/{id}/relations`

**影响范围**: `admin/page.tsx`、`admin/models/[modelId]/page.tsx`、`instances/by-model/[modelId]/[id]/page.tsx`、`associations/page.tsx`、`associations/new/page.tsx`

**风险缓解**: 保留 `admin/page.tsx` 的旧 AssociationsTab 中的 association-kinds/defs 管理功能为只读模式（从模型数据展示），创建/删除功能标记为「需要后端补充端点」的 disabled 状态。不报错，只提示。

### AD-3: 侧边栏 CMDB 分组化

**决策**: 将侧边栏中 CMDB 相关的 3 个扁平导航项（模型、实例、变更）重组为可折叠 `NavGroup`，并新增告警和统计。

**修改文件**: `frontend/src/components/layout/Sidebar.tsx`

**结构变更**:
```
当前（扁平）:
  CMDB 模型 (/cmdb/models)
  CMDB 实例 (/cmdb/instances)
  CMDB 变更 (/cmdb/changes)
  IP 地址池 (/ipam)

改为（分组）:
  📦 CMDB (可折叠)
    ├─ CMDB 模型   (/cmdb/models)
    ├─ CMDB 实例   (/cmdb/instances)
    ├─ CMDB 变更   (/cmdb/changes)
    ├─ CMDB 告警   (/cmdb/alerts)     ← 新增
    └─ CMDB 统计   (/cmdb/changes/stats)  ← 新增
  🌐 IP 地址池 (/ipam)  ← 保持独立
```

**实现**: 将 CMDB 条目改为 `NavGroup` 类型（现有 Sidebar 已支持 `NavGroup` 结构），`resource: 'cmdb_instance'`, `action: 'read'`，`defaultOpen: true`。

### AD-4: 实例创建参数统一

**决策**: 所有创建实例的调用统一使用 `{ modelId, name, fieldsData }` 格式（匹配后端 `CreateInstanceRequest`）。

**影响**:
- `instances/by-model/[modelId]/new/page.tsx` — 已正确使用 `{ modelId, ... }`
- `instances/page.tsx` L122 — 需将 `{ model, ... }` 改为 `{ modelId, ... }`

### AD-5: 关联关系 body 格式统一

**决策**: 所有创建关联的调用统一使用后端 `CreateRelationRequest` 格式。

**后端期望**: `POST /cmdb/instances/{id}/relations` body:
```json
{
  "dstInstanceId": 123,
  "associationKind": "connected_to",
  "metadata": {}
}
```

**当前问题**: 
- `[id]/page.tsx` 内联对话框发送 `{ def_id, src_id, dst_id }` — 路径和 body 都错
- `associations/new/page.tsx` 发送 `{ dst_instance_id, association_kind }` — 路径正确但 body 字段名可能用 snake_case

**修正**: 统一为 `{ dstInstanceId, associationKind }` (camelCase，匹配后端 Java bean)。

### AD-6: 拓扑 PNG 导出方案

**决策**: 继续使用现有 `html-to-image` 库（已在 topology 页面中通过 `useRef(graphRef)` + `html-to-image` 实现）。PRD AC-6.4 要求分辨率 ≥ 1920×1080。

**实现**: 在现有 `CiTopologyGraph` 组件的导出逻辑中设置 `pixelRatio: 2`（对 1080p 屏幕 → 3840×2160 输出）。

**无需新 npm 依赖。**

---

## 13. 数据流图

### 13.1 实例详情页（重构后）

```
┌──────────────────────────────────────────────────────────────┐
│  Route: /cmdb/instances/by-model/[modelId]/[id]              │
│  useParams → { modelId, id }                                  │
│  usePermission('cmdb_instance', 'read')                       │
└───────────┬──────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│  useQuery: GET /cmdb/instances/{id}                          │
│  → CiInstanceDetailVO { id, modelId, modelName, name,        │
│      status, attrs: [{key,name,value,fieldType,groupName}] } │
│  queryKey: ['cmdb-instance', id]                              │
└───────────┬──────────────────────────────────────────────────┘
            │
            ▼
┌──── Tabs ────────────────────────────────────────────────────┐
│                                                               │
│  [基本信息] ← 默认 active                                      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ 渲染: 属性按 groupName 分组                               │ │
│  │ 编辑模式: renderEditField(attr, value, onChange)         │ │
│  │ 保存: PUT /cmdb/instances/{id} body { attrs }            │ │
│  │ 权限: cmdb_instance:update                               │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [关联关系] ← activeTab === 'relations'                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ useQuery: GET /cmdb/instances/{id}/relations             │ │
│  │ → [{ relationId, kind, kindName, srcInstance,            │ │
│  │      dstInstance, dstModelName }]                        │ │
│  │ 按 kindName 分组渲染                                      │ │
│  │ 删除: DELETE /cmdb/instances/{id}/relations/{relationId} │ │
│  │   权限: cmdb_relation:delete                             │ │
│  │ 添加: 内联选目标实例 (GET /cmdb/instances/search)         │ │
│  │   POST /cmdb/instances/{id}/relations                    │ │
│  │   body { dstInstanceId, associationKind }                │ │
│  │   权限: cmdb_relation:create                             │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [变更历史] ← activeTab === 'history'                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ useQuery: GET /cmdb/instances/{id}/history               │ │
│  │   ?page=&size=&from=&to=&operatorId=&action=             │ │
│  │ → Page<ChangeHistoryVO> { action, operatorName,          │ │
│  │      timestamp, before, after }                          │ │
│  │ 渲染: <ChangeRecordItem> + <JsonDiffView> 时间线          │ │
│  │ 过滤: 时间范围 / 操作人 / 动作类型                         │ │
│  │ 权限: cmdb_change:read                                   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [告警] ← activeTab === 'alerts'                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ useQuery: GET /cmdb/alerts/by-instance/{id}              │ │
│  │ → [{ id, alertName, severity, status, summary,           │ │
│  │      triggeredAt }]                                      │ │
│  │ 渲染: 告警列表表格                                         │ │
│  │ 确认: POST /cmdb/alerts/{alertId}/acknowledge            │ │
│  │   权限: cmdb_alert:acknowledge                           │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                               │
│  [关联资源] ← activeTab === 'resources'                       │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ useQuery ×3 (并行):                                      │ │
│  │   GET /cmdb/instances/{id}/devices                       │ │
│  │     → [{ deviceId, name, ipAddr, credentialType }]       │ │
│  │   GET /cmdb/instances/{id}/change-docs                   │ │
│  │     → [{ docId, title, status, updatedAt }]              │ │
│  │   GET /cmdb/instances/{id}/daily-reports                 │ │
│  │     → [{ reportId, date, authorName }]                   │ │
│  │ 三列卡片或三段列表渲染                                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

### 13.2 CMDB 告警列表页（新增）

```
┌──────────────────────────────────────────────────────────────┐
│  Route: /cmdb/alerts (新增)                                   │
│  usePermission('cmdb_alert', 'read')                          │
└───────────┬──────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│  useState: status, severity, page, size                      │
│                                                               │
│  useQuery: GET /cmdb/alerts                                   │
│    ?status=&severity=&page=&size=                             │
│  → Page<CmdbAlertVO>                                          │
│  queryKey: ['cmdb-alerts', { status, severity, page }]        │
└───────────┬──────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────────────────┐
│  表格:                                                        │
│  [告警名称] [关联 CI](link) [严重级别](badge) [状态]           │
│  [摘要] [触发时间] [操作: 确认]                                │
│                                                               │
│  确认: useMutation                                            │
│    POST /cmdb/alerts/{id}/acknowledge                         │
│    成功 → invalidate ['cmdb-alerts']                          │
│    权限: cmdb_alert:acknowledge                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 14. 新增/修改文件清单

### 14.1 新增文件

| 文件路径 | 说明 | 预估行数 |
|---|---|---|
| `frontend/src/app/(dashboard)/cmdb/alerts/page.tsx` | CMDB 告警列表页 | ~180 |
| `frontend/src/components/cmdb/instance-detail/InstanceBasicTab.tsx` | 基本信息 Tab（从原页面抽取） | ~200 |
| `frontend/src/components/cmdb/instance-detail/InstanceRelationsTab.tsx` | 关联关系 Tab | ~180 |
| `frontend/src/components/cmdb/instance-detail/InstanceHistoryTab.tsx` | 变更历史 Tab | ~120 |
| `frontend/src/components/cmdb/instance-detail/InstanceAlertsTab.tsx` | 告警 Tab | ~100 |
| `frontend/src/components/cmdb/instance-detail/InstanceResourcesTab.tsx` | 关联资源 Tab | ~150 |

### 14.2 修改文件

| 文件路径 | 修改内容 | 关联 AC |
|---|---|---|
| `instances/by-model/[modelId]/[id]/page.tsx` | **重写**：Tab 化布局 + API 路径修正 + 拆分子组件 | AC-1.1~1.7, AC-2.1~2.5 |
| `instances/by-model/[modelId]/[id]/associations/page.tsx` | API 路径修正 (instance GET, rel GET/DELETE) | AC-1.1, 1.4, 1.6 |
| `instances/by-model/[modelId]/[id]/associations/new/page.tsx` | API 路径修正 (instance GET, search, defs) | AC-1.1, 1.7 |
| `instances/by-model/[modelId]/page.tsx` | API 路径修正 (model GET, instance list/delete) | AC-1.3, 1.8 |
| `instances/by-model/[modelId]/new/page.tsx` | API 路径修正 (model GET) | AC-1.3 |
| `instances/page.tsx` | 参数名 model→modelId (AC-1.8), CsvImportDialog 集成 | AC-1.8, AC-4.1 |
| `admin/page.tsx` | API 路径修正 (/meta/models → /models)，AssociationsTab 适配 | AC-1.3 |
| `admin/models/[modelId]/page.tsx` | API 路径修正 (/meta/ → /models/) | AC-1.3 |
| `components/layout/Sidebar.tsx` | CMDB NavGroup 化 + 新增告警/统计导航项 | AC-3.5, AC-7.2 |
| `topology/[instanceId]/page.tsx` | PNG 导出 pixelRatio 调优 (AC-6.4，如未达标) | AC-6.4 |

### 14.3 不修改的文件（已正确工作）

- `cmdb/models/page.tsx` — `/cmdb/models` CRUD 正确
- `cmdb/changes/page.tsx` — `/cmdb/changes` 正确
- `cmdb/changes/stats/page.tsx` — `/cmdb/changes/stats` 正确
- `cmdb/instances/2d-view/page.tsx` — `/cmdb/instances/2d-view` 正确
- `cmdb/impact/[instanceId]/page.tsx` — `/cmdb/instances/{id}/impact` 正确
- `components/cmdb/CsvImportDialog.tsx` — CSV 导入 5 个端点全部正确
- `components/cmdb/CiInstanceSelect.tsx` — search 端点正确
- `components/cmdb/CiLinkSelector.tsx` — search 端点正确
- `components/cmdb/ChangeRecordItem.tsx` — 纯展示组件
- `components/cmdb/JsonDiffView.tsx` — 纯展示组件
- `components/cmdb/CiTopologyGraph.tsx` — 拓扑图组件

---

## 15. 路由变更

| 路由 | 类型 | 说明 |
|---|---|---|
| `/cmdb/alerts` | **新增** | CMDB 告警列表页 |
| `/cmdb/instances/by-model/[modelId]/[id]` | **重构** | Tab 化重写 |
| 其他路由 | 不变 | — |

---

## 16. 权限矩阵

| 功能 | 权限 key | 说明 |
|---|---|---|
| 实例详情页查看 | `cmdb_instance:read` | Tab 化后仍由父页面守卫 |
| 实例编辑 | `cmdb_instance:update` | 基本信息 Tab 编辑模式 |
| 关联查看 | `cmdb_relation:read` | 关联关系 Tab |
| 关联创建 | `cmdb_relation:create` | 关联关系 Tab 添加 |
| 关联删除 | `cmdb_relation:delete` | 关联关系 Tab 删除 |
| 变更历史 | `cmdb_change:read` | 变更历史 Tab |
| 告警查看 | `cmdb_alert:read` | 告警 Tab + 告警列表页 |
| 告警确认 | `cmdb_alert:acknowledge` | 告警列表 + 实例告警 Tab |
| 关联资源 | `cmdb_instance:read` | 关联资源 Tab |
| CSV 导入 | `cmdb_instance:create` + `cmdb_instance:update` | CsvImportDialog |
| 关联属性管理 | `cmdb_model:update` | 配置管理页 |

---

## 17. 风险评估

| 风险 | 级别 | 缓解 |
|---|---|---|
| 实例详情页重写引入回归 | **中** | 逐 Tab 测试；保留原页面的属性编辑逻辑；先修 API 路径再重构 Tab |
| `/cmdb/meta/association-defs` 无替代端点导致关联创建不可用 | **中** | 从 `GET /cmdb/models/{id}` 返回的 associationDefs 字段获取；如字段不存在则用关联列表返回的 kind 信息做可用选项 |
| admin 页 AssociationsTab 的 kind/def 管理功能失效 | **低** | 将创建/删除按钮 disabled + tooltip「需要后端补充端点」；不影响只读展示 |
| body 字段名 camelCase vs snake_case 不匹配 | **低** | 后端 Spring 默认 Jackson camelCase；审计确认 `CreateRelationRequest` 使用 camelCase 字段名 |
| 懒加载 Tab 切换闪烁 | **低** | 使用 TanStack Query `keepPreviousData` + 骨架屏 |
| 侧边栏分组化影响用户习惯 | **低** | `defaultOpen: true` 保持展开 |

---

## 18. 实现顺序建议（供 Engineer 参考）

### Phase 1: P0 API 路径修正（先行，不依赖 Tab 重构）
1. 修 `instances/by-model/[modelId]/[id]/page.tsx` 的 GET/PUT 实例路径（去 modelId 段）
2. 修关联 CRUD 路径（`/cmdb/rel/*` → `/cmdb/instances/{id}/relations`）
3. 修模型查询路径（`/cmdb/meta/models` → `/cmdb/models`）
4. 修实例列表路径（path param → query param）
5. 修创建实例参数名（`model` → `modelId`）
6. 修搜索路径（`/cmdb/rel/search` → `/cmdb/instances/search`）

### Phase 2: P1 实例详情页 Tab 化
7. 拆分子组件到 `components/cmdb/instance-detail/`
8. 重写主页面为 Tabs 布局
9. 实现懒加载逻辑
10. 新增「变更历史」Tab
11. 新增「告警」Tab
12. 新增「关联资源」Tab

### Phase 3: P1 新页面 + 集成
13. 新增 `/cmdb/alerts` 告警列表页
14. CsvImportDialog 集成到实例列表页（如果尚未集成）
15. 侧边栏 NavGroup 化 + 新增导航项

### Phase 4: P2 增强
16. 关联属性定义管理 UI
17. 拓扑对比模式入口（已存在于 topology 页面，确认可用即可）
18. 拓扑 PNG 导出分辨率调优

---

## 19. 验证检查点

| 检查点 | 验证方法 |
|---|---|
| AC-1.9 全页面无 404 | 浏览器 DevTools Network 面板逐页面检查 |
| AC-2.1 Tab 布局 | 5 个 Tab 可切换 |
| AC-2.5 懒加载 | 切 Tab 时 Network 面板才出现对应请求 |
| AC-3.1~3.5 告警页 | 路由可访问 + 数据加载 + 过滤 + 确认操作 |
| AC-4.1~4.5 CSV 导入 | 实例列表 → 导入按钮 → 预览 → 执行 → 结果 |
| AC-7.2 侧边栏 | CMDB 分组可折叠 + 包含告警项 |

---

## 20. 向后兼容性确认

- ✅ 不修改任何后端代码（Controller / Service / Mapper / Entity）
- ✅ 不修改已正确工作的前端页面（models, changes, changes/stats, impact, 2d-view, topology）
- ✅ `changedoc` 前端的 `ci_selector` 通过 `/cmdb/instances/search` 工作 — 不受影响
- ✅ CsvImportDialog API 路径正确 — 不修改
- ✅ 不引入新 npm 依赖
