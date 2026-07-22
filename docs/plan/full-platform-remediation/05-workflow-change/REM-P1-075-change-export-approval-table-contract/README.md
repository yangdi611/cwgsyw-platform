# REM-P1-075：变更文档导出审批与表格合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-075` |
| 优先级 / 领域 | P1 / ChangeDoc 导出 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `XL-EXPORT-002` |
| 分支 | `codex/rem-p1-075-change-export-approval-table-contract` |
| 基线 | `lint-fix@414037c2` |
| 事件运行 | `REM_P1_075_20260722` |

当前程序化 DOCX/PDF 缺少明确审批状态，PDF 不渲染模板动态表格，且 PDF application/plan 未按模板分区。本事件已补齐导出内容，不改变审批、权限、归档和清理生命周期。L1-L3、真实审批/下载/归档、权限反向验证和精确清理全部通过；等待事件提交、no-ff 合并后同一 L4 run 仅重验 `XL-EXPORT-002`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
