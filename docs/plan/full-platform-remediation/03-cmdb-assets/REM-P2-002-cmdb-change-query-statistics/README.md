# REM-P2-002：CMDB 变更查询与统计准确性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-002` |
| 优先级 | P2 |
| 领域 | `03-cmdb-assets` |
| 状态 | `CLOSED` |
| 风险 | `MEDIUM` |
| 负责人 | Codex |
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

事件级 L1-L3 已通过；下一门禁为发布候选版全量 L4 复验。文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
