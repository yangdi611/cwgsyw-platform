# REM-P1-026 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-012`；用例：`DAILY-006`、`FLOW-001`、`FLOW-002`。
- 根因：旧 WorkflowController 与统一 facade 使用两套候选组解析和任务查询实现。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：实现已开始，等待生命周期授权

- 基线：`lint-fix@5275f72`；分支：`codex/rem-p1-026-daily-workflow-task-convergence`。
- GitNexus：旧 `WorkflowController.groupTasks`、`approve` upstream impact 均为 LOW；统一 `listGroupTasks` 和 `completeTask` upstream impact 均为 LOW。旧 `WorkflowService.toVOList` 有 4 个同域影响，未修改。
- 根因确认：旧 `/api/workflow/tasks/group` 仅按 `SecurityUser.groupId` 查询；旧 `/api/workflow/approve` 绕过统一 facade 的候选身份、业务权限和 claim/complete 校验。统一流程中心已具备 candidate user/group/role 解析。
- 实现：旧组待办接口映射统一 `WorkflowTaskSummary` 回原 `TaskVO` 合同；旧审批接口委托统一 `WorkflowTaskCompleteCommand`。新增 `WorkflowControllerCompatibilityTest` 覆盖两条兼容路径。
- L1：Java 21 容器执行 `WorkflowControllerCompatibilityTest,WorkflowRuntimeFacadeGroupReferenceTest,WorkflowServiceGroupReferenceTest` 通过。
- 阻塞：真实日报审批会创建日报、通知、Flowable runtime/history 与业务实例。当前没有产品 API 能精确回收日报及其终态关联；`cancelBusinessProcess` 不能处理日报/通知/history。`BR-005` 要求先确认 archive/purge 合同，且该能力超出本事件 SPEC。
- 停止条件：等待用户明确选择是否将日报终态 archive/purge 生命周期纳入本事件或建立后继事件；在此之前不得创建真实日报测试对象、不得直接 SQL 清理、不得将事件标记 VERIFIED 或合并。

## 2026-07-15：生命周期授权后完成 L1-L3

- 用户授权将严格受限的本地整改测试日报清理能力纳入本事件；正常日报没有通用删除入口。
- GitNexus：`WorkflowCenterController.groupTasks` 与 `complete` upstream impact 均为 LOW（0 直接调用方、0 受影响流程）。发现组长拥有 `daily_report:approve` 但没有 `workflow:read`，统一中心原门控会返回 403；两条统一中心入口改为与旧日报审批入口一致的 `daily_report:approve`，业务级候选与审批权限继续由 facade 复核。
- 新增 `DailyReportService.purgeRemediationReport` 与受保护的 `DELETE /api/daily-reports/{id}/remediation-test?remediationRunId=...`：平台 scope、当前租户、非删除日报、非空且内容匹配 runId 缺一不可；仅精确清理该日报关联的通知、业务流程映射、Flowable runtime/history，并写入清理审计。
- L1：Java 21 容器执行 `DailyReportRemediationCleanupTest,WorkflowControllerCompatibilityTest,WorkflowRuntimeFacadeGroupReferenceTest,WorkflowServiceGroupReferenceTest` 通过；新增统一中心权限兼容断言。主机 Java 26 的 Mockito/Byte Buddy 初始化失败属于运行时工具不兼容，不作为代码回归结论。
- L2：runId `REM_P1_026_20260715211538` 的临时组长账号完成 `/api/account/setup` 后，旧/统一待办返回相同 taskId；旧 `/api/workflow/approve` 使日报进入 `APPROVED`。清理 API 返回 200，此后日报为 400、两套待办均无该任务，临时账号删除成功。
- L3：开发后端镜像重建与健康检查通过；前端 lint 为 0 error/41 个既有 warning，typecheck 通过。内置浏览器无可连接实例，故不伪造 UI 点击证据；前端继续消费兼容旧待办接口，真实 API 链路覆盖其任务查询与审批合同。
- 回滚：回退本事件提交即可恢复原有接口实现；受限清理端点与服务同时移除。已清理的测试对象不可恢复，但均为带 runId 的临时对象。
