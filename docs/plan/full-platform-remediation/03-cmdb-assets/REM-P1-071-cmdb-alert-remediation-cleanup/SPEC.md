# REM-P1-071 规格

## 范围

- 提供只用于整改验证的 CMDB 告警精确清理入口。
- 仅允许 platform 用户清理同租户、内容精确带指定 `remediationRunId` 的告警。
- 使用逻辑删除保留既有 fired/acknowledge 审计，并追加 `purge_remediation_test` 审计。

## 非目标

- 不提供普通告警批量删除或生产数据清理能力。
- 不改变 Prometheus 同步、告警确认、实例解析或授权模式。
- 不允许跨租户、模糊 runId、直接 SQL、restore 或物理 purge。

## 验收标准

- AC-001：具备 `cmdb_alert:acknowledge` 的 platform 用户可清理同租户且精确带 runId 的测试告警。
- AC-002：非 platform、跨租户、空/错误 runId 与无标记告警被拒绝且无写入。
- AC-003：清理是逻辑删除，列表不再返回该告警，重复清理稳定拒绝。
- AC-004：清理写入 `cmdb/purge_remediation_test/cmdb_alert` 审计，既有告警审计保留。
- AC-005：当前事件分支生产 backend、真实 Prometheus 同步、配置恢复和零残留通过。
