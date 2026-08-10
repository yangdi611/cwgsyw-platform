# UI / V2 合并 Task Goal Prompt v1.2

以下代码块可直接粘贴到 AI Goal / 任务目标中。它只负责 `components/ui` 与 `components/v2` 向 `components/design-system` 的统一治理，并把 Intent UI 作为后置技术决策，不与现有页面统一化工作包混合。总计划见 [`MASTER-PLAN.md`](./MASTER-PLAN.md)，状态以 [`STATUS.md`](./STATUS.md) 顶部和最近记录为准。

## 主任务目标 Prompt

```text
你是 cwgsyw-platform 前端 Design System 统一实施工程师。请在当前仓库 /Users/byron/AI/cwgsyw-platform 的分支 codex/frontend-style-unification 上，完成 components/ui 与 components/v2 的统一治理，最终让业务页面只从 components/design-system 或 components/shared 导入基础组件和页面级组件，并通过独立技术验证决定是否向 Intent UI 演进。

开始前完整读取：根 AGENTS.md、frontend/AGENTS.md、docs/open-design-refactor/design-system-unification/README.md、ARCHITECTURE-DECISION.md、COMPONENT-CONTRACT.md、MIGRATION-PLAN.md、INTENTUI-DECISION.md、ACCEPTANCE-CHECKLIST.md 和 STATUS.md；同时阅读 docs/open-design-refactor/route-layout-matrix-v2.md、unification-plan-v2.md、docs/open-design-refactor/DESIGN_TOKENS.md、frontend/src/components/README.md、docs/open-design-refactor/MIGRATION.md，以及 docs/open-design-refactor/ai-implementation/ 下与现有页面统一化相关的合同和状态。先执行 git status --short --branch，识别并保护用户已有修改、未追踪文档和当前分支边界。获准启动 DS-04 后，额外完整读取 DS-04-SPIKE-PROTOCOL.md，并严格按其隔离和回滚协议执行。

严格按 STATUS.md 顶部当前指针执行，不跳过依赖门：DS-04 runtime、DS-05 决策和 DS-06 静态审计均已完成。当前 DS-00～DS-04 已 VERIFIED，DS-05 为 `BASE_UI_DEFAULT`，业务源码直接 ui/v2 import 为 0；当前等待负责人 review。不要重做已完成代码迁移，也不要在未授权时删除 legacy 入口。

目标结构是 components/design-system 作为基础 UI 唯一公开入口，components/shared 继续承担 PageShell、PageHeader、DataTable、DetailDrawer、WorkspaceShell、EmptyState 等页面级组合。components/ui 和 components/v2 在迁移期只作为内部实现或兼容 re-export，不能删除、reset 或覆盖；新代码不得新增直接引用 ui/v2。

不可变业务边界：不得修改后端 API、DTO、数据库、migration、权限资源、路由地址、动态参数、重定向、React Query query key、分页/筛选参数、业务字段、审批/发布/归档状态机，以及 Wiki、BPMN、React Flow、Konva、空间布局、文件预览、Markdown 编辑器和任务模板设计器的领域交互。组件基础层不得请求 API、读取权限、拼接业务路由或依赖领域 store。

每次修改函数、类或方法前，先对准确 symbol 执行 GitNexus upstream impact；如果是 CSS token、纯类型或新文件没有可用 symbol，记录工具无法识别并改用引用清单评估。HIGH/CRITICAL 风险必须在继续前报告直接调用方、受影响流程、风险和缓解措施。不要使用全库正则替换；按组件族和页面模块做小批次迁移。

DS-00：只读盘点组件文件、公开导出、业务引用、重复 API、视觉 token 和测试/构建命令，写入 STATUS.md；当前已完成，除非输入发生变化，不要重做。

DS-01：建立 components/design-system，每个基础组件独立文件并通过 index.ts 导出；当前已完成，除非发现具体合同缺口，不要重建入口。

DS-02：把 v2 的旧入口改为 design-system 的兼容 re-export；ui 保留内部实现；当前已完成。继续迁移时保持其 controlled/uncontrolled、disabled、loading、invalid、focus-visible、aria、dark mode、内部滚动和 ref 合同。

DS-03：不要继续做无目标的 import 修改。使用 development 环境和授权 superadmin 会话，从真实入口验证代表范围：账户/全局菜单、用户或设备 Dialog、CMDB 总览/管理/告警/影响、任务/Workflow/日历、Wiki/文件、拓扑/空间布局。覆盖主要操作、焦点、Dialog、表单校验、内部滚动、双滚动、横向溢出和画布非空，并检查 1440x900、1024x768、390x844。可读取 .env 中 FQA_SUPERADMIN_PASSWORD 完成登录，但不得输出、持久化、截图展示或写入文档。浏览器不可用时保持 RUNTIME_BLOCKED，不得用源码检查、HTTP 200、未认证页面或伪造 token 替代运行时证据。

DS-04：DS-03 已标记 VERIFIED，隔离 spike 的依赖、适配层、静态检查和运行时矩阵均已通过。保留 Button、Input、Dialog、Select、Popover/Dropdown 和 react-hook-form 的证据；依赖只留在隔离 worktree，业务仍只能导入 @/components/design-system 或 @/components/shared。

DS-05：已根据 INTENTUI-DECISION.md 记录 PASS/FAIL、证据和明确采用结论，当前选择 `BASE_UI_DEFAULT`。不把 React Aria 依赖复制到主分支，不重新修改业务导入；未来逐组件替换必须单独授权并重新完成组件族验收。

DS-06：复核业务 legacy import 为 0、v2 单向 compatibility re-export、design-system/ui/v2 不反向依赖 shared、ESLint 负向门禁有效，并完成运行时、viewport、detect_changes 和最终 review。未经用户单独授权，不删除 components/ui 或 components/v2。

每个工作包完成后执行 git diff --check、cd frontend && npm run lint、npm run typecheck，以及 package.json 中存在的 build/test；没有 test script 必须记录 NOT_RUN。运行 detect_changes()，确认符号和执行流只覆盖当前批次；新增未追踪文件无法被工具观察时明确记录限制，不能把 No changes detected 当作通过。对代表页面执行真实点击和 1440x900、1024x768、390x844 检查，覆盖 loading/error/empty/permission、主操作、Dialog、表单校验、返回、双滚动、横向溢出和特殊工作区边界。

将每个工作包的目标、修改文件、impact、静态结果、运行时证据、detect_changes、阻塞、回滚边界和下一步追加到 STATUS.md。只有静态、行为、运行时和最低 viewport 证据齐全才可标记 VERIFIED；缺少登录态、业务数据或浏览器能力时标记 BLOCKED/NOT_RUN，不得伪造通过。未经用户明确授权，不 commit、push、merge、deploy、切换分支、删除旧目录或修改无关文件。
```

