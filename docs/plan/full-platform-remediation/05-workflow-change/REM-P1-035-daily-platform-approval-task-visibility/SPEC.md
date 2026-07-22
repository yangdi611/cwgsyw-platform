# REM-P1-035 实施合同

## 目标

tenant/platform 范围且拥有 `daily_report:approve` 的用户必须能查询并完成本租户各活动组的日报候选审批任务；group 范围用户仍只能查询自己组的候选任务。

## 允许变更

- `WorkflowRuntimeFacadeImpl.candidateGroupTokens` 的 tenant/platform 候选组解析。
- 定向工作流测试。

## 非目标

- 不改变 `DailyReportWorkflowAdapter.canApprove` 的权限或范围合同。
- 不改变 Flowable 流程定义、candidate group 写入、角色 token 或日报状态机。
- 不改变非测试对象；只对 runId 日报执行受限清理。

## 验收

1. tenant/platform 候选 token 包含本租户所有未删除组。
2. group scope 仍仅包含自己组 token；角色 token 保持原样。
3. 平台管理员真实 UI 可看到、审批并完成任意活动组的 runId 日报。
4. 审批后日报 `APPROVED`，审计/通知路径可完成，runId 清理后日报/流程/通知无残留。
5. Java 21 定向测试、backend compile、当前分支容器和 Playwright 均通过。
