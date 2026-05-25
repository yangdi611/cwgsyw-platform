# CMDB Phase 4：拓扑树 + 变更文档影响范围打通 — 设计规格

**日期：** 2026-05-26
**状态：** 已批准，待实施
**分支：** `feature/cmdb`

---

## 目标

两个功能合并一个实施周期：

1. **拓扑树**：以 React Flow 可视化 CI 实例的关联关系图，提供实例详情页内嵌预览和独立全屏页两个入口
2. **变更文档影响范围打通**：在变更文档模板中新增 `ci_selector` 字段类型，允许在变更文档中选择受影响的 CI 实例，选中后自动展示 2 层关联 CI 作为候选建议

---

## 前提条件

- Phase 3 已完成：`ci_instance_rel` 表 + `CiInstanceRelService.getRelations()` + `CiInstanceRelMapper.findByInstance()`
- `ci_association_def`、`ci_association_kind` 已有 `srcToDst/dstToSrc` 标签
- 现有 `change_doc_field.field_type` 为 VARCHAR，支持直接扩展新值，无需 DB 迁移

---

## 架构：后端拓扑接口（BFS 单接口）

新增 `GET /api/cmdb/topology/{instanceId}?depth=2`，后端一次 BFS 遍历返回 React Flow 直接可用的图结构。

CI 选择器建议功能也复用此接口，共享代码路径。

---

## 数据层

**无新建 DB 表。** 复用现有：
- `ci_instance_rel` — 关联数据
- `ci_association_def` / `ci_association_kind` — 关联语义
- `change_doc.fields_data` — 存储已选 CI 快照（JSON 数组字符串）
- `change_doc_field.field_type` — 扩展新值 `ci_selector`（VARCHAR，无迁移）

---

## 后端

### 新增文件（5 个）

| 文件 | 说明 |
|------|------|
| `dto/TopologyNodeVO.java` | 节点 VO：id, name, modelId, modelName, isRoot |
| `dto/TopologyEdgeVO.java` | 边 VO：id, srcId, dstId, label, defId |
| `dto/CiTopologyResult.java` | 拓扑结果：nodes + edges |
| `CiTopologyService.java` | BFS 遍历逻辑 |
| `CiTopologyController.java` | `GET /api/cmdb/topology/{instanceId}` |

### CiTopologyResult 响应结构

```json
{
  "nodes": [
    { "id": 1, "name": "web-01", "model_id": "host", "model_name": "主机", "is_root": true },
    { "id": 5, "name": "web-app", "model_id": "app", "model_name": "应用", "is_root": false }
  ],
  "edges": [
    { "id": 10, "src_id": 1, "dst_id": 5, "label": "运行", "def_id": "host_run_app" }
  ]
}
```

### CiTopologyService BFS 逻辑

```
输入：tenantId, rootInstanceId, depth（默认 2，最大 5 — clamp 超限值）

1. 初始化：queue = [rootInstanceId], visited = {rootInstanceId: 0}, edgesSeen = Set()
2. 批量预加载：所有 depth 层内的实例、关联定义、关联种类（减少 N+1）
3. BFS 循环：
   - 取出当前实例 id，查 relMapper.findByInstance(tenantId, current)
   - 对每条 rel：
     a. rel.id 已在 edgesSeen → 跳过（去重双向关联）
     b. 确定方向：isSrc = (current == rel.srcId)
     c. label = isSrc ? kind.srcToDst : kind.dstToSrc
     d. 添加到 edges；edgesSeen.add(rel.id)
     e. peerId 未访问且当前深度 < depth → 加入 queue
4. 构建 nodes：每个 visited 实例查名称和模型名称
5. 返回 { nodes, edges }
```

### API 端点

| 方法 | 路径 | 权限 | 参数 |
|------|------|------|------|
| `GET` | `/api/cmdb/topology/{instanceId}` | `cmdb_instance:read` | `depth`（默认 2，1-5）|

### RBAC

复用 `cmdb_instance:read`，无需新增资源码。

---

## 前端

### 依赖安装

```bash
cd frontend && npm install @xyflow/react
```

### 新增/修改文件

| 操作 | 文件 | 说明 |
|------|------|------|
| 新建 | `components/cmdb/CiTopologyGraph.tsx` | 可复用的 React Flow 图组件 |
| 新建 | `app/(dashboard)/cmdb/topology/[instanceId]/page.tsx` | 全屏拓扑页 |
| 修改 | `app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx` | 添加内嵌拓扑预览区块 |
| 修改 | `app/(dashboard)/change-docs/new/page.tsx` | 添加 ci_selector 字段渲染器 |
| 修改 | `app/(dashboard)/admin/change-doc-templates/` | 模板管理页添加 ci_selector 选项 + 用法说明 |

