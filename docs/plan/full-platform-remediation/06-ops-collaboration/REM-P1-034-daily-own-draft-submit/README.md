# REM-P1-034：日报本人草稿提交入口

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-034` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | L4 `FQA_20260717_1245_final_l4`，`L4-DAILY-001-admin-own-draft-submit` |

## 问题与范围

具有 `daily_report:approve` 的管理员在日报页进入“全部日报”视图后，其本人 `DRAFT/REJECTED` 日报被错误视为非本人记录，导致“提交审批”入口消失。

本事件仅将前端本人判定改为 `reporterId === currentUserId`。审批权限仍只决定可查看范围；不修改状态机、后端权限、数据范围、工作流候选规则或整改清理合同。

## 结论

管理员能够在“全部日报”视图中提交自己的 runId 草稿并进入 `SUBMITTED`；该测试日报已通过受限产品清理 API 精确删除。审批待办对管理员不可见是独立的 `REM-P1-026` 范围回归，未在本事件中掩盖或改动。

文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
