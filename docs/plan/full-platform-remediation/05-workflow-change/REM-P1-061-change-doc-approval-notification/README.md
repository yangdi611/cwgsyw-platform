# REM-P1-061：变更文档审批通知一致性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-061` |
| 优先级 / 领域 | P1 / 流程与变更、通知 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `CHANGE-011` |
| 分支 | `codex/rem-p1-061-change-doc-approval-notification` |
| 基线 | `lint-fix@2f19e1f4b` |
| 事件运行 | `REM_P1_061_20260720` |
| 证据 | `/tmp/rem-p1-061-l3-r1` |

直接审批已正确持久化状态和长意见，但未向申请人发送变更文档通知。事件将直接审批与 workflow 回调统一到同一通知投递点，并保证每次有效终态转换只产生一条通知。

L1-L3 已通过：Java 21 定向 4/4、Changedoc/Workflow 受影响集合 42/42、生产 backend 构建与健康检查、真实 API Playwright 1/1。通过/拒绝、1024 字符 Unicode、空意见、跨组拒绝、通知引用和精确清理均通过；manifest `objects=[]`、`cleanupFailures=0`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
