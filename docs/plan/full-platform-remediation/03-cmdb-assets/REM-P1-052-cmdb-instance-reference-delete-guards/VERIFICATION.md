# REM-P1-052 验证与证据矩阵

| AC | 层级 | 证据 | 结果 |
|---|---|---|---|
| `AC-001` | L1-L2 | 活动关系引用拒绝与无副作用 | `PASS` |
| `AC-002` | L1-L2 | 活动设备引用拒绝与无副作用 | `PASS` |
| `AC-003` | L1-L3 | 活动变更文档引用拒绝 | `PASS` |
| `AC-004` | L1-L3 | 活动日报引用拒绝 | `PASS` |
| `AC-005` | L1-L3 | 解除引用后正常删除 | `PASS` |
| `AC-006` | L3 | 当前 backend API/UI/cleanup | `PASS` |
| `AC-007` | L4 | same-run `CMDB-040` affected-only | `PENDING` |

原始失败：L4 snapshot `4a80a9d4`；活动变更文档 `ci-links` 明确包含 CI，但实例 DELETE 返回 200。最终夹具通过产品 API 清理，shared manifest `objects=[]`、`cleanupFailures=0`。

## L1-L3 结果

- L1：JDK 21 `CiInstanceCommandServiceTest` 5/5 PASS，覆盖关系、设备、活动文档、活动日报四类拒绝及无引用成功删除的单次审计/变更历史。
- L2：`CiInstanceCommandServiceTest`、`CiInstanceRelMapperTopologySqlTest`、`CiRelationServiceTest`、`ChangeDoc*Test`、`DailyReport*Test` 合计 28/28 PASS；生产 `mvn -q -DskipTests compile` PASS。
- L3：`docker compose -f docker-compose.dev.yml build backend` PASS，镜像 `sha256:6105836288...`；仅替换 backend，容器 healthy，Flyway 无迁移，会话 epoch 保留，日志无 ERROR/Exception。
- 真实 API/UI：`test/rem-p1-052-cmdb-instance-reference-delete-guards.spec.js` 在 `/tmp/rem-p1-052-cmdb-reference-guards-rerun` 1/1 PASS（2.3 秒）。活动文档和日报分别返回 400，实例与 delete audit 不变；产品 unlink/update 后真实页面删除 200，恰好新增一条 delete audit，Console/page error/5xx 为零。
- 清理：日报 remediation purge、变更文档 remediation purge、实例/模型/组删除均通过产品 API；event manifest `objects=[]`、`cleanupFailures=0`。首跑因 superadmin 缺主组未显式传 `groupId` 停在日报夹具创建，finally 同样清理为零。
- 环境协调：首次 L1 命令的 `/usr/libexec/java_home -v 21` 未找到 JDK 21并回落到 Java 26，Mockito/Byte Buddy 不支持；显式使用 `/opt/homebrew/Cellar/openjdk@21/21.0.11/...` 后通过。首次 L2 shell selector 未加引号被 zsh 拦截，不计结果；加引号后 28/28 PASS。
