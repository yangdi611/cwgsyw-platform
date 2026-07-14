# REM-P1-024：Workflow 定义版本与实例状态生命周期

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-024` |
| 优先级 | P1 |
| 领域 | `05-workflow-change` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

删除定义声称删除全部版本却只删一个 deployment；挂起定义发起和实例终止异常又没有稳定业务合同。

管理员无法确认定义是否真正清除，状态操作返回不可预测错误并遗留版本/实例。

## 追溯与边界

- 缺陷：`BUG-FQA-081`、`BUG-FQA-099`
- 用例：`FLOW-006`、`FLOW-012`
- 根因：definitionId、process key、deployment 与 runtime/history 的生命周期边界未在 Service 统一，Flowable 异常直接外泄。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 明确并实现单版本/全版本删除语义
- 保护 binding 与运行实例
- 挂起定义发起前置校验
- 实例终止、审计和稳定 4xx 合同

非目标：
- 不批量删除历史流程
- 不绕过业务回调
- 不改变 BPMN 内容

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
