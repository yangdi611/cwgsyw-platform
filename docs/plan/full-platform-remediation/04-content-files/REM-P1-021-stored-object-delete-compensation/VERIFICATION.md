# REM-P1-021 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FILE-004 | L1 | Java 21 定向测试：`SharedFileServiceTest`、`WikiAttachmentServiceTest`、`WikiPageServiceTest`、`WikiControllerTest` 通过 | `PASS` |
| `AC-002` | FILE-008 / WIKI-011 / WIKI-017 / XL-WIKI-001 | L2 | `REM_P1_021_20260715111401`：独立附件 DELETE `200`、随后读取 `400`；页面 DELETE `200`、级联附件读取 `400` | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 存储删除失败定向测试断言 `503` 且不软删记录、不写删除审计；ACL write 映射到既有 `wiki:update` 并由 Controller 回归测试覆盖 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支 `docker compose -f docker-compose.dev.yml build backend` 成功，替换 `backend` 后 `/actuator/health` 为 `UP`；API 复验通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | upstream impact：删除路径 LOW；`WikiController.checkAcl` MEDIUM（9 调用方），映射修复后定向回归通过；临时 role/user/membership/space/page/attachment 经产品 API 清理 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-053` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。

## 执行明细（2026-07-15）

- L1/L2：`docker run --rm ... eclipse-temurin:21-jdk-alpine ... mvn -q test -Dtest=SharedFileServiceTest,WikiAttachmentServiceTest,WikiPageServiceTest,WikiControllerTest` 通过。宿主 Java 26 的 Mockito/Byte Buddy 不兼容仅作为环境限制记录，未以其替代有效测试。
- L3：`docker compose -f docker-compose.dev.yml build backend && docker compose -f docker-compose.dev.yml up -d backend`；健康检查 `{"status":"UP"}`；运行标识 `REM_P1_021_20260715111401` 的 API 流程通过并在 finally 中清理。
- 前端关联门禁：`npm run typecheck` 通过；`npm run lint` 为 0 error、41 条既有 warning。
