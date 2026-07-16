# REM-P1-032：日报详情低权路由门控

状态：`VERIFIED`；风险：`HIGH`；来源：L4 `AUTH-009`。

无 `daily_report:read` 的账号直达 `/daily/999999` 会请求受保护 API 并产生 403 Console error。本事件将 `/daily` 及子路由纳入统一 dashboard 路由门控：无权限回首页且不请求 API；有权限的不存在日报保持中性态。不改变 API、数据范围或状态机。

L1-L3 已通过，等待合并到 `lint-fix` 后重启 L4。
