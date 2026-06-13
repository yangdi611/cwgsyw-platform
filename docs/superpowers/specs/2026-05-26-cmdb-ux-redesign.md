# CMDB-UX：导航重构设计规格

**日期：** 2026-05-26
**状态：** 已批准，待实施
**分支：** `feature/cmdb`

---

## 目标

重构 CMDB 前端导航，将现有单一入口拆分为三个功能区：**搜索首页**（日常查询）、**CI 资源**（按模型浏览实例）、**配置管理**（模型与关联定义管理）。提升日常运维效率，同时将管理功能通过 RBAC 控制访问。

---

## 路由结构（完全重构）

### 新路由

| 路由 | 页面 | 说明 |
|------|------|------|
| `/cmdb` | 搜索首页 | **新建**，替换原模型列表页 |
| `/cmdb/instances` | CI 资源页 | **新建**，左侧模型树 + 右侧实例表格 |
| `/cmdb/instances/[modelId]/[id]` | 实例详情/编辑 | 保留不变 |
| `/cmdb/instances/[modelId]/[id]/associations` | 实例关联管理 | 保留不变 |
| `/cmdb/instances/[modelId]/new` | 新建实例 | 保留不变 |
| `/cmdb/admin` | 配置管理 | **新建**，合并模型管理 + 关联定义 |
| `/cmdb/admin/models/[modelId]` | 模型属性编辑 | **迁移**自 `/cmdb/models/[modelId]` |

### 重定向

| 旧路由 | 新路由 |
|--------|--------|
| `/cmdb/models/[modelId]` | `/cmdb/admin/models/[modelId]` |
| `/cmdb/associations` | `/cmdb/admin` |

### 文件变更

| 操作 | 文件 |
|------|------|
| 重写 | `app/(dashboard)/cmdb/page.tsx` |
| 新建 | `app/(dashboard)/cmdb/instances/page.tsx` |
| 新建 | `app/(dashboard)/cmdb/admin/page.tsx` |
| 移动 | `cmdb/models/[modelId]/page.tsx` → `cmdb/admin/models/[modelId]/page.tsx` |
| 删除 | `cmdb/associations/page.tsx`（内容合并进 admin） |
| 修改 | `components/layout/Sidebar.tsx` |

---

## 侧边栏

CMDB 从单条目改为**展开式子菜单**（方案 A）：

```
▼ 🗄️ CMDB
   🔍 搜索          /cmdb              cmdb_instance:read
   📦 CI 资源       /cmdb/instances    cmdb_instance:read
   ⚙️ 配置管理      /cmdb/admin        cmdb_model:write
```

- 点击父节点展开/折叠，默认展开
- 「配置管理」仅当用户拥有 `cmdb_model:write` 权限时显示
- 当前激活子路由高亮对应子条目

---

## 各页面设计

### `/cmdb` — 搜索首页

**布局：**
- 顶部大搜索框，placeholder：「搜索 CI 名称、IP、主机名…」
- 搜索框下方模型筛选标签：`全部 (N)` / `主机 (12)` / `应用 (8)` / …（来自后端 `modelCounts`）
- 结果区：表格 + 自定义列（见下方列自定义规格）

**空状态（无关键词）：** 显示各模型卡片 + 实例数量，作为快速入口导航至 CI 资源页对应模型

**搜索行为：**
- 关键词变化时 debounce 300ms 后触发请求
- 调用 `GET /api/cmdb/instances/search?keyword=X&modelId=&page=1&size=20`
- 切换模型筛选标签时保留关键词重新查询

**表格列（跨模型时）：** 名称、模型类型（徽章）、关键属性（取该模型第一个 `is_list_show=true` 属性）、更新时间

**表格列（筛选到单模型时）：** 显示该模型所有 `is_list_show=true` 的属性列，可通过列自定义增减

---

### `/cmdb/instances` — CI 资源页

**布局：左右分栏**

**左侧模型树（220px 固定宽）：**
- 按 `group_code` 分组，可折叠展开
- 每个模型显示：模型名 + 实例数量（右对齐）
- 点击模型：右侧加载该模型实例列表，URL 不变（state 管理）
- 默认选中第一个有实例的模型

