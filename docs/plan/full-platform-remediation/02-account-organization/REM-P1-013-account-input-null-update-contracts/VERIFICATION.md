# REM-P1-013 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | GROUP-CRUD | L1 定向 | `test-results/<remediationRunId>/REM-P1-013/` | `NOT_RUN` |
| `AC-002` | ACCOUNT-001 / ACCOUNT-003 / RBAC-002 | L2 根因聚类 | 同上，逐缺陷独立结果 | `NOT_RUN` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | API、UI、DB/存储只读核对 | `NOT_RUN` |
| `AC-004` | 受影响模块 | L3 | 测试命令与报告 | `NOT_RUN` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | `detect_changes`、manifest、回滚记录 | `NOT_RUN` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-015`、`BUG-FQA-044`、`BUG-FQA-085` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。
