# 前端入口页面布局矩阵 v2

> 调研基线：`development@0a68c4e5e44d43d980670772e88b90cba91d3f13`，当前分支 `codex/frontend-style-unification`。
> 本文只记录页面布局与组件统一性，不改变业务权限、接口、查询参数或路由契约。

## 1. 调研范围与结论

仓库共有 81 个 `page.tsx` 入口，其中认证页 1 个、Dashboard 下页面 80 个。入口页中有 34 个直接使用共享 `PageHeader`，17 个自行渲染 `<h1>`，其余页面把布局下沉到任务、Wiki、CMDB 空间或流程业务组件。由此可见，页面入口数量不能直接等同于需要逐页改造的数量，统一工作应以页面模板和工作区组件为单位。

当前已形成的共存体系：

| 观察项 | 当前情况 | 统一影响 |
|---|---|---|
| 页面标题 | `PageHeader`、手写 `<h1>`、工具栏标题并存 | 用户在列表、详情、编辑页之间切换时层级和返回路径不稳定 |
| 按钮 | `components/v2/Button` 与 `components/ui/button` 并存 | variant、尺寸、圆角和禁用态语义不一致 |
| 表格 | `shared/DataTable`、原生 `<table>`、卡片/业务列表并存 | 排序、加载、空态、移动端降级方式不一致 |
| 状态 | `LoadingState` 1 个入口直接使用，`ErrorState` 几乎未在入口使用，大量手写文案 | 加载失败和空数据恢复路径不一致 |
| 对话框 | V2 Dialog、旧 Dialog、固定 `fixed inset-0` overlay 并存 | 键盘、焦点、关闭行为和遮罩样式不一致 |
| 容器 | 普通页、表单、工作区自行选择 `max-w-*` 或负边距 | 大屏利用率、页面密度和滚动边界不稳定 |
| 设计 token | V2 token 与 shadcn 原始 token 并存 | 新旧页面视觉语言混合，迁移边界不清晰 |

统计为源码静态扫描结果，不能替代运行时可视化验收：`PageHeader` 34 个入口、`<h1>` 17 个入口、`DataTable` 15 个入口、`FilterBar` 9 个入口、原生 `<table>` 3 个入口、固定 overlay 7 个入口、V2 Button 44 个入口、旧 Button 14 个入口。业务组件内部仍有额外使用，实际影响面更大。

## 2. 页面类型定义

### A. 标准列表页

页面骨架：

```text
PageHeader
  -> FilterBar / 查询条件
  -> Toolbar / 批量操作
  -> DataTable 或业务列表
  -> Pagination / EmptyState / ErrorState
  -> DetailDrawer（可选）
```

适用对象：CMDB 告警、模型/实例列表、变更文档、设备、IPAM、用户、用户组、角色、流程实例、审计日志、文件等。

统一要求：页面标题和主操作位置固定；筛选条件与 URL 同步的页面保持原有参数；表格保留业务列定义，只统一外壳、状态、分页和响应式降级。

### B. 标准详情页

页面骨架：

```text
DetailHeader（返回、标题、状态、更新时间、操作）
  -> 主信息区
  -> Tabs / Sections
  -> 关联对象、审计、历史
```

适用对象：CMDB 实例、设备、IP、变更文档、任务详情、Wiki 阅读页。

统一要求：返回入口、标题和状态在首屏稳定；危险操作统一确认；关联对象使用一致的链接/抽屉语义。详情页面不强制改成 DataTable。

### C. 创建/编辑表单页

页面骨架：

```text
返回 + PageHeader / DetailHeader
  -> 表单分组或步骤
  -> 校验与错误提示
  -> 底部或标题栏操作区
```

适用对象：变更文档新建、设备新建、CMDB 实例新建、关联新建、账号设置、模板和计划编辑。

统一要求：表单字段间距、错误提示、未保存状态、取消/保存位置统一；表单内容可保留 `max-w-2xl` 到 `max-w-4xl`，但由页面模板决定，不再逐页随意选择。

### D. 工作台/概览页

页面骨架：

```text
PageHeader
  -> 指标/摘要
  -> 多列业务面板
  -> 最近活动 / 快捷入口
```

适用对象：`/`、`/cmdb`、CMDB 变更统计、流程统计、任务分析。

统一要求：指标卡只表达可行动数据；卡片内标题、说明、状态和跳转语义一致。复杂统计可以保留领域组件，不强制套列表模板。

