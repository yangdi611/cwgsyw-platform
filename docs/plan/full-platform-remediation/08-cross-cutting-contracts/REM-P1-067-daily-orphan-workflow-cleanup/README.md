# REM-P1-067：日报整改清理孤儿流程一致性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-067` |
| 优先级 / 领域 | P1 / 日报与 Workflow 横切一致性 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `COMMON-012` |
| 分支 | `codex/rem-p1-067-daily-orphan-workflow-cleanup` |
| 基线 | `lint-fix@4bd4ae56` |
| 事件运行 | `REM_P1_067_20260721` |
| 首次失败证据 | `/tmp/fqa-2050-common012-source-diag` |

受限整改清理入口只按日报记录中的 `processInstId` 删除 Flowable。字段缺失或与实际实例不一致时，日报已删除但相同 `daily_report:<id>` 运行/历史流程仍存在，流程实例页继续暴露死链接。

修复为同时按存储实例 ID 与精确 businessKey 查询运行/历史实例，去重后逐个删除；其他业务键和正常日报路径不受影响。GitNexus upstream impact 为 MEDIUM：1 个生产调用者、5 个清理测试、单一 Daily 模块，无生产执行流扩散。

L1-L3 已通过：Java 21 定向测试、backend 生产构建、当前容器专用 Playwright 创建/提交/受限清理链 `1/1`。新日报与相同 businessKey 的 running/finished 均归零，`cleanupFailures=0`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
