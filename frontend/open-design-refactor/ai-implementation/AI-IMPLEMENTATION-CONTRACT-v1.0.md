# 前端页面统一化 AI 实施合同 v1.0

## 1. 用途

这份合同把 F-01 至 F-07 的 finding 转成 AI 可以持续执行的工作协议。它不是新的视觉方案，也不授权后端、数据库或发布操作；它规定 AI 每次接管任务时必须读取什么、可以改什么、如何证明完成、何时必须暂停。

适用分支：`codex/frontend-style-unification`

运行环境：`development`

代码范围：`frontend/` 页面入口、Dashboard Shell、共享页面模板和被当前工作包触及的业务组件。

## 2. 权威关系

发生冲突时按以下顺序处理：

1. 用户当前指令。
2. 根目录及目标路径适用的 `AGENTS.md`。
3. 本合同：`AI-IMPLEMENTATION-CONTRACT-v1.0.md`。
4. `FINDING-TRACEABILITY-v1.0.md`。
5. `AI-EXECUTION-RUNBOOK-v1.0.md`。
6. `IMPLEMENTATION-SPEC-v1.0.md`。
7. `IMPLEMENTATION-PLAN-v1.0.md`。
8. `TEST-ACCEPTANCE-v1.0.md`。
9. `IMPLEMENTATION-STATUS-v1.0.md` 的最新状态和变更记录。
10. `route-layout-matrix-v2.md`、`unification-plan-v2.md`、设计 token 和组件迁移文档。

状态文件是进度真相，但不能推翻用户最新指令或本仓库规则。Prompt 已存在不等于代码已完成；源码存在不等于运行时验收通过。

## 3. 参与角色和最小输入

### AI 实施工程师

AI 负责读取合同、选择可执行工作包、修改代码、运行验证、更新状态和输出交付报告。AI 不自行 commit、push、merge、deploy、切换分支或修改账号凭据。

### 项目负责人

项目负责人只需要：

1. 在当前分支复制主 Goal Prompt，启动或续跑任务。
2. 查看 `IMPLEMENTATION-STATUS-v1.0.md` 的最后一条记录。
3. 遇到外部阻塞时提供授权测试条件，或明确批准 `DEFERRED`。
4. 在独立的 PR 流程中决定 review、merge 和发布。

### 每次接管必须具备的输入

| 输入 | 用途 | 缺失时的处理 |
|---|---|---|
| 当前分支和工作树 | 确认不会覆盖用户修改 | 先停止并报告冲突 |
| `IMPLEMENTATION-STATUS-v1.0.md` | 选择工作包和复用证据 | 不凭聊天记录猜进度 |
| finding 追踪矩阵 | 确认本批目标和回滚边界 | 不扩大范围 |
| SPEC/PLAN/TEST | 确认实现合同和退出条件 | 先补阅读，不先改代码 |
| 可用 lint/typecheck/build | 建立静态门禁 | 标记 `NOT_RUN` 或 `BLOCKED` |
| development 登录态和业务数据 | L2/L3 真实验收 | 没有时如实记录阻塞 |

## 4. 绝对不变量

以下内容在任何工作包中都不得改变：

- 后端 API、DTO、数据库、migration 和业务数据。
- 路由地址、动态参数、重定向、面包屑解析和兼容入口。
- React Query query key、缓存失效、分页默认值和筛选参数。
- 权限资源、路由守卫、按钮显隐和后端鉴权语义。
- 审批、发布、归档、删除、保存和提交状态机。
- CMDB、Workflow、Wiki、文件预览、空间布局、ReactFlow、BPMN 和 Markdown 的领域交互。

禁止一次性删除 `components/ui`、全库正则替换样式、覆盖用户修改、读取或修改密码哈希、猜测密码或修改数据库凭据。

## 5. 工作包依赖门

工作包状态不是“做过源码修改”标记，而是证据状态。状态含义如下：

