# REM-P1-044 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| 空/错 runId 与普通任务拒绝、零写入 | L1/L2 | PASS | `OpsCalendarTaskServiceTest`；真实错 runId 400 后任务仍可读 |
| 正确 runId 逆序精确清理及审计 | L1/L2 | PASS | 五张从表逆序删除、task 删除、`purge_remediation_test` 审计 |
| 权限拒绝与重复清理 | L2 | PASS | 非 platform 单测拒绝；真实重复清理 400 |
| 当前分支 backend 与真实 OPS 页面 | L3 | PASS | backend-only build/recreate health；Playwright 1/1；UI 无 runId |

验证命令：

- `mvn -q -DskipTests compile`：PASS。
- `mvn -q -Dnet.bytebuddy.experimental=true -Dtest=OpsCalendarTaskServiceTest test`：15/15 PASS。
- `docker compose -f docker-compose.dev.yml build backend` 并仅重建 backend：PASS，其他七个服务 ID 不变。
- `test/rem-p1-044-ops-task-remediation-cleanup.spec.js`：1/1 PASS，`/tmp/rem-p1-044-l3`。
