# REM-P0-008 实施 SPEC

## 目标与不变量

当 tenant cutover 已为 `rollback` 时，`POST /api/rbac/migration/cutover/rollback` 必须拒绝。拒绝发生在 rollout、cutover 时间戳和审计写入之前，且不得改变 epoch。

首次从 `enforced` 到 `rollback` 的合法路径保持不变；不存在 cutover 行时保留原有首次回退 upsert 合同。

## 根因与实施

`AuthorizationCutoverService.rollback` 未读取或锁定当前状态，直接执行 cutover/rollout/audit 写入。实现应使用 `SELECT ... FOR UPDATE` 读取当前状态；若为 `rollback`，立即抛出业务状态错误。

## 验收

| ID | 条件 |
|---|---|
| AC-001 | 已 rollback 的重复 Rollback API 返回拒绝，cutover 状态、epoch、rollout 不变 |
| AC-002 | 拒绝前不执行 rollout、cutover 或审计写入 |
| AC-003 | 首次 Rollback 后可通过 eligible preflight 恢复 Enforce，最终为 `enforced` 且 epoch 仅在 Enforce 时增加 |
| AC-004 | 服务测试、backend package、当前分支容器和 Playwright L1-L3 均通过 |

## 回滚

回滚本服务状态守卫与测试即可；不通过 SQL 回写历史状态或 epoch。
