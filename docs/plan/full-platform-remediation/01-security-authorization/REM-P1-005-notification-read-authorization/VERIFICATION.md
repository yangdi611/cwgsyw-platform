# REM-P1-005 验证矩阵

| AC | 用例 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| `AC-001` | 四个 API deny | L1/L2 | `L1 PASS / L2 PENDING` | `NotificationControllerAuthorizationTest` 验证四个端点均显式要求 `notification:read`；待真实零权限会话复验。 |
| `AC-002` | 列表与未读数 allow | L1/L2 | `PENDING` | 待具备 `notification:read` 会话的 API 复验。 |
| `AC-003` | 页面直达 deny | L1/L2 | `L1 PASS / L2 PENDING` | 全局 `ROUTE_PERMISSIONS` 已保护 `/notifications`；待浏览器直达复验。 |
| `AC-004` | 定向测试与影响分析 | L1/L3 | `PASS` | Maven 定向测试 PASS；GitNexus `detect_changes` 为 4 个源文件、8 个符号、LOW、0 个受影响执行流程。 |
| `AC-005` | 全量 FQA | L4 | `PENDING` | 最终发布门禁。 |

环境限制：工作树未安装 `frontend/node_modules`，执行 `npm run lint` / `npm run typecheck` 时 `eslint` 与 `tsc` 不存在；未安装依赖或变更锁文件。待前端依赖可用后执行两项检查。
