# REM-P1-074：CMDB 状态变更通知链

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-074` |
| 优先级 / 领域 | P1 / CMDB 变更与通知 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `XL-CMDB-006` |
| 分支 | `codex/rem-p1-074-cmdb-status-change-notification-chain` |
| 基线 | `lint-fix@1f4e3138` |
| 事件运行 | `REM_P1_074_20260721` |
| 阻塞证据 | `/tmp/fqa-2050-xl-cmdb-006-failure-r4` |

CI 状态更新已经写入 canonical `ci_change_record` 并刷新统计缓存，但没有调用现有 `CiNotificationService.notifyStatusChange`，因此 owner/管理员收不到状态变更通知。

本事件只接通已存在的通知服务：保留更新前状态，在实例更新、审计和 change record 成功后，对真实状态变化发送通知；同状态或未提供状态的更新保持静默。

结论：LOW blast radius 的最小接线已完成；Java 21 L1 11/11、CMDB 模块 76/76、生产 backend 和真实 API/UI/batch 1/1 全部通过，runId fixture 精确清理为 0/0。下一门禁是变更范围核验、事件提交和顺序 no-ff 合并。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
