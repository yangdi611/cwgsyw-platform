# REM-P0-007 实施 SPEC

## 目标与不变量

在配置模式为 `ENFORCED` 且 tenant cutover 已为 `enforced` 时，`POST /api/rbac/migration/cutover/enforce` 必须拒绝。拒绝发生在 rollout、epoch、cutover 时间戳和审计写入之前。

首次或从 rollback 恢复的合法 Enforce 合同保持不变；缺少 cutover 行仍按既有 `INSERT ... ON CONFLICT` 路径处理。禁止用重复 Enforce 作为“成功但无副作用”的幂等 API。

## 根因与实施

`AuthorizationCutoverService.enforce` 在严格预检通过后无条件执行 rollout upsert、cutover epoch 增量和审计。实现通过 `SELECT ... FOR UPDATE` 读取当前 tenant cutover 状态；若为 `enforced`，立即抛出业务状态错误。无记录时返回 `preparing`，保留首次切换路径。

## 验收

| ID | 条件 |
|---|---|
| AC-001 | 已 enforced 的重复 Enforce API 返回拒绝，状态、epoch、enforcedAt 不变 |
| AC-002 | 拒绝前不执行 rollout、cutover 或审计写入 |
| AC-003 | 已 enforced 的 UI 不显示“全量切换 Enforced”，仅保留获授权的回退入口 |
| AC-004 | 服务单测、backend package、当前事件分支 backend 容器与 Playwright L1-L3 全部通过 |

## 回滚

回滚本服务的状态守卫与测试；无数据回滚需求。已发生的历史 epoch 增量遵守单调性，绝不通过 SQL 或再次切换回退。
