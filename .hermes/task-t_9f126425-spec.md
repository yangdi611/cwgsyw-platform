# Task t_9f126425: 创建 6 个缺失文件 — 告警列表页 + 实例详情 5 个 Tab 子组件

## 概述

CMDB 前端当前缺少告警列表页，且实例详情页（`instances/by-model/[modelId]/[id]/page.tsx`）将关联面板/拓扑面板/变更历史/告警等内联渲染，没有使用 Tab 组织。需要创建 6 个文件：

1. `frontend/src/components/cmdb/InstanceBasicInfoTab.tsx` — 基本信息 Tab
2. `frontend/src/components/cmdb/InstanceAssociationsTab.tsx` — 关联关系 Tab
3. `frontend/src/components/cmdb/InstanceTopologyTab.tsx` — 拓扑图 Tab
4. `frontend/src/components/cmdb/InstanceChangeHistoryTab.tsx` — 变更历史 Tab
5. `frontend/src/components/cmdb/InstanceAlertsTab.tsx` — 告警 Tab
6. `frontend/src/app/(dashboard)/cmdb/alerts/page.tsx` — 告警列表页

并重构 `frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/page.tsx` 使用这 5 个 Tab 子组件。

## 参考文件

### InstanceBasicInfoTab.tsx

从现有 page.tsx 提取基本信息部分。包含：
- 属性分组显示（带 editing mode 切换）
- renderEditField 函数（支持 singlechar, longchar, enum, enummulti, bool, date, int, float, objuser）
- 在 grouped cards 中展示
- Props: { modelId, instance, model, editing, editAttrs, onEditAttrsChange, onSave, onCancel, onEdit }
- 所有类型定义（CiAttributeVO, CiAttributeGroupVO, CiInstanceVO, CiModelVO）内联在该文件顶部

### InstanceAssociationsTab.tsx

从现有 page.tsx 提取关联关系面板和对话框。包含：
- 关联分组列表（按 kind 分组）
- 管理全部关联链接 → `/cmdb/instances/by-model/${modelId}/${id}/associations`
- 添加关联 Dialog（选择关联定义 → 搜索目标实例 → 建立关联）
- 删除关联功能
- 关联搜索（useQuery with enabled 条件）
- Props: { modelId, id, hasPermission }
- 所有类型定义（CiInstanceRelVO, CiRelGroupVO, CiAssociationDefVO, InstanceSearchVO）内联

### InstanceTopologyTab.tsx

从现有 page.tsx 提取拓扑图和关联面板。包含：
- CiTopologyGraph 渲染
- preview 模式（有高度限制）
- 全屏展开链接 → `/cmdb/topology/${id}`
- 加载和空状态
- Props: { id }

### InstanceChangeHistoryTab.tsx

变更历史 Tab。从现有的 ChangeRecordItem 和 cmdb/changes 页面模式构建：
- 加载实例的变更历史（`GET /cmdb/changes?entityType=ci_instance&entityId=${id}`）
- 使用 ChangeRecordItem 组件（compact 模式）
- 时间线展示
- 分页（如果数据量大）
- Props: { id }

### InstanceAlertsTab.tsx

告警 Tab。使用现有的 usePrometheusAlerts hook：
- 使用 `useInstanceAlerts(id)` 加载告警数据
- 使用 `useAcknowledgeAlert()` 确认告警 mutation
- 按 severity 区分颜色展示（critical=red, warning=yellow, info=blue）
- 显示 alertName, severity badge, summary, startsAt
- 确认按钮（acknowledge）
- Props: { id }

### cmdb/alerts/page.tsx

全局告警列表页。路由: `/cmdb/alerts`。
- `useQuery` 调用 `GET /api/cmdb/alerts`（带 status/severity 筛选 + 分页）
- 告警表格：alertName, severity, status, ciInstanceName, summary, startsAt, acknowledged
- severity badge 着色
- 确认按钮（一行操作）
- 点击 CI 实例名跳转到实例详情页
- 筛选栏：severity Select, status Select
- 分页
- 权限守卫：cmdb_alert:read

### 重构 page.tsx

将现有 page.tsx 改为 Tab 布局：
- 顶部标签栏：基本信息 / 关联关系 / 拓扑图 / 变更历史 / 告警
- 默认选中"基本信息"
- 选中的 Tab 渲染对应的子组件
- 影响分析和编辑按钮保持在 header 区域
- 删除旧的 inline 面板代码（关联面板、拓扑面板、添加关联 Dialog）
- 保留原有的基本信息属性编辑逻辑（用 InstanceBasicInfoTab 替代）

## 约束

1. 不要修改 node_modules 或 package.json
2. 使用 shadcn/ui 已有的组件（Button, Input, Select, Badge, Table, Card 等）
3. UI 组件中没有 Tabs 组件可用 — 用简单的 state + button bar 实现 Tab 切换
4. API 路径以 `/api` 开头（如 `/api/cmdb/alerts`）
5. 中文界面
6. 必须通过 `npx tsc --noEmit` 编译检查
7. 保持与现有代码风格一致：'use client', @tanstack/react-query, Tailwind

## 验收标准

- [ ] 6 个新文件全部创建
- [ ] page.tsx 使用 Tab 布局替代 inline 面板
- [ ] `npx tsc --noEmit` 通过
- [ ] `npm run build` 通过（如果有 build script）
