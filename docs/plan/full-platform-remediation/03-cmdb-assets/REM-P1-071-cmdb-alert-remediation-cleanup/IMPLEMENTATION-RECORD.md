# 实施记录

## 2026-07-21：发现与认领

- 同 run L4 的 `CMDB-034/XL-CMDB-008` 需要真实实例关联告警，但正式 Prometheus 同步创建的 `cmdb_alert` 没有产品清理入口，无法满足精确 cleanup；阻塞证据提交为 `ea40aaec`。
- 分支从 `lint-fix@685d57c0` 创建，事件 run 为 `REM_P1_071_20260721`。创建任何 L4 告警前先事件化，因此没有遗留告警夹具。
- GitNexus 对 `CmdbAlertController` 与 `acknowledge` 的 upstream impact 均为 LOW，0 个直接调用者、0 条已登记流程。由于新增持久化清理边界，仍按高敏感数据生命周期完成拒绝、审计和真实运行时验证。

## 2026-07-21：实现与 L1-L3

- 新增 `CmdbAlertRemediationService` 与 `DELETE /api/cmdb/alerts/{id}/remediation-test`。Controller 要求 `cmdb_alert:acknowledge`，Service 再要求 platform scope、同租户和精确 runId 标记。
- 服务设置删除/更新操作者与时间，使用 MyBatis 逻辑删除，并追加 `cmdb/purge_remediation_test/cmdb_alert` 审计。错误 runId、跨租户、非 platform 和重复清理在写入前拒绝。
- Java 21 定向服务、同步与 Controller 测试通过；当前分支生产 backend 构建并替换后 healthy，Flyway V79。
- Playwright 首轮发现 MockServer expectation 创建合法返回 `201 Created`，修正测试断言；第二轮证明动态调度仍按切换前 60 秒周期等待，扩展 poll 上限覆盖原周期。最终运行 `1/1`、16.2 秒通过。
- finally 通过产品配置 API 恢复 Prometheus 配置并清除 MockServer expectation；产品 API 核验活动 `REM_P1_071_*` 告警为 0，active expectation 为 0，未使用 SQL 写入、restore、purge、Redis 或会话清空。
- 合并后恢复同一 L4 run，仅复跑 `CMDB-034/XL-CMDB-008` 全部 AC；通过且 manifest 为 0/0 后才解除 `BR-071`。
