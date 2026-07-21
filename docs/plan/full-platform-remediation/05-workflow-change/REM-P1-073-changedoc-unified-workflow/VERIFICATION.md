# REM-P1-073 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21：`ChangeDocWorkflowOrchestratorTest,ChangeDocWorkflowAdapterTest,WorkflowRuntimeFacadeGroupReferenceTest,ChangeDocSubmitIdempotencySqlTest,ChangeDocApprovalNotificationTest,BusinessKeyParserTest,WorkflowControllerCompatibilityTest` | `37/37 PASS` |
| L2 | Java 21：`mvn -q -Dtest='com.cwgsyw.platform.module.changedoc.**,com.cwgsyw.platform.module.workflow.**' test` | `124/124 PASS` |
| L3 build | Java 21 `mvn -q -DskipTests package`；`docker compose -f docker-compose.dev.yml build backend`；只替换 backend | `PASS`：backend/PostgreSQL healthy，HTTP 200，Flyway V79 |
| L3 runtime | `test/rem-p1-073-changedoc-unified-workflow.spec.js`；证据 `/tmp/rem-p1-073-change020-final/result.json` | `1/1 PASS`：真实 `/workflow/todo`、详情导航、旧旁路 409、统一拒绝终态、快照/审计/通知 |
| Shared regression | Daily submit/cleanup、Wiki page、binding lifecycle、Controller compatibility | `43/43 PASS` |
| Cleanup | 文档 #298 的只读核验；事件 manifest | runtime/history/mapping/active notification/active document/snapshot=`0`；manifest `0/0` |

## AC 结论

| AC | 证据 | 结果 |
|---|---|---|
| AC-001 | 完整双模板提交返回 `pending`，统一 my tasks 命中唯一 `change_doc:298` 待办 | PASS |
| AC-002 | `submit-plan` 和重复/并发启动由编排单测、租户行锁及 Changedoc 聚类覆盖 | PASS |
| AC-003 | 无 binding 保留 direct approve；有停用/删除历史拒绝新启动并回滚 | PASS |
| AC-004 | 摘要权限、租户可见性、`/change-docs/298` URL 与真实详情导航通过 | PASS |
| AC-005 | 运行中旧 approve 返回 409；统一拒绝回写 `rejected`，3 个快照且审计/通知存在 | PASS |
| AC-006 | 文档行锁先于 running mapping 检查；启动失败与重复状态由事务/聚类测试覆盖 | PASS |
| AC-007 | 精确 runId cleanup 后 runtime/history/mapping/业务活动数据和 manifest 全部归零 | PASS |

## 首败证据

- `test/l4-change-unified-workflow-current-run.spec.js` 位于失败快照提交 `231bc59b`。
- `/tmp/fqa-2050-change020-failure/result.json`：完整双模板提交为 `pending`，`matchingTask=null`。
- 文档、两个模板、binding、模板实例、运行流程和 manifest 回读均为 0；Console/5xx/backend ERROR 为空。
