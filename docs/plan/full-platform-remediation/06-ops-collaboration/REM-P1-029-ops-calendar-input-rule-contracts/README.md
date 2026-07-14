# REM-P1-029：运维日历任务、节假日与周期规则输入合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-029` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

任务 priority 枚举与数据库不一致，节假日缺必填/枚举校验，周期规则又缺 Cron、提前日和 due 时序校验。

合法 UI 值可能触发 500，非法配置可进入数据库或静默生成空计划。

## 追溯与边界

- 缺陷：`BUG-FQA-014`、`BUG-FQA-020`、`BUG-FQA-082`
- 用例：`OPS-003`、`OPS-004`、`OPS-014`、`OPS-HOLIDAY-CRUD`、`COMMON-012`
- 根因：前端枚举、DTO、Service、OccurrenceCalculator 与 schema 约束各自定义输入合同。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 统一 task priority/type 枚举
- HolidayRequest 字段与日期/类型校验
- Cron parser、generateDaysAhead、dueConfig 时序校验
- 保存前 preview 与实际生成一致

非目标：
- 不重做日历调度架构
- 不自动修复存量非法规则
- 不执行不可清理任务状态链

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
