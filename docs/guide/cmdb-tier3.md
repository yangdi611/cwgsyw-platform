# CMDB Tier 3 — 可视化指南

> 模块：CMDB / 变更历史增强 + 变更统计面板 + 拓扑图可视化增强 + 2D 分组视图 + 全局实例搜索
> 对应 Flyway V27、V29、V32–V34，后端 + 前端全部完成

---

## 目录

1. [概述](#概述)
2. [数据模型变更](#数据模型变更)
3. [API 参考](#api-参考)
4. [权限控制（RBAC）](#权限控制rbac)
5. [核心功能详解](#核心功能详解)
6. [前端页面与组件](#前端页面与组件)
7. [性能与缓存策略](#性能与缓存策略)
8. [设计决策与注意事项](#设计决策与注意事项)

---

## 概述

Tier 3 让 CMDB 从「能用」变成「好盯」——变更可追溯（diff 可视化）、拓扑可交互（展开/过滤/对比）、变动可度量（统计面板）、物理可布局（2D 视图）、资产可搜索（全局搜索）。

### Tier 3 包含 6 项功能

| # | 功能 | 后端 | 前端 | 说明 |
|---|------|------|------|------|
| 1 | 变更历史 V2（字段级 diff） | ✅ | ✅ | 时间线 + JSONB diff 高亮 + 多维过滤 + 分页 |
| 2 | 变更统计面板 | ✅ | ✅ | 今日/周/月变更卡片 + 每日趋势 + Top 10 活跃实例 |
| 3 | 拓扑图可视化增强 | ✅ | ✅ | 模型着色 + 状态边框 + 展开/折叠 + 过滤 + 对比模式 + PNG 导出 |
| 4 | 2D 分组视图 | ✅ | ✅ | 按属性分组网格展示实例 |
| 5 | 全局实例搜索 | ✅ | ✅ | 跨模型关键词搜索 |
| 6 | 模型可视化字段 | ✅ | ✅ | `ci_model.color` + `ci_model.enable_2d_view` |

### 新增文件

```
后端:
module/cmdb/
  service/
    CiChangeService.java           (344行) 变更历史 V2 + 统计 + Redis 缓存
    Ci2DViewService.java           (114行) 2D 分组视图
    CiTopologyCompareService.java  (343行) 拓扑时间点对比（audit_log 回放算法）
  controller/
    CiChangeController.java        (63行)  /api/cmdb/changes + /api/cmdb/instances/{id}/history
  dto/changes/
    ChangeHistoryV2VO.java         变更记录（含 changedFields + summary）
    ChangeStatsVO.java             统计聚合
    ActionCountVO.java             动作计数（创建/更新/删除/总计）
    DailyCountVO.java              每日计数
    TopInstanceVO.java             Top 10 实例
  dto/topology/
    TopologyNodeV2VO.java          增强节点（含 fieldsData）
    TopologyResultV2VO.java        增强拓扑结果
    TopologyCompareVO.java         对比结果
    TopologyCompareEdgeVO.java     对比边（含 diff status）
  dto/instance/
    TwoDimensionViewVO.java        2D 视图结果
    TwoDimGroupVO.java             分组
    TwoDimCellVO.java              网格单元格（实例摘要）
    GroupableAttrVO.java           可分组属性

前端:
app/(dashboard)/cmdb/
  changes/page.tsx                 (349行) 变更历史列表页
  changes/stats/page.tsx           (247行) 变更统计面板
  instances/2d-view/page.tsx       (241行) 2D 视图页面
  topology/[instanceId]/page.tsx   (462行) 拓扑图页面（增强）
components/cmdb/
  JsonDiffView.tsx                 (163行) 字段级 JSONB diff 渲染器
  CiTopologyGraph.tsx              (537行) ReactFlow 拓扑图组件
  ChangeRecordItem.tsx             (124行) 变更记录时间线条目
```

---

## 数据模型变更

### V27: ci_model 可视化字段

```sql
ALTER TABLE ci_model
ADD COLUMN color VARCHAR(7),             -- 拓扑图节点颜色（如 '#1890FF'）
ADD COLUMN enable_2d_view BOOLEAN NOT NULL DEFAULT FALSE;  -- 是否启用 2D 视图

-- 内置模型默认颜色
UPDATE ci_model SET color = '#1890FF' WHERE name = 'host';
UPDATE ci_model SET color = '#52C41A' WHERE name = 'app';
-- 主机模型默认启用 2D 视图
UPDATE ci_model SET enable_2d_view = TRUE WHERE name = 'host';
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `color` | VARCHAR(7) | HEX 颜色码（如 `#1890FF`），用于拓扑图节点着色。NULL 时前端自动按模型名 hash 生成颜色 |
| `enable_2d_view` | BOOLEAN | 是否在 2D 视图中展示此模型的实例。仅 `true` 的模型可调用 2D 视图 API |

### V29: 变更历史查询索引

```sql
-- 实例变更历史分页查询专用索引
CREATE INDEX idx_audit_cmdb_instance_changes
ON audit_log(tenant_id, target_type, target_id, created_at DESC)
WHERE module = 'cmdb' AND target_type = 'ci_instance';

-- 统计查询索引
CREATE INDEX idx_audit_cmdb_stats
ON audit_log(tenant_id, target_type, action, created_at)
WHERE module = 'cmdb';
```

### V33: cmdb_change 权限

```sql
INSERT INTO sys_resource (code, name, actions, sort_order)
VALUES ('cmdb_change', 'CMDB 变更历史', '["read"]', 53);

INSERT INTO sys_permission (resource_id, action, code, name)
VALUES (..., 'read', 'cmdb_change:read', 'CMDB 变更历史-查看');

-- 分配给 super_admin / admin / group_leader / member
```

### V32 + V34: 跨模块关联（Tier 4 共享）

```sql
-- V32: device 表关联 CI 实例
ALTER TABLE device ADD COLUMN ci_instance_id BIGINT;

-- V34: 日报关联 CI 实例
ALTER TABLE daily_report ADD COLUMN ci_instance_ids JSONB DEFAULT '[]'::jsonb;
```

---

## API 参考

所有 API 需要 JWT 认证，通过 `@PreAuthorize` 或 `@PreAuthorize("hasPermission(...)")` 进行权限检查。

### 1. 变更历史 — 实例级别

```
GET /api/cmdb/instances/{instanceId}/history
GET /api/cmdb/instances/{id}/history          (CiInstanceController 别名)
```

**权限**: `cmdb_change:read`

**查询参数**:

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `from` | String | null | 起始时间（ISO 格式 `yyyy-MM-ddTHH:mm:ss`） |
| `to` | String | null | 截止时间 |
| `operatorId` | Long | null | 操作人 ID |
| `action` | String | null | 动作类型：`create_instance` / `update_instance` / `delete_instance` |
| `page` | int | 1 | 页码 |
| `size` | int | 20 | 每页条数 |

**响应**: `PageResult<ChangeHistoryV2VO>`

```json
{
  "records": [
    {
      "id": 42,
      "action": "update_instance",
      "operator_id": 1,
      "operator_name": "admin",
      "before_json": { "name": "web-01", "status": "running", "fields_data": { "ip": "10.0.0.1" } },
      "after_json": { "name": "web-01", "status": "stopped", "fields_data": { "ip": "10.0.0.1" } },
      "changed_fields": ["status"],
      "summary": "修改了 1 个字段: status",
      "created_at": "2026-06-14T10:30:00"
    }
  ],
  "total": 42,
  "page": 1,
  "size": 20
}
```

**字段说明**:

| 字段 | 说明 |
|------|------|
| `changed_fields` | 运行时计算的字段级 diff（比较 before_json 和 after_json 的 key 集合） |
| `summary` | 人类可读的变更摘要，如「修改了 3 个字段: name, status, owner」或「创建了实例」 |

### 2. 变更历史 — 全局

```
GET /api/cmdb/changes
```

**权限**: `cmdb_change:read`

**查询参数**:

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `entityType` | String | `ci_instance` | 实体类型：`ci_instance` 或 `ci_instance_rel` |
| `entityId` | Long | null | 指定实体 ID |
| `modelId` | String | null | 按模型过滤（仅 `ci_instance` 有效） |
| `from` | String | null | 起始时间 |
| `to` | String | null | 截止时间 |
| `operatorId` | Long | null | 操作人 |
| `action` | String | null | 动作类型 |
| `page` | int | 1 | |
| `size` | int | 20 | |

**响应**: 同实例级别，`PageResult<ChangeHistoryV2VO>`

### 3. 变更统计

```
GET /api/cmdb/changes/stats
```

**权限**: `cmdb_change:read`

**查询参数**:

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `from` | String | 30 天前 | 统计起始日期 |
| `to` | String | 明天 | 统计截止日期 |
| `modelId` | String | null | 按模型过滤 |

**响应**: `ChangeStatsVO`

```json
{
  "today": { "created": 2, "updated": 5, "deleted": 0, "total": 7 },
  "this_week": { "created": 10, "updated": 25, "deleted": 2, "total": 37 },
  "this_month": { "created": 50, "updated": 120, "deleted": 5, "total": 175 },
  "daily_breakdown": [
    { "date": "2026-06-01", "created": 3, "updated": 8, "deleted": 1 },
    { "date": "2026-06-02", "created": 1, "updated": 5, "deleted": 0 }
  ],
  "top10_instances": [
    { "instance_id": 101, "instance_name": "web-01", "model_id": "host", "model_name": "主机", "change_count": 42 }
  ]
}
```

### 4. 拓扑图

```
GET /api/cmdb/topology/{instanceId}?depth=2
```

**权限**: `cmdb_instance:read`

**查询参数**:

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `depth` | int | 5 | BFS 遍历深度（最大 10） |

**响应**: `TopologyResultVO`

```json
{
  "nodes": [
    {
      "id": 1,
      "name": "web-01",
      "model_id": "host",
      "model_name": "主机",
      "model_color": "#1890FF",
      "status": "running",
      "owner": "ops-team",
      "is_root": true,
      "key_attrs": { "ip": "10.0.0.1", "cpu": 8 }
    }
  ],
  "edges": [
    { "src": 1, "dst": 2, "kind": "runs_on", "label": "运行于" }
  ]
}
```

**节点字段说明**:

| 字段 | 说明 |
|------|------|
| `model_color` | 来自 `ci_model.color`。NULL 时前端 hash 生成 |
| `key_attrs` | 从 `fields_data` 中提取 `is_list_show=true` 的属性键值对 |
| `is_root` | 是否为查询的根节点 |

### 5. 拓扑时间点对比

```
GET /api/cmdb/topology/{instanceId}/compare?fromTime=...&toTime=...&depth=3
```

**权限**: `cmdb_instance:read`

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `fromTime` | String | 是 | 起始时间点 |
| `toTime` | String | 是 | 截止时间点 |
| `depth` | int | 否 (默认 5) | BFS 遍历深度 |

**响应**: `TopologyCompareVO`

```json
{
  "added": [ { "id": 5, "name": "db-02", "model_id": "database", ... } ],
  "removed": [ { "id": 3, "name": "cache-01", "model_id": "cache", ... } ],
  "modified": [ { "id": 1, "name": "web-01", "status": "stopped", "fields_data": { ... } } ],
  "unchanged": [ { "id": 2, "name": "web-02", ... } ],
  "edges": [
    { "src": 1, "dst": 5, "kind": "depends_on", "label": "依赖", "status": "added" },
    { "src": 1, "dst": 3, "kind": "depends_on", "label": "依赖", "status": "removed" }
  ]
}
```

### 6. 2D 分组视图

```
GET /api/cmdb/instances/2d-view?modelId=host&groupBy=idc
```

**权限**: `cmdb_instance:read`

**约束**: 模型必须 `enable_2d_view = true`；`groupBy` 属性必须是 `singlechar` 或 `enum` 类型。

**查询参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `modelId` | String | 是 | 模型标识 |
| `groupBy` | String | 是 | 分组字段 key（必须是 string/enum 类型属性） |

**响应**: `TwoDimensionViewVO`

```json
{
  "model_id": "host",
  "model_name": "主机",
  "group_by": "idc",
  "groups": [
    {
      "group_value": "北京机房",
      "instances": [
        { "id": 1, "name": "web-01", "status": "running", "owner": "ops" },
        { "id": 2, "name": "web-02", "status": "running", "owner": "ops" }
      ]
    },
    {
      "group_value": "__未分组__",
      "instances": [ { "id": 3, "name": "web-03", "status": "stopped", "owner": null } ]
    }
  ],
  "groupable_attrs": [
    { "field_key": "idc", "name": "机房", "field_type": "singlechar" },
    { "field_key": "rack", "name": "机架", "field_type": "singlechar" }
  ]
}
```

### 7. 全局实例搜索

```
GET /api/cmdb/instances/search?keyword=web&size=10
```

**权限**: `cmdb_instance:read`

**响应**: `PageResult<CiInstanceSearchVO>`

```json
{
  "records": [
    { "id": 1, "name": "web-01", "model_id": "host", "model_name": "主机" },
    { "id": 2, "name": "web-02", "model_id": "host", "model_name": "主机" }
  ],
  "total": 2,
  "page": 1,
  "size": 10
}
```

---

## 权限控制（RBAC）

### 新增资源

| resource | actions | 分配角色 |
|----------|---------|----------|
| `cmdb_change` | read | super_admin, admin, group_leader, member |

### 权限矩阵

| API | 权限要求 |
|-----|----------|
| `GET /api/cmdb/instances/{id}/history` | `cmdb_change:read` |
| `GET /api/cmdb/changes` | `cmdb_change:read` |
| `GET /api/cmdb/changes/stats` | `cmdb_change:read` |
| `GET /api/cmdb/topology/{instanceId}` | `cmdb_instance:read` |
| `GET /api/cmdb/topology/{instanceId}/compare` | `cmdb_instance:read` |
| `GET /api/cmdb/instances/2d-view` | `cmdb_instance:read` |
| `GET /api/cmdb/instances/search` | `cmdb_instance:read` |

注意：变更历史有两个 controller 入口 — `CiChangeController`（`/api/cmdb/changes`、`/api/cmdb/instances/{instanceId}/history`）和 `CiInstanceController`（`/api/cmdb/instances/{id}/history`、`/api/cmdb/instances/changes`），两者都委托到同一个 `CiChangeService`。

---

## 核心功能详解

### 功能 1: 变更历史 V2（字段级 diff）

**架构决策（AD-1）**: 不新建变更日志表，而是复用 `audit_log` 的 `before_json` / `after_json` 完整快照，运行时计算 `changed_fields`。

**changed_fields 计算算法** (`CiChangeService.computeChangedFields`):

```
1. 取 before_json 和 after_json 的 key 并集
2. 遍历每个 key:
   - 仅在 before 中 → 删除
   - 仅在 after 中 → 新增
   - 两边都有但值不同 → 修改
3. 生成 summary:
   - ≤3 个变更字段: "修改了 N 个字段: field1, field2"
   - >3 个: "修改了 N 个字段: field1, field2, field3 等"
   - 创建/删除: "创建了实例" / "删除了实例"
```

**前端渲染** (`JsonDiffView.tsx`):

- 纯 React 实现，无外部 diff 库
- 每个字段渲染为一行，颜色编码:
  - 🔴 红色 = 删除（before 有，after 无）
  - 🟢 绿色 = 新增（after 有，before 无）
  - 🟡 黄色 = 修改（两边有，值不同）
  - ⚪ 灰色 = 未变
- 变更字段排在前面，未变字段排后面
- 可通过 `hideUnchanged` prop 隐藏未变字段

### 功能 2: 变更统计面板

**架构决策（AD-3）**: 全局 Redis 缓存，key 格式 `cmdb:stats:{modelId}:{from}:{to}`，TTL = 300 秒（5 分钟）。

**统计维度**:

| 维度 | 时间范围 | 数据源 |
|------|----------|--------|
| 今日变更 | 今天 00:00 ~ 明天 00:00 | `audit_log` COUNT BY action |
| 本周变更 | 本周一 00:00 ~ 明天 00:00 | 同上 |
| 本月变更 | 本月 1 日 00:00 ~ 明天 00:00 | 同上 |
| 每日趋势 | from ~ to | `GROUP BY DATE(created_at), action` |
| Top 10 实例 | from ~ 现在 | `GROUP BY target_id ORDER BY cnt DESC LIMIT 10` |

**缓存失效**: 实例 CRUD 操作后调用 `CiChangeService.invalidateStatsCache()`，使用 `redisTemplate.keys("cmdb:stats:*")` 删除所有统计缓存 key。

**前端** (`changes/stats/page.tsx`):
- 三张概览卡片（今日/本周/本月），每张显示总数 + 创建/更新/删除分项
- 每日趋势条形图（纯 CSS，绿=新增、蓝=修改、红=删除）
- Top 10 实例表格（排名、名称、模型、变更次数）

### 功能 3: 拓扑图可视化增强

**架构决策（AD-2）**: 拓扑对比基于 audit_log 逆向回放，无快照表。

**拓扑对比重建算法** (`CiTopologyCompareService.reconstructTopology`):

```
给定时间点 T:
1. 获取当前拓扑（从 root BFS，深度 N）
2. 查询 audit_log 中 createdAt > T 的所有 cmdb 变更
3. 逆向 apply（从最新到最早）:
   - create_instance → 从快照中删除此节点
   - delete_instance → 从 beforeJson 恢复此节点
   - update_instance → 回退 name/status/owner/fieldsData
   - create_relation → 从快照中删除此边
   - delete_relation → 从 beforeJson 恢复此边
4. 得到 T 时刻的拓扑快照
```

对比两个时间点 A、B 的快照:
- 节点: added（B 有 A 无）、removed（A 有 B 无）、modified（共有但 status 或 fieldsData 不同）、unchanged
- 边: 按 `src-dst-kind` 三元组比较，标记 added/removed/unchanged

**前端** (`CiTopologyGraph.tsx`):
- 基于 `@xyflow/react`（ReactFlow）
- 自定义节点组件 `CiNode`:
  - 模型颜色: 来自 `model_color`，NULL 时按 modelId hash 生成 HSL 色
  - 状态边框: running/online = 绿色实线、stopped/offline = 红色虚线、maintenance = 黄色虚线
  - 悬浮 tooltip: 名称、模型、状态、负责人、关键属性（`is_list_show=true`）
  - 展开/折叠: 点击有下游的节点切换折叠状态
  - 对比模式 diff badge: 新增/删除/修改/未变
- BFS 层级布局（每层 x 间隔 230px，同层 y 均匀分布）
- MiniMap + Controls + Background
- 过滤面板: 按模型/状态复选，未选节点半透明（保持连通性）

**PNG 导出**: 使用 `html-to-image` 的 `toPng`，pixelRatio 自动计算确保 ≥ 1920px 宽度。

### 功能 4: 2D 分组视图

**架构决策（AD-4）**: 仅 `singlechar` 和 `enum` 类型属性可用于分组。

**逻辑** (`Ci2DViewService.get2DView`):
1. 校验模型存在且 `enable_2d_view = true`
2. 加载模型属性，筛选可分组属性（`singlechar` / `enum`）
3. 校验 `groupBy` 参数是否为可分组属性
4. 加载该模型所有未删除实例
5. 按 `fields_data[groupBy]` 分组，null/空值 → `__未分组__`
6. 每组内按名称排序
7. 返回分组结果 + 可分组属性列表（供前端下拉切换）

**前端** (`instances/2d-view/page.tsx`):
- 模型选择器 + 分组字段选择器
- 每个 group 渲染为 Card，Card header 显示组名 + 实例计数
- Card body 为响应式网格（1~4 列），每个单元格显示实例名 + 状态 badge + owner
- 点击单元格跳转到实例详情页

### 功能 5: 全局实例搜索

**逻辑** (`CiInstanceService.search`):
- 跨所有模型搜索，按实例名 `LIKE %keyword%`
- 按更新时间倒序，LIMIT size（默认 10）
- 返回轻量 VO: id + name + modelId + modelName

### 功能 6: 模型可视化字段

`ci_model` 表新增两个字段:
- `color`: 拓扑图节点颜色，可在模型管理页面自定义
- `enable_2d_view`: 控制是否在 2D 视图中展示

这两个字段通过 `CiModelVO` 返回给前端，在模型管理页面可编辑。

---

## 前端页面与组件

### 页面路由

| 路由 | 页面 | 权限 |
|------|------|------|
| `/cmdb/changes` | 变更历史列表 | `cmdb_change:read` |
| `/cmdb/changes/stats` | 变更统计面板 | `cmdb_change:read` |
| `/cmdb/instances/2d-view` | 2D 分组视图 | `cmdb_instance:read` |
| `/cmdb/topology/[instanceId]` | 拓扑图（增强） | `cmdb_instance:read` |

### 组件清单

| 组件 | 用途 | 关键特性 |
|------|------|----------|
| `JsonDiffView` | 字段级 JSONB diff | 纯 React，颜色编码，可隐藏未变字段 |
| `ChangeRecordItem` | 变更记录时间线条目 | 动作 badge + 操作人 + 摘要 + 可展开 diff |
| `CiTopologyGraph` | ReactFlow 拓扑图 | 模型着色、状态边框、展开/折叠、过滤、对比模式、PNG 导出 |

### 前端约定

- 所有 API 通过 `@/lib/api`（axios instance），baseURL = `/api`
- 数据获取使用 TanStack Query v5
- 权限检查: `usePermission().hasPermission(resource, action)`
- 后端 JSON 序列化使用全局 SNAKE_CASE 策略，前端接口类型使用 snake_case
- 组件使用 shadcn/ui（Button、Card、Badge、Table、Select、Input、Skeleton 等）

---

## 性能与缓存策略

### 索引

| 索引名 | 用途 |
|--------|------|
| `idx_audit_cmdb_instance_changes` | 实例变更历史分页查询（partial index on `module='cmdb' AND target_type='ci_instance'`） |
| `idx_audit_cmdb_stats` | 变更统计聚合查询 |
| `idx_audit_cmdb_target` (V19) | 通用 CMDB audit_log 查询 |

### Redis 缓存

| Key Pattern | TTL | 用途 | 失效策略 |
|-------------|-----|------|----------|
| `cmdb:stats:{modelId}:{from}:{to}` | 5 分钟 | 变更统计面板 | 实例 CRUD 后 `invalidateStatsCache()` 删除所有 `cmdb:stats:*` |

### 性能指标（PRD 目标）

| 指标 | 目标 |
|------|------|
| 变更历史查询 P95 | < 300ms（复合索引已覆盖） |
| 拓扑对比重建（< 500 节点） | < 2s |
| 统计 API 缓存命中率 | > 95% |

---

## 设计决策与注意事项

### AD-1: 变更历史 diff — 保留完整 JSONB + 运行时计算 changed_fields

**决策**: 不改变 `audit_log` 存储策略，`changed_fields[]` 在后端运行时计算。

**理由**: 完整快照对未来扩展更有价值（回滚、审计追溯），100k 条记录规模下 JSONB 存储开销可忽略（单条 < 2KB）。

### AD-2: 拓扑对比 — 基于 audit_log 重建历史快照（无快照表）

**决策**: 对比模式从 `audit_log` 反推历史拓扑，无需新建快照表。

**理由**: 快照表引入存储膨胀和调度复杂度。当前规模（< 500 节点）下从 audit_log 重建开销可接受（< 2s）。如规模增长，Phase 4 可引入增量快照策略。

### AD-3: 变更统计缓存 — 全局 Redis 缓存（不区分权限）

**决策**: 统计 API 走全局 Redis 缓存，不区分用户权限。

**理由**: MVP 单租户场景，统计只返回计数（不暴露具体字段值），无信息泄露风险。

### AD-4: 2D 视图 group_by — 仅支持 string + enum 类型属性

**决策**: 只有 `singlechar` 和 `enum` 类型属性可用于 2D 视图分组。

**理由**: 数字、布尔、日期类型不适合离散分组。

### 注意事项

1. **双 Controller 入口**: `CiChangeController` 和 `CiInstanceController` 都暴露了变更历史端点。前者是 Tier 3 新增的主入口（`/api/cmdb/changes`），后者是向后兼容的别名。

2. **序列化**: 后端使用全局 Jackson SNAKE_CASE 策略，所有 JSON 字段名为 snake_case（如 `changed_fields`、`model_color`、`created_at`）。

3. **拓扑对比深度**: 对比 API 的 `depth` 参数同时控制当前拓扑 BFS 深度和 audit_log 查询范围。深度越大，重建计算量越高。

4. **统计缓存 key 中的 from/to**: 如果调用方不传 from/to，后端使用默认值（30 天前 ~ 明天），缓存 key 中包含这些默认值，确保不同默认时间段不会缓存冲突。

5. **前端颜色 fallback**: 当 `ci_model.color` 为 NULL 时，前端使用 FNV-1 hash 算法按 modelId 生成确定性 HSL 颜色，确保同一模型颜色一致。

6. **`__未分组__` 约定**: 2D 视图中，当实例的 `fields_data[groupBy]` 为 null 或不存在时，归入 `__未分组__` 组。
