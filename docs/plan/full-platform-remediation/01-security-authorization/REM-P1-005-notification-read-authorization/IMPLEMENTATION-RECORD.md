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

## 2026-07-15：Goal 恢复与运行时复验启动

- 规划基线 `9d3478a`、检查点 `b9a6637` 已在 `lint-fix`；已确认旧事件分支 `4df753d8` 是 `lint-fix` 祖先后安全删除，并从 `b9a6637` 重建 `codex/fqa-008-notification-read-authorization`。
- GitNexus query/context/上游 impact 已复核：`NotificationController` 无直接上游调用者、无受影响执行流，风险 `LOW`；当前实现的四个 API guard 均为 `hasAuthority('notification:read')`，`/notifications` 已在全局路由权限表中。
- 本次运行时复验 runId：`REM_REM-P1-005_20260715_015940`。仅创建带该 runId 的最小权限测试对象，并通过产品 API 精确清理；不修改现有通知、角色 seed 或非测试授权。
- 当前开发容器均健康，前端依赖可用。待安全提供运行时管理员密码后执行真实会话 API/UI allow/deny；凭据不进入仓库、日志或证据。

## 2026-07-15：L1-L3 复验完成

- 先重建当前分支 `frontend` 容器，排除旧镜像；构建内的 Next production build 与 TypeScript 均通过，未重置任何数据服务或会话。
- L1：`mvn -q -Dtest=NotificationControllerAuthorizationTest test` 通过。前端：`npm run lint` 为 0 error、41 条既有 warning；`npx tsc --noEmit` 通过。
- L2/L3 API：临时零权限用户对 `GET /notifications`、`GET /notifications/unread-count`、`POST /notifications/{id}/read`、`POST /notifications/read-all` 均为 `403`；管理员列表和未读数均为 `200`。临时用户仅通过产品 API 删除，关键词复核剩余 `0`。
- L2/L3 UI：Playwright 从 Nginx `http://localhost` 验证零权限用户直达 `/notifications` 返回首页、没有通知 API 请求；管理员可打开并看到通知中心。两项用例均通过。
- 之前的前端拒绝失败来自旧 frontend 镜像，不是当前源码行为。所有 AC 已达到事件级 L1-L3，状态更新为 `VERIFIED`，保留 L4 作为最终关闭门禁。
