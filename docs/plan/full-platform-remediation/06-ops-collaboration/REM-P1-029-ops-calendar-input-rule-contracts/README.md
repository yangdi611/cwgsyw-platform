# REM-P1-029：运维日历任务、节假日与周期规则输入合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-029` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
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

L4 发现模板删除未保护周期规则引用：删除返回 `200` 并留下悬空 `templateId`。已在独立回归分支补充同租户、未软删规则引用保护；L1 单测、当前分支容器 API 和浏览器管理路由复验通过，事件恢复为 `VERIFIED`，等待提交与 no-ff 合并。合并后必须创建全新 L4 runId 并重跑完整矩阵。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
