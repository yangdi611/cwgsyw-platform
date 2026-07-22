# REM-P2-002 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | REPORT-003 | L1 | 默认 API Top10 返回 10 条且 `changeCount` 降序；服务合同测试已新增 | `PASS` |
| `AC-002` | CMDB-035 / CMDB-036 | L2 | 不存在 keyword 为 `records=[]/total=0`；未来显式范围全部统计维度为 0 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | keyword SQL/count 同条件；缓存按 tenant 分段；无写入测试数据 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端编译、前端 eslint/tsc、当前分支容器与真实 API/UI 通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | impact、all-scope detect-changes、无测试数据与独立提交回滚路径 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-026`、`BUG-FQA-051`、`BUG-FQA-052` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。

## 执行结果

- PASS：`backend/mvn -q -DskipTests compile`；前端受影响页面 `eslint` 与 `npx tsc --noEmit`。
- PASS：当前分支执行 `docker compose -f docker-compose.dev.yml build backend frontend`，仅重建 backend/frontend；健康状态通过。
- PASS：Playwright 经网关验证变更历史关键字空态与统计页面显式日期范围，未见应用 Console error。
- BLOCKED（既有、非本事件）：`mvn -Dtest=CiChangeServiceTest test` 仍在全仓 test-compile 阶段被三处已知不相关测试错误阻断；新增定向测试已纳入代码审查，生产编译与运行态复验均通过。