| 状态 | 可以做什么 | 不能做什么 |
|---|---|---|
| `TODO`/`READY` | 依赖满足后开始 | 不能跳过前置工作包 |
| `IN_PROGRESS` | 继续当前工作包；可做不依赖阻塞的工作 | 不能把缺失证据写成通过 |
| `BLOCKED` | 记录复现证据，寻找不改变合同的替代方案 | 不能解除依赖门 |
| `DEFERRED` | 仅按用户明确授权继续不依赖部分 | 不能伪装成 `VERIFIED` |
| `VERIFIED` | 允许依赖它的工作包开始 | 仍需保留证据和回滚边界 |

选择规则：

1. 优先恢复最早的 `IN_PROGRESS`。
2. 如果该工作包是 `IN_PROGRESS` 且被外部条件阻塞，只继续不依赖阻塞的工作；不能标记 `VERIFIED`。
3. 只有不存在更早的 `IN_PROGRESS` 时，才选择依赖已 `VERIFIED` 或用户批准 `DEFERRED` 的 `TODO/READY`。
4. 一个依赖工作包从未开始时，不能因为前置工作包被阻塞就提前启动它。
5. 当前状态下，WP-00～WP-07 均已满足各自退出条件；后续只做独立 Review/Acceptance 和合并决策，不再扩大实现范围。

## 6. 工作包合同

| 工作包 | 目标和 finding | 允许修改 | 最低退出证据 | 依赖/回滚 |
|---|---|---|---|---|
| WP-00 | 冻结基线，覆盖 F-07 | 只读盘点、状态文档和只读辅助脚本 | L0/L1 基线、工作树边界、命令可用性 | 无；回滚为文档变更 |
| WP-01 | 共享模板，覆盖 F-01/F-03/F-05 | `PageShell`、`FormShell`、`WorkspaceShell`、`DetailHeader`、`WorkspaceToolbar` | 类型检查、组件运行示例、三 viewport 结构证据、detect_changes | WP-00；独立回滚 shared 模板 |
| WP-02 | 全局 Shell，覆盖 F-01/F-02 | Dashboard layout、Header、Sidebar 和滚动边界 | L1 + 首页/CMDB/Workflow/Wiki/无权路由 L2/L3 | WP-01；Shell 回归整体回滚 |
| WP-03 | 三页列表试点，覆盖 F-01/F-03/F-04/F-06 | `/cmdb/alerts`、`/change-docs`、`/users` 页面级组合 | 三页 L2/L3、状态/操作矩阵、API/权限不变量核对 | WP-02；试点批次整体回滚 |
| WP-04 | 列表批量迁移，覆盖 F-03/F-04/F-06 | 设备、用户组、流程实例、IPAM、审计和 CMDB 模型列表外壳 | 每页核心路径、状态、三 viewport、detect_changes | WP-03；按页面组回滚 |
| WP-05 | 详情/表单，覆盖 F-03/F-06 | `DetailHeader`/`FormShell` 组合、字段分组和操作反馈 | 列表到详情/编辑/保存/返回闭环、三 viewport | WP-03；详情/表单批次回滚 |
| WP-06 | 特殊工作区，覆盖 F-05/F-06 | 工具栏、面板边界、剩余高度和状态承载 | 非空画布、无遮挡、无双滚动条、移动端降级、三 viewport | WP-02、WP-05；按工作区回滚 |
| WP-07 | 低频收口，覆盖 F-04/F-07 | 触及范围内的 overlay、状态、旧组件债务和文档 | 基线对比不扩大、质量门禁、P0/P1 收口 | WP-04、WP-06；收口批次回滚 |

每个工作包都必须在状态文件写明“允许变化”和“禁止变化”。当某页面需要超过两个专属例外 prop 才能接入模板时，暂停该页面，不继续堆叠抽象。

## 7. 单工作包执行协议

### Step 0：接管现场

```bash
git status --short --branch
git diff --stat
git diff --check
```

读取状态文件的最后一条记录，确认用户已有修改、当前工作包、阻塞次数、可复用证据和唯一下一步。

### Step 1：冻结边界

在开始编辑前写出：目标 finding、目标文件、允许变化、禁止变化、退出条件、回滚边界。只读调查可以使用 GitNexus `query`/`context`；不熟悉的模块先查执行流。

### Step 2：影响分析

