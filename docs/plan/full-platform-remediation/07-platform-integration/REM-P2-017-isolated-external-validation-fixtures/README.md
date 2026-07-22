# REM-P2-017：隔离外部集成验证夹具

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-017` |
| 优先级 | P2 |
| 领域 | `07-platform-integration` |
| 状态 | `CLOSED` |
| 风险 | `MEDIUM` |
| 分支 | `codex/rem-p2-017-isolated-external-validation-fixtures` |
| 来源 | L4 `FQA_20260716_191500_lintfix` 外部集成门禁 |

## 问题与影响

L4 不能安全验证 SMTP、Prometheus 与 AI：缺少可观测、可恢复且不访问互联网的本地端点；AI 配置也没有明确清除临时 API Key 的产品合同。因此 `BR-003`、`BR-007`、`BR-010` 不能解除。

## 范围

- 仅为开发 compose 新增本地 Mailpit 和无出网能力的 HTTP mock。
- mock 只提供 Prometheus alerts 与 OpenAI-compatible chat 的固定响应。
- 提供受既有 `ai_config:write` 保护的显式 AI API Key 清除接口；清钥不改变 provider 的其他字段。
- 以产品 API 写入、验证并恢复临时 SMTP / Prometheus / AI 配置。

非目标：不改生产 compose，不连接真实外部系统，不新增 provider，不删除真实配置、告警或审计记录。

## 当前结论

开发 compose 的隔离夹具、AI 显式清钥合同和 SMTP 无认证支持已完成 L1-L3 验证。所有临时 SMTP、Prometheus、AI 配置均已恢复；runId 日报和测试用户均已通过产品 API 清理。等待独立提交及 `lint-fix` no-ff 合并后，恢复 L4 外部集成范围。

文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