## 续跑 Prompt

```text
继续 cwgsyw-platform 的 Design System 统一任务。先读取 docs/open-design-refactor/design-system-unification/STATUS.md 顶部状态和最近一条记录、MASTER-PLAN.md、README.md、ARCHITECTURE-DECISION.md、COMPONENT-CONTRACT.md、MIGRATION-PLAN.md、INTENTUI-DECISION.md 和 ACCEPTANCE-CHECKLIST.md，检查 git status --short --branch 与最新用户指令。DS-00～DS-04 已 VERIFIED，DS-05 已选择 `BASE_UI_DEFAULT`，DS-06 静态审计已完成；不重做已完成代码迁移，当前等待负责人 review。保持 API、权限、路由、query key、业务状态机和特殊工作区领域行为不变；未经明确授权不 commit、push、merge、deploy、删除 legacy 目录或切换分支。
```

## 只做 Review Prompt

```text
请 review 当前 Design System 统一变更，不修改代码。读取 ARCHITECTURE-DECISION.md、COMPONENT-CONTRACT.md、MIGRATION-PLAN.md、INTENTUI-DECISION.md、ACCEPTANCE-CHECKLIST.md、STATUS.md 和当前 diff。按严重性优先检查：基础组件 API 或 ref 回归；API/权限/路由/query key/状态机改变；Dialog/Select/Popover 焦点和键盘回归；双滚动、遮挡、移动端溢出；业务页面继续新增 ui/v2 引用；shared 与 design-system 分层反向依赖；Intent UI 未经 spike 直接扩散；impact/detect_changes 或运行时证据缺失。每个 finding 引用绝对路径和行号；没有问题时明确剩余测试缺口和残余风险。
```
