# REM-P1-051 验证与证据矩阵

| AC | 层级 | 证据 | 结果 |
|---|---|---|---|
| `AC-001` | L1-L3 | 首次确认状态与身份时间戳 | `PASS` |
| `AC-002` | L1-L3 | 连续及真实并发重复确认 | `PASS` |
| `AC-003` | L1-L3 | confirm 任务日志/审计唯一性 | `PASS` |
| `AC-004` | L3 | 当前 backend API/UI/cleanup | `PASS` |
| `AC-005` | L1-L3 | 聚类/build/runtime/detect | `PASS` |
| `AC-006` | L4 | same-run `OPS-010` affected-only | `PENDING` |

原始失败：snapshot `5dc89ca21141d79047ee808b0617bdb5db6cb580`；真实双击发出两次 POST，均提交并产生 confirm 日志 `163/164`。finally 产品清理成功，shared manifest 空。

## L1-L3 结果

- L1/L2：Java 21 `OpsCalendarTaskServiceTest` 31/31、`OpsCalendarVisibilityServiceTest` 3/3、`NotificationTargetResolverServiceTest` 2/2，合计 36/36 PASS；连续重复确认只产生一次 update/log/audit。
- L3：`docker compose -f docker-compose.dev.yml build backend` PASS，镜像 `sha256:2d115b946...`；仅替换 backend，容器 healthy，Flyway 无迁移、会话 epoch 未递增，启动与测试期间无未解释 ERROR/Exception。
- 真实 API/UI：`/tmp/rem-p1-051-ops-confirm-idempotency-final-readback` 1/1 PASS（3.3 秒）。两个真实并发 POST 返回 `[200,400]`；真实页面双击后进入 `not_started`，刷新后确认按钮消失；API 与 UI 任务各只有一条 confirm 日志和一条 confirm 审计，Console/page error/5xx 为零。
- 清理：两个任务、assignment、用户、角色均通过产品 API 逆序清理；任务读回 400，manifest `objects=[]`、`cleanupFailures=0`。
- 两次测试协调失败均在 finally 完成清理：首次错误断言未公开 `confirmedBy`；第二次使用 response 而非权威资产的 request 监听。均未发现产品回归，最终证据使用公开状态、日志操作者和审计操作者。
- GitNexus `detect_changes(all)`：3 个预期代码符号、0 affected process、LOW。
