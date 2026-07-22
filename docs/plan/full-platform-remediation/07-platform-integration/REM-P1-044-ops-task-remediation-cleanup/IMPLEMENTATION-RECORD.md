# REM-P1-044 实施记录

## 2026-07-19：认领

- 基线：`lint-fix@08a3df963ea4b0a664d7f7879525e441141b5c63`；分支：`codex/rem-p1-044-ops-task-remediation-cleanup`；runId：`REM_P1_044_20260719`。
- L4 在执行 `OPS-003..010`、`ST-OPS-001..014` 前发现产品没有任务删除或受限测试清理 API。未创建任务、未产生残留；L4 安全停止。
- GitNexus upstream impact：`OpsCalendarTaskController` 1 个直接上游、0 个流程，LOW；`OpsCalendarTaskService` 1 个直接调用者、0 个流程，LOW。
- 范围：严格 runId 清理端点、从属记录逆序清理、审计、定向测试和当前分支运行时复验；不改变业务状态机。

## 2026-07-19：实现与 L1-L3

- Controller 新增受 `ops_calendar:update` 保护的单任务 remediation DELETE；Service 继续要求 platform scope、非空 runId、同租户和任务字段精确包含 runId。
- 事务内依次删除 links、checklist、participants、task logs、notification logs 和 task，随后保留 `purge_remediation_test` 审计。普通任务、错误 runId、跨租户、非 platform 和重复请求均拒绝。
- L1：production compile PASS；`OpsCalendarTaskServiceTest` 15/15 PASS，覆盖拒绝、删除顺序与审计。
- L2/L3：当前事件分支 backend 镜像构建成功，仅 backend ID 变化并健康。真实 API 创建一条 runId 任务；错 runId 400 且任务仍在，正确清理 200，详情与重复清理 400，审计可查；真实 `/ops-calendar` 无 runId。
- 测试任务已通过新产品 API 精确清理；未创建角色、用户、配置或其他业务对象。回滚为移除受限端点和 Service 方法，无迁移。
