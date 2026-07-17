# REM-P1-035：平台管理员日报审批待办可见性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-035` |
| 优先级 | P1 |
| 领域 | `05-workflow-change` |
| 状态 | `VERIFIED` |
| 风险 | MEDIUM |
| 来源 | L4 `FQA_20260717_1245_final_l4`，`L4-DAILY-002-platform-approval-task-visibility` |

## 问题与范围

`DailyReportWorkflowAdapter.canApprove` 已允许 tenant/platform 范围审批任意组日报，但候选任务查询只使用会话的单个 `groupId`。平台管理员没有主组时 token 为空，导致既看不到也无法完成已获准的日报审批任务。

本事件只扩展 tenant/platform 会话的候选 token 为本租户所有活动组；组级会话仍只取其自身组，角色 token 保持原有行为，业务适配器继续执行权限和 scope 二次校验。

## 结论

当前分支容器中，平台管理员真实 UI 完成 runId 日报 `DRAFT -> SUBMITTED -> APPROVED`；候选审批入口显示，终态回读正确，受限清理 API 删除日报、流程和关联通知后读取返回不存在。

文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
