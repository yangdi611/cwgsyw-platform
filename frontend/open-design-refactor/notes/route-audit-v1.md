# 前端重构盘点 v1

## 项目判断

当前项目是 Next.js App Router 前端，核心业务是企业级运维 / CMDB / 流程 / 变更文档 / 权限管理平台。

重构方向建议采用「成熟 B2B 工具台」：

- 全宽工作台布局，减少居中窄版页面
- 顶部全局操作区 + 左侧业务导航 + 主内容工作区
- 列表、筛选、详情、批量操作、状态反馈优先
- 高密度但清晰，避免营销页式大留白
- 响应式从桌面优先扩展到平板和手机，而不是简单压缩

## 当前路由分组

### 认证

- `/login`

建议：
- 登录页保持极简
- 强化企业属性：系统名称、部署环境、账号/密码、错误提示、加载态
- 不需要大面积装饰图

### 工作台首页

- `/`

建议：
- 作为全局运营总览
- 展示待办、风险、CMDB 变更、流程任务、近期通知
- 不建议只是欢迎页

### CMDB 主模块

- `/cmdb`
- `/cmdb/models`
- `/cmdb/instances`
- `/cmdb/instances/2d-view`
- `/cmdb/instances/by-model`
- `/cmdb/admin`
- `/cmdb/admin/models`
- `/cmdb/alerts`
- `/cmdb/associations`
- `/cmdb/changes`
- `/cmdb/changes/stats`
- `/cmdb/impact/[instanceId]`
- `/cmdb/topology`
- `/cmdb/topology/[instanceId]`

建议：
- CMDB 是第一优先级重构对象
- 需要统一成「资产模型 → 实例 → 关系 → 拓扑 → 影响分析 → 告警 → 变更记录」的工作流
- 列表页应采用三段结构：筛选区、数据表、右侧详情抽屉
- 拓扑和影响分析应占满可用宽度，减少卡片堆叠

### 变更文档

- `/change-docs`
- `/change-docs/new`
- `/change-docs/[id]`
- `/admin/change-doc-templates`
- `/admin/change-doc-templates/[id]`

建议：
- 文档列表要支持状态、创建人、关联 CI、时间筛选
- 新建页应是分步表单或左右分栏编辑器
- 模板管理应归入后台配置，但入口可从变更文档模块跳转

### 日报 / 日常流程

- `/daily`
- `/daily/new`
- `/daily/[id]`

建议：
- 适合采用列表 + 审批状态 + 详情页结构
- `DailyReportForm` 和审批动作应沉淀成复用表单/状态组件

### 设备与 IPAM

- `/devices`
- `/devices/new`
- `/devices/[id]`
- `/ipam`
- `/ipam/[id]`

建议：
- 可合并为「资源管理」大类
- 设备详情页要强化凭证、归属、关联 CI、变更记录
- IPAM 需要突出地址占用、冲突、分配状态

### 文件与预览

- `/files`
- `/files/preview/[id]`

建议：
- 文件列表需要清晰的类型、来源、关联业务对象
- 预览页应全宽，右侧保留元信息与操作

### 组织、用户、权限

- `/users`
- `/groups`
- `/rbac/roles`
- `/rbac/permissions`

建议：
- 合并成「身份与权限」模块
- 用户、用户组、角色、权限四者需要统一表格语言
- 对话框组件可以保留，但表格批量操作要增强

### 流程引擎

- `/workflow/design`
- `/workflow/design/[id]`
- `/workflow/instances`
- `/workflow/tasks`
- `/workflow/stats`
- `/workflow/admin`

建议：
- 流程设计器需要最大化画布
- 实例、任务、统计、配置应形成完整流程运营闭环
- BPMN 编辑器不应被普通卡片布局限制宽度

### 管理后台

- `/admin/ai`
- `/admin/audit`
- `/admin/config`

