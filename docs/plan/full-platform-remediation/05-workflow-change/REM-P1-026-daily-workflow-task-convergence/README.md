# REM-P1-026：日报审批待办与统一流程任务收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-026` |
| 优先级 | P1 |
| 领域 | `05-workflow-change` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

旧日报待办只按 SecurityUser.groupId 查询，漏掉 Flowable candidate group 与角色候选任务。

审批人看不到实际待办，日报和统一流程中心显示不同任务集合。

## 追溯与边界

- 缺陷：`BUG-FQA-012`
- 用例：`DAILY-006`、`FLOW-001`、`FLOW-002`
- 根因：旧 WorkflowController 与统一 facade 使用两套候选组解析和任务查询实现。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 复用统一候选身份解析
- 统一待办查询、分页和任务动作
- 保持旧接口兼容
- 覆盖真实 candidate group/role

非目标：
- 不改变流程定义
- 不自动审批
- 不修改用户 membership

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
