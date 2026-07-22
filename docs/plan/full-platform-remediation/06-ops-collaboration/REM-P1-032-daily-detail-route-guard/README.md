# REM-P1-032：日报详情低权路由门控

状态：`CLOSED`；风险：`HIGH`；来源：L4 `AUTH-009`。

无 `daily_report:read` 的账号直达 `/daily/999999` 会请求受保护 API 并产生 403 Console error。本事件将 `/daily` 及子路由纳入统一 dashboard 路由门控：无权限回首页且不请求 API；有权限的不存在日报保持中性态。不改变 API、数据范围或状态机。

L1-L3 已通过，等待合并到 `lint-fix` 后重启 L4。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
