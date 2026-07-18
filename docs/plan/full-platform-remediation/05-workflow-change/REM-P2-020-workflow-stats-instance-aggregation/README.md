# REM-P2-020：Workflow 统计与实例聚合一致性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-020` |
| 优先级 | P2 |
| 领域 | `05-workflow-change` |
| 状态 | `VERIFIED` |
| 风险 | `MEDIUM` |
| 创建 / 更新 | 2026-07-17 |
| 来源 | `FQA_20260716_2300_lintfix` |

## 问题与影响

流程实例页面返回 4 条已完成实例，但流程统计只聚合其中 1 条日报审批实例。用户据此判断流程量、完成量或成功率时会得到不完整结果。

## 追溯与边界

- 新证据：L4 `L4-FLOW-013-001`。
- 用例：`FLOW-013`、`REPORT-003`。
- 根因聚类：流程定义枚举与历史实例所属定义的聚合口径不一致。
- 证据：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260716_2300_lintfix/execution-record.md`。

范围：

- 使流程统计覆盖实例列表可见的已运行和已完成实例；
- 保持统计 DTO、权限、路由和前端展示合同；
- 验证列表、单定义统计与汇总统计的一致性。

非目标：

- 不删除、回填或修改任何历史流程实例；
- 不更改流程定义生命周期、统计口径以外的审批语义；
- 不进行全租户数据迁移或 Flowable 历史清理。

2026-07-18 L4 回归：全量统计中的 `historical-deleted-definition` 保留桶为 `3/0/3`，单项统计却返回 `0/0/0`。本次从 `lint-fix@7d65aef6` 的独立分支重新认领；L1-L3 已复验通过，待提交合并后重新初始化最终 L4。

文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
