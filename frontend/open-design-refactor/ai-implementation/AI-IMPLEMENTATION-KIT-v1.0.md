# 前端页面统一化 AI 实施资料包 v1.0

本文件是给项目负责人和后续 AI 代理使用的一站式入口。它把 finding、实施合同、工作包 Prompt、验收规则和状态台账串成一个可执行流程。

第一次接手请先阅读 [`START-HERE-v1.0.md`](./START-HERE-v1.0.md)；它把复制 Goal、判断阻塞和合并前检查压缩成用户可操作步骤。

执行合同是 [`AI-IMPLEMENTATION-CONTRACT-v1.0.md`](./AI-IMPLEMENTATION-CONTRACT-v1.0.md)；它定义角色、输入、依赖门、证据等级、暂停条件和每个工作包的最低退出证据。

## 1. 先看结论

- 方案可落地，但必须按 WP-00 至 WP-07 分批实施。
- 不能把 81 个入口页一次性重画，也不能用全库正则替换统一样式。
- API、权限、路由、query key、业务状态机、数据库和特殊工作区领域交互是硬性不变量。
- 当前分支已经有 WP-01～WP-07 的代码改动；WP-00～WP-07 已 `VERIFIED`。下一步是独立的 Review/Acceptance，不再新增实现工作包。

## 2. 用户实际操作步骤

### 第一步：确认实施现场

当前实施分支是 `codex/frontend-style-unification`，运行环境是 `development`。先确认工作树中没有需要覆盖的用户修改。

### 第二步：读取实施合同

先读 [`AI-IMPLEMENTATION-CONTRACT-v1.0.md`](./AI-IMPLEMENTATION-CONTRACT-v1.0.md)，确认当前工作包、允许变化、禁止变化和最低证据等级。它是 AI 执行时的操作合同，不是额外的产品需求。

### 第三步：启动一个 Goal

打开 [`TASK-GOAL-PROMPT-v1.0.md`](./TASK-GOAL-PROMPT-v1.0.md)，复制“主任务目标 Prompt”整个代码块，粘贴到 AI Goal/任务目标中。

这个 Prompt 会要求 AI：

1. 读取全部实施文档。
2. 从 `IMPLEMENTATION-STATUS-v1.0.md` 的第一个未完成工作包继续。
3. 修改代码、执行门禁、进行真实路由和多 viewport 验收。
4. 把证据写回状态台账，再继续下一个可实施工作包。

在当前状态下，这个 Goal 不应再启动新的实现批次；应使用 Review/Acceptance Prompt 复核 WP-00～WP-07 的最终证据，不重做任何已验证工作包。

### 第四步：中断后续跑

任务被暂停、连接中断或新会话接管时，复制同一文件的“续跑 Prompt”。AI 必须先读取最新状态，而不是依赖聊天记录猜测进度。

### 第五步：只执行一个工作包

需要限制范围时，使用 [`PROMPT-PLAYBOOK-v1.0.md`](./PROMPT-PLAYBOOK-v1.0.md) 中对应的 WP Prompt。工作包未通过验收时，不得跳到后续批次。

### 第六步：做代码 Review 或运行时验收

- 只审查、不改代码：使用 `TASK-GOAL-PROMPT-v1.0.md` 的 Review Prompt。
- 只做浏览器验收：使用同一文件的 Acceptance Prompt。
- 外部环境阻塞恢复：使用 Playbook 的阻塞恢复 Prompt。

同一轮只选择一种工作模式：实施、Review、Acceptance 或阻塞恢复。不要把 Review/Acceptance Prompt 追加到主 Goal 末尾，以免 AI 在只读任务中继续修改代码。

### 第七步：合并前检查

只有当状态台账满足完成定义、P0 全部通过、P1 没有未解释失败、截图或等价运行时证据齐全、`detect_changes()` 范围符合预期时，才进入 PR 审查和合并。Prompt 本身存在不等于代码已完成。

## 3.1 工作包接管规则

AI 不能只按文件名或聊天上下文选择工作包，必须按 [`IMPLEMENTATION-STATUS-v1.0.md`](./IMPLEMENTATION-STATUS-v1.0.md) 的台账接管：

