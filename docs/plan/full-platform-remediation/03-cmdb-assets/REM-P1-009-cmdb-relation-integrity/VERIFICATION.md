# REM-P1-009 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | CMDB-028 | L1 | 单测 + runId API 自关联 `400`、无新增关系 | `PASS` |
| `AC-002` | CMDB-040 / DEVICE-003 | L2 | runId API 关系/设备 restrict、重复设备关联、精确清理 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2/L3 | 拒绝路径单测 + runId API 并发设备创建与逆序清理；UI 真实点击路径 | `PASS` |
| `AC-004` | 受影响模块 | L3 | `mvn -q test`（JDK 21）通过；开发容器构建、健康检查通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 迁移 V73、upstream impact、detect_changes、产品 API 清理均通过 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-061`、`BUG-FQA-086`、`BUG-FQA-088` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。

## 2026-07-15 实际执行

- `JAVA_HOME=/opt/homebrew/opt/openjdk@21/... mvn -q -Dtest=CiRelationServiceTest,CiInstanceCommandServiceTest,DeviceServiceTest test`：PASS。
- `JAVA_HOME=/opt/homebrew/opt/openjdk@21/... mvn -q test`：PASS。默认 JDK 26 与项目 Byte Buddy/Mockito 不兼容，已使用容器同版本 JDK 21 执行。
- `docker compose -f docker-compose.dev.yml up -d --build backend`：PASS；`/actuator/health` 返回 `UP`。
- PostgreSQL 已确认 V73 成功执行，`chk_ci_instance_rel_not_self` 与 `uq_device_active_ci_instance` 均存在。
- runId `REM_P1_009_20260715123848`：真实 API 验证自关联 `400`、关系存在时删除 `400`、重复设备关联 `400`；解除关系后，设备关联仍使删除返回 `400`；设备、关系、实例均通过产品 API 逆序删除，按 runId 查询为零。
- 同一 CI 的两个并发设备创建请求返回恰好一个 `200`、一个 `400`；成功设备和 CI 已通过产品 API 清理。
- UI：使用 `http://localhost` 的 Nginx 用户入口登录，进入 CMDB 实例管理并点击 rack 实例删除；确认弹窗后页面显示“该 CMDB 实例仍有关联关系，请先解除后再删除”。浏览器对预期 HTTP `400` 产生一条资源日志，页面已处理并显示该可读错误；没有其他 console error。UI 夹具已通过产品 API 清理。
- GitNexus：`detect_changes --scope unstaged` 映射 9 个符号、7 条流程，风险 `HIGH`，全部为 CI 删除、关系创建、设备创建及其既有调用流；upstream impact 显示 CI 删除和设备创建各 1 个直接 Controller 调用，关系创建有 Controller / reverse-create 两个直接调用与 5 条 reverse-create 流程。
