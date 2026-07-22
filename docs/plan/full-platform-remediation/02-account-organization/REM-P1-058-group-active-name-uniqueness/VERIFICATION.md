# REM-P1-058 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| `AC-001` | L1 | PASS | Controller create 冲突在 insert 前拒绝；PostgreSQL trim expression index 拒绝重复。 |
| `AC-002` | L1 | PASS | Controller update 冲突在实体字段和 mapper update 前拒绝。 |
| `AC-003` | L1 | PASS | 迁移集成测试证明跨租户活动同名和同租户归档同名可并存。 |
| `AC-004` | L1 | PASS | PostgreSQL 两连接并发创建恰一成功；异常映射返回 HTTP/body 400。 |
| `AC-005` | L1 | PASS | restore 预检 blocker 与数据库竞态均为 `GROUP_RESTORE_NAME_CONFLICT`，无 audit insert。 |
| `AC-006` | L2-L3 | PASS | 组管理聚类 114/114；当前 backend 镜像、真实 API/UI 1/1、日志与精确清理通过。 |

L1 命令：Java 21 下 `mvn -q -Dtest=GroupControllerGroupReferenceTest,GroupLifecycleServiceTest,GlobalExceptionHandlerTest,GroupActiveNameMigrationIntegrationTest test`，补入真实 Mapper 空参数绑定回归后 26/26 PASS；`mvn -q -DskipTests compile` PASS。首次误用默认 Java 26 被 ByteBuddy 版本门禁阻断，随后按项目 Java 21 基线复验通过，不计产品失败。

L2：org/group 受影响聚类 114/114 PASS，零 failure/error/skipped；进程退出码 0。末尾仅有既知 Flowable/Hikari shutdown-hook 超时警告，Surefire XML 全绿。

L3：backend-only 重建镜像 `sha256:73fbb95a462ddde96ee28fa7c49f30fcce7b8092aab17f779fe546da086c7f42` 并替换；其余核心容器未替换，actuator `UP`，Flyway `78|true`，`uq_sys_group_tenant_name_active` 存在。Playwright `/tmp/rem-p1-058-group-name-r3` 1/1 PASS（2.4s）；manifest `objects=[]`、`cleanupFailures=0`，活动 runId marker 为零，backend 日志无 ERROR/5xx。

原始失败：L4 snapshot `592f775c`；测试资产位于该 snapshot 的 `test/l4-rbac-group-lifecycle-current-run.spec.js`；失败输出 `/tmp/fqa-2050-rbac006007-r1`。两个重复组均经产品 API 归档，active marker 为零，manifest `objects=[]`、`cleanupFailures=0`。
