# REM-P1-036 实施记录

## 2026-07-18：认领

- L4 `AUTH-003` 发现并复现：登录 API 的统一 `401` 被全局 session 失效拦截器误处理，错误反馈在页面重载后消失。
- GitNexus `redirectToLogin` upstream impact：2 个直接依赖、0 个执行流、LOW；修改范围限于 `frontend/src/lib/api.ts`。
- 基线为 `lint-fix@cccd0ef6`，独立分支为 `codex/rem-p1-036-login-error-feedback`。

## 2026-07-18：实现与复验

- GitNexus 重新执行 `redirectToLogin` upstream impact：直接调用点为本文件响应拦截器；无已建模执行流。索引经共享 `api.ts` 给出 HIGH 扩散告警（134 个传递导入），因此修复仅将 `/auth/login` 的 401 排除在会话失效路径外；其他端点不变。
- 在 `frontend/src/lib/api.ts` 增加 URL 级登录请求判断。登录错误仍由页面本地 `catch` 显示；非登录 401 仍清 token、清 store 并跳转 `/login`。
- L1：`npx eslint src/lib/api.ts`、`npm run typecheck` 通过。
- L2/L3：当前事件分支重建 frontend 容器（未重建后端、数据库、Redis、MinIO 或 Nginx）；缓存 Playwright 运行器在 `http://127.0.0.1` 通过 `2 passed`。覆盖两类错误凭据、空字段无请求、成功登录与伪造 token 触发的受保护路由重定向。
- 无测试业务对象、角色、授权或持久化数据产生，因而无清理项。Playwright 默认删除的 8 个历史受控 L4 证据已在发现后立即从 `HEAD` 恢复，未包含在本事件差异。
- 回滚：恢复本事件提交即可恢复既有拦截器；无数据回滚需求。
