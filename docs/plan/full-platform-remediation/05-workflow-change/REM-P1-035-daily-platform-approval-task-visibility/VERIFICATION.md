# REM-P1-035 验证

| AC | 层级 | 证据 | 结果 |
|---|---|---|---|
| tenant/platform token | L1 | `WorkflowRuntimeFacadeGroupReferenceTest.platformApproverReceivesAllActiveTenantGroupTokens`，Java 21 临时容器通过 | PASS |
| 旧/统一接口兼容 | L1 | `WorkflowControllerCompatibilityTest`，Java 21 临时容器通过 | PASS |
| 编译 | L2 | `backend/mvn -q -DskipTests compile` 通过 | PASS |
| 真实审批链 | L3 | 当前事件分支仅重建 backend；Playwright 从登录 UI 创建、提交、显示候选审批、通过审批并回读 `APPROVED` | PASS |
| 清理 | L3 | runId 受限日报 purge 返回 200，后续读取 400；关联流程和通知由产品清理端点处理 | PASS |
| 影响检测 | L3 | GitNexus `detect_changes`：`MyTasks/GroupTasks` 两条候选组流程，MEDIUM；范围与事件合同一致 | PASS |

本机 Java 26 运行 Mockito 测试因 Byte Buddy 仅支持至 Java 24 而失败；同一组定向测试已在 Java 21 临时容器通过，故不归类为业务回归。
