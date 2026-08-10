# 前端统一化 Task Goal Prompt v1.0

本文件是可直接粘贴到 AI Goal/任务目标中的入口。它引用仓库内的实施合同，不把聊天上下文当作唯一状态来源。

## 1. 主任务目标 Prompt

```text
你是 cwgsyw-platform 前端页面统一化的实施工程师。请在当前仓库 /Users/byron/AI/cwgsyw-platform 的分支 codex/frontend-style-unification 上，依据 docs/open-design-refactor/ai-implementation/ 下的文档持续完成真实代码实施、验证和状态记录。

开始前完整读取：根 AGENTS.md、frontend/AGENTS.md、AI-IMPLEMENTATION-CONTRACT-v1.0.md、FINDING-TRACEABILITY-v1.0.md、README.md、IMPLEMENTATION-SPEC-v1.0.md、IMPLEMENTATION-PLAN-v1.0.md、AI-EXECUTION-RUNBOOK-v1.0.md、TEST-ACCEPTANCE-v1.0.md、IMPLEMENTATION-STATUS-v1.0.md、DELIVERY-REPORT-TEMPLATE-v1.0.md，以及 route-layout-matrix-v2.md、unification-plan-v2.md、docs/open-design-refactor/DESIGN_TOKENS.md、frontend/src/components/README.md、docs/open-design-refactor/MIGRATION.md。先检查 git status --short --branch 和当前用户未提交修改。

从 IMPLEMENTATION-STATUS-v1.0.md 的第一个未完成工作包继续，不重做已有且仍有效的证据。严格遵守 AI-IMPLEMENTATION-CONTRACT-v1.0.md 的选择规则：优先恢复最早的 IN_PROGRESS；若为 IN_PROGRESS/BLOCKED，只做不依赖阻塞的工作，不能标记 VERIFIED，也不能进入其依赖工作包；没有 IN_PROGRESS 时，才选择依赖已 VERIFIED 或用户明确批准 DEFERRED 的 TODO/READY。不要只输出计划：应在当前分支修改代码，运行门禁，进行真实路由/浏览器验收，更新状态文件，并在本工作包完成后继续下一个可实施工作包。

执行顺序固定为 WP-00 基线、WP-01 共享模板、WP-02 全局 Shell、WP-03 三页列表试点、WP-04 列表批量迁移、WP-05 详情/表单、WP-06 特殊工作区、WP-07 低频模块与收口。当前 WP-00～WP-07 均已 VERIFIED，下一步只做独立 Review/Acceptance。工作区只统一工具栏、容器、滚动边界和状态，不重写 ReactFlow、BPMN、Markdown、空间布局、文件预览等领域交互。

硬性不变量：不修改后端 API、DTO、数据库、migration、权限资源、路由地址、动态参数、重定向、React Query query key、分页/筛选参数、业务字段、审批/发布/归档状态机和特殊工作区领域行为。不得一次性删除 components/ui，不做全库正则替换，不覆盖、reset、checkout、删除用户已有或无关修改。

任何函数、类或方法改动前，先对准确 symbol 执行 GitNexus upstream impact；HIGH/CRITICAL 必须在继续前报告直接调用方、受影响流程、风险和缓解方式。每个工作包完成后运行 git diff --check、frontend lint、typecheck，以及 package.json 中存在的 build/test；项目没有 test script 时明确记录 `NOT_RUN`。使用真实点击覆盖 loading/error/empty/permission denied、主操作、筛选/分页、Dialog、详情/编辑/返回，以及 1440x900、1024x768、390x844 三种 viewport；最后执行 detect_changes()。如果新增未追踪文件导致 detect_changes 无法观察，明确记录限制，不得把 No changes detected 当作通过。

把所有结果写回 IMPLEMENTATION-STATUS-v1.0.md，并按 DELIVERY-REPORT-TEMPLATE-v1.0.md 输出交付或阻塞报告，严格区分 PASS、FAIL、BASELINE_FAIL、BLOCKED 和 NOT_RUN。按 L0（源码/静态）、L1（命令/HTTP）、L2（授权登录真实点击）、L3（L2 加三种 viewport）记录证据；只有工作包退出条件要求的最低等级全部齐全，才可标记 VERIFIED。遇到 API/权限/路由/状态机边界、无法降低的 HIGH/CRITICAL 风险、破坏性环境操作、浏览器/登录态/业务数据缺失或用户修改冲突时暂停并给出证据和最小决策问题。普通组件命名、间距和迁移顺序采用与现有代码一致的保守方案自行推进。未经我明确授权，不 commit、push、merge、deploy 或切换分支。
```

## 2. 当前工作包 Prompt：WP-07

