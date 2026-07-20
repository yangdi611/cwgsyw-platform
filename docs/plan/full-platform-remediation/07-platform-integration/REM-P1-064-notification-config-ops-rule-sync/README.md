# REM-P1-064：通知配置与正式日报规则同步

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-064` |
| 优先级 / 领域 | P1 / 配置与运维日历 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `CONFIG-003` |
| 分支 | `codex/rem-p1-064-notification-config-ops-rule-sync` |
| 基线 | `lint-fix@daa73689` |
| 事件运行 | `REM_P1_064_20260720` |
| 首次失败证据 | `/tmp/fqa-2050-config003-failure` |

系统配置页保存的日报提醒开关、周期和模板仅写入已失去运行消费者的旧配置键，正式内置运维规则不变。本事件让配置保存与唯一正式 `daily_report` 规则保持事务一致，并让通知路径消费模板。

L1 51/51、排除无关历史 Mockito stub 后的 L2 聚类、Java 21 生产构建、当前 backend 健康、真实 UI/API 与自然 scheduler 均通过；正式通知正文消费配置模板，配置与规则已精确恢复，测试任务和通知残留为 0。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
