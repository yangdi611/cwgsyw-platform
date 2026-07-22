# REM-P1-024 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FLOW-006 | L1 | Java 21 容器：`WorkflowServiceLifecycleTest` 通过 | `PASS` |
| `AC-002` | FLOW-012 | L2 | API：两版本定义、挂起拒绝发起、运行实例删除保护、终止后全删 | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | `400/WORKFLOW_DEFINITION_SUSPENDED`、`400/WORKFLOW_DEFINITION_RUNNING_INSTANCES`；拒绝后版本仍为 2 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端镜像构建、健康检查、定向单测通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 逐符号 impact 为 LOW；`detect-changes` LOW、0 affected processes；测试对象 API 清理 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-081`、`BUG-FQA-099` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## 本次运行记录

- 运行时间：2026-07-15；环境：本地 Docker 后端 `http://localhost:8081`。
- API 用带 runId 的 BPMN 创建 v1/v2：挂起 v2 后发起返回 `400/WORKFLOW_DEFINITION_SUSPENDED`；激活后创建含 user task 的运行实例。
- 有运行实例时全删返回 `400/WORKFLOW_DEFINITION_RUNNING_INSTANCES`，版本数保持 2；经 `DELETE /api/workflow/instances/{id}` 终止后，finished 列表可见 1 条历史，全删返回 200 且版本数为 0。
