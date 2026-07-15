# REM-P1-023 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WORKFLOW-DEFINITION-LIFECYCLE | L1 | `REM_P1_023_20260715114734`：缺 key 与非法 XML 创建均返回 `400` | `PASS` |
| `AC-002` | FLOW-007 / FLOW-008 / FLOW-009 | L2 | 创建、读取、更新 v2 并读取：name/category/description/key、`flowable:candidateGroups` 与 `conditionExpression` 均保持 | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | Bean Validation 拒绝缺 key/非法 key；安全 XML preflight 拒绝畸形与缺少 definitions/process/start/end 的 BPMN；部署异常统一 `400` | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支后端 Docker Java 21 构建成功，替换 `backend` 后健康 `UP`；真实 API 创建/更新/回读/清理通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | create/update service/controller upstream impact 均 LOW；创建的流程定义经 `DELETE /workflow/definitions/{id}` 产品 API 清理 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-021`、`BUG-FQA-084`、`BUG-FQA-104`、`BUG-FQA-105` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## 执行明细（2026-07-15）

- 宿主 `mvn -q -DskipTests test` 与 Docker Java 21 后端构建通过；`npm run typecheck` 通过，`npm run lint` 为 0 error、41 条既有 warning。
- 运行标识 `REM_P1_023_20260715114734` 在当前事件分支容器验证：输入错误由历史 500 转为 400；含 `flowable:candidateGroups="group_1"` 和条件表达式的 BPMN 创建、详情重载、更新至 v2、再次详情重载均保持语义；finally 通过产品 API 删除测试流程。
