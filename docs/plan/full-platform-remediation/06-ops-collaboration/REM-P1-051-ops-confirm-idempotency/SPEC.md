# REM-P1-051 实施合同

## 目标与不变量

- 同一待确认任务的并发确认只允许一个请求完成状态转换。
- 仅成功请求写入一条 `confirm` 任务日志和一条 `confirm` 审计。
- 后到或重复请求保持现有 HTTP 400 与“仅待确认任务可确认”合同。
- 保持确认权限、任务可见范围、其他状态操作、路由和数据库 schema 不变。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | 首个确认成功并写入 `not_started/confirmedAt/confirmedBy`。 |
| `AC-002` | 并发或连续第二个确认稳定拒绝，状态副作用不重复。 |
| `AC-003` | 最终仅有一条 confirm 任务日志和一条 confirm 审计。 |
| `AC-004` | 当前后端真实 API/UI 双击复验、精确产品清理和 Console/5xx 检查通过。 |
| `AC-005` | L1-L3、detect、独立提交和 no-ff 合并全部通过。 |
| `AC-006` | no-ff 合并后同一 L4 run affected-only `OPS-010` PASS。 |

## 风险与回滚

风险为 MEDIUM：新增 mapper 锁定读取有 6 个直接 import、9 个总依赖、0 个已识别流程；实际行为只用于 confirm。回滚删除专用锁定读取并恢复普通读取，不涉及 schema、迁移或数据 restore。