修改任何函数、类或方法前，对准确 symbol 执行 GitNexus upstream impact。记录直接调用方、受影响流程、风险等级和缓解措施。`HIGH`/`CRITICAL` 共享组件优先采用页面级组合、适配器或拆分；无法降低时暂停请求决定。

### Step 3：最小实现

先改外壳，再改状态组合，最后处理当前范围内的按钮、Dialog 或表格。模板不得请求 API、读取权限或承载领域算法。人工编辑使用 `apply_patch`，保留所有用户未提交修改。

### Step 4：静态门禁

至少执行：

```bash
git diff --check
cd frontend && npm run lint
cd frontend && npm run typecheck
```

存在脚本且本批影响构建行为时执行 `npm run build`；项目没有测试脚本时记录 `NOT_RUN（package.json 无 test script）`，不得虚构测试通过。

### Step 5：运行时和视觉

从首页或指定入口真实点击进入目标页面，至少覆盖本批适用的 loading、error、empty、permission denied、主操作、筛选/分页、Dialog、详情/编辑/返回。使用 `1440x900`、`1024x768`、`390x844`，记录截图或可复核的浏览器测量结果。

没有授权登录态、业务数据、浏览器或端口时，记录 `BLOCKED`；不要猜密码、暴力尝试、修改数据库或用未认证页面替代业务验收。

### Step 6：变更范围检查

工作包结束运行 GitNexus `detect_changes()`。新增未追踪文件未进入索引时，记录限制并使用安全的 intent-to-add/索引刷新方式补足；不能把 `No changes detected` 当作无影响。

### Step 7：状态和交付

更新 `IMPLEMENTATION-STATUS-v1.0.md`，然后按 `DELIVERY-REPORT-TEMPLATE-v1.0.md` 输出。每项证据标记 `PASS`、`FAIL`、`BASELINE_FAIL`、`BLOCKED` 或 `NOT_RUN`，并标注 L0/L1/L2/L3 等级。

## 8. 证据等级和完成定义

| 等级 | 证据 | 能证明什么 |
|---|---|---|
| L0 | 源码、静态扫描、impact | 结构、调用图和变更边界 |
| L1 | lint、typecheck、build、HTTP | 编译、构建和服务可达 |
| L2 | 授权登录后的真实点击 | 路由、权限、业务操作和恢复路径 |
| L3 | L2 加三种 viewport 证据 | 响应式运行时和视觉布局 |

工作包只有在其合同要求的最低证据全部满足时才可 `VERIFIED`。总体目标只有在 WP-00 至 WP-07 全部 `VERIFIED`，或有用户明确授权的 `DEFERRED`，且 P0 全部通过、P1 无未解释失败、detect_changes 范围可解释时才能报告完成。

## 9. 必须暂停的情况

出现以下任一情况，AI 应停止扩大范围并按阻塞模板请求最小决定：

- 需要改变 API、权限、路由、query key、数据库或业务状态机。
- `HIGH`/`CRITICAL` impact 无法通过拆分、适配器或额外验证降低。
- 用户未提交修改和目标文件冲突，无法安全合并。
- 需要真实生产数据、破坏性环境操作或新外部授权。
- 浏览器、登录态或关键业务数据使当前工作包的最低 L2/L3 证据无法获得。
- 共享模板需要为一个页面增加大量例外分支。

暂停报告必须包含：复现证据、已尝试措施、受影响验收、可继续的静态工作、推荐方案和唯一决策问题。

## 10. 项目负责人操作手册

第一次执行：复制 `TASK-GOAL-PROMPT-v1.0.md` 的“主任务目标 Prompt”。

任务中断：复制同一文件的“续跑 Prompt”，让 AI 先读取状态文件，不依赖聊天记录。

只做一批：复制 `PROMPT-PLAYBOOK-v1.0.md` 对应 WP Prompt。

只做审查：复制 Review Prompt；只做浏览器验收：复制 Acceptance Prompt。

遇到阻塞：提供授权 development 测试登录态，或明确批准 `DEFERRED` 的原因和重新验收触发条件。不要提供生产密码、密码哈希，也不要让 AI 修改账号数据。

合并前：先看状态台账、Review 报告、Acceptance 报告和 `detect_changes()`，再单独授权 PR/merge/release 操作。
