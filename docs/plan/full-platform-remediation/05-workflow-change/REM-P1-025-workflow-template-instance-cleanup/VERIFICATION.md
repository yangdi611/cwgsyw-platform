# REM-P1-025 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FLOW-005 | L1 | `test-results/<remediationRunId>/REM-P1-025/` | `NOT_RUN` |
| `AC-002` |  | L2 | 逐缺陷 result | `NOT_RUN` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | API/UI/DB 核对 | `NOT_RUN` |
| `AC-004` | 受影响模块 | L3 | 测试命令与报告 | `NOT_RUN` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 实施记录/manifest | `NOT_RUN` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-049` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。
