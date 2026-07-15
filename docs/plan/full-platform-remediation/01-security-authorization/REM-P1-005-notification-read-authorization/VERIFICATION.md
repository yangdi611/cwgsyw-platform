# REM-P1-005 验证矩阵

| AC | 用例 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| `AC-001` | 四个 API deny | L1/L2/L3 | `PASS` | `NotificationControllerAuthorizationTest` PASS；run `REM-P1-005_20260715_085000` 的真实零权限会话对列表、未读数、单条已读、全部已读均获 `403`，且无状态副作用。 |
| `AC-002` | 列表与未读数 allow | L2/L3 | `PASS` | 同一运行时复验中具备权限的管理员真实会话对列表和未读数均获 `200`。 |
| `AC-003` | 页面直达 deny | L1/L2/L3 | `PASS` | 当前事件分支重建 frontend 容器后，Playwright 经 `http://localhost` 验证零权限用户直达 `/notifications` 重定向首页、不渲染通知中心且无通知 API 请求；管理员可打开通知中心。 |
| `AC-004` | 定向测试与影响分析 | L1/L3 | `PASS` | Maven 定向测试 PASS；GitNexus 上游 impact 为 LOW、0 直接调用、0 受影响流程；前端 `npm run lint` 为 0 error/41 条历史 warning，`npx tsc --noEmit` PASS，当前分支 frontend build PASS。 |
| `AC-005` | 全量 FQA | L4 | `PENDING` | 最终发布门禁。 |

## L3 运行时复验记录

- 构建来源：`codex/fqa-008-notification-read-authorization`，基线 `b9a66376`；仅重建 `frontend`（`docker compose -f docker-compose.dev.yml build frontend`、`up -d --no-deps frontend`），未清空 Redis、卷、MinIO 或会话。
- 真实 API：run `REM-P1-005_20260715_085000` 的临时零权限账号仅通过产品 API 创建、初始化和删除；清理后 keyword 查询剩余 `0`。
- 真实 UI：run `REM-P1-005_20260715_084500` 的 Playwright 用例共 `2 passed`；测试入口为 Nginx `http://localhost`，不使用无法代理 API 的 `:3001` 直连端口。
- 静态与构建：`NotificationControllerAuthorizationTest` PASS；`npm run lint` 0 error、41 条既有 warning；`npx tsc --noEmit` PASS；Next production build PASS。
