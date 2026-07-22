# REM-P1-070 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21 `FunctionalPermissionAccessDeniedHandlerTest,GlobalExceptionHandlerTest` | PASS；精确断言 filter/MVC 两条 403 reason-code 响应 |
| L2 | Java 21 `AuthorizationServiceTest,NotificationControllerAuthorizationTest` | PASS；与 L1 合并命令退出码 0 |
| L3 build | `docker compose -f docker-compose.dev.yml build backend`；仅替换 backend | PASS，553 source；health healthy；Flyway V79 |
| L3 runtime | `test/rem-p1-070-method-security-reason-code.spec.js` | PASS，1/1，2.2 秒；`/tmp/rem-p1-070-method-security-reason-code-r3` |
| 数据安全 | 产品 API 逆序删除页面、空间、assignment、用户、角色；backend 日志 | PASS，清理断言全部 200；ERROR/未处理 5xx 为 0 |

## 验收结论

| AC | 结果 | 证据 |
|---|---|---|
| AC-001 | PASS | 真实旧会话在最后 assignment 删除后返回 403/`FUNCTION_PERMISSION_DENIED`。 |
| AC-002 | PASS | 响应无页面内容；`data ?? null` 为 null。 |
| AC-003 | PASS | Authorization 受影响簇通过；合并后同 run L4 组合资产继续验证全部四层 reason code。 |
| AC-004 | PASS | Java 21、生产 backend、health/V79、真实 API 与产品 API 清理全部通过。 |
