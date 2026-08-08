# 前端页面统一化 AI 实施文档

## 1. 用途

本目录把 `route-layout-matrix-v2.md` 和 `unification-plan-v2.md` 转换为可交给 AI 执行代理的实施合同。目标是让代理能够在当前 `codex/frontend-style-unification` 分支上持续完成前端页面统一化，而不是只返回设计建议。

适用范围：

- 全局 Dashboard Shell、页面容器和滚动边界。
- 标准列表、详情、表单、工作台四类页面模板。
- Loading、Error、Empty、Dialog、按钮和状态标签的组合方式。
- CMDB、Workflow、Wiki、文件预览、空间布局等特殊工作区的统一外壳。

不适用范围：

- 后端 API、数据库、权限资源、路由地址和查询键改造。
- 业务状态机、领域字段、Flowable、ReactFlow、BPMN、Markdown 和空间布局算法重写。
- 一次性重命名或删除所有旧 `components/ui` 组件。

## 2. 文档权威顺序

发生冲突时按以下顺序处理，用户当前明确指令最高：

1. 仓库根目录及目标路径适用的 `AGENTS.md`。
2. 用户当前消息和当前分支已有改动。
3. 本目录 `AI-IMPLEMENTATION-CONTRACT-v1.0.md`。
4. 本目录 `FINDING-TRACEABILITY-v1.0.md`。
5. 本目录 `AI-EXECUTION-RUNBOOK-v1.0.md`。
6. 本目录 `IMPLEMENTATION-SPEC-v1.0.md`。
7. 本目录 `IMPLEMENTATION-PLAN-v1.0.md`。
8. 本目录 `TEST-ACCEPTANCE-v1.0.md`。
9. `frontend/open-design-refactor/route-layout-matrix-v2.md`。
10. `frontend/open-design-refactor/unification-plan-v2.md`。
11. `frontend/DESIGN_TOKENS.md`、`frontend/src/components/README.md`、`frontend/MIGRATION.md`。

## 3. 使用入口

- 项目负责人第一次接手：先读 [`START-HERE-v1.0.md`](./START-HERE-v1.0.md)，按其中步骤复制 Goal Prompt。

- 需要确认 AI 的输入、依赖门、证据等级和暂停条件：先读 [`AI-IMPLEMENTATION-CONTRACT-v1.0.md`](./AI-IMPLEMENTATION-CONTRACT-v1.0.md)。

- 需要一页看懂整个执行流程：先读 [`AI-IMPLEMENTATION-KIT-v1.0.md`](./AI-IMPLEMENTATION-KIT-v1.0.md)。
- 要求 AI 从当前状态持续执行：使用 `TASK-GOAL-PROMPT-v1.0.md` 的主任务目标 Prompt。
- 需要完整背景和执行纪律：先读 `AI-EXECUTION-RUNBOOK-v1.0.md`。
- 需要核对 finding 到工作包的关系：先读 `FINDING-TRACEABILITY-v1.0.md`。
- Goal 中断后继续：使用 `TASK-GOAL-PROMPT-v1.0.md` 的续跑 Prompt，并先读取 `IMPLEMENTATION-STATUS-v1.0.md`。
- 只执行某个工作包：使用 `PROMPT-PLAYBOOK-v1.0.md` 对应工作包 Prompt。
- 实施完成后做代码审查：使用 Playbook 或 Task Goal Prompt 的 Review Prompt。
- 只做运行时验收：使用 Playbook 或 Task Goal Prompt 的 Acceptance Prompt。
- 需要统一交付、阻塞或 Review 报告格式：使用 [`DELIVERY-REPORT-TEMPLATE-v1.0.md`](./DELIVERY-REPORT-TEMPLATE-v1.0.md)。

`AI-IMPLEMENTATION-PROMPT-v1.0.md` 保留为兼容入口；新任务优先使用 `TASK-GOAL-PROMPT-v1.0.md`，因为它明确了 finding、证据等级、当前工作包状态和 untracked 变更的 detect_changes 限制。

## 4. 用户最短操作路径

1. 在 `codex/frontend-style-unification` 分支确认工作树和用户修改。
2. 把 `TASK-GOAL-PROMPT-v1.0.md` 的“主任务目标 Prompt”粘贴到 AI Goal。
3. 中断后使用同文件的“续跑 Prompt”，不要凭聊天记录恢复状态。
4. 需要单批执行、Review 或浏览器验收时，使用 `PROMPT-PLAYBOOK-v1.0.md` 对应章节。
5. 合并前只看 `IMPLEMENTATION-STATUS-v1.0.md` 的证据，不把文档已创建当作实现完成。

### 当前这次任务的第一步

当前没有未完成的实现工作包。WP-00～WP-07 的代码、静态检查、授权真实加载和三种 viewport 证据已经具备；项目负责人下一步只需使用 Review/Acceptance Prompt 做合并前审查，不要重做实现批次。

不要同时粘贴主任务、某个 WP Prompt 和 Acceptance Prompt。需要限定范围时才改用 `PROMPT-PLAYBOOK-v1.0.md` 的单个章节；需要只验收或只 Review 时，单独启动对应 Prompt。

## 5. 执行原则

1. 当前分支就是实施分支，不自动创建、切换或合并其他分支。
2. 每次接管先按 `AI-IMPLEMENTATION-CONTRACT-v1.0.md` 选择工作包和确认依赖门，再按 WP-00 至 WP-07 顺序推进。
3. 任何函数、类或方法改动前运行 GitNexus upstream impact；HIGH/CRITICAL 风险先向用户报告。
4. 每个工作包完成后运行 `detect_changes()`、相关 lint/typecheck/测试和代表路由验收，再更新状态文件。
5. 保留用户已有修改；未经明确授权不 reset、checkout、删除用户文件、push、部署或合并。
6. 特殊工作区只统一工具栏、容器和状态反馈，不强行套普通列表模板。

## 6. 当前状态

当前状态以 [`IMPLEMENTATION-STATUS-v1.0.md`](./IMPLEMENTATION-STATUS-v1.0.md) 为准：WP-00～WP-07 已 `VERIFIED`。创建 Prompt、计划或规格文档不等于工作包实现完成；本轮已具备代码、静态、运行时和视觉证据。

## 7. 交付状态

每次 AI 续跑都必须先核对工作树、当前状态和有效证据，不能凭对话记忆判断完成度。状态只能在代码、命令、运行时和视觉证据齐全后升级为 `VERIFIED`；`PASS`、`BASELINE_FAIL`、`BLOCKED` 和 `NOT_RUN` 必须按实际情况记录。

`IN_PROGRESS/BLOCKED` 只是一种说明性组合，表示工作包仍在实施但受到外部阻塞；它不能作为 `VERIFIED` 或依赖门解除的依据。`DEFERRED` 必须由用户明确授权，并记录原因和重新验收条件。

## 8. 可操作性结论

这套方案可以直接执行，但必须把“代码实施”和“运行时验收”看作两个相互依赖的门：

- AI 可以在没有 development 登录态时继续页面级静态实施、类型检查、构建和文档记录，但不能伪造 L2/L3 通过。
- 没有授权登录态、关键业务数据、当前分支服务或可用浏览器时，当前工作包保持 `IN_PROGRESS/BLOCKED`，依赖它的工作包不启动。
- 只有用户明确批准 `DEFERRED`，并写明原因、授权人和重新验收触发条件，才允许暂缓某项运行时证据；`DEFERRED` 不等于 `VERIFIED`。
- 交付前应先使用 Review Prompt，再使用 Acceptance Prompt；commit、push、merge、deploy 由项目负责人单独决定。