```text
WP-07 已完成。请不要重新执行低频模块实施；先读取 TASK-GOAL-PROMPT-v1.0.md、FINDING-TRACEABILITY-v1.0.md、IMPLEMENTATION-SPEC-v1.0.md、IMPLEMENTATION-PLAN-v1.0.md、TEST-ACCEPTANCE-v1.0.md 和 IMPLEMENTATION-STATUS-v1.0.md，使用下方“只做 Review 的 Prompt”或“只做验收的 Prompt”复核 WP-00～WP-07 的最终证据。不要重做共享模板、Shell、列表、详情/表单、特殊工作区或低频页面代码。

范围是账号资料/密码/首次设置、通知中心及通知目标、运维日历/节假日/值班表、AI/系统配置/备份、任务分析/指标/自动化、Wiki 空间列表和搜索。先以 WP-00 静态基线比较固定 overlay、裸标题、手写状态、旧 Button 和原生 table；只处理实际触及页面，不做全库替换。优先使用现有 `components/shared`、`components/v2` 和受控 Dialog，保持 API、权限、路由、query key、业务状态机和模块专用布局不变。

使用当前分支服务和用户授权的 `.env` 中 `FQA_SUPERADMIN_PASSWORD` 做临时 development 验收，密码和 token 不得输出、持久化或写入文档；只读验收，不执行备份恢复、删除、发布或其他破坏性写操作。完成后运行 `git diff --check`、lint、typecheck、build/相关测试（没有 test script 则记录 `NOT_RUN`），对代表路由执行真实点击和 `1440x900`、`1024x768`、`390x844` 检查，运行 `detect_changes`，更新 STATUS、遗留 P2 和完成定义。未经明确授权不 commit、push、merge、deploy 或切换分支。
```

## 3. 历史回归 Prompt：WP-04

```text
继续执行前端统一化 WP-04 列表批量迁移。先读取 TASK-GOAL-PROMPT-v1.0.md、FINDING-TRACEABILITY-v1.0.md、IMPLEMENTATION-SPEC-v1.0.md、IMPLEMENTATION-PLAN-v1.0.md、TEST-ACCEPTANCE-v1.0.md 和 IMPLEMENTATION-STATUS-v1.0.md，确认 WP-00～WP-03 已 VERIFIED、当前分支和用户修改。不要重做共享模板、Shell 或三页试点，不要进入 WP-05。

目标页面是 `/devices`、`/groups`、`/workflow/instances`、`/ipam`、`/admin/audit`、`/cmdb/instances/by-model/[modelCode]`。代码、静态检查和 API/L1 数据证据已存在，先对目标页面 symbol 和共享组件复核 upstream impact，再启动当前分支服务（不要使用 3006 的旧构建产物）。只使用用户授权的 `.env` 中 `FQA_SUPERADMIN_PASSWORD` 做临时 development 登录；密码和 token 不得输出、持久化或写入文档。

逐页完成从首页或指定入口的真实点击，覆盖真实数据/空态、loading/error/retry、筛选、分页、Dialog、详情抽屉/预览、主操作和返回；在 `1440x900`、`1024x768`、`390x844` 检查无页面级横向溢出、Header/Sidebar 遮挡和表格自身滚动。流程页保留 BPMN viewer，审计页保留高密度扫描体验，CMDB 模型页至少验收 `host`；若 `/admin/audit` 命中旧 chunk 404，按环境阻塞记录并切换到当前服务，不能把它写成产品代码 FAIL。完成后运行 lint、typecheck、build、git diff --check、detect_changes 并更新 STATUS；只有六页 L2/L3 证据齐全才可把 WP-04 标记 VERIFIED。
```

## 4. 历史回归 Prompt：WP-02（仅在状态台账要求回退时使用）

```text
继续执行前端统一化 WP-02 全局 Shell 与容器。先读取 README.md、FINDING-TRACEABILITY-v1.0.md、IMPLEMENTATION-SPEC-v1.0.md、IMPLEMENTATION-PLAN-v1.0.md、TEST-ACCEPTANCE-v1.0.md、AI-EXECUTION-RUNBOOK-v1.0.md 和 IMPLEMENTATION-STATUS-v1.0.md，确认 WP-01 已 VERIFIED，不要重做共享模板或迁移业务页面。

当前已有 Dashboard layout、Header、Sidebar 的代码改动和共享 Shell 三种 viewport 证据。先对 DashboardLayout、Header、Sidebar 复核 upstream impact；DashboardLayout 的认证/权限/导航流程风险为 HIGH 时，保持本批只做容器和样式边界，不改变守卫、面包屑、搜索、通知、用户菜单、导航 badge 或链接地址。

运行 git diff --check、frontend lint、typecheck、build，并启动 development 前端。取得授权登录态后，从首页真实点击验证 /、/cmdb、/workflow/design、/wiki 和一个无权限路由，覆盖 1440x900、1024x768、390x844；重点检查双滚动条、Header 遮挡、Sidebar 覆盖、主内容横向溢出和移动端主要操作。没有有效登录态时，不猜密码、不修改凭据，把真实业务路由记录为 BLOCKED，但仍完成静态检查和未认证重定向复验。

完成后更新 IMPLEMENTATION-STATUS-v1.0.md，记录 impact、静态命令、真实路由/viewport 证据、阻塞、回滚边界和下一步；运行 detect_changes。仅当状态台账明确要求回归 WP-02 时，才按本节检查 Shell 的最低 L2/L3；当前指针以 STATUS 为准，WP-06 未完成前不得进入 WP-07。未经明确授权不 commit、push、merge、deploy 或切换分支。
```