### E. 全宽复杂工作区

页面骨架：

```text
WorkspaceToolbar
  -> 左侧资源/筛选面板（可折叠）
  -> 中央画布/编辑器/预览
  -> 右侧属性/详情面板（可折叠）
```

适用对象：CMDB 拓扑、2D 视图、空间布局查看/编辑、BPMN 设计器、Wiki 图谱、文件预览、任务模板设计器。

统一要求：全宽、不套普通列表最大宽度；统一工具栏高度、返回按钮、加载/错误/空态和移动端降级提示。画布本身的领域交互保持不变。

### F. 模块专用布局与状态守卫

Wiki 空间的 260px 可折叠目录侧栏是合理的模块专用布局；CMDB 当前 layout 是占位，不应再次引入重复模型树。登录、首次账号设置、权限重定向、加载中和错误页面属于守卫/状态页面，按独立模板治理。

## 3. 入口页矩阵

矩阵中的“实现位置”表示后续改造的主要落点：入口页、业务组件或模块 layout。

| 模块 | 路由/路由族 | 数量 | 页面类型 | 当前骨架 | 统一优先级 | 实现位置 |
|---|---|---:|---|---|---|---|
| 认证 | `/login` | 1 | 状态/守卫 | V2 Card + V2 Button，`max-w-sm` | P2 | 入口页 |
| 工作台 | `/` | 1 | 工作台 | PageHeader + 指标卡 + 日历/待办面板 | P0 | 入口页 + Dashboard 组件 |
| 账号 | `/account/profile`、`/account/password` | 2 | 表单 | PageHeader + `max-w-lg` Card | P2 | 入口页 |
| 账号 | `/account/setup` | 1 | 状态/守卫 + 表单 | 独立 `max-w-md` Card，无 PageHeader | P2 | 入口页 |
| CMDB | `/cmdb` | 1 | 工作台/目录 | PageHeader + 模型目录 + 实例浏览 | P0 | 入口页 + 业务组件 |
| CMDB | `/cmdb/instances`、`/cmdb/models` | 2 | 路由别名/重定向 | 重定向到 `/cmdb` 或 `/cmdb/admin` | P1 | 保留兼容，不做视觉改造 |
| CMDB | `/cmdb/associations` | 1 | 路由别名/重定向 | 旧关联入口重定向到按实例关联页 | P1 | 保留兼容，不做视觉改造 |
| CMDB | `/cmdb/admin`、`/cmdb/admin/models/[modelCode]` | 2 | 列表/配置详情 | PageHeader 或手写返回标题，子组件较重 | P1 | 入口页 + 配置组件 |
| CMDB | `/cmdb/alerts` | 1 | 标准列表 | PageHeader + FilterBar + DataTable | P0 | 入口页 |
| CMDB | `/cmdb/changes`、`/cmdb/changes/stats` | 2 | 列表/工作台 | PageHeader；变更页含原生表格，统计页含指标/表格 | P1 | 入口页 |
| CMDB | `/cmdb/impact/[instanceId]` | 1 | 详情/分析工作区 | 手写标题 + 层级影响结果 | P1 | 入口页 |
| CMDB | `/cmdb/instances/by-model/[modelCode]/page` | 1 | 标准列表 | PageHeader + DataTable + Dialog/Drawer | P0 | 入口页 |
| CMDB | `/cmdb/instances/by-model/[modelCode]/[id]` | 1 | 标准详情 | 手写标题 + 属性/关联区 | P1 | 入口页 + 详情组件 |
| CMDB | `.../[id]/associations`、`.../associations/new` | 2 | 详情子页/表单 | 手写返回标题；原生表格或搜索选择 | P1 | 入口页 |
| CMDB | `/cmdb/instances/by-model/[modelCode]/new` | 1 | 表单 | PageHeader + `max-w-3xl` | P1 | 入口页 |
| CMDB | `/cmdb/instances/2d-view` | 1 | 全宽工作区 | 旧 Button/Badge/Card，二维分组视图 | P2 | 入口页 + 视图组件 |
| CMDB | `/cmdb/topology/[instanceId]`、`.../compare` | 2 | 全宽工作区 | 负边距全高画布；工具栏与右侧面板 | P1 | 入口页 + 图组件 |
| CMDB | `/cmdb/spatial` | 1 | 标准列表/目录 | PageHeader + 活动/已归档分段 + 卡片列表 + 固定 overlay | P1 | `SpatialLayoutIndex` |
| CMDB | `/cmdb/spatial/rooms/[roomId]` | 1 | 全宽查看工作区 | 独立工具栏 + 画布/图层 | P2 | `SpatialRoomViewer` |
| CMDB | `/cmdb/spatial/rooms/[roomId]/edit` | 1 | 全宽编辑工作区 | 编辑器组件下沉 | P2 | 空间编辑器 |
| CMDB | `/cmdb/spatial/rooms/[roomId]/versions` | 1 | 详情/历史 | 版本历史工作区下沉 | P2 | 空间组件 |
| CMDB | `/cmdb/spatial/spike` | 1 | 技术验证页 | 实验性页面 | P3 | 保持隔离，发布前确认入口 |
| 变更文档 | `/change-docs` | 1 | 标准列表 | PageHeader + FilterBar + DataTable + Drawer | P0 | 入口页 |
| 变更文档 | `/change-docs/new` | 1 | 表单/编辑器 | 手写返回标题 + `max-w-4xl` Card/字段区 | P1 | 入口页 + editor 组件 |
| 变更文档 | `/change-docs/[id]` | 1 | 标准详情 | 手写标题 + DocActionBar + 字段区 | P1 | 入口页 + action bar |
| 变更文档 | `/admin/change-doc-templates`、`.../[id]` | 2 | 列表/配置编辑 | PageHeader 或手写返回标题，表格配置编辑器 | P2 | 入口页 + editor |
| 系统管理 | `/admin/ai`、`/admin/config` | 2 | 分组表单/配置工作台 | PageHeader + V2 表单组件；配置页仍混用旧 Button | P2 | 入口页 |
| 系统管理 | `/admin/audit`、`/admin/backup` | 2 | 高密度列表/运维操作 | PageHeader + DataTable；备份页含固定 overlay 恢复对话框 | P2 | 入口页 |
| 资源管理 | `/devices` | 1 | 标准列表 | PageHeader + FilterBar + DataTable + Drawer | P0 | 入口页 |
| 资源管理 | `/devices/new`、`/devices/[id]` | 2 | 表单/详情 | 手写标题，`max-w-2xl` 或属性详情 | P1 | 入口页 |
| 资源管理 | `/ipam`、`/ipam/[id]` | 2 | 列表/详情 | PageHeader + FilterBar + DataTable；详情含 DataTable/Dialog | P1 | 入口页 |
| 资源管理 | `/files` | 1 | 模块工作区/列表 | PageHeader + 左侧文件夹树 + DataTable + 多 Dialog | P2 | 入口页 + file components |
| 资源管理 | `/files/preview/[id]` | 1 | 全宽预览工作区 | 手写标题 + 原生表格/预览内容 | P2 | 入口页 + preview |
| 身份权限 | `/users`、`/groups` | 2 | 标准列表 | PageHeader + FilterBar/DataTable + Dialog | P0 | 入口页 |
| 身份权限 | `/rbac/roles`、`/rbac/permissions` | 2 | 配置列表/矩阵 | PageHeader + EmptyState 或权限矩阵 | P1 | 入口页 |
| 通知 | `/notifications` | 1 | 列表/消息中心 | PageHeader + Card/EmptyState + NotificationItem | P1 | 入口页 |
| 通知 | `/notifications/targets/...`、`/notifications/targets/resolve/...` | 2 | 状态/跳转页 | EmptyState/操作提示，无统一标题 | P2 | 入口页 |
| 日常工作 | `/work` | 1 | 列表/工作台 | 入口只包 Suspense，布局在 WorkItemList | P1 | `WorkItemList` |
| 日历 | `/ops-calendar` | 1 | 工作台/筛选 | PageHeader + FilterBar + 日历视图 | P2 | 入口页 + calendar |
| 日历 | `/ops-calendar/holidays`、`/ops-calendar/rosters` | 2 | 标准列表/配置 | PageHeader/DataTable 或下沉组件；部分固定宽度 | P2 | 入口页 |
| 任务 | `/tasks`、`/tasks/[taskId]` | 2 | 列表/详情 | 入口只挂 TaskList/TaskDetail；组件已部分使用 PageHeader/Card | P1 | task-runtime |
| 任务 | `/tasks/plans`、`/plans/new`、`/plans/[planId]` | 3 | 列表/多步表单 | 入口下沉；编辑器使用 PageHeader + 左步骤/右表单 | P1 | task-plan |
| 任务 | `/tasks/templates`、`/templates/new`、`/[templateId]` | 3 | 列表/表单/详情 | 入口下沉；已使用 PageHeader、Loading/Error/Empty | P1 | task-template |
| 任务 | `/tasks/templates/[templateId]/versions/[versionId]` | 1 | 全宽编辑工作区 | 三栏模板设计器，最小宽度约 1100px | P2 | task-template |
| 任务分析 | `/tasks/analytics`、`/[dashboardId]`、`/metrics`、`/automations` | 4 | 工作台/配置 | 入口下沉；统计结果含原生表格和手写 select | P2 | task-analytics |
| Wiki | `/wiki`、`/wiki/search` | 2 | 列表/搜索 | PageHeader + Card/EmptyState | P1 | 入口页 |
| Wiki | `/wiki/[spaceId]` | 1 | 模块首页 | Wiki 专用 layout + 空间首页 | P1 | Wiki layout + page |
| Wiki | `/wiki/[spaceId]/[pageId]`、`/edit` | 2 | 阅读/编辑工作区 | 目录侧栏 + Markdown 阅读/编辑 | P2 | Wiki layout + page |
| Wiki | `/wiki/[spaceId]/graph` | 1 | 全宽图谱工作区 | ReactFlow 图谱，独立工具栏 | P2 | 入口页 + graph |
| 流程 | `/workflow/admin`、`/bindings`、`/templates` | 3 | 配置列表/表单 | PageHeader + 原生 table/Dialog/EmptyState 混用 | P1 | 入口页 |
| 流程 | `/workflow/instances` | 1 | 标准列表 + 预览 | PageHeader + FilterBar + DataTable + BPMN viewer | P1 | 入口页 |
| 流程 | `/workflow/stats` | 1 | 工作台/统计 | PageHeader + 指标/EmptyState | P2 | 入口页 |
| 流程 | `/workflow/design`、`/design/[id]` | 2 | 全宽编辑工作区/表单 | 手写 h1 + 四列元数据 + BPMN editor，旧 Button | P1 | 入口页 + BpmnEditor |

