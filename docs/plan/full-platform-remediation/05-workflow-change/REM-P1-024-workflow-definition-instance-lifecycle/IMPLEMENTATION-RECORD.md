# REM-P1-024 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-081`、`BUG-FQA-099`；用例：`FLOW-006`、`FLOW-012`。
- 根因：definitionId、process key、deployment 与 runtime/history 的生命周期边界未在 Service 统一，Flowable 异常直接外泄。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：L1-L3 实施与复验完成

- 基线：`lint-fix@634e8fa`；分支：`codex/rem-p1-024-workflow-definition-instance-lifecycle`。
- GitNexus 已刷新；`deleteDefinition`、`deleteDefinitionVersion`、`suspendDefinition`、`startProcess`、`suspendInstance`、`deleteInstance` 及对应控制器入口 upstream impact 均为 LOW。直接调用方均为同域控制器；`deleteDefinitionVersion` 另涉及 3 条同域流程。
- 修复：按 process key 收集并非级联删除所有 deployment；存在业务配置绑定或运行实例时拒绝全删。单版本删除也拒绝运行实例并取消 cascade。定义挂起、实例启停/终止、定义发起先验证目标存在和状态，稳定返回业务 4xx。
- L1：Java 21 容器执行 `WorkflowServiceLifecycleTest,WorkflowServiceGroupReferenceTest` 通过。
- L2：真实 API runId 流程 v1/v2 验证挂起发起 `400/WORKFLOW_DEFINITION_SUSPENDED`；运行实例保护 `400/WORKFLOW_DEFINITION_RUNNING_INSTANCES` 且拒绝后版本仍为 2；终止实例后历史列表可见，定义全删成功且版本数归零。
- L3：`docker compose -f docker-compose.dev.yml build backend` 通过，重启后 `/actuator/health` 为 UP；`detect-changes --scope all` 为 LOW、0 affected processes。
- 清理：全部测试流程定义与运行实例均通过 Workflow API 精确清理；无直接数据库、Redis 或对象存储操作。
- 回滚：回退本事件提交可恢复此前单 deployment 的删除路径；无 schema 或持久化迁移。
