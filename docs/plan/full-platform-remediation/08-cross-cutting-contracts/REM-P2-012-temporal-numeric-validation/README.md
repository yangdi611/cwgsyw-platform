# REM-P2-012：日期范围、月份与数值输入统一校验

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-012` |
| 优先级 | P2 |
| 领域 | `08-cross-cutting-contracts` |
| 状态 | `NOT_STARTED` |
| 风险 | `MEDIUM` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

反向日期在报表、任务、素材和排班端点被当作成功空集或 500，非法月份/日期类型与负工时也落入通用 500，统计页还永久 loading。

调用方无法区分无数据和非法输入，用户看不到可恢复的字段错误。

## 追溯与边界

- 缺陷：`BUG-FQA-029`、`BUG-FQA-030`、`BUG-FQA-031`、`BUG-FQA-032`、`BUG-FQA-033`、`BUG-FQA-034`、`BUG-FQA-037`、`BUG-FQA-060`
- 用例：`REPORT-001`、`REPORT-002`、`OPS-002`、`OPS-016`、`OPS-018`、`OPS-019`、`DAILY-001`、`DAILY-003`、`DAILY-004`、`COMMON-012`
- 根因：日期解析、range 校验和 MethodArgumentTypeMismatchException 映射分散在多模块，前端 query error 分支不完整。
- 原始证据：`defects.md` 与 `test-results/FQA_20260712_0329_lintfix/` 对应项；保持只读。

范围：
- 建立共享日期/range/month 验证 helper
- 全局类型转换异常映射 400
- 日报工时范围校验
- 统计页错误态与 retry
- 保持各端点合法范围上限

非目标：
- 不统一所有业务时区
- 不修改报表内容
- 不执行不可清理状态写入

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
