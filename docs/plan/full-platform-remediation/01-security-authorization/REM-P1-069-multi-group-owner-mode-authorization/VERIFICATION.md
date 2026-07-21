# REM-P1-069 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21 `AuthorizationServiceTest` | PASS，31/31 |
| L2 | Authorization persistence、Wiki、SharedFile 受影响测试簇 | PASS，89/89；合计 120/120 |
| L3 build | `docker compose -f docker-compose.dev.yml build backend`；仅替换 backend | PASS，552 source；image `012e01cc...`；health UP；Flyway V79 |
| L3 runtime | `test/rem-p1-069-multi-group-owner-mode-authorization.spec.js` | PASS，1/1，2.9 秒；`/tmp/rem-p1-069-runtime-r2` |
| 数据安全 | 产品 API 逆序清理；manifest、marker、ERROR/5xx | PASS，0/0；用户/角色/Wiki marker 0；日志 0 |

## 验收结论

| AC | 结果 | 证据 |
|---|---|---|
| AC-001 | PASS | 非主组有效成员 + assignment 单测与真实双组列表均通过。 |
| AC-002 | PASS | 主组字段残留、有效成员集合为空时回退 others 并拒绝。 |
| AC-003 | PASS | Authorization/Wiki/SharedFile 120/120；无跨组旁路回归。 |
| AC-004 | PASS | 当前 backend 旧/新会话撤销收敛；manifest 与 marker 归零。 |
