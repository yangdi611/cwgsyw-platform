# REM-P1-032 实施记录

## 2026-07-17：认领

- 基线：`lint-fix@d718db060`；分支：`codex/rem-p1-032-daily-detail-route-guard`。
- L4 证据：`acltest` 的不存在日报 API 为 403，页面出现 Console error。
- 根因：统一 `ROUTE_PERMISSIONS` 未包含 `/daily`；批准使用前端路由门控，不修改后端 API。

## 2026-07-17：实现与 L1-L3

- 在统一路由表增加 `/daily -> daily_report:read`，既有前缀匹配自动覆盖子路由。
- eslint 0 error/39 既有 warning，typecheck 和当前分支生产前端镜像构建通过。
- Playwright：`acltest` 的三条日报直达路由均回首页、零日报 API/Console error；superadmin 列表可加载，缺失日报显示中性态。
- 未创建业务对象，未改后端、授权或数据范围。管理员缺失日报 API 的既有 400 保持不变，不属于低权路由门控范围。
