# REM-P1-060：变更文档终端状态幂等与归档清理

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-060` |
| 优先级 / 领域 | P1 / 流程与变更、共享文件生命周期 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `CHANGE-019`、`ST-CHANGE-001`、`ST-CHANGE-004`、`CHANGE-013` |
| 分支 | `codex/rem-p1-060-change-doc-submit-idempotency` |
| 基线 | `lint-fix@a5482a775` |
| 事件运行 | `REM_P1_060_20260720` |
| 证据 | `/tmp/rem-p1-060-l3-final3` |

原始 L4 并发 submit 返回 `200/200`，且终端审批测试缺少可完成的精确清理链。本事件为变更文档 submit/approve 增加租户行锁和状态复核，并使共享文件清理能够处理已不存在的 MinIO 对象而删除对应孤儿元数据；其他存储故障仍保留 503 和不删除保护。

L1-L3 已通过：Java 21 定向 12/12、Changedoc/Sharedfile 受影响测试 52/52、当前分支 backend 健康、真实 API/导出/权限 Playwright 1/1。测试覆盖 submit 与 approve 各自恰好 `200 + 409`、唯一审计/快照、审批归档、重草稿、拒绝、导出权限和产品 API 清理。manifest `objects=[]`、`cleanupFailures=0`。

日志中的中文下载文件名 `Content-Disposition` 警告是既有 Tomcat header 兼容性日志；下载断言、HTTP 状态、文件内容和清理均通过，未产生本事件未解释 5xx。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
