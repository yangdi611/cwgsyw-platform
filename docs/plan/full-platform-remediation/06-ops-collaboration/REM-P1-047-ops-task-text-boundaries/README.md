# REM-P1-047：运维任务文本边界合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-047` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
| 风险 | `MEDIUM` |
| 分支 | `codex/rem-p1-047-ops-task-text-boundaries` |
| 基线 | `lint-fix@1cfccf0e` |
| 来源 | L4 `FQA_20260718_2050_remp1038` |

## 问题与影响

`OPS-004` 边界复验中，255 字符任务标题创建与回读成功，但 256 字符标题进入数据库后由列约束触发 HTTP 409，而不是稳定的输入校验 HTTP 400。

## 追溯与边界

- L4 缺陷：`L4-OPS-004-001`
- 失败快照：`cff458729`
- 用例：`OPS-004`
- 根因：`ops_schedule_task.title` 为 `VARCHAR(255)`，创建和更新服务没有对应的写前长度校验，任务表单也不显示或阻止超长标题。
- 正文列为 PostgreSQL `TEXT`，当前产品规范没有批准的正文最大长度；本事件不发明正文上限。
- 不修改权限、状态机、数据库 schema、审计格式、任务正文语义或非测试数据。

标题创建/更新 255/256、空白更新、零副作用、Unicode UI 计数、当前 backend/frontend 和产品 API 精确清理均已通过 L1-L3。下一门禁：独立提交并 no-ff 合并到 `lint-fix`，随后在同一 L4 run 重跑完整 `OPS-004`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
