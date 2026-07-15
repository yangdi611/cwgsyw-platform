# REM-P1-025：Workflow 模板实例可审计清理生命周期

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-025` |
| 优先级 | P1 |
| 领域 | `05-workflow-change` |
| 状态 | `VERIFIED`（L1-L3 已通过，等待最终 L4） |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

Workflow 模板可以创建实例，但没有 delete/unbind/archive 清理入口。

测试和管理员操作会永久留下模板实例，阻断可重复验收和生命周期治理。

## 追溯与边界

- 缺陷：`BUG-FQA-049`
- 用例：`FLOW-005`
- 根因：WorkflowTemplateController/Service 只实现创建与读取，没有引用检查、删除或归档事务。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 定义模板实例 archive/delete 合同
- 检查 runtime/history/binding 引用
- 提供确认、审计和 UI 操作
- 支持 runId 精确清理

非目标：
- 不删除系统模板定义
- 不清理非测试历史实例
- 不改 BPMN 生成器

L1-L3 已通过：未引用模板实例可以经确认后删除并软删记录；绑定、运行/历史流程引用均拒绝删除；测试对象已通过产品 API 精确清理。下一门禁：最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