## 4. 统一边界

### 必须统一

1. 全局页面内容边界、顶部间距和普通页/工作区的滚动边界。
2. 标准列表页的 PageHeader、FilterBar、Toolbar、表格状态和分页。
3. 详情/编辑页的返回、标题、状态、主操作和危险操作确认。
4. Loading、Error、Empty 三类状态的视觉和恢复动作。
5. 新增页面的按钮、状态标签和设计 token 入口，避免继续扩大双体系。
6. Dialog 的焦点管理、关闭行为、宽度级别和底部操作区。

### 建议统一

1. Tabs、分段切换、筛选项和 URL 参数命名的外观与键盘语义。
2. 表单字段 label、帮助文案、校验错误和底部操作栏。
3. 表格行高、数字列字体、状态 Badge 和移动端卡片降级。
4. 页面级空白、卡片圆角、边框和 V2 token 使用方式。

### 应保留模块差异

1. Wiki 的空间目录侧栏；它是内容导航，不是全局 Sidebar 的重复实现。
2. CMDB 拓扑、2D、空间布局、BPMN、文件预览、模板设计器的全宽画布和左右面板。
3. CMDB 概览的模型组目录和颜色编码；统一外壳即可，不应改成普通 DataTable。
4. 任务分析的统计结果、Wiki Markdown、BPMN 属性面板等领域交互。

## 5. 关键风险

- 入口页下沉组件较多，逐页修改容易出现“标题统一但实际工作区不统一”的假完成。
- `/cmdb`、任务模板、空间布局和文件中心包含较多领域状态，不能一次性替换为通用表格。
- `components/ui` 与 `components/v2` 不能在一个 PR 中强制重命名，否则会扩大回归范围。
- 普通页去掉最大宽度前必须保留表单/详情的模板级约束，否则会造成信息密度过低。
- 任何布局改动都要验证权限重定向、加载态、错误态和移动端滚动，不只看桌面截图。

## 6. 推荐结论

平台需要统一，但不应进行“81 页逐页重画”。最可落地的边界是：先统一 1 个全局 Shell、3 个标准页面模板、1 套状态反馈、1 个 Dialog 迁移边界，再按业务模块迁移页面外壳；特殊工作区只统一工具栏、状态和容器，不改领域交互。这样能在不改变 API、权限和路由的情况下逐步收敛视觉与交互差异。
