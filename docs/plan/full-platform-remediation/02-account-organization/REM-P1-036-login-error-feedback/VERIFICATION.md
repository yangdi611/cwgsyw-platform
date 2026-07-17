# REM-P1-036 验证矩阵

| AC | 层级 | 状态 | 证据 |
|---|---|---|---|
| AC-001 | L1/L2/L3 | PASS | `npx eslint src/lib/api.ts`、`npm run typecheck`；`auth003InvalidLoginMatrix` 证明错误密码与未知用户名均返回 401、保持 `/login` 并显示统一错误。 |
| AC-002 | L2/L3 | PASS | 同一矩阵验证空字段不发请求、原生 `required` 校验存在。 |
| AC-003 | L1/L3 | PASS | `auth003StillRedirectsInvalidSessions` 先完成真实成功登录，再写入伪造 token 访问 `/daily`；受保护请求 401 后仍回到 `/login`。 |
| AC-004 | L2/L3 | PASS | 两种错误凭据保持 API 401 合同；成功登录仍为 200。未改后端、审计或密码策略。 |
| AC-005 | L3 | PASS | `docker compose -f docker-compose.dev.yml up -d --no-deps --build frontend` 从本事件分支构建，仅替换 frontend；真实 Nginx `http://127.0.0.1` 上 Playwright 两项通过。 |
