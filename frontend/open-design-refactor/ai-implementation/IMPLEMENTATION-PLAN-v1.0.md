# 前端页面统一化实施计划 v1.0

## 1. 工作包总览

| 工作包 | 内容 | 主要落点 | 依赖 | 退出条件 |
|---|---|---|---|---|
| WP-00 | 基线、证据和契约冻结 | 文档、脚本、状态 | 无 | 基线记录完整，工作树边界明确 |
| WP-01 | 共享页面模板 | `components/shared`、`components/layout` | WP-00 | 模板 API、类型和状态可用 |
| WP-02 | 全局 Shell 和容器 | dashboard layout、Header、Sidebar | WP-01 | 普通页/工作区滚动和响应式稳定 |
| WP-03 | 标准列表试点 | CMDB 告警、变更文档、用户 | WP-02 | 三页通过 L1-L3 验收 |
| WP-04 | 列表批量迁移 | 设备、用户组、流程实例、IPAM、审计 | WP-03 | 目标列表统一且无行为回归 |
| WP-05 | 详情和表单 | CMDB/设备/IPAM/变更文档/任务模板 | WP-03 | 列表到详情/编辑闭环通过 |
| WP-06 | 特殊工作区 | 拓扑、2D、空间、BPMN、Wiki、文件、模板设计器 | WP-02、WP-05 | 全宽、工具栏和状态统一 |
| WP-07 | 低频模块和收口 | 账号、通知、日历、任务分析、管理员页面 | WP-04、WP-06 | 静态扫描、质量门禁和文档收口通过 |

工作包必须按依赖门完成。允许在一个工作包内并行处理互不依赖的页面，但不要跨依赖门提前迁移页面或删除旧组件。当前状态文件若存在更早的 `IN_PROGRESS`，任何单批 Prompt 都不能绕过它。

## 2. WP-00：基线、证据和契约冻结

### 目标

把当前实现和验收入口固定下来，避免“统一后看起来更好”但无法证明没有行为回归。

### 执行项

1. 检查 `git status --short --branch` 和当前分支。
2. 阅读适用 `AGENTS.md`、设计矩阵、统一化计划、设计 token 和组件 README。
3. 记录 81 个入口页的静态扫描计数。
4. 确认前端可用的 lint、typecheck、build、测试和 dev server 命令。
5. 选取代表路由：`/`、`/cmdb`、`/cmdb/alerts`、`/change-docs`、`/users`、`/cmdb/topology/[instanceId]`、`/workflow/design`、`/wiki`。
6. 记录当前页面截图或说明无法启动的环境原因。

### 不允许

- 不在 WP-00 修改业务代码。
- 不因基线存在的失败而顺手修复无关问题。

### 交付

- `IMPLEMENTATION-STATUS-v1.0.md` 的基线命令、失败分类和代表路由记录。
- 如需脚本，脚本必须只读且放在明确的测试辅助目录。

## 3. WP-01：共享页面模板

### 目标

建立最小共享模板，减少页面继续手写布局。

### 建议范围

- `PageShell`
- `FormShell`
- `WorkspaceShell`
- `DetailHeader`
- `WorkspaceToolbar`
- 复用现有 `PageHeader`、`LoadingState`、`ErrorState`、`EmptyState`；本工作包不修改 `PageHeader`，因为其 upstream impact 为 CRITICAL，后续如需调整必须单独评估。

### 约束

- 组件不请求 API、不读取权限、不改变路由。
- 组件接口使用 typed props，避免 `ReactNode` 以外的无边界 `any`。
- 模板允许 `className`、`children`、`actions` 等有限 slot，但不为单个页面创建专属分支。

### 验证

- 组件级 TypeScript 编译。
- 最小 Story/测试或可运行的临时示例（若项目已有相应基础设施）。
- 1440px、1024px、390px 的容器和操作区截图。
- 如果 `frontend/package.json` 没有 `test` script，记录 `NOT_RUN（package.json 无 test script）`，不能虚构测试通过。

## 4. WP-02：全局 Shell 和容器

### 目标

让 Dashboard 的 Sidebar、Header、main 内容区和特殊工作区拥有稳定的尺寸与滚动边界。

### 主要文件

