# REM-P1-027：变更模板复制、字段配置与引用保护生命周期

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-027` |
| 优先级 | P1 |
| 领域 | `05-workflow-change` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

变更模板缺少复制、实体删除、引用保护、字段排序与默认值配置，生命周期无法审计和精确清理。

管理员无法安全复用、维护或删除模板，测试夹具和历史引用会积累。

## 追溯与边界

- 缺陷：`BUG-FQA-048`、`BUG-FQA-083`、`BUG-FQA-098`
- 用例：`CHANGE-014`、`CHANGE-015`、`CHANGE-016`、`CHANGE-018`
- 根因：Template Controller/Service/UI 能力集不完整，模板引用策略和字段配置合同没有统一。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 实现 clone 与 delete/archive
- 被文档引用时拒绝或使用不可变快照
- 字段 sort/default/type 合同和 UI
- 审计、确认及对象/字段清理

非目标：
- 不改变既有文档快照内容
- 不自动删除被引用模板
- 不重做 DOCX 解析

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
