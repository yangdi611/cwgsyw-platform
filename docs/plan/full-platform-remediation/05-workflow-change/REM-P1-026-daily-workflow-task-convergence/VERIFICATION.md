# REM-P1-026 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | DAILY-006 | L1 | Java 21 容器：`DailyReportRemediationCleanupTest`、`WorkflowControllerCompatibilityTest`、既有 group-reference runtime/service 测试通过 | `PASS` |
| `AC-002` | FLOW-001 / FLOW-002 | L2 | `REM_P1_026_20260715211538`：带组长角色的临时账号完成首次设置后，旧 `/workflow/tasks/group` 与统一 `/workflow/center/tasks/group` 命中同一日报任务；旧 `/workflow/approve` 审批后日报为 `APPROVED` | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | 清理 API 仅平台 scope、必须匹配 runId；定向单测覆盖非平台和无 runId 拒绝。运行复验后日报查询为 `400`、两套待办均不再含该任务，临时账号删除成功 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 开发后端镜像重建、健康检查通过；前端 `lint` 0 error（41 个既有 warning）、`typecheck` 通过。内置浏览器无可连接实例，交互点击无法执行；前端仍调用兼容旧待办接口，真实 API 链路已覆盖页面依赖契约 | `PASS_WITH_ENV_LIMITATION` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 所有编辑符号已做 upstream impact（LOW）；测试对象均经产品 API 精确清理；提交前执行 GitNexus `detect_changes` | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-012` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## 清理与环境说明

- 用户已授权仅面向带 `remediationRunId` 本地测试日报的受限清理生命周期；正常日报仍无通用删除入口。
- 清理仅允许平台 scope，逐日报匹配 runId，并精确处理该日报的通知、业务流程映射、Flowable runtime/history 与逻辑删除记录；不使用 SQL、Redis 或对象存储直写。
- 本机 Java 26 与 Mockito/Byte Buddy 不兼容，不能作为单测结论；定向测试已在 Java 21 容器通过。内置浏览器当前无可用连接，L4 仍需包含一次交互式 UI 回归。
