# REM-P1-029 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | OPS-003 | L1 | 后端 Maven compile；任务类型/优先级无效值在 Service 入库前拒绝 | `PASS` |
| `AC-002` | OPS-004 / OPS-014 / OPS-HOLIDAY-CRUD / COMMON-012 | L2 | 真实 API 验证 7 类非法任务/节假日/规则输入均为 400；合法节假日、规则、预览均通过 | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | Cron、负提前日、同日 23:59/18:00 due、空/非法 holiday 均拒绝；合法 runId 对象 DELETE 后残留 0 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支 backend 重建 healthy；frontend typecheck/lint、规则与节假日真实页面加载通过，Console error 0 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 规则/任务/节假日服务及 OccurrenceCalculator upstream impact 均 LOW；提交前执行 `detect_changes` | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-014`、`BUG-FQA-020`、`BUG-FQA-082` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## 2026-07-16 L1-L3 复验记录

- L1：后端 `-DskipTests compile` 通过；补充任务、规则、节假日服务的输入合同单元测试。仓库现有 `GroupControllerGroupReferenceTest` 因已存在的 `Group`/`GroupRequest` 类型不匹配导致 testCompile 失败，发生在任何运维日历测试执行之前，与本事件无关。
- L2：真实 superadmin 会话对任务 `medium` priority、`maintenance` taskType，空/`custom` 节假日，无效 Cron、负提前日、同日到期早于 23:59 计划等 7 类请求逐一确认均返回 400；合法节假日、规则与 preview 成功，preview 中 `dueAt >= plannedStartAt`。
- L3：当前事件分支 backend 容器已重建并 healthy；frontend typecheck/lint 通过。Playwright 登录后加载 `/ops-calendar/rules` 与 `/ops-calendar/holidays`，页面可见且 Console error 为 0。
- 测试数据：仅创建一条 runId 节假日和一条禁用规则，均通过产品 DELETE 删除；列表回读残留为 0。
