# REM-P2-002：CMDB 变更查询与统计准确性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-002` |
| 优先级 | P2 |
| 领域 | `03-cmdb-assets` |
| 状态 | `NOT_STARTED` |
| 风险 | `MEDIUM` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

Top 10 将 tenantId 错传为 modelId，变更历史忽略关键词，统计卡又不使用用户显式日期范围。

变更热点、筛选结果和时间范围统计均可能误导管理员。

## 追溯

- 缺陷：`BUG-FQA-026`、`BUG-FQA-051`、`BUG-FQA-052`
- 用例：`REPORT-003`、`CMDB-035`、`CMDB-036`
- 历史证据：`defects.md` 对应章节及 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

## 边界

根因：Controller→Service→Mapper 参数传播和统计 DTO 语义不一致。

范围：
- 修正 Top 10 参数
- 贯通 keyword 与分页 count
- 明确显式范围下 today/week/month 标签和查询语义

非目标：
- 不重建变更记录
- 不增加新的统计指标
- 不改变默认 30 日口径之外的产品决策

下一门禁：逐符号 GitNexus upstream impact；`HIGH/CRITICAL` 告警后才可编辑。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