## 5. 历史回归 Prompt：WP-03（仅在状态台账要求回退时使用）

```text
继续执行前端统一化 WP-03 列表试点，范围严格限定为 /cmdb/alerts、/change-docs、/users。先读取 README.md、FINDING-TRACEABILITY-v1.0.md、IMPLEMENTATION-SPEC-v1.0.md、IMPLEMENTATION-PLAN-v1.0.md、TEST-ACCEPTANCE-v1.0.md、AI-EXECUTION-RUNBOOK-v1.0.md 和 IMPLEMENTATION-STATUS-v1.0.md，检查当前分支和用户未提交修改。当前三个页面已有初步代码改动：PageShell、响应式标题/筛选/主操作、ErrorState 重试和权限感知空态；不要重做已通过的静态改动。

先对三个页面入口执行 GitNexus upstream impact；对 PageHeader、FilterBar、DataTable、Pagination、DetailDrawer 等共享组件只完成影响评估。共享组件影响为 CRITICAL 时，优先保持页面级组合，不修改共享实现；任何无法降低的高风险必须在 commentary 说明调用方、流程、风险和缓解。保留 API 路径/方法、React Query query keys、分页、URL 筛选参数、业务列、权限、Dialog、详情抽屉和现有搜索请求契约；不要为了视觉统一给 /users 请求新增 keyword 参数。

先运行 git diff --check、frontend lint、typecheck、build。仅当状态台账明确要求回归 WP-03 时，才启动 development 前端并验收三页列表；若没有授权登录态，不得猜密码、暴力尝试或修改数据库凭据，应记录 BLOCKED。当前指针以 STATUS 为准，不能把静态检查当作运行时通过，也不得在 WP-06 未完成时进入 WP-07。

完成后更新 IMPLEMENTATION-STATUS-v1.0.md，记录修改文件、finding、impact、静态命令、路由和 viewport 证据、阻塞原因、回滚边界与下一步；运行 detect_changes，明确新增/未追踪文件是否被纳入。只有三页真实业务路径和三种 viewport 证据齐全，才可把 WP-03 标记 VERIFIED。未经明确授权不 commit、push、merge、deploy 或切换分支。
```

## 6. 续跑 Prompt

```text
继续当前 cwgsyw-platform 前端页面统一化任务。先读取 AI-IMPLEMENTATION-CONTRACT-v1.0.md、IMPLEMENTATION-STATUS-v1.0.md 最近一条记录、FINDING-TRACEABILITY-v1.0.md 和当前工作包所需的 SPEC/PLAN/TEST 文档，检查 git status 和最新用户指令。从第一个未完成工作包继续，不重做仍然有效的证据。遵守合同和 AI-EXECUTION-RUNBOOK-v1.0.md 的 impact、最小变更、静态门禁、运行时视觉、detect_changes 和状态更新协议。保持 API、权限、路由、query keys、业务状态机、数据库和特殊工作区领域行为不变。普通实现选择自行推进；只有硬性行为边界、无法降低的高风险、破坏性环境授权、浏览器/登录态/业务数据阻塞或用户修改冲突才暂停。未经明确要求不 commit、push、merge、deploy 或切换分支。
```

## 7. 只做 Review 的 Prompt

```text
请 review 当前前端统一化变更，不修改代码。读取 FINDING-TRACEABILITY、IMPLEMENTATION-SPEC、IMPLEMENTATION-PLAN、TEST-ACCEPTANCE、IMPLEMENTATION-STATUS 和当前 diff。按严重性优先报告：API/权限/路由/query key/状态机回归；Shell 双滚动、首屏空白、遮挡和移动端溢出；loading/error/empty/无权限缺失；特殊工作区被普通容器限制；新增旧 Button、裸 h1、固定 overlay、原生 table 或无理由 any；impact/detect_changes 和运行时证据缺失。每个 finding 引用绝对路径和行号；没有问题时明确说明测试缺口和残余风险。
```

## 8. 只做验收的 Prompt

```text
请依据 TEST-ACCEPTANCE-v1.0.md 和 AI-EXECUTION-RUNBOOK-v1.0.md 对当前前端统一化工作包做运行时验收，不修改代码。先检查工作树、状态文件和可用命令；启动 development 前端时选择未占用端口。从首页或指定入口真实点击进入目标模块，验证主路径、权限守卫、loading/error/empty、筛选/分页、Dialog、详情/编辑/返回、特殊工作区画布和移动端降级。覆盖 1440x900、1024x768、390x844，记录截图或等价证据，并将每项标记为 PASS、FAIL、BLOCKED 或 NOT_RUN。不得把源码检查替代真实点击验收，不得把未执行写成通过。
```