建议：
- 归入「系统管理」
- 审计日志应高密度表格化
- AI 配置与系统配置应使用分组表单，不建议散落卡片

### 通知与报表

- `/notifications`
- `/reports`

建议：
- 通知页可作为全局消息中心
- 报表页应聚合 CMDB、流程、变更、设备等核心指标

## 建议的新信息架构

### 一级导航

1. 工作台
2. CMDB
3. 变更文档
4. 资源管理
5. 流程中心
6. 报表分析
7. 身份与权限
8. 系统管理

### 二级结构

#### 工作台

- 总览
- 我的待办
- 近期风险
- 最近变更

#### CMDB

- 概览
- 模型管理
- 实例管理
- 关系管理
- 拓扑视图
- 影响分析
- 告警中心
- 变更记录

#### 变更文档

- 文档列表
- 新建变更文档
- 文档详情
- 模板管理

#### 资源管理

- 设备资产
- IP 地址管理
- 文件中心

#### 流程中心

- 我的任务
- 流程实例
- 流程设计
- 流程统计
- 流程配置

#### 身份与权限

- 用户
- 用户组
- 角色
- 权限

#### 系统管理

- 系统配置
- AI 配置
- 审计日志
- 通知中心

## 关键布局规则

### 桌面端

- 页面最大化利用宽度，不使用过窄居中容器
- 内容区建议 `max-width: none`
- 主工作台采用 `grid-template-columns: 280px minmax(0, 1fr)`
- 表格页支持右侧详情抽屉
- 拓扑、BPMN、文件预览使用全宽沉浸式画布

### 平板端

- 左侧导航收窄为图标栏或抽屉
- 筛选区从横向改为两列
- 详情抽屉改为底部面板或独立详情页

### 手机端

- 保留核心查询、列表、详情、主操作
- 表格转为信息卡片
- 批量操作降级为更多菜单
- 复杂拓扑 / BPMN 提示切换桌面端查看，保留只读摘要

## 第一批线框建议

优先输出这些页面线框：

1. `00-shell.html`：全局应用框架
2. `01-dashboard.html`：企业工作台首页
3. `02-cmdb-instances.html`：CMDB 实例列表 + 详情抽屉
4. `03-cmdb-topology.html`：拓扑全宽画布
5. `04-change-doc-editor.html`：变更文档新建 / 编辑
6. `05-workflow-tasks.html`：流程任务中心
7. `06-admin-users.html`：用户与权限管理

## 组件系统建议

### 基础组件

- AppShell
- Sidebar
- Topbar
- PageHeader
- SectionHeader
- Toolbar
- FilterBar
- DataTable
- DetailDrawer
- EmptyState
- StatusBadge
- ConfirmDialog

### 业务组件

- CiInstancePicker
- CiRelationshipGraph
- ImpactSummary
- ChangeRecordTimeline
- ApprovalActions
- WorkflowTaskCard
- AuditLogTable
- PermissionMatrix

## 风险点

- 当前页面数量较多，不能逐页单独美化，必须先统一 Shell、表格、表单、详情页模式
- CMDB 与 Workflow 是复杂模块，应优先做工作区级布局，不应只改颜色
- 移动端不适合完整承载拓扑和 BPMN 编辑，应提供摘要与跳转策略
- 如果现有组件已基于 shadcn/ui，需要保留组件体系，只改组合方式和页面骨架

## 下一步需要读取

请继续提供以下命令输出，用于做更准确的组件与页面落地方案：

```bash
find frontend/src/app -name "page.tsx" -o -name "layout.tsx" | sort
find frontend/src/components -type f | sort
sed -n '1,220p' frontend/src/components/layout/Sidebar.tsx
sed -n '1,220p' frontend/src/components/layout/Header.tsx
sed -n '1,220p' frontend/src/app/'(dashboard)'/layout.tsx
sed -n '1,220p' frontend/src/app/'(dashboard)'/page.tsx
```
