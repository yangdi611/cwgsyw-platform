# REM-P2-013：Workflow 活动历史与统计读模型 schema

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-013` |
| 优先级 | P2 |
| 领域 | `05-workflow-change` |
| 状态 | `VERIFIED` |
| 风险 | `LOW` |
| 分支 | `codex/rem-p2-013-workflow-read-model-schema` |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

历史活动返回 snake_case 而页面读 camelCase，统计 Map 也用 snake_case，导致完成节点显示进行中、统计为空或 NaN。

流程追溯和运营统计失真。

## 追溯与边界

- 缺陷：`BUG-FQA-028`、`BUG-FQA-036`
- 用例：`FLOW-004`、`FLOW-013`
- 根因：Service 直接返回 Map，没有稳定 DTO/JSON 命名合同。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 引入类型化活动与统计 DTO
- 统一 camelCase JSON
- 处理 null/zero duration
- 同步前端类型

非目标：
- 不改变流程运行状态
- 不重算历史数据
- 不修改审批权限

L1-L3 已通过：Workflow 历史活动和统计读模型已改为类型化 camelCase DTO；当前分支容器 API/UI 复验中完成态、统计字段、零值 duration、无 NaN 与零 Console error 均通过。无测试数据写入，等待最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
