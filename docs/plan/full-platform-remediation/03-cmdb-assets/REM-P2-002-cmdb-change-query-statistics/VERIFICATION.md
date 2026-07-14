# REM-P2-002 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | REPORT-003 | L1 | `test-results/<remediationRunId>/REM-P2-002/` | `NOT_RUN` |
| `AC-002` | CMDB-035 / CMDB-036 | L2 | 逐缺陷独立 result | `NOT_RUN` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | API、UI、DB/存储核对 | `NOT_RUN` |
| `AC-004` | 受影响模块 | L3 | 测试命令与报告 | `NOT_RUN` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 实施记录与 manifest | `NOT_RUN` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-026`、`BUG-FQA-051`、`BUG-FQA-052` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。
