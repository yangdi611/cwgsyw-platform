# 前端页面统一化实施计划 v2

## 1. 目标与非目标

### 目标

- 让普通列表、详情、表单和工作台页面拥有可预测的页面骨架。
- 让大屏、平板和手机在同一页面类型下遵循一致的容器与滚动规则。
- 统一标题、主操作、状态、表格、Dialog 的组合方式，同时保留业务组件和模块特色。
- 通过小批次 PR 实施，每批可独立验证和回滚。

### 非目标

- 不改变后端 API、权限资源、路由地址、查询参数和数据库结构。
- 不在本计划内重做业务信息架构；已有 Sidebar 8 模块方向继续沿用。
- 不一次性删除 `components/ui`，不强制所有历史页面立即迁移到 V2。
- 不将 Wiki、BPMN、拓扑、空间布局、文件预览改造成普通卡片页。

## 2. 目标架构

```text
Dashboard Shell
  ├─ AppFrame：Sidebar + Header + content scroll boundary
  ├─ PageShell：普通页 / 表单页 / 全宽工作区三种容器
  ├─ PageHeader：标题、面包屑上下文、主操作
  ├─ ListPage primitives：FilterBar + Toolbar + DataTable + Pagination
  ├─ DetailPage primitives：DetailHeader + Section/Tabs + DetailDrawer
  ├─ Feedback primitives：LoadingState + ErrorState + EmptyState
  └─ Workspace primitives：WorkspaceToolbar + CanvasPanels
```

原则：共享组件只负责外壳、语义和状态，不吞掉业务 API 或领域操作。页面模板通过 className/slot 提供可控差异，避免新建大量相似组件。

## 3. 分阶段计划

### Phase 0：基线与契约冻结

交付物：

- 保留本文件和 `route-layout-matrix-v2.md` 作为改造入口。
- 为 `PageShell`、`DetailHeader`、`WorkspaceToolbar` 定义接口和页面类型。
- 记录当前路由、权限、查询参数和关键视觉快照；形成回归基线。
- 明确 V2 新页面边界：新代码使用 `v2/` + `shared/`，旧页面不做无关迁移。

验收：`pnpm lint`、`pnpm typecheck`（或仓库现有等价命令）在基线通过；所有改造页面能从首页真实点击进入。

### Phase 1：统一全局 Shell 与普通容器

范围：`frontend/src/app/(dashboard)/layout.tsx`、`Header.tsx`、`Sidebar.tsx`、新增/调整 `PageShell`。

动作：

1. 明确普通内容区、表单详情区、全宽工作区的容器 class。
2. 保留现有面包屑、搜索、快捷新建、通知和权限守卫行为。
3. 将 `-m-6` 等工作区边界改为显式 `WorkspaceShell` 语义，避免依赖父级 padding。
4. 统一桌面/平板/移动端的导航收缩和主内容滚动。

验收：普通页无大屏窄容器；拓扑/Wiki 工作区不出现双滚动条；权限重定向和首次设置流程不变。

风险：全局影响面高。必须先做 upstream impact，改动后运行全量前端 lint/typecheck 和至少 4 个代表路由的桌面/移动截图。

### Phase 2：标准列表模板（第一批业务 PR）

第一批页面：

- `/cmdb/alerts`
- `/change-docs`
- `/devices`
- `/users`
- `/groups`
- `/workflow/instances`

动作：

1. 统一 `PageHeader` 标题、说明和右侧主操作。
2. 统一 `FilterBar` 的查询区高度、换行和清除行为。
3. 统一 `Toolbar`、表格加载/错误/空态、分页和行操作。
4. 保留每个页面的 API、列定义和权限判断；先不做跨模块字段改名。
5. 能使用详情抽屉的页面采用 `DetailDrawer`，不适合抽屉的保留独立详情路由。

验收：六页在 1440px、1024px、390px 通过同一套交互检查；筛选、分页、权限隐藏和错误重试均可用。

### Phase 3：详情与表单模板

范围：

- CMDB 实例详情与关联新建
- 设备详情/新建
- IPAM 详情
- 变更文档新建/详情
- 任务详情、计划编辑、模板创建/详情

动作：

1. 新增 `DetailHeader`，收敛返回、状态、更新时间和操作区。
2. 新增 `FormPage` 约束内容宽度、字段分组和底部操作。
3. 统一保存中、保存成功、校验失败和离开未保存状态。
4. 详情内部 Tabs/Sections 只做语义和间距统一，不改变领域字段顺序。

验收：从列表进入详情、编辑、保存、返回列表形成闭环；危险操作有一致的确认和取消路径；移动端操作区不溢出。

### Phase 4：CMDB 与 Workflow 工作区

