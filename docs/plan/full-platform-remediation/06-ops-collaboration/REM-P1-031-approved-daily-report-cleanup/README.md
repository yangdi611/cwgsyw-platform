# REM-P1-031：已审批整改日报精确清理

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-031` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
| 风险 | HIGH |
| 来源 | `FQA_20260716_2300_lintfix` |

## 问题与范围

L4 日报 `#10` 已通过真实 UI 审批并进入 `APPROVED`，但其内容只带历史 FQA 标记而未包含完整 runId。现有受限清理端点正确拒绝删除，导致测试数据无法精确收敛。

本事件仅扩展本地整改测试日报的识别规则：接受完整 runId，或与请求 runId 时间戳精确对应的历史 `FQA_*_yyyyMMdd_HHmm` 标记。正常日报、非平台调用、跨租户和未匹配标记仍必须拒绝。

非目标：不提供通用日报删除、不改变审批状态机、不修改非测试日报。

当前进展：事件级 L1-L3 已完成；普通日报删除边界保持不变，等待 `lint-fix` 集成与最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
