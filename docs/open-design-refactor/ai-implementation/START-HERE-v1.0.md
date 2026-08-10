# 前端统一化 AI 执行入口 v1.0

这是一份给项目负责人使用的最短操作说明。它不替代实施合同、实施规格、验收标准或状态台账；它告诉你下一步应该复制哪个 Prompt、如何判断 AI 是否真的完成，以及遇到阻塞时需要提供什么。

## 1. 当前真实状态

当前分支是 `codex/frontend-style-unification`，运行环境是 `development`。状态以 [`IMPLEMENTATION-STATUS-v1.0.md`](./IMPLEMENTATION-STATUS-v1.0.md) 为准：

| 工作包 | 当前状态 | 负责人下一步 |
|---|---|---|
| WP-00 | `VERIFIED` | 不需要重做 |
| WP-01 | `VERIFIED` | 不需要重做 |
| WP-02 | `VERIFIED` | 不需要重做 |
| WP-03 | `VERIFIED` | 不需要重做 |
| WP-04 | `VERIFIED` | 不需要重做 |
| WP-05 | `VERIFIED` | 不需要重做 |
| WP-06 | `VERIFIED` | 不需要重做 |
| WP-07 | `VERIFIED` | 不需要重做；进入 Review/Acceptance |

历史记录中的 `IN_PROGRESS/BLOCKED` 是说明性组合，不是新的状态值。当前 WP-00～WP-07 均已完成，下一步是独立的 Review/Acceptance，不再新增实现批次。

当前最先执行的是最终 Review/Acceptance。WP-00～WP-07 的退出条件已经满足；Review/Acceptance 应复用有效证据，不要重做共享模板、Shell、列表、详情/表单、特殊工作区或低频页面。

## 2. 第一次执行

在当前仓库和当前分支中，按顺序执行：

1. 先打开 [`AI-IMPLEMENTATION-CONTRACT-v1.0.md`](./AI-IMPLEMENTATION-CONTRACT-v1.0.md)，确认角色、依赖门、绝对不变量、最低证据等级和暂停条件。
2. 打开 [`TASK-GOAL-PROMPT-v1.0.md`](./TASK-GOAL-PROMPT-v1.0.md)，复制“主任务目标 Prompt”整个代码块，粘贴到 AI Goal/任务目标。
3. 让 AI 自己读取状态台账并接管第一个可执行工作包。不要把聊天记录当作进度依据。
4. AI 停止后，先看 `IMPLEMENTATION-STATUS-v1.0.md` 的工作包台账和最后一条变更记录，再决定是否继续。
5. 如果状态是 `BLOCKED` 或 `IN_PROGRESS/BLOCKED`，复制本目录 [`PROMPT-PLAYBOOK-v1.0.md`](./PROMPT-PLAYBOOK-v1.0.md) 的“阻塞恢复 Prompt”；如果阻塞需要你的授权，按第 4 节回复。
6. 只有当前工作包达到退出条件，才让 AI 进入下一个工作包。

如果只想执行一批，不启动长期 Goal，复制 [`PROMPT-PLAYBOOK-v1.0.md`](./PROMPT-PLAYBOOK-v1.0.md) 中对应的 WP Prompt。

如果只想完成当前业务验收，不要使用主 Goal；复制 `TASK-GOAL-PROMPT-v1.0.md` 的“只做验收的 Prompt”。如果只想判断代码是否值得合并，复制“只做 Review 的 Prompt”，它不会修改文件。

## 3. 工作包如何选择

AI 必须遵守以下决策顺序：

1. 先恢复最早的 `IN_PROGRESS` 工作包；如果它只有外部阻塞，继续完成其中不依赖阻塞的静态工作，但不得把它标为 `VERIFIED`。
2. 没有 `IN_PROGRESS` 时，选择台账中第一个依赖已经 `VERIFIED` 或明确 `DEFERRED` 的 `TODO/READY` 工作包。
3. 依赖未通过的工作包不得提前开始。当前 WP-07 已满足 WP-04/WP-06 依赖，可以开始收口。
4. `BLOCKED` 只表示暂时无法完成，不表示已获得豁免；跳过必须由用户明确批准并记录为 `DEFERRED`。

