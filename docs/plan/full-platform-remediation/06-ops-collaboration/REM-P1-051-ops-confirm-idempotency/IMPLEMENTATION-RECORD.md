# REM-P1-051 实施记录

## 2026-07-19：认领、影响与实现

- 分支 `codex/rem-p1-051-ops-confirm-idempotency`，基线 `lint-fix@7af9f24a`，runId `REM_P1_051_20260719`。
- L4 snapshot `5dc89ca21141d79047ee808b0617bdb5db6cb580`：真实双击确认两次 POST 均成功，产生两条 confirm 日志；测试夹具已按产品 API 清理为零。
- GitNexus 方法级 `confirm` 未被索引解析；类级 `OpsCalendarTaskService` 为 LOW（2 direct/4 total/0 flow）。新增 `OpsScheduleTaskMapper` 方法的接口影响为 MEDIUM（6 direct/9 total/0 flow），直接依赖均为 Ops Calendar 服务/测试 import，无 HIGH/CRITICAL 门禁。
- 根因是两个事务普通读取同一 `pending_confirm` 状态后都通过校验。实现改为事务内 `SELECT ... FOR UPDATE`，后到事务在锁释放后读取已转换状态并按现有 400 合同拒绝，因此不产生第二份状态、任务日志或审计。

## 2026-07-19：L1-L3 复验与清理

- Java 21 受影响聚类 36/36 PASS；生产 backend build PASS，镜像 `sha256:2d115b946...`，当前 backend healthy，Flyway 无迁移、会话 epoch 未递增。
- 最终 Playwright `/tmp/rem-p1-051-ops-confirm-idempotency-final-readback` 1/1 PASS：真实并发确认返回一个 200 与一个 400；真实 UI 双击状态稳定；两个任务分别只有一条 confirm 日志和审计，Console/page error/5xx 为零。
- 首次协调失败误断言详情未公开字段 `confirmedBy`；第二次协调失败使用 response 监听未捕获代理请求。两次 finally 均完成产品清理，最终测试对齐权威 request 监听并以公开状态、日志和审计证明合同。
- 两个任务、assignment、用户、角色均通过产品 API 逆序清理并读回确认，manifest `objects=[]`、`cleanupFailures=0`；未使用 SQL 修改、restore、Redis/卷清理。
- GitNexus `detect_changes(all)` 为 LOW：3 个预期代码符号、0 affected process。回滚删除锁定 mapper 查询并恢复 confirm 普通读取，无 schema、迁移或数据 restore。
- GitNexus staged detect 同为 LOW；事件提交 `305d527e3e21f8e469546bbf136f59ce3e1c02f2` 精确包含 14 个事件文件，未包含用户保留测试改动或历史结果删除。