### `CiTopologyGraph` 组件

接受 `nodes`、`edges`、`preview`（布尔）两种模式：

- **preview=true**（详情页内嵌）：高度 280px，`panOnDrag=false`，`zoomOnScroll=false`，只读展示
- **preview=false**（全屏页）：占满父容器，支持拖拽/缩放/平移，MiniMap，Controls

节点颜色：按 `model_id` 哈希分配颜色，根节点加金色边框 + 加粗
边：有向箭头 + 中间显示 `label`（关联种类标签）

### 实例详情页修改

在关联面板（`Link2` 区块）下方新增折叠区块：

```
┌─ 拓扑图 ──────────────────────────────── [全屏展开 →] ┐
│  [React Flow 预览，280px，只读]                        │
└────────────────────────────────────────────────────────┘
```

- 折叠状态同 `relPanelOpen` 模式（默认折叠，localStorage 记忆）
- 展开时调用 `GET /api/cmdb/topology/{id}?depth=2`
- "全屏展开 →" → `/cmdb/topology/{id}`

### 全屏拓扑页 `/cmdb/topology/[instanceId]`

布局：
```
[顶部] 面包屑 "返回实例详情"  |  [根CI名称] 的拓扑图  |  深度选择器: [1] [2] [3]
[主体] React Flow 全屏（含 MiniMap + Controls）
[右侧浮层] 点击节点后出现：CI名称、模型、关键属性(前3个)、"访问实例"链接
```

- 深度选择器切换后重新请求 API
- 不加入侧边栏，仅通过实例详情页的"全屏展开"按钮进入

### 变更文档 ci_selector 字段渲染器

在 `/change-docs/new/page.tsx` 的动态表单渲染函数中新增 `ci_selector` 分支：

**交互流程：**
1. 搜索框（调用 `GET /api/cmdb/rel/search?modelId=&keyword=`）→ 从结果中选主 CI
2. 选中后自动调用 `GET /api/cmdb/topology/{id}?depth=2` → 展示 2 层关联 CI 作为候选（复选框列表）
3. 用户勾选/取消，点击"确认"
4. 已选 CI 以卡片形式展示（名称 + 模型徽章 + 删除按钮）

**存储格式**（`fieldsData` 中该字段的值）：
```json
"[{\"id\":1,\"name\":\"web-01\",\"model_name\":\"主机\"},{\"id\":5,\"name\":\"web-app\",\"model_name\":\"应用\"}]"
```

**展示格式**（变更文档详情页）：渲染为 CI 卡片列表，每张卡片含名称、模型徽章、链接到 `/cmdb/instances/{modelId}/{id}`。

### 模板管理页修改（用法说明）

在 `/admin/change-doc-templates` 字段编辑器中，当 `fieldType` 下拉选中 `ci_selector` 时，右侧显示说明卡片：

> **ci_selector 用法说明**
>
> 此字段类型允许文档填写人在变更文档中选择受影响的 CI 实例。
>
> - 填写时：可搜索 CI 名称/IP，选中后自动展示 2 层关联 CI 作为候选
> - 存储：选中的 CI ID 和名称快照（删除 CI 后仍可查看历史记录）
> - 展示：变更文档详情页中以 CI 卡片列表呈现，可点击跳转到 CMDB

---

## 不在本期范围

- 拓扑图导出（PNG/SVG）
- 拓扑图编辑（直接在图上建立/删除关联）
- 变更文档中 CI 影响链的自动化分析（Phase 5）
- `ci_selector` 字段的后端 API 联动（如关联 CI 的审批通知）

---

## 文件变更清单

**后端（5 个新文件）：**
- `module/cmdb/dto/TopologyNodeVO.java`
- `module/cmdb/dto/TopologyEdgeVO.java`
- `module/cmdb/dto/CiTopologyResult.java`
- `module/cmdb/CiTopologyService.java`
- `module/cmdb/CiTopologyController.java`

**前端（4 个新建 + 3 个修改）：**
- 新建：`components/cmdb/CiTopologyGraph.tsx`
- 新建：`app/(dashboard)/cmdb/topology/[instanceId]/page.tsx`
- 修改：`app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx`
- 修改：`app/(dashboard)/change-docs/new/page.tsx`
- 修改：`app/(dashboard)/admin/change-doc-templates/[id]/page.tsx` （模板字段编辑页，添加 ci_selector 选项 + 用法说明）
