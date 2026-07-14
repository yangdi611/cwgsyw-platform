# REM-P1-005 实施记录

## 2026-07-15：启动

- 基线：`lint-fix` 的 `9a3b85ed`；复用隔离工作树并创建 `codex/fqa-008-notification-read-authorization`。
- 前序 `BUG-FQA-006` 已由 `REM-P1-004` 修复，历史 FQA 运行包已注明“待最终全量复验”，不篡改原始执行结果。
- 下一步：完成通知授权影响分析后，以最小范围统一 API 与页面直达 guard，并执行 allow/deny 回归。

## 2026-07-15：实施

- GitNexus upstream impact：`NotificationController`、`DashboardLayout`、`NotificationsPage` 为 LOW；`NotificationBell` 的直接消费者为 `Header`，间接为 `DashboardLayout`，仍为 LOW。
- 四个通知 API 统一从 `isAuthenticated()` 收敛为 `hasAuthority('notification:read')`。
- `/notifications` 加入全局路由权限表；页头铃铛在权限未水合或无 `notification:read` 时不渲染、不发未读数请求。
- `NotificationControllerAuthorizationTest` PASS；`detect_changes` 为 4 个源文件、8 个符号、LOW、0 个 execution process。
- 前端 `node_modules` 未安装，ESLint 与 TypeScript 检查暂不可执行；没有安装依赖或修改锁文件。
