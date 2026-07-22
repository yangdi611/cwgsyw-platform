# REM-P2-021：流程实例业务跳转

- 优先级：P2；领域：Workflow；状态：`CLOSED`
- 源：L4 `FQA_20260716_2300_lintfix`，`FLOW-004`。
- 问题：流程实例列表将 `daily_report:<id>` 业务键仅显示为文本，用户不能从实例回到关联日报。
- 影响：已完成或运行中的日报流程缺少可追溯业务入口。
- 范围：仅为可解析且属于日报的业务键提供详情跳转；其他业务键保持文本显示。
- 非目标：不改变流程 API、实例状态、任务审批、权限或历史数据。
- 分支：`codex/rem-p2-021-workflow-instance-business-navigation`，基线：`lint-fix@5ceb2c84`。
- 下一门禁：提交并 no-ff 合并后，从最新集成点重跑 `FLOW-004` L4，再进入最终全量关闭门禁。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
