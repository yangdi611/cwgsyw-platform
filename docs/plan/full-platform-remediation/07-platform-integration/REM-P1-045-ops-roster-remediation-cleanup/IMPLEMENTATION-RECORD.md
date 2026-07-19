# REM-P1-045 实施记录

## 2026-07-19：认领

- 基线：`lint-fix@5e3ebe46bff07051d6ff2a08dc32b259e9faf133`；分支：`codex/rem-p1-045-ops-roster-remediation-cleanup`；runId：`REM_P1_045_20260719`。
- L4 `OPS-016` 在创建排班前发现无产品 API 清理路径并安全停止；没有排班残留，manifest 为空。
- GitNexus upstream impact：`OpsCalendarRosterController` 0 个上游、0 流程，LOW；`OpsCalendarRosterService` 1 个直接调用者、0 流程，LOW。
- 范围仅限严格 platform/runId/tenant 单排班清理、审计、测试和运行时复验。

## 2026-07-19：L1-L3 完成

- 实现 `DELETE /api/ops-calendar/rosters/{id}/remediation-test`；Controller 要求 `ops_calendar:manage`，Service 要求 platform scope、同租户、非空 runId 且 remark 包含该 runId。
- L1-L2：backend compile 通过；`OpsCalendarRosterHistoricalGroupTest` 在 Java 兼容参数下 6/6 PASS，覆盖非 platform、空 runId、跨租户、未标记、正确删除/审计和重复调用零额外写入。
- L3：仅重建 backend，容器 `d956e7adadca` healthy；frontend、PostgreSQL、Redis、MinIO、Nginx 未替换。真实 Playwright API `1/1 PASS`，覆盖 roster 创建、主备人员、电话、更新回读、错 runId、正确清理、重复拒绝和审计。
- 首次 L3 发现反向时间创建返回 `200`。该行为不属于本事件清理合同且 SPEC 明确不改变时间语义；失败 trace 保留于 `/tmp/rem-p1-045-l3`，恢复 L4 后独立事件化。首次请求产生的唯一排班通过本事件产品 API 精确清理。
- 最终只读核对 `remark like 'REM_P1_045_%' and not is_deleted` 为 `0`；共享 L4 manifest 未写入，无 cleanup failure。
- 回滚仅移除受限 Controller 端点与 Service 方法；无迁移、配置、授权或非测试数据变更。
