# REM-P2-020 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FLOW-013 | L1/L2 | 当前分支统计完成数 `4` 与完成实例列表 `4` 对账 | `PASS` |
| `AC-002` | FLOW-013 | L1/L2 | 当前分支统计运行数 `0` 与运行实例列表 `0` 对账 | `PASS` |
| `AC-003` | FLOW-013 | L1 | 零实例当前定义保留零统计；已删除且无 key 的历史实例显式归类 | `PASS` |
| `AC-004` | FLOW-013 | L2 | 统计/实例读取未创建数据、审计或授权副作用 | `PASS` |
| `AC-005` | 受影响模块 | L3 | 主包构建、当前分支 backend/frontend 容器和真实浏览器 | `PASS` |
| `AC-006` | FLOW-013 / REPORT-003 | L4 | 新 `lint-fix` 基线的列表、统计和 UI 复验 | `PENDING` |

## 原始失败证据

- L4：`/api/workflow/instances/finished` 返回 4 条完成实例，`/api/workflow/stats` 仅汇总日报审批流 1 条，详见当前 L4 run `execution-record.md` 的 `FLOW-013` 章节。

PASS 必须同时满足数据对账、权限、零副作用、当前分支运行时和 Console/网络检查；任何遗漏实例、未解释 5xx 或数据残留均为 FAIL。

## 2026-07-17 修复验证

- L1：新增 `WorkflowServiceLifecycleTest.allStatsIncludesHistoricalInstancesWhoseDefinitionsWereDeleted`。全量 Maven test compile 仍由四项既有无关源码错误阻断；`mvn -Dmaven.test.skip=true package` 通过。
- L2：统计包含现行 definition key、可解析历史 key 与 `historical-deleted-definition` 汇总项。已删除实例的 Flowable 历史行缺少可恢复 key，因此不伪造原 key；该汇总项明示包含 3 条历史完成实例。
- L3：当前事件分支重建 backend/frontend 容器后，真实 Playwright 会话中 `/workflow/stats` 汇总 `totalStarted=4`、`finishedCount=4`、`runningCount=0`；`/workflow/instances/finished.total=4`、`running.total=0`。UI 显示“历史已删除流程定义”且不显示孤立版本标记；Console/HTTP 4xx/5xx 为零。
- 清理：仅读取既有 Flowable 历史和定义，未创建、修改或清理产品对象、权限或审计记录。
