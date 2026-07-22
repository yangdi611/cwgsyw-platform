# REM-P2-020 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FLOW-013 | L1/L2 | 保留历史桶全量/单项均为 `3/0/3`，定向单测覆盖 | `PASS` |
| `AC-002` | FLOW-013 | L1/L2 | 当前定义单项与全量统计仍逐项对账，运行计数不变 | `PASS` |
| `AC-003` | FLOW-013 | L1 | 零实例当前定义保留零统计；已删除且无 key 的历史实例显式归类 | `PASS` |
| `AC-004` | FLOW-013 | L2 | 统计/实例读取未创建数据、审计或授权副作用 | `PASS` |
| `AC-005` | 受影响模块 | L3 | `JAVA_TOOL_OPTIONS=-Dnet.bytebuddy.experimental=true mvn -Dtest=WorkflowServiceLifecycleTest test`; `mvn -DskipTests package`; 当前分支 backend 容器、真实 API/UI | `PASS` |
| `AC-006` | FLOW-013 / REPORT-003 | L4 | 当前事件分支回归探针通过；合并后必须从新基线完整重跑 L4 | `PENDING` |

## 原始失败证据

- L4：`/api/workflow/instances/finished` 返回 4 条完成实例，`/api/workflow/stats` 仅汇总日报审批流 1 条，详见当前 L4 run `execution-record.md` 的 `FLOW-013` 章节。

PASS 必须同时满足数据对账、权限、零副作用、当前分支运行时和 Console/网络检查；任何遗漏实例、未解释 5xx 或数据残留均为 FAIL。

## 2026-07-17 修复验证

- L1：新增 `WorkflowServiceLifecycleTest.allStatsIncludesHistoricalInstancesWhoseDefinitionsWereDeleted`。全量 Maven test compile 仍由四项既有无关源码错误阻断；`mvn -Dmaven.test.skip=true package` 通过。
- L2：统计包含现行 definition key、可解析历史 key 与 `historical-deleted-definition` 汇总项。已删除实例的 Flowable 历史行缺少可恢复 key，因此不伪造原 key；该汇总项明示包含 3 条历史完成实例。
- L3：当前事件分支重建 backend/frontend 容器后，真实 Playwright 会话中 `/workflow/stats` 汇总 `totalStarted=4`、`finishedCount=4`、`runningCount=0`；`/workflow/instances/finished.total=4`、`running.total=0`。UI 显示“历史已删除流程定义”且不显示孤立版本标记；Console/HTTP 4xx/5xx 为零。
- 清理：仅读取既有 Flowable 历史和定义，未创建、修改或清理产品对象、权限或审计记录。

## 2026-07-18 回归修复验证

- L1：`WorkflowServiceLifecycleTest` 新增 historical bucket 的单项统计测试；本机 Java 26 需 `JAVA_TOOL_OPTIONS=-Dnet.bytebuddy.experimental=true` 使 ByteBuddy Mockito 运行。6 个定向测试通过。
- L2：全量 `/api/workflow/stats` 的 `historical-deleted-definition` 和单项 `/api/workflow/stats/historical-deleted-definition` 均返回 `totalStarted=3`、`runningCount=0`、`finishedCount=3`，字段完全一致。
- L3：当前事件分支 `docker compose -f docker-compose.dev.yml up -d --build --no-deps backend` 仅替换 backend；健康检查通过。真实 Playwright 以 superadmin 进入 Workflow/CMDB 统计页面，并逐项对账全量/单项 Workflow 与 CMDB read sources，`test/l4-report-stats.spec.js` 通过。