**右侧实例表格：**
- 显示当前选中模型的实例列表（复用 `GET /api/cmdb/instances/{modelId}`）
- 列 = 该模型 `is_list_show=true` 的属性，支持列自定义
- 右上角：「+ 新建实例」（`cmdb_instance:create` 权限）→ `/cmdb/instances/[modelId]/new`
- 行点击跳转 `/cmdb/instances/[modelId]/[id]`
- 左侧模型树显示 `is_deleted=false` 的实例数量（实时）

---

### `/cmdb/admin` — 配置管理页

**访问控制：** `cmdb_model:write`，无权限则 redirect 到 `/cmdb`

**Tab 布局：**

**Tab 1 — 模型管理：** 现有 `/cmdb/page.tsx` 内容迁入（模型卡片列表 + 新建模型表单），点击模型跳 `/cmdb/admin/models/[modelId]`

**Tab 2 — 关联定义：** 现有 `/cmdb/associations/page.tsx` 内容迁入（关联种类 + 关联定义管理）

---

### `/cmdb/admin/models/[modelId]` — 模型属性编辑

现有 `/cmdb/models/[modelId]/page.tsx` 直接迁移，**内容不变**。原「查看实例」按钮链接更新为指向 `/cmdb/instances`（选中对应模型）。

---

## 列自定义规格

**两种操作入口（A+B 结合）：**

1. **右上角下拉菜单**：点击「⚙ 列显示」弹出 checkbox 列表，勾选/取消勾选列
2. **列标题 hover**：悬停列标题出现「✕」快速隐藏该列；表头末列有「+ 添加列」入口

**存储：** localStorage，key 格式 `cmdb_col_config_{modelId}`（`all` 表示跨模型搜索的列配置）

**列来源：** 该模型所有 `is_list_show=true` 的属性为默认显示列；其他属性可通过列自定义添加

**默认列（跨模型搜索）：** 名称、模型类型、关键属性（各模型第一个 is_list_show 列）、更新时间

---

## 后端变更（仅 1 个新接口）

### `GET /api/cmdb/instances/search`

**参数：**
- `keyword`（可选）：对 `name` 字段 LIKE 搜索
- `modelId`（可选）：为空时跨所有模型
- `page`（默认 1）、`size`（默认 20，最大 100）

**返回：**
```json
{
  "records": [
    {
      "id": 1,
      "name": "web-server-01",
      "model_id": "host",
      "model_name": "主机",
      "attrs": { "inner_ip": "192.168.1.100", "status": "running" }
    }
  ],
  "total": 42,
  "page": 1,
  "size": 20,
  "model_counts": { "host": 12, "app": 8, "mysql": 3 }
}
```

**实现：**
- `CiInstanceController` 新增 `GET /api/cmdb/instances/search` 端点
- `CiInstanceService` 新增 `searchAcrossModels(tenantId, keyword, modelId, page, size)` 方法
- 使用 `LambdaQueryWrapper` + `LIKE name` + 可选 `modelId` 过滤
- `model_counts` 用 GROUP BY 或多次 `selectCount` 获取（模型数量有限，可接受）
- `attrs` 字段仅返回该模型 `is_list_show=true` 的属性值子集（在 service 层过滤）
- RBAC：`cmdb_instance:read`

---

## 不在本次范围

- 实例详情页内容修改（仅路由调整）
- 列顺序拖拽排序
- 列配置同步到服务端（用 localStorage 足够 MVP）
- 搜索结果高亮关键词
- 实例批量操作（批量删除/导出）

---

## 文件变更清单

**前端（6 个文件）：**
- 重写：`app/(dashboard)/cmdb/page.tsx`
- 新建：`app/(dashboard)/cmdb/instances/page.tsx`
- 新建：`app/(dashboard)/cmdb/admin/page.tsx`
- 新建：`app/(dashboard)/cmdb/admin/models/[modelId]/page.tsx`（从旧 models/[modelId] 迁移内容）
- 删除：`app/(dashboard)/cmdb/associations/page.tsx`
- 修改：`components/layout/Sidebar.tsx`

**后端（2 个文件）：**
- 修改：`module/cmdb/CiInstanceController.java`（新增 search 端点）
- 修改：`module/cmdb/CiInstanceService.java`（新增 searchAcrossModels 方法）