- `frontend/src/app/(dashboard)/layout.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- 必要时 `Breadcrumb.tsx`、Sidebar 子组件和 `cmdb/layout.tsx`。

### 约束

- 保留登录、首次设置、权限重定向、导航 badge、全局搜索、通知和用户菜单行为。
- 普通页面默认 `w-full max-w-none`；表单/详情由 `FormShell`/`PageShell` 控制；画布使用 `WorkspaceShell`。
- 不在本工作包重做 Sidebar 信息架构，不改变链接地址。

### 高风险验证

- 修改 Dashboard layout、Header、Sidebar 前分别执行 impact；若 HIGH/CRITICAL，先向用户报告。
- 首页、CMDB、Workflow、Wiki 和未授权路由各验证一次。
- 检查桌面/平板/手机是否出现双滚动条或内容被 Header 遮挡。

## 5. WP-03：标准列表试点

### 首批页面

1. `/cmdb/alerts`
2. `/change-docs`
3. `/users`

### 统一内容

- PageHeader 标题、说明和主操作。
- FilterBar 高度、换行、清除和输入焦点。
- DataTable/行操作、加载、错误、空态和分页。
- 仅在已有独立详情能力时使用 DetailDrawer。

### 保持不变

- API、query key、列字段、排序和权限判断。
- 过滤条件的 URL 结构和分页默认值。

### 试点退出条件

- 三页在 1440x900、1024x768、390x844 可用。
- 加载、错误、空数据、无权限、筛选、分页、主操作均有证据。
- 三页均有授权登录后的真实点击证据（L2）和三种 viewport 证据（L3）；只有未认证 HTTP 200 或源码检查时，状态仍为 `BLOCKED`/`IN_PROGRESS`。
- 试点后再决定是否继续 WP-04，不用试点失败的抽象推进全量迁移。

## 6. WP-04：列表批量迁移

### 页面

- `/devices`
- `/groups`
- `/workflow/instances`
- `/ipam`
- `/admin/audit`
- `/cmdb/instances/by-model/[modelCode]`

### 特别说明

- `/cmdb/instances`、`/cmdb/models`、`/cmdb/associations` 是兼容重定向入口，不做重复视觉实现。
- 流程实例页保留 BPMN viewer，只统一列表外壳和预览面板边界。
- 审计日志保留高密度信息，不为了卡片化牺牲扫描效率。

## 7. WP-05：详情和表单

### 页面

- CMDB 实例详情及关联新增。
- 设备详情/新建。
- IPAM 详情。
- 变更文档新建/详情。
- 任务详情、计划编辑、模板创建/详情。

### 统一内容

- DetailHeader 的返回、标题、状态、更新时间和操作位置。
- FormShell 的内容宽度、字段分组、错误提示和底部操作。
- 保存中、成功、失败、取消和未保存离开提示。

### 领域保护

- 不改变审批、发布、归档、提交和附件行为。
- 不改变字段顺序所表达的业务含义；只调整容器和间距。

## 8. WP-06：特殊工作区

### 页面

- `/cmdb/topology/[instanceId]` 与对比页。
- `/cmdb/instances/2d-view`。
- `/cmdb/impact/[instanceId]`。
- `/cmdb/spatial` 及房间查看/编辑/版本页。
- `/workflow/design` 及编辑页。
- `/wiki/[spaceId]/graph`、Wiki 阅读/编辑页。
- `/files/preview/[id]`。
- 任务模板三栏设计器。

### 统一内容

- WorkspaceShell、WorkspaceToolbar、面板折叠和剩余高度。
- 返回、标题、工具组、保存/导出/发布操作位置。
- 工作区 loading/error/empty/无权和移动端降级提示。

### 禁止

- 不把 BPMN/ReactFlow/空间布局/Markdown 领域控件替换成通用卡片。
- 不改变拓扑、空间布局、文件预览和编辑器数据请求。

## 9. WP-07：低频模块和收口

### 页面

- 账号资料、修改密码、首次设置。
- 通知中心和通知目标页。
- 运维日历、节假日和值班表。
- AI、系统配置、备份、模板管理。
- 任务分析、指标和自动化。
- Wiki 空间列表和搜索。

### 收口动作

1. 迁移固定 overlay 到受控 Dialog（仅触及时）。
2. 新增页面不得继续扩大旧 Button、原生表格和手写状态体系。
3. 静态扫描新增用法与基线对比，确认债务不扩大。
4. 更新矩阵、状态、验收报告和后续 P2 清单。

## 10. 回滚策略

- 每个 PR 只覆盖一个工作包或一个页面类型。
- 全局 Shell、共享组件和业务页面不在同一 PR 中混合重写。
- 出现权限跳转、双滚动条、API 参数变化或主操作不可达时，优先回滚当前工作包，不用页面局部补丁掩盖根因。

## 11. 提交前门禁

1. `git diff --check`。
2. `detect_changes()`，确认只影响当前工作包预期符号和执行流。
3. 前端 lint、typecheck、build 或仓库现有等价命令。
4. 相关单元/组件测试。
5. 代表路由真实点击验收和三种 viewport 截图。
6. 更新 `IMPLEMENTATION-STATUS-v1.0.md`，记录命令、结果、剩余风险和下一步。

## 12. 当前执行建议

当前分支已有 WP-01～WP-07 的共享 Shell、列表、详情/表单、特殊工作区和低频模块改动；WP-00～WP-07 已完成合同要求。后续 AI 应使用独立 Review/Acceptance Prompt 复核最终证据，不重做已验证工作包或扩大实现范围。
