# CMDB 前端完整指南

> CMDB 前端统一参考手册 — 涵盖 Tiers 1–4 所有功能页面、组件、数据流和权限控制
> 平台版本: Next.js 14 + React 18 + TanStack Query 5 + shadcn/ui + Tailwind CSS 3
> 总代码量: 19 个页面 (3,890 行) + 12 个组件 (2,249 行) + 2 个自定义 hooks (82 行) = ~6,221 行

---

## 目录

1. [架构概述](#架构概述)
2. [路由结构总览](#路由结构总览)
3. [CMDB 页面详表](#cmdb-页面详表)
   - [重定向与入口](#重定向与入口)
   - [模型管理](#模型管理)
   - [实例管理](#实例管理)
   - [关联关系](#关联关系)
   - [变更历史](#变更历史)
   - [可视化](#可视化)
   - [集成联动](#集成联动)
   - [IPAM](#ipam)
4. [全局侧边栏导航](#全局侧边栏导航)
5. [CMDB 布局系统](#cmdb-布局系统)
6. [组件库](#组件库)
   - [实例详情 Tab 组件](#实例详情-tab-组件)
   - [通用组件](#通用组件)
7. [自定义 Hooks](#自定义-hooks)
8. [数据流模式](#数据流模式)
9. [权限控制模型](#权限控制模型)
10. [已知问题](#已知问题)

---

## 架构概述

### 技术栈

| 依赖 | 版本 | 用途 |
|------|------|------|
| Next.js | 14 | App Router 框架, 文件系统路由 |
| React | 18 | UI 库 |
| TanStack Query | 5 | 服务端数据获取与缓存 |
| shadcn/ui | — | UI 组件库 (Button/Input/Dialog/Table/Select/Badge/Card 等) |
| Tailwind CSS | 3 | 原子化 CSS |
| @xyflow/react | 12 | 拓扑图可视化 (ReactFlow) |
| html-to-image | — | 拓扑图导出为 PNG |
| lucide-react | — | 图标库 |
| sonner | — | Toast 通知 |

### 目录结构

```
frontend/src/app/(dashboard)/cmdb/
├── layout.tsx                         # CMDB 布局 — 左侧模型树侧边栏
├── page.tsx                           # /cmdb → 重定向到 /cmdb/models
├── models/
│   └── page.tsx                       # 模型列表 (CRUD + 分组筛选 + 搜索 + 分页)
├── admin/
│   ├── page.tsx                       # 管理后台 (模型 Tab + 关联定义 Tab)
│   └── models/[modelId]/page.tsx      # 模型详情 (属性 CRUD)
├── instances/
│   ├── page.tsx                       # 实例列表 (CRUD + CSV 导入)
│   ├── 2d-view/page.tsx              # 2D 分组视图
│   └── by-model/[modelId]/
│       ├── page.tsx                   # 按模型筛选的实例列表
│       ├── new/page.tsx               # 新建实例 (动态表单)
│       └── [id]/
│           ├── page.tsx               # 实例详情 (5 个 Tab)
│           └── associations/
│               ├── page.tsx           # 关联关系管理列表
│               └── new/page.tsx       # 新建关联 (3 步向导)
├── associations/
│   └── page.tsx                       # 旧版关联页面 → 重定向到 /cmdb/admin
├── changes/
│   ├── page.tsx                       # 变更历史 V2 (diff 可视化)
│   └── stats/page.tsx                 # 变更统计面板
├── alerts/
│   └── page.tsx                       # CMDB 告警列表
├── impact/
│   └── [instanceId]/page.tsx          # 影响分析
└── topology/
    └── [instanceId]/page.tsx          # 拓扑图 (增强版, 含对比模式)

frontend/src/hooks/
├── usePrometheusAlerts.ts             # CMDB 告警轮询 Hook
└── useColumnConfig.ts                 # 列显示配置 Hook (localStorage 持久化)

frontend/src/components/cmdb/
├── InstanceBasicInfoTab.tsx           # 实例基本信息 Tab (内联编辑)
├── InstanceAssociationsTab.tsx        # 实例关联关系 Tab
├── InstanceTopologyTab.tsx            # 实例拓扑图 Tab (内嵌预览)
├── InstanceChangeHistoryTab.tsx       # 实例变更历史 Tab
├── InstanceAlertsTab.tsx              # 实例告警 Tab
├── CiTopologyGraph.tsx                # ReactFlow 拓扑图组件 (537 行)
├── CiLinkSelector.tsx                 # 变更文档 CI 关联选择器 (多选 + 影响级别)
├── CiInstanceSelect.tsx               # CI 实例单选下拉搜索
├── CsvImportDialog.tsx                # CSV 导入弹窗 (上传→预览→执行→结果)
├── ChangeRecordItem.tsx               # 变更记录时间线条目
├── JsonDiffView.tsx                   # 字段级 JSONB diff 渲染器
└── ColumnPicker.tsx                   # 列显示切换器
```

---

## 路由结构总览

| 路由 | 页面文件 | 行数 | Tier | 功能概述 |
|------|----------|------|------|----------|
| `/cmdb` | `cmdb/page.tsx` | 9 | T1 | 重定向到 `/cmdb/models` |
| `/cmdb/models` | `models/page.tsx` | 295 | T1 | 模型 CRUD + 分组/搜索/分页 |
| `/cmdb/admin` | `admin/page.tsx` | 557 | T2 | 模型管理 Tab + 关联扩展属性管理（AC5） |
| `/cmdb/admin/models/[modelId]` | `admin/models/[modelId]/page.tsx` | 210 | T1 | 模型详情 + 属性 CRUD (字段类型/分组/必填) |
| `/cmdb/instances` | `instances/page.tsx` | 426 | T1 | 实例 CRUD + 动态表单 + 模型/状态筛选 + CSV 导入 |
| `/cmdb/instances/by-model/[modelId]` | `instances/by-model/[modelId]/page.tsx` | 150 | T1 | 按模型筛选的实例列表 + 跳转创建 |
| `/cmdb/instances/by-model/[modelId]/new` | `instances/by-model/[modelId]/new/page.tsx` | 170 | T1 | 基于模型属性的动态表单创建实例 |
| `/cmdb/instances/by-model/[modelId]/[id]` | `instances/by-model/[modelId]/[id]/page.tsx` | 109 | T1 | 实例详情 — 5 个 Tab 容器 |
| `/cmdb/instances/by-model/[modelId]/[id]/associations` | `instances/.../[id]/associations/page.tsx` | 191 | T1 | 关联关系列表 (按关联种类分组) |
| `/cmdb/instances/by-model/[modelId]/[id]/associations/new` | `instances/.../associations/new/page.tsx` | 353 | T1 | 新建关联 3 步向导 |
| `/cmdb/associations` | `associations/page.tsx` | 5 | T1 | 旧版 → 重定向到 `/cmdb/admin` |
| `/cmdb/changes` | `changes/page.tsx` | 349 | T3 | 变更历史 V2 (模型筛选 + 日期范围 + 动作筛选 + diff) |
| `/cmdb/changes/stats` | `changes/stats/page.tsx` | 247 | T3 | 变更统计面板 (今日/周/月卡片 + 趋势 + Top 10) |
| `/cmdb/instances/2d-view` | `instances/2d-view/page.tsx` | 241 | T3 | 2D 分组视图 (按属性分组的网格卡片布局) |
| `/cmdb/topology/[instanceId]` | `topology/[instanceId]/page.tsx` | 471 | T3 | 拓扑图 (模型着色 + 状态边框 + 展开/折叠 + 对比模式 + ?compare=1 自动激活 + PNG 导出) |
| `/cmdb/impact/[instanceId]` | `impact/[instanceId]/page.tsx` | 306 | T2 | 影响分析 (BFS 层次展示 + 双向/上游/下游策略) |
| `/cmdb/alerts` | `alerts/page.tsx` | 264 | T4 | CMDB 告警列表 (状态/严重度筛选 + 确认 + 分页) |
| `/ipam` | `frontend/src/app/(dashboard)/ipam/page.tsx` | 303 | T4 | IP 地址池列表 (CRUD + 搜索 + 状态筛选 + 利用率进度条) |
| `/ipam/[id]` | `frontend/src/app/(dashboard)/ipam/[id]/page.tsx` | 348 | T4 | IP 地址池详情 (分配/释放 + 利用率卡片 + 分配列表分页) |

---

## CMDB 页面详表

### 重定向与入口

#### `/cmdb` — CMDB 入口页 (9 行)

`pages/page.tsx` — 最简单的页面: `useEffect` 中调用 `router.replace('/cmdb/models')`。不渲染任何 UI。

---

### 模型管理

#### `/cmdb/models` — 模型列表页 (295 行)

**文件**: `models/page.tsx`

核心功能:
- **模型列表表格**: 展示 `CiModelVO` 字段 (name, displayName, group, instanceCount, 创建/更新时间)
- **分组筛选**: 5 个预定义分组 `infra/biz/network/security/cloud`，中文标签通过 `MODEL_GROUPS` 映射
- **关键词搜索**: 后台分页搜索 (Input + debounce)
- **分页**: 20 条/页, 上一页/下一页 + 页码跳转
- **创建模型**: Dialog 弹窗, 表单字段: name, displayName, group (Select), 支持 `isBuiltIn` 标签显示
- **编辑模型**: 点击铅笔图标打开 Dialog 预填表单
- **删除模型**: AlertDialog 确认弹窗, 内置模型不可删除 (isBuiltIn 禁用删除按钮)
- **模型详情链接**: 表格行中的实例计数和模型名均可点击跳转到 `/cmdb/instances/by-model/{id}` 或 `/cmdb/admin/models/{id}`
- **权限控制**: 通过 `usePermission().hasPermission('cmdb_model', 'write')` 控制 CRUD 按钮显隐

#### `/cmdb/admin` — CMDB 管理后台 (557 行)

**文件**: `admin/page.tsx`

这是全平台最大的 CMDB 页面之一，两个 Tab：

**Tab 1: 模型管理** — 展示所有 `CiModelVO` 模型卡片网格 (icon + name + description + group_code)
- 每张卡片使用 `ICON_MAP` 根据 icon 字段渲染不同 Lucide 图标 (Server/Database/Network/Box)
- 内置模型标注 `is_built_in: true`
- 暂停的模型标注 `is_paused: true`
- 点击卡片进入模型详情页 `/cmdb/admin/models/{modelId}`

**Tab 2: 关联扩展属性管理 (AC-5)** — 为指定关联类型（kind）定义自定义扩展属性
- **关联类型选择器**：文本输入框 + `<datalist>` 预定义建议（`connected_to`, `depends_on`, `contains`, `deployed_on`, `runs_on`），回车或点击刷新按钮加载该类型的属性列表
- **属性列表表格**：展示 `AssociationAttrVO` 字段：
  - 标识 (`fieldKey`) — 渲染为 `<code>` 标签，英文/下划线格式
  - 名称 (`name`) — 显示名称
  - 类型 (`fieldType`) — 渲染为 Badge，中文标签映射：singlechar(单行文本)/int(整数)/enum(枚举)/list(列表)/bool(布尔)/user(用户)/date(日期)
  - 必填 (`isRequired`) — 是(红色) / 否(灰色)
  - 默认值 (`defaultValue`) — 空则显示 `-`
  - 排序 (`sortOrder`) — 排序权重
  - 操作 — 编辑 (PencilLine 图标) / 删除 (Trash2 图标)，仅在 `cmdb_model:write` 权限下显示
- **创建/编辑表单**：点击「新增属性」按钮展开表单面板：
  - 字段标识 — Input，创建时必填，编辑时禁用（不可修改 fieldKey）
  - 显示名称 — Input，必填
  - 字段类型 — Select （singlechar/int/enum/list/bool/user/date）
  - 默认值 — Input，可选
  - 排序 — Input type=number
  - 必填 — Checkbox
  - 枚举选项 — 仅在 fieldType=`enum` 时显示，逗号分隔输入
- **CRUD API**：通过 TanStack Query mutations 调用后端端点：
  - `GET /cmdb/association-kinds/{kind}/attributes` — 列表（路由传参 activeKind）
  - `POST /cmdb/association-kinds/{kind}/attributes` — 创建
  - `PUT /cmdb/association-kinds/{kind}/attributes/{attrId}` — 更新
  - `DELETE /cmdb/association-kinds/{kind}/attributes/{attrId}` — 删除
  - 创建/更新/删除成功后自动 `invalidateQueries` 刷新列表

**已知问题：** 后端 `CiAssociationKind.code` 实体字段映射到不存在的 DB 列，导致 `GET /api/cmdb/association-kinds/{kind}/attributes` 返回 500。正在修复（参见 bug 任务 t_9dd744b5）。修复后属性 CRUD 完整可用。

权限: 进入页面检查 `cmdb_model:write`, 无权限重定向到 `/cmdb`

#### `/cmdb/admin/models/[modelId]` — 模型详情 (210 行)

**文件**: `admin/models/[modelId]/page.tsx`

- **模型基本信息**: model_id, name, icon, is_built_in
- **属性列表表格**: field_key, name, field_type (中文标签映射 via `FIELD_TYPES`), group_id, is_required, is_unique, is_list_show, sort_order, placeholder, unit
- **字段类型枚举**: singlechar(单行文本)/longchar(多行文本)/int(整数)/float(浮点数)/enum(单选枚举)/enummulti(多选枚举)/date(日期)/bool(是/否)/objuser(用户)
- **新增属性**: Dialog 弹窗, 表单含 fieldKey/name/fieldType/groupId/isRequired/isUnique/isListShow/placeholder/unit
- **删除属性**: AlertDialog 确认, 内置属性不可删除
- **返回按钮**: 回到 `/cmdb/admin`

---

### 实例管理

#### `/cmdb/instances` — 实例列表页 (426 行)

**文件**: `instances/page.tsx`

全平台最大的独立页面之一, 功能丰富:

- **实例列表表格**: CiInstanceVO (id, name, modelName, status, owner, description, 创建/更新时间)
- **模型筛选**: Select 下拉框, 通过 `/cmdb/models` API 获取模型列表
- **状态筛选**: Select 下拉框 (running/stopped/maintenance/fault/offline)
- **关键词搜索**: 后台搜索 (name 字段)
- **分页**: 20 条/页
- **创建实例**: Dialog 弹窗, 先选模型, 然后根据模型属性的 `field_type` 动态渲染表单控件:
  - singlechar → Input, longchar → Textarea, int/float → Input type=number
  - enum → Select (从 option 字段解析), date → Input type=date, bool → Select(是/否)
  - objuser → 用户选择器
  - `FORM_TYPE_BY_FIELD_TYPE` 映射
- **编辑实例**: 点击行内的铅笔图标打开 Dialog 预填
- **删除实例**: AlertDialog 确认
- **CSV 导入**: 通过 `CsvImportDialog` 组件 (见组件章节)
- **外链按钮**: 本页面还有 "2D 视图" 和 "告警" 按钮跳转到对应页面
- **已知问题**: 创建实例时发送 `model` 字段而非 `modelId` (Tier 1 遗留 bug)

#### `/cmdb/instances/by-model/[modelId]` — 按模型实例列表 (150 行)

**文件**: `instances/by-model/[modelId]/page.tsx`

- 按 `modelId` 过滤的实例列表
- 使用该模型定义的 `is_list_show` 属性动态渲染表格列
- 每行有 "查看" 按钮跳到 `/cmdb/instances/by-model/{modelId}/{id}`
- 右上角 "新增实例" 按钮跳到 `/cmdb/instances/by-model/{modelId}/new`
- 权限: 检查 `cmdb_instance:read`

#### `/cmdb/instances/by-model/[modelId]/new` — 新建实例 (170 行)

**文件**: `instances/by-model/[modelId]/new/page.tsx`

- 基于模型属性的动态表单创建页面
- 表单字段按 `attribute_groups` 分组展示
- 每个字段根据 `field_type` 渲染对应控件
- 验证必填字段 (`is_required`)
- 提交后跳转到实例详情页
- 权限: 检查 `cmdb_instance:create`

#### `/cmdb/instances/by-model/[modelId]/[id]` — 实例详情 (109 行)

**文件**: `instances/by-model/[modelId]/[id]/page.tsx`

这是一个 **Tab 容器页**, 本身代码量不大但聚合了 5 个 Tab 组件:

| Tab | 组件 | 功能 |
|-----|------|------|
| 基本信息 | `InstanceBasicInfoTab` | 属性组展示 + 内联编辑 |
| 关联关系 | `InstanceAssociationsTab` | 关联列表 + 删除 + 跳转新建 |
| 拓扑图 | `InstanceTopologyTab` | 内嵌深度 2 的 ReactFlow 拓扑预览 + "对比模式" 入口链接 |
| 变更历史 | `InstanceChangeHistoryTab` | 分页时间线 + diff |
| 告警 | `InstanceAlertsTab` | 关联 Prometheus 告警列表 + 确认 |

顶部 header 包含: 返回按钮、实例名/model_id/创建信息、影响分析按钮 (需 `cmdb_instance:impact` 权限)、**拓扑对比按钮** (需 `cmdb_instance:read` 权限, 链接到 `/cmdb/topology/{id}?compare=1`)

---

### 关联关系

#### `/cmdb/instances/by-model/[modelId]/[id]/associations` — 关联管理 (191 行)

**文件**: `instances/.../associations/page.tsx`

- 按关联种类 (kind_id) 分组的关联关系列表
- 每组展示: kind_name、该种类下的所有 relation 卡片 (peer_name, peer_model, direction_label, attrs, 创建时间)
- 关联种类筛选: 顶部 Select 下拉框过滤
- 删除关联: AlertDialog 确认
- "新建关联" 按钮跳到 `/cmdb/instances/by-model/{modelId}/{id}/associations/new`
- 权限: 检查 `cmdb_instance:read`

#### `/cmdb/instances/by-model/[modelId]/[id]/associations/new` — 新建关联 (353 行)

**文件**: `instances/.../associations/new/page.tsx`

3 步向导 (wizard):
1. **选择关联定义**: 列出该实例所属模型的所有可用关联定义 (def_name, 方向标签, mapping)
2. **选择目标实例**: 关键词搜索 CMDB 实例, 仅显示符合 def 的 src/dst model_id 的实例
3. **确认提交**: 显示关联摘要 (源实例 → 关联定义 → 目标实例), 可选填扩展属性 (attribution)
   - 扩展属性需要输入 key/value 对

权限: 第 1 步检查 `cmdb_relation:create`; 各步之间通过 state 传递 (`selectedDefId`, `selectedPeer`, `assocAttrs`)

#### `/cmdb/associations` — 旧版关联页 (5 行)

`redirect('/cmdb/admin')` — 纯重定向, 保留向后兼容。

---

### 变更历史

#### `/cmdb/changes` — 变更历史 V2 (349 行)

**文件**: `changes/page.tsx`

Tier 3 增强页面, 全平台变更审计的入口:
- **模型筛选**: Select 下拉, 从 `/cmdb/models` 获取
- **动作筛选**: 全部/创建/更新/删除 (`ACTION_OPTIONS`)
- **日期范围**: 两个 Input type=date 分别控制开始/结束日期
- **分页**: 可选 20/50/100 条/页
- **变更记录列表**: 每条记录渲染为 `ChangeRecordItem` 组件:
  - `actionMeta` 映射: create_instance→绿色, update_instance→蓝色, delete_instance→红色
  - 展开后显示 `JsonDiffView` 字段级 diff
- **筛选条件重置**: X 按钮清除所有筛选条件
- **统计面板链接**: 跳到 `/cmdb/changes/stats`
- 无数据时显示占位: `暂无变更记录`

#### `/cmdb/changes/stats` — 变更统计面板 (247 行)

**文件**: `changes/stats/page.tsx`

Tier 3 数据看板:
- **3 个统计卡片** (ActionCountCard 组件复用):
  - 今日: 创建/更新/删除/总计
  - 本周: 同上
  - 本月: 同上
- **每日趋势表格**: Date / 创建 / 更新 / 删除 列
- **Top 10 活跃实例**: instanceName / modelName / changeCount + 排名 Badge
- 加载中显示 Skeleton 占位

---

### 可视化

#### `/cmdb/topology/[instanceId]` — 拓扑图 (471 行)

**文件**: `topology/[instanceId]/page.tsx`

全平台前端最复杂的页面, 基于 `@xyflow/react` (ReactFlow v12):

- **拓扑渲染**: `CiTopologyGraph` 组件, 含模型着色、状态边框颜色
- **全屏模式**: full-bleed 布局 (`-m-6`, `h-[calc(100vh-XX)]`), 绕过 CMDB Layout 侧边栏
- **状态筛选**: 在线/离线/维护中 下拉过滤
- **深度控制**: Input type=number 控制 BFS 遍历深度 (默认 3)
- **展开/折叠**: 点击节点可展开其关联的子节点
- **对比模式**: 
  - **`?compare=1` 自动激活**: 链接到 `/cmdb/topology/{id}?compare=1` 时自动进入对比模式 (通过 `useSearchParams` + `useEffect` 读取 URL 参数)
  - 选择两个时间点 (audit_log 回放), 对比拓扑差异
  - 差异结果展示: `CompareNodeV2[]` (added/removed/modified/unchanged) + `CompareEdge` (含 diff status)
- **PNG 导出**: 使用 `html-to-image` 的 `toPng` 方法, 下载为同名 PNG
- **搜索过滤**: Input 搜索节点名称, 高亮匹配项
- 返回链接到实例详情页
- 权限: 检查 `cmdb_instance:read`
- 相关指南: [拓扑对比模式使用指南](cmdb-topology-compare.md)

#### `/cmdb/instances/2d-view` — 2D 分组视图 (241 行)

**文件**: `instances/2d-view/page.tsx`

Tier 3 可视化功能:
- **模型选择**: Select 下拉选择模型
- **分组属性选择**: 自动检测模型的 `groupableAttrs` (仅 `singlechar` 和 `enum` 类型字段可分组)
- **卡片网格**: `TwoDimGroupVO[]` 渲染为卡片组, 每组一个 header (groupValue) + 实例卡片网格
- **实例卡片**: 显示 name, status (Badge), owner
- **跳转到实例详情**: 点击卡片跳转
- **刷新按钮**: 手动刷新数据
- 无数据时显示 `暂无数据`
- 无 `enable_2d_view` 模型则不显示此页面入口

#### `/cmdb/impact/[instanceId]` — 影响分析 (306 行)

**文件**: `impact/[instanceId]/page.tsx`

Tier 2 功能:
- **方向选择**: bidirectional(双向)/upstream(上游)/downstream(下游)
- **层次展示**: 按 `ImpactLayer.depth` 递归渲染, 使用 `ChevronRight`/`ChevronDown` 折叠
- **节点详情**: 每个节点显示 name, model_id, status (中文标签), business_level
- **严重节点标记**: 故障/离线状态的节点用 AlertTriangle 图标 + 红色背景高亮
- **边信息**: hover 时显示 kind + label
- **跳转到实例详情**: 点击节点名称跳转
- **跳转到拓扑图**: "查看拓扑" 按钮
- 无关联数据时显示 `暂无上下游依赖`
- 截断提示: 如果 `truncated=true`, 显示 `结果已截断...`
- 权限: 检查 `cmdb_instance:impact`

---

### 集成联动

#### `/cmdb/alerts` — CMDB 告警列表 (264 行)

**文件**: `alerts/page.tsx`

Tier 4 功能:
- **告警列表表格**: AlertVO (alert_name, severity, status, summary, ci_instance_name, starts_at, acknowledged)
- **严重度筛选**: Select 下拉 (全部/严重/警告/提示)
- **状态筛选**: Select 下拉 (全部/触发中/已恢复)
- **告警确认**: 每条未确认告警行有 "确认" 按钮, 调用 `useAcknowledgeAlert` mutation
- **颜色编码**: 
  - severity: critical→红色, warning→琥珀色, info→蓝色
  - status: firing→红色, resolved→绿色
- **分页**: 20 条/页
- **跳转实例**: ci_instance_name 可点击跳转到实例详情

**注意**: 后端 Jackson SNAKE_CASE 策略导致 AlertVO 类型声明为 snake_case (与 `usePrometheusAlerts` hook 的 camelCase 接口不一致, 代码中标注了 TODO)

---

## IPAM

#### `/ipam` — IP 地址池列表 (303 行)

**文件**: `frontend/src/app/(dashboard)/ipam/page.tsx`

Tier 4 功能:
- **地址池列表表格**: IpPoolVO (name, cidr, gateway, dns, status, totalCount, allocatedCount, utilizationPercent)
- **利用率进度条**: 纯 CSS progress bar, `utilizationPercent` 驱动宽度和颜色 (高利用率→红色)
- **关键词搜索**: name/dcidr 搜索
- **状态筛选**: active/full/disabled
- **分页**: 20 条/页
- **创建地址池**: Dialog, 表单: name, cidr, gateway, dns, description
- **编辑**: 点击铅笔图标, 同创建表单预填
- **删除**: AlertDialog 确认, 有活跃分配的池无法删除 (后端校验)
- **权限**: 侧边栏 `ip_pool:read` + 页面内 `hasPermission('ip_pool', 'create/update/delete')`

#### `/ipam/[id]` — IP 地址池详情 (348 行)

**文件**: `frontend/src/app/(dashboard)/ipam/[id]/page.tsx`

- **概览卡片**: CIDR / 总容量 / 已分配 / 可用 / 利用率百分比 + 进度条
- **IP 分配列表**: 分页表格展示所有分配记录 (ipAddress, status, ciInstanceName, description, allocatedByName, allocatedAt)
- **分配状态 Badge**: allocated→蓝色, released→灰色
- **新增分配**: Dialog, 可选填 IP 地址 (留空自动分配) 和 CI 实例关联 (`CiInstanceSelect`)
- **释放 IP**: AlertDialog 确认, 仅 `allocated` 状态的 IP 可释放
- **返回按钮**: 到 `/ipam`

---

## 全局侧边栏导航

**文件**: `components/layout/Sidebar.tsx` (223 行)

全局侧边栏是 Dashboard 布局 (`(dashboard)/layout.tsx`) 的左侧固定导航，所有登录用户可见。CMDB 功能通过侧边栏的 **CMDB 导航组**进入。

### CMDB 导航组结构

```tsx
const navItems: NavEntry[] = [
  // ... 首页及日常功能项 ...
  {
    label: 'CMDB',
    icon: ServerCog,       // lucide-react ServerCog 图标
    resource: 'cmdb_model',
    action: 'read',
    storageKey: 'sidebar-cmdb',
    defaultOpen: true,     // 默认展开
    children: [
      { href: '/cmdb/models',           label: '模型管理', icon: Box,      resource: 'cmdb_model',    action: 'read' },
      { href: '/cmdb/instances',        label: '实例管理', icon: Database, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/changes',          label: '变更历史', icon: History,  resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/alerts',           label: 'CMDB 警告', icon: Bell,      resource: 'cmdb_alert',   action: 'read' },
      { href: '/cmdb/changes/stats',    label: '统计看板', icon: BarChart2, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/instances/2d-view', label: '2D 视图', icon: Grid3x3, resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/admin',            label: '配置管理', icon: Settings, resource: 'cmdb_model',    action: 'write' },
    ],
  },
  { href: '/ipam',  label: 'IP 地址池', icon: Globe, resource: 'ip_pool', action: 'read' },  // 独立顶层项
  // ... 其他功能项 ...
]
```

### 导航项总览

| # | 侧边栏标签 | 路由 | 图标 | 资源 | 操作 | 类型 |
|---|-----------|------|------|------|------|------|
| 1 | **CMDB** (组) | — | ServerCog | cmdb_model | read | NavGroup, defaultOpen |
| — | ├ 模型管理 | `/cmdb/models` | Box | cmdb_model | read | NavItem (子项) |
| — | ├ 实例管理 | `/cmdb/instances` | Database | cmdb_instance | read | NavItem (子项) |
| — | ├ 变更历史 | `/cmdb/changes` | History | cmdb_instance | read | NavItem (子项) |
| — | ├ CMDB 警告 | `/cmdb/alerts` | Bell | cmdb_alert | read | NavItem (子项) |
| — | ├ 统计看板 | `/cmdb/changes/stats` | BarChart2 | cmdb_instance | read | NavItem (子项) |
| — | ├ 2D 视图 | `/cmdb/instances/2d-view` | Grid3x3 | cmdb_instance | read | NavItem (子项) |
| — | └ 配置管理 | `/cmdb/admin` | Settings | cmdb_model | write | NavItem (子项) |
| 2 | **IP 地址池** | `/ipam` | Globe | ip_pool | read | 独立 NavItem |

### 关键设计

1. **可折叠组**: CMDB 导航组使用 `usePersistState` hook + `localStorage` 持久化折叠状态 (`storageKey: 'sidebar-cmdb'`)，默认展开 (`defaultOpen: true`)。折叠/展开时切换 `ChevronDown`/`ChevronRight` 图标。

2. **子项高亮**: 当任意子项路由匹配当前路径时，整个导航组标题高亮（`font-medium` + 前景色）。子项自身活跃时显示 `bg-primary` 高亮背景。

3. **IP 地址池独立**: IP 地址池 (`/ipam`) 是独立的顶层导航项，不属于 CMDB 组。路由、资源 (`ip_pool`) 和权限控制均与 CMDB 解耦。

4. **权限守卫**: 组级别检查 `cmdb_model:read` — 无权限则整个组不渲染。子项内部也各有独立权限检查，无权限的子项自动隐藏（`visibleChildren` 过滤机制）。当所有子项均被权限过滤后，整个组自动隐藏。

5. **活跃路径检测**: 支持精确匹配 + 子路径匹配 + query 参数匹配三种模式：
   ```tsx
   pathname === href || pathname.startsWith(href + '/') || pathname.startsWith(href + '?')
   ```

---

## CMDB 布局系统

**文件**: `cmdb/layout.tsx` (107 行)

CMDB Layout 为所有 CMDB 页面提供左侧 **模型树侧边栏**（与全局侧边栏并行，形成双层侧边栏结构）：

### 侧边栏行为

- **条件渲染**: 仅当用户有 `cmdb_instance:read` 权限且路径非 `/cmdb/topology` 时显示
- 拓扑图页面使用 full-bleed 布局 (跳过侧边栏)
- **模型分组**: 从 `/cmdb/models` API 获取全量模型, 按 `group_code` 分组
- **模型图标**: `MODEL_ICONS` 映射 (server→Server, database→Database, network→Network, box→Box, cloud→Cloud)
- **活跃高亮**: 当前路径匹配 `params.modelId` 时高亮对应模型
- **暂停模型**: `is_paused` 的模型灰显
- **加载态**: 显示 Loader2 旋转图标

### 布局效果

```
┌─────────────────────────────────────────────────┐
│  Header (全局 Header 组件)                        │
├─────────────┬───────────────────────────────────┤
│  模型侧边栏  │  子页面内容 (<children>)            │
│  ─────────  │                                   │
│  基础设施     │                                   │
│  ├ 🖥 Server  │                                   │
│  ├ 🗄 Database│                                   │
│  网络设备     │                                   │
│  ├ 🌐 Network │                                   │
│  └ ...       │                                   │
└─────────────┴───────────────────────────────────┘
```

---

## 组件库

### 实例详情 Tab 组件

#### `InstanceBasicInfoTab` (191 行)

**用途**: 实例详情页的"基本信息" Tab

**Props**: `{ modelId: string, inst: CiInstanceVO }`

功能:
- **只读模式**: 按 `attribute_groups` 分组展示所有属性字段的值
- **内联编辑模式**: 切换笔图标进入编辑态
  - 每个字段渲染为动态控件 (同创建实例逻辑)
  - `is_editable=false` 的字段禁用编辑
  - Save 按钮: 调用 `PUT /cmdb/instances/{id}`
  - Cancel 按钮: 恢复原值
- 自包含: 自己通过 `/cmdb/models/{id}` 查询模型信息 (属性分组名)

#### `InstanceAssociationsTab` (255 行)

**用途**: 实例详情页的"关联关系" Tab

**Props**: 无外部 Props (通过页面级 query 获取数据 - 注意与页面解耦方式)

功能:
- 按关联种类分组的关联列表
- 每组: 种类名 + 各条关联 (peer_name, peer_model_name, direction_label, 扩展属性)
- 新建关联 Dialog: 选择关联定义 + 搜索目标实例 + 关联扩展属性
- 删除关联: AlertDialog 确认
- **注**: 此组件与 `instances/.../associations/page.tsx` 功能重复但不共享代码

#### `InstanceTopologyTab` (55 行)

**用途**: 实例详情页的"拓扑图" Tab (内嵌预览)

**Props**: `{ id: string }`

功能:
- 调用 `GET /cmdb/topology/{id}?depth=2` 获取深度 2 的拓扑数据
- 嵌入 `CiTopologyGraph` 组件 (preview 模式)
- "对比模式" 链接跳转到 `/cmdb/topology/{id}?compare=1` (带 `GitCompare` 图标)
- "全屏展开 →" 链接跳转到 `/cmdb/topology/{id}`
- 无数据: `暂无关联数据`

#### `InstanceChangeHistoryTab` (71 行)

**用途**: 实例详情页的"变更历史" Tab

**Props**: `{ instanceId: string }`

功能:
- 调用 `GET /cmdb/instances/{id}/history` (V2 端点)
- 每条记录渲染为 `ChangeRecordItem` 组件
- 分页: 20 条/页
- 无数据: `暂无变更记录`

#### `InstanceAlertsTab` (130 行)

**用途**: 实例详情页的"告警" Tab

**Props**: `{ instanceId: string }`

功能:
- 调用 `useInstanceAlerts(instanceId)` hook
- 渲染告警列表: alert_name, severity (颜色 Badge), status (颜色 Badge), starts_at, summary
- 每条未确认告警有 "确认" 按钮 (CheckCircle2 图标)
- severity 映射: critical→红色/警告→琥珀色/提示→蓝色
- status 映射: firing→红色/resolved→绿色

---

### 通用组件

#### `CiTopologyGraph` (537 行)

**用途**: 全平台最大的组件, 基于 @xyflow/react 的拓扑图渲染器

**导入**: `TopologyNode, TopologyEdge, DiffStatus` 类型被 `topology/page.tsx` 复用

功能:
- **节点渲染**: 自定义 ReactFlow Node 组件
  - 模型着色: 按 `modelId` 分配颜色
  - 状态边框: 不同状态不同颜色
  - 字段数据显示: 可选在节点内展示 fields_data
- **边渲染**: 自定义 Edge, 可选显示 kind label
- **交互**: 拖拽, 缩放, 点击节点展开/折叠
- **对比模式**: 支持 added/removed/modified/unchanged 四种节点状态
- **preview 模式**: `preview={true}` 时用于实例详情 Tab 内嵌

#### `CiInstanceSelect` (120 行)

**用途**: CI 实例单选下拉搜索选择器

**Props**: `{ value: number | null, onChange: (id: number | null) => void, disabled?: boolean }`

功能:
- 搜索模式: 输入关键词 → 调用 `/cmdb/instances/search` API → 展示下拉列表
- 选择后: 显示 "实例名 (模型名)" 标签 + 清除按钮 (X)
- 失焦关闭: 通过 document.addEventListener('mousedown', handler) 实现
- 搜索延迟: 无显式 debounce (依赖 keyword state 变化)

**使用**: 设备关联, IP 分配

#### `CiLinkSelector` (168 行)

**用途**: 变更文档 CI 关联选择器 (多选 + 影响级别)

**Props**: `{ value: CiLinkItem[], onChange: (selected: CiLinkItem[]) => void, disabled?: boolean }`

导出类型: `CiLinkItem { instanceId, instanceName, modelName, impactLevel? }`

功能:
- 多选模式: 已选项显示为带 X 的 Badge 列表
- 搜索: 通过 `/cmdb/instances/search` API
- 影响级别: 每个关联项可选择 high/medium/low (IMPACT_OPTIONS)

**使用**: 变更文档创建/编辑页

#### `CsvImportDialog` (299 行)

**用途**: CSV 批量导入弹窗

**Props**: `{ open: boolean, onOpenChange: (open: boolean) => void, model: string }`

3 步流程:
1. **上传**: 选择 CSV 文件 + 冲突策略 (override/skip) + 编码选择 (UTF-8/GBK)
2. **预览**: 显示解析结果表格 + 行数统计 (toCreate, toUpdate, toSkip, failedRows)
3. **执行/结果**: 发起导入 → 进度轮询 → 完成报告 (created, updated, skipped, failed, durationMs)

状态管理: `step` (0~2), `file`, `batchId`, `preview`, `result`
组件内 `reset()` 在关闭弹窗时重置所有状态。

**使用**: `instances/page.tsx` 的 "CSV 导入" 按钮

#### `ChangeRecordItem` (124 行)

**用途**: 变更记录时间线条目

导出: `ChangeHistoryV2VO` 类型 + `actionMeta` 映射

功能:
- 渲染单条变更记录: 动作标签 (创建/更新/删除), 操作人, 时间, 摘要
- 可展开: 展开后嵌入 `JsonDiffView` 显示字段级 diff
- 颜色: create→绿色, update→蓝色, delete→红色

**使用**: `changes/page.tsx`, `InstanceChangeHistoryTab`

#### `JsonDiffView` (163 行)

**用途**: 字段级 JSONB diff 渲染器

**Props**: `JsonDiffViewProps`

功能:
- 纯 React diff 渲染 (无外部 diff 库)
- 4 种 diff 类型带颜色:
  - added (绿色) — before 无, after 有
  - removed (红色) — before 有, after 无
  - modified (琥珀色) — 两者都有但值不同
  - unchanged (灰色) — 两者一致

**使用**: `ChangeRecordItem` (展开后)

#### `ColumnPicker` (59 行)

**用途**: 列显示切换器

**Props**: `{ allColumns: ColumnDef[], visibleKeys: string[], onToggle: (key: string) => void }`

导出类型: `ColumnDef { key, name, required? }`

功能:
- 弹出式菜单: Settings2 图标按钮, 点击展开/关闭
- 每个列名 + checkbox
- required 列不可隐藏 (checkbox disabled)
- 外部点击关闭 (inset-0 z-10 backdrop)

**使用**: `instances/by-model/[modelId]/page.tsx`

---

## 自定义 Hooks

#### `usePrometheusAlerts` (39 行)

**文件**: `hooks/usePrometheusAlerts.ts`

导出接口:

| 导出 | 类型 | 说明 |
|------|------|------|
| `CmdbAlertVO` | interface | 告警 VO (camelCase) — alertName, severity, status, acknowledged 等 |
| `useInstanceAlerts(instanceId)` | useQuery hook | 获取单个实例的告警, key: `['cmdb-instance-alerts', instanceId]` |
| `useAcknowledgeAlert()` | useMutation hook | 确认告警, 成功后 invalidate `cmdb-instance-alerts` 和 `cmdb-alerts` 查询 |

**注意**: 后端 Jackson SNAKE_CASE 序列化策略导致 hook 中 camelCase 接口与后端 snake_case 响应不匹配。告警页面 (`alerts/page.tsx`) 和 `InstanceAlertsTab` 各自声明了自己的 snake_case 接口来绕过。这是一个已知的架构不一致。

#### `useColumnConfig` (43 行)

**文件**: `hooks/useColumnConfig.ts`

**签名**: `useColumnConfig(modelId: string, defaultKeys: string[]) => [visibleKeys, toggleKey]`

功能:
- localStorage 持久化列显示偏好
- key: `cmdb_col_config_{modelId}`
- modelId 变化时自动重载 (useEffect 监听 storageKey)
- SSR safe: `typeof window === 'undefined'` 保护

**使用**: `instances/by-model/[modelId]/page.tsx`

---

## 数据流模式

所有 CMDB 页面遵循统一的数据流模式:

```
┌──────────┐    ┌────────────────┐    ┌──────────────┐    ┌────────────────┐
│  shadcn/ui │◄──│  React 页面/组件 │◄──│ TanStack Query │◄──│  API Client    │
│  (Table,   │    │  (状态 + 事件)   │    │  (缓存+重试)    │    │  (Axios JWT)   │
│  Dialog,   │    │                │    │                │    │  @/lib/api     │
│  Button)   │    │                │    │                │    │                │
└──────────┘    └────────────────┘    └──────────────┘    └────────────────┘
                                                                    │
                                                                    ▼
                                                          ┌────────────────┐
                                                          │  后端 REST API  │
                                                          │  (Spring Boot)  │
                                                          └────────────────┘
```

### GET 请求 (useQuery)

```tsx
const { data, isLoading, error } = useQuery({
  queryKey: ['cmdb-models', page, size, search, groupFilter],
  queryFn: () => api.get('/cmdb/models', { params }).then(r => r.data.data),
})
```

- queryKey 包含所有筛选参数以确保正确缓存失效
- `r.data.data` 解包 (Axios Response → 后端统一包装 `{ code, data, msg }`)

### 写请求 (useMutation)

```tsx
const mutation = useMutation({
  mutationFn: (form) => api.post('/cmdb/models', form),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['cmdb-models'] })
    toast.success('创建成功')
    setDialogOpen(false)
  },
  onError: (err) => toast.error(err.response?.data?.msg || '操作失败'),
})
```

- 成功后 invalidate 关联查询键以自动刷新
- 使用 sonner toast 显示操作结果

### 常见模式

| 模式 | 代码模式 | 示例页面 |
|------|----------|----------|
| CRUD 列表 | useState(筛选) + useQuery(列表) + useMutation(增删改) | models, instances, ipam |
| 详情页 | useParams + useQuery(单条) | model detail, instance detail |
| Tab 容器 | useState(tab) + 条件渲染 Tab 组件 | 实例详情 |
| 向导 | useState(step) + 条件渲染步骤 | 新建关联 |
| 弹窗 CRUD | Dialog + form state + useMutation | 所有 CRUD Dialog |
| 轮询 | useQuery(refetchInterval) | 告警 (30s) |

---

## 权限控制模型

### 三层权限守卫

```
第一层: 侧边栏导航 → 无权限菜单项不渲染 (Sidebar.tsx)
第二层: 页面入口 → usePermission → 无权限重定向 (useEffect)
第三层: 组件/按钮 → hasPermission 条件渲染
```

### 资源与操作

| 资源 (resource) | 操作 (actions) | 所属 Tier | 涉及页面 |
|-----------------|---------------|-----------|----------|
| `cmdb_model` | read, write (create/update/delete) | T1 | models, admin |
| `cmdb_instance` | read, create, update, delete, import, impact | T1/T2 | instances |
| `cmdb_relation` | create, update, delete | T1/T2 | associations |
| `ip_pool` | create, read, update, delete | T4 | ipam |
| `cmdb_alert` | create, read, acknowledge | T4 | alerts |

### 页面级权限检查代码模式

```tsx
const { hasPermission, isHydrated } = usePermission()
const router = useRouter()

useEffect(() => {
  if (!isHydrated) return
  if (!hasPermission('cmdb_model', 'write')) router.replace('/')
}, [isHydrated, hasPermission, router])
```

### PermissionGuard 组件

```tsx
import { PermissionGuard } from '@/components/shared/PermissionGuard'

<PermissionGuard resource="cmdb_instance" action="read">
  <Button>创建实例</Button>
</PermissionGuard>
```

---

## 已知问题

### 关键 Bug

| # | 描述 | 位置 | Severity | 影响 |
|---|------|------|----------|------|
| 1 | **createModel 参数名不匹配** — 从模型详情页跳转到实例创建页时, URL 传 `createModel` 参数, 但 instances 页面读取 `model` 参数, 导致从模型详情自动预设模型失败 | `instances/page.tsx` | Medium | ⚠️ 用户需要手动重新选择模型 |
| 2 | **创建实例发送 `model` 而非 `modelId`** — 实例创建 API 请求中发送的是模型显示名称而非模型标识符, 后端 DTO 期望 `modelId` | `instances/page.tsx` | Medium | ⚠️ 创建实例可能失败或关联错误模型 |
| 3 | **AlertVO snake_case 不一致** — `usePrometheusAlerts` hook 声明 camelCase 接口 (如 `alertName`), 但后端 Jackson SNAKE_CASE 策略返回 snake_case (`alert_name`)。`alerts/page.tsx` 和 `InstanceAlertsTab` 各自声明了本地 snake_case 接口绕过 | 多处 | Low | 🟡 代码冗余, 类型安全受损 |

### 代码质量问题

| # | 描述 | 位置 | 建议 |
|---|------|------|------|
| 1 | 非空断言 `relEditTarget!.id` | `instances/[id]/page.tsx` 附近 | 添加 null 检查 |
| 2 | 非空断言 `model!.name` | `admin/models/[modelId]/page.tsx` 附近 | 添加 null 检查 |
| 3 | `InstanceAssociationsTab` 与 `instances/.../associations/page.tsx` 功能重复但未共享代码 | 两处 | 考虑抽取公共关联管理组件 |

### 架构注意事项

1. **路径与早期设计不一致**: 实例详情使用 `[modelId]/[id]` 双段路径 (非早期设计的 `[instanceId]` 单段); 关联管理集成在 admin Tab 和实例详情中 (无独立 `/cmdb/relations` 路由)
2. **代码规模**: `CiTopologyGraph.tsx` (537 行) 和 `instances/page.tsx` (426 行) 已达拆分阈值
3. **拓扑图复用**: `InstanceTopologyTab` 使用 `CiTopologyGraph` (preview 模式), 拓扑独立页使用相同组件, 参数由父组件控制
4. **CSV 导入是弹窗而非独立页面**: 设计选择避免了页面跳转, 但复杂流程 (3 步) 嵌入 Dialog 增加了组件复杂度
5. **useColumnConfig 仅通过 localStorage 同步**: 没有后端持久化, 在不同设备/浏览器之间列配置不共享

---

## 附录: 页面完整文件映射

```
cmdb/page.tsx                                    (9 行)   重定向
cmdb/layout.tsx                                  (107 行)  布局 + 模型树侧边栏
cmdb/models/page.tsx                             (295 行)  模型列表
cmdb/admin/page.tsx                              (356 行)  管理后台 (模型+关联定义)
cmdb/admin/models/[modelId]/page.tsx             (210 行)  模型详情 (属性 CRUD)
cmdb/instances/page.tsx                          (426 行)  实例列表
cmdb/instances/by-model/[modelId]/page.tsx       (150 行)  按模型实例列表
cmdb/instances/by-model/[modelId]/new/page.tsx   (170 行)  新建实例
cmdb/instances/by-model/[modelId]/[id]/page.tsx  (109 行)  实例详情 (Tab 容器)
cmdb/instances/.../associations/page.tsx         (191 行)  关联管理
cmdb/instances/.../associations/new/page.tsx     (353 行)  新建关联向导
cmdb/associations/page.tsx                        (5 行)   重定向
cmdb/changes/page.tsx                            (349 行)  变更历史
cmdb/changes/stats/page.tsx                      (247 行)  变更统计
cmdb/instances/2d-view/page.tsx                  (241 行)  2D 分组视图
cmdb/topology/[instanceId]/page.tsx              (471 行)  拓扑图
cmdb/impact/[instanceId]/page.tsx                (306 行)  影响分析
cmdb/alerts/page.tsx                             (264 行)  告警列表
ipam/page.tsx                                    (303 行)  IP 地址池列表
ipam/[id]/page.tsx                               (348 行)  IP 地址池详情
```

---

*文档版本: v1.0 — 2026-06-17*
*对应前端源代码全部来自 `frontend/src/`, 基于 CMDB 验收 (t_d08ecd7d) 19 页面全部 200 OK 验证通过*