1. 优先恢复最早的 `IN_PROGRESS` 工作包。
2. 如果该工作包是 `IN_PROGRESS/BLOCKED`，可以继续不依赖阻塞的静态工作，但不能标记 `VERIFIED`，也不能启动其依赖工作包。
3. 没有进行中的工作包时，选择第一个依赖已经 `VERIFIED` 或明确 `DEFERRED` 的 `TODO/READY` 工作包。
4. `DEFERRED` 必须有用户授权、原因和重新验收条件；不存在“默认跳过”。

## 3. 文档职责

| 文件 | 用途 | 什么时候读 |
|---|---|---|
| `FINDING-TRACEABILITY-v1.0.md` | finding 到工作包、证据和回滚边界的映射 | 所有执行前 |
| `AI-IMPLEMENTATION-CONTRACT-v1.0.md` | 角色、输入、依赖门、最低证据和暂停条件 | 每次接管前 |
| `IMPLEMENTATION-SPEC-v1.0.md` | 页面模板合同、不变量和禁止事项 | 修改代码前 |
| `IMPLEMENTATION-PLAN-v1.0.md` | WP-00 至 WP-07 的范围、依赖和退出条件 | 选择工作包时 |
| `AI-EXECUTION-RUNBOOK-v1.0.md` | impact、门禁、视觉验收、状态更新和暂停规则 | 所有执行中 |
| `TEST-ACCEPTANCE-v1.0.md` | P0/P1/P2 验收标准和 viewport 矩阵 | 每批验收时 |
| `IMPLEMENTATION-STATUS-v1.0.md` | 当前唯一进度真相、证据和阻塞记录 | 每次开始/结束 |
| `TASK-GOAL-PROMPT-v1.0.md` | 主 Goal、续跑、Review、Acceptance Prompt | 直接交给 AI |
| `PROMPT-PLAYBOOK-v1.0.md` | 单工作包和阻塞恢复 Prompt | 限定执行范围时 |
| `START-HERE-v1.0.md` | 项目负责人第一次执行的步骤和授权选项 | 接手任务时 |
| `DELIVERY-REPORT-TEMPLATE-v1.0.md` | 工作包、阻塞、Review、Acceptance 交付格式 | 每次交付/暂停时 |
| `AI-IMPLEMENTATION-PROMPT-v1.0.md` | 旧入口兼容说明和完整 Prompt | 兼容旧流程时 |

## 4. AI 必须交付的结果

每个工作包结束时，AI 必须在状态台账中写清：

- 修改了哪些文件，明确没有修改哪些业务边界。
- 每个改动 symbol 的 upstream impact：调用方、流程、风险和缓解。
- `lint`、`typecheck`、`build`、相关测试的真实结果。
- 真实路由、操作、viewport 和截图/等价证据。
- `detect_changes()` 的范围、限制和是否包含新增文件。
- 遗留风险、回滚边界和唯一下一步。

状态只能使用 `PASS`、`FAIL`、`BASELINE_FAIL`、`BLOCKED`、`NOT_RUN`；工作包可以使用 `VERIFIED`、`IN_PROGRESS`、`BLOCKED`、`DEFERRED`、`TODO`、`READY`。没有执行的项目不能写成通过。

## 5. 必须暂停并请求决定的情况

只有以下情况需要暂停交给用户：

- 需要修改 API、权限、路由、query key、数据库或业务状态机。
- HIGH/CRITICAL impact 无法通过拆分、适配器或额外验证降低。
- 用户未提交修改与目标文件冲突，无法安全合并。
- 需要破坏性环境操作、真实生产数据或新增外部授权。
- 一个共享模板需要为单页增加大量例外分支。

普通的组件命名、间距、slot 设计和迁移顺序由 AI 依据现有代码采用保守、可回滚的方案。

## 6. 完成定义

总体目标只有在以下条件全部满足后才能报告完成：

1. WP-00 至 WP-07 全部为 `VERIFIED`，或有明确授权的 `DEFERRED`。
2. 验收标准中的 P0 全部通过，P1 没有未解释失败。
3. lint、typecheck、build、相关测试、真实点击和三种 viewport 证据已写入状态台账。
4. `detect_changes()` 与当前工作包范围一致，没有无法解释的执行流影响。
5. 临时预览、临时文件和无关变更已清理，工作树边界明确。

当前状态以 [`IMPLEMENTATION-STATUS-v1.0.md`](./IMPLEMENTATION-STATUS-v1.0.md) 为准：WP-00～WP-07 已 `VERIFIED`。不以本资料包或任何 Prompt 的存在作为完成依据；最终合并仍需独立 Review/Acceptance。