## 4. 遇到阻塞时你只需要做一件事

AI 必须给出证据、影响和最小决策问题。你可以直接回复以下任一类授权：

### 提供或恢复测试条件

```text
我已授权使用当前仓库 `.env` 中的 `FQA_SUPERADMIN_PASSWORD` 做 development 验收。只在临时会话中使用，不输出、持久化或写入文档；完成真实路由和三种 viewport 验收，不修改账号、密码、数据库或权限配置。
```

### 授权延后验收

```text
我授权将当前工作包的真实运行时/视觉验收记录为 DEFERRED，原因是：<填写原因>。先完成不依赖该证据的静态实施；不得把工作包标记 VERIFIED，也不得进入依赖它的工作包。
```

### 只允许静态实施

```text
当前只允许继续不依赖外部登录态的代码、静态检查和文档工作。不得伪造运行时通过；把缺失的真实验收保留为 BLOCKED，并停在当前工作包。
```

不要把密码、token、密码哈希写入报告或仓库；不要要求 AI 修改数据库凭据。若浏览器被扩展浮层阻断，请提供干净浏览器会话或允许切换到当前分支新启动的服务，不要注入 token 或改写浏览器存储。

## 5. 怎样判断 AI 的报告可信

看到以下内容才可认为一个工作包具备完成候选资格：

- 修改文件和明确未修改的 API、权限、路由、query key、状态机边界。
- 每个函数、类或方法改动前的 GitNexus upstream impact；共享组件的 HIGH/CRITICAL 风险和缓解方式。
- `git diff --check`、lint、typecheck、build/相关测试的真实结果，并区分本次失败、基线失败、阻塞和未执行。
- 从首页或指定入口的真实点击证据，以及 `1440x900`、`1024x768`、`390x844` 的目标页面证据。
- 工作包结束时的 GitNexus `detect_changes()` 范围和限制。
- 遗留风险、回滚边界和唯一下一步。

源码存在、Prompt 已写好、HTTP 200、未认证页面能打开，都不能单独证明业务工作包完成。

## 6. 合并前的最后两步

1. 使用 [`TASK-GOAL-PROMPT-v1.0.md`](./TASK-GOAL-PROMPT-v1.0.md) 的“只做 Review 的 Prompt”，只找问题，不修改代码。
2. 使用同文件或 [`PROMPT-PLAYBOOK-v1.0.md`](./PROMPT-PLAYBOOK-v1.0.md) 的 Acceptance Prompt 做真实验收。

只有所有 P0 通过、P1 没有未解释失败、工作包状态真实、`detect_changes()` 范围可解释，才进入 PR 审查。commit、push、merge、deploy 仍需要单独授权。

## 7. 相关文档

- 发现与工作包映射：[`FINDING-TRACEABILITY-v1.0.md`](./FINDING-TRACEABILITY-v1.0.md)
- AI 执行合同：[`AI-IMPLEMENTATION-CONTRACT-v1.0.md`](./AI-IMPLEMENTATION-CONTRACT-v1.0.md)
- 页面和组件合同：[`IMPLEMENTATION-SPEC-v1.0.md`](./IMPLEMENTATION-SPEC-v1.0.md)
- 分阶段计划：[`IMPLEMENTATION-PLAN-v1.0.md`](./IMPLEMENTATION-PLAN-v1.0.md)
- 执行纪律：[`AI-EXECUTION-RUNBOOK-v1.0.md`](./AI-EXECUTION-RUNBOOK-v1.0.md)
- 验收规则：[`TEST-ACCEPTANCE-v1.0.md`](./TEST-ACCEPTANCE-v1.0.md)
- 唯一进度真相：[`IMPLEMENTATION-STATUS-v1.0.md`](./IMPLEMENTATION-STATUS-v1.0.md)
- 可复制 Prompt：[`TASK-GOAL-PROMPT-v1.0.md`](./TASK-GOAL-PROMPT-v1.0.md)、[`PROMPT-PLAYBOOK-v1.0.md`](./PROMPT-PLAYBOOK-v1.0.md)
