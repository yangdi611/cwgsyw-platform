# UI / V2 合并执行入口

这份入口只用于 `components/ui`、`components/v2` 与 `components/design-system` 的统一治理。它不替代页面视觉统一资料，也不要求一次性重写全部页面。

## 当前目标

在 `codex/frontend-style-unification` 分支上，按批次完成以下收敛：

- 业务页面的基础组件统一从 `@/components/design-system` 导入。
- 页面级组合组件继续从 `@/components/shared` 导入。
- `components/v2` 在迁移期保留为兼容入口。
- `components/ui` 在迁移期保留为 design-system 的内部实现。
- Intent UI 只在前置迁移完成后做独立技术验证，不提前扩大范围。

## 你只需要做的事

1. 确认当前分支和工作树没有需要覆盖的修改。
2. 阅读 [`MASTER-PLAN.md`](./MASTER-PLAN.md) 和 [`STATUS.md`](./STATUS.md) 的顶部状态。
3. 将 [`TASK-GOAL-PROMPT.md`](./TASK-GOAL-PROMPT.md) 中“主任务目标 Prompt”的代码块完整复制到 AI Goal / 任务目标。
4. 让 AI 从 `STATUS.md` 顶部的当前执行指针继续：DS-04 隔离 spike 已 `VERIFIED`，DS-05 已决定保留 Base UI，当前执行 DS-06 最终审计。
5. 任务中断时，只复制同一文件的“续跑 Prompt”，不要依赖聊天记录恢复进度。
6. 所有批次完成后，单独使用“只做 Review Prompt”和运行时验收清单；不要在 Review 阶段继续改代码。

## 当前执行指针

- DS-00：已完成
- DS-01：已完成
- DS-02：已完成
- DS-03：批次 1～6 代码、静态门禁和 development 三种 viewport 运行时验收已 `VERIFIED`
- DS-04：隔离 spike 已 `VERIFIED`；Dialog、Select、表单和三种 viewport 运行时证据已记录
- DS-05：已决策 `BASE_UI_DEFAULT`，Intent UI 保留为隔离的后续候选
- DS-06：业务 legacy import、基础层边界和静态审计已收口；删除 legacy 目录仍需要单独授权和回滚演练

当前执行顺序固定为：`DS-04 VERIFIED -> DS-05 BASE_UI_DEFAULT -> DS-06 final audit`。不要重做 DS-03，不要把 spike 依赖扩散到主迁移路径。

DS-04 隔离工作区和适配层已经存在；如需复核技术候选，先完整阅读 [`DS-04-SPIKE-PROTOCOL.md`](./DS-04-SPIKE-PROTOCOL.md)，不得把依赖复制回主分支。

`STATUS.md` 是组件体系合并的唯一进度台账；页面视觉统一工作的状态在 [`../ai-implementation/IMPLEMENTATION-STATUS-v1.0.md`](../ai-implementation/IMPLEMENTATION-STATUS-v1.0.md) 单独维护，不能互相覆盖。

## AI 必须遵守的边界

- 每次修改函数、类或方法前先执行准确 symbol 的 GitNexus upstream impact。
- HIGH/CRITICAL 风险先报告直接调用方、受影响流程、风险和缓解措施。
- 不改变 API、DTO、权限、路由、query key、分页/筛选参数和业务状态机。
- 不重写 Wiki、BPMN、React Flow、Konva、空间布局、文件预览和任务模板设计器的领域交互。
- 每批完成后执行 `git diff --check`、lint、typecheck、build（若存在）和 `detect_changes`。
- 缺少 development 登录态、业务数据或浏览器能力时，记录 `BLOCKED`/`NOT_RUN`，不得用源码检查或 HTTP 200 冒充运行时通过。
- 未经明确授权，不 commit、push、merge、deploy、删除旧目录或切换分支。

## 完成判断

只有当静态检查、组件行为、真实路由、三种 viewport、`detect_changes` 和遗留风险均有证据，且 Intent UI 已有独立 PASS/FAIL 决策，才可以报告 UI/V2 合并工作完成。文档存在、Prompt 可复制或局部页面通过，都不等于总体完成。
