# REM-P1-071：CMDB 告警整改测试精确清理

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-071` |
| 优先级 / 领域 | P1 / CMDB 告警生命周期 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `CMDB-034`、`XL-CMDB-008` |
| 分支 | `codex/rem-p1-071-cmdb-alert-remediation-cleanup` |
| 基线 | `lint-fix@685d57c0` |
| 事件运行 | `REM_P1_071_20260721` |
| 阻塞快照 | `ea40aaec` |

Prometheus 正式同步可以创建告警，但产品此前没有受限的测试告警清理能力，导致 `CMDB-034/XL-CMDB-008` 无法在最终 L4 创建真实实例告警后精确收敛数据。

本事件新增仅限 platform、同租户、内容精确带 `remediationRunId` 的软删除端点，并写入独立清理审计。普通告警、错误 runId、跨租户、非 platform 和重复清理均不能产生写入。

L1-L3 已通过：Java 21 定向 CMDB 告警测试、生产 backend 构建与健康检查、真实 Prometheus mock 同步、错误 runId 拒绝、正确软删除、重复清理拒绝、审计读回和配置恢复均通过；活动 runId 告警与 MockServer expectation 均为 0。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
