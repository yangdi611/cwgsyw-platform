# REM-P1-032 实施合同

- `/daily`、`/daily/new`、`/daily/:id` 必须要求 `daily_report:read`。
- 无权限直达时重定向首页、零日报 API 请求和零 Console error。
- 有权限的不存在日报仍显示业务中性态；后端权限和日报查询合同不变。
- GitNexus：`DashboardLayout`、`DailyReportDetailPage` upstream 均为 0 直接消费者、0 流程、LOW；统一路由影响按 HIGH 保护。

验收：低权三条路由拒绝；superadmin 不存在日报中性态；允许账号日报路由可加载；lint/typecheck/build/Playwright 通过。
