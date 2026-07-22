# REM-P0-007 实施记录

## 2026-07-18：认领、影响与根因

- L4 `ST-AUTHZ-020` 复现：已 `enforced` tenant 对有效 `ENFORCE` 返回 `200`，并错误递增 epoch。
- GitNexus 索引状态为 current；本会话未暴露 GitNexus MCP `impact` 调用。源码调用面确认 `AuthorizationMigrationController.enforce` 为唯一直接入口，服务下游更新 cutover、rollout 与审计，按授权关键路径判定 CRITICAL。
- 在用户先前明确的全租户 rollback-to-enforced 授权窗口中，首次复现已造成一次不可逆但单调合法的 epoch 增量；环境保持 `enforced`。后续本事件没有执行 Rollback 或 Enforce 状态转换。

## 2026-07-18：实现与 L1-L3

- `AuthorizationCutoverService.enforce` 在写锁和所有写操作前，以 `FOR UPDATE` 读取当前 tenant 状态；状态为 `enforced` 时拒绝。缺失行映射为 `preparing`，保持首次 Enforce 的既有 upsert 合同。
- 新服务测试验证重复 Enforce 在写锁和 JDBC update 前失败。
- L1 Maven 服务测试及 package 通过。L2/L3 当前分支真实 API 返回 `409`，前后完整 cutover 状态相等；页面隐藏重复 Enforce 入口并显示紧急回退。backend 容器由当前分支重建且 healthy。
- 没有创建测试对象；L4 manifest 保持 `objects=[]`、`cleanupFailures=0`。