范围：CMDB 拓扑、2D、影响分析、空间布局；BPMN 设计、实例预览；文件预览；Wiki 图谱。

动作：

1. 统一 `WorkspaceToolbar` 高度、返回按钮、标题、工具组、状态反馈。
2. 统一左/右面板折叠、画布剩余空间计算和桌面端提示。
3. 将手写加载/错误/空态替换为工作区专用状态组件。
4. 只迁移 Dialog/按钮外壳，不改 ReactFlow、BPMN、Markdown 和空间领域交互。

验收：画布在 1440px 不被普通 `max-w` 限制；平板不出现内容被工具栏遮挡；手机显示只读摘要或明确的桌面提示。

### Phase 5：低频模块与收口

范围：账号、通知目标页、日历、审计/备份/系统配置、文件中心、Wiki 空间页、任务分析。

动作：

1. 统一剩余页面的 PageHeader/状态组件。
2. 将固定 overlay 迁移到受控 Dialog，但保留 API 和确认文案。
3. 逐步减少新代码对旧 `ui/button`、原生 table 的依赖；历史代码只在触及时迁移。
4. 删除重复样式 helper 前先确认无调用方；不做大范围自动替换。

验收：静态扫描不再新增第二套组件用法；所有特殊工作区都有明确的滚动边界和错误恢复路径。

## 4. PR 拆分建议

每个 PR 只覆盖一个可验证边界：

1. `P0-shell-contract`：PageShell/WorkspaceShell 契约和全局布局。
2. `P1-list-pages-cmdb-change`：CMDB 告警、变更文档、设备列表。
3. `P1-list-pages-iam-workflow`：用户、用户组、流程实例。
4. `P1-detail-form-pages`：详情/表单模板与代表性页面。
5. `P2-cmdb-workspaces`：拓扑、2D、空间布局、影响分析。
6. `P2-workflow-wiki-files`：BPMN、Wiki 图谱/阅读、文件预览。
7. `P2-admin-cleanup`：审计、备份、系统配置、通知目标页。

不建议把所有分支或所有入口页一次性修改到一个 PR；这样无法区分 Shell 回归、页面业务回归和视觉差异来源。

## 5. 每个 PR 的执行门槛

开始前：

- 对要修改的共享组件/函数运行 GitNexus upstream impact，记录直接调用方和风险；HIGH/CRITICAL 必须先缩小范围或增加验证。
- 确认当前分支基于最新 `development`，保留用户未提交改动。

实现中：

- 不改变 API、权限、路由、查询键、URL 筛选参数和领域状态机。
- 新增/修改前端代码不得引入新的 lint 错误；避免在超过 600 行的页面继续堆叠行为。
- 每个列表/详情/工作区至少覆盖 loading、error、empty、permission denied 和 narrow viewport。

提交前：

- 运行 `detect_changes()`，确认只影响预期符号和执行流。
- 执行仓库现有 lint、typecheck、相关单元/集成测试。
- 启动 development 前端，使用真实点击验证首页、目标模块、详情/返回、主操作和权限守卫。
- 保存桌面 1440x900、平板 1024x768、手机 390x844 三组截图或等价证据。

## 6. 回滚与停止条件

### 回滚

- 每个 PR 保持单一页面类型或单一工作区边界，可独立 revert。
- 不在同一 PR 合并导航重组、组件重命名和业务逻辑重写。
- 若全局 Shell 导致双滚动条、权限跳转异常或首屏空白，优先回滚 Shell PR，不在业务页面临时打补丁。

### 停止条件

出现以下任一情况，应暂停下一批并修正当前批次：

- 路由/权限/API 行为发生变化。
- 桌面或手机出现遮挡、横向溢出、不可达主操作。
- loading/error/empty 状态缺失且无法恢复。
- 统一组件需要为单一页面增加大量例外 props，说明抽象边界不对。
- 视觉统一依赖跨模块重命名或一次性迁移旧组件，超出本批范围。

## 7. 建议的实际开始顺序

1. 先实施 Phase 0，只定义契约和记录基线。
2. 再实施 Phase 1，验证全局 Shell，不同时改业务页面。
3. 选择 `/cmdb/alerts`、`/change-docs`、`/users` 三页做最小列表试点。
4. 试点通过后扩展到设备、用户组、流程实例，再进入详情/工作区。
5. 每完成一批先做 PR review 和运行时点击验收，再决定是否继续下一批。

## 8. 最终建议

建议采纳“模板先行、模块分批、特殊工作区保留差异”的方案。当前分支适合继续作为调研和契约分支；确认计划后，再从 Phase 0 开始实现。这样既能收敛前端风格，也能把每次回归定位在明确的页面类型和 PR 范围内。
