# REM-P0-008 实施记录

## 2026-07-18：认领、影响与根因

- L4 `ST-AUTHZ-021` 复现：首次 Rollback 后，第二个有效 `ROLLBACK` 返回 `200`。
- 失败发生在第二次回退断言前；在用户已授权的切换窗口中，立即执行 eligible preflight 与 Enforce，核验环境恢复 `enforced`、epoch 为 `11`。
- GitNexus MCP `impact` 在本会话不可用。源码调用面确认 `AuthorizationMigrationController.rollback` 为唯一 HTTP 入口，服务下游会写 tenant cutover、account rollout 与审计；风险为 CRITICAL。

## 2026-07-18：实现与 L1-L3

- `AuthorizationCutoverService.rollback` 在所有写入前以 `SELECT ... FOR UPDATE` 获取当前 tenant cutover；已为 `rollback` 时立即拒绝。
- 拒绝发生在 tenant cutover upsert、账户 rollout 更新和审计写入前；首次 rollback 与 rollback 后 Enforce 合同保持不变。
- L1 定向服务测试和 backend package 通过。L2/L3 在当前事件分支构建的 backend 容器中通过：首次 rollback、重复 rollback `409`、eligible preflight 后 Enforce 恢复 `enforced`，终态 epoch `12`。
- 本事件不创建测试业务对象；没有 manifest 残留。完整 L4 需从合并后的新基线重新开始。
