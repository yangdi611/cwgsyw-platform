# REM-P1-045 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| 权限、空/错 runId、跨租户拒绝 | L1/L2 | PASS | `OpsCalendarRosterHistoricalGroupTest` 6/6；错 runId 真实 API 返回 400 且记录保留 |
| 正确单记录删除与审计 | L1/L2 | PASS | 单记录软删除并仅写一次 `purge_remediation_test` 审计；重复请求拒绝 |
| 当前 backend 与真实排班 CRUD | L3 | PASS | 当前分支 backend `d956e7adadca` healthy；Playwright `1/1 PASS`，覆盖创建、主备人员、电话、更新与读取 |
| 精确清理、manifest 为空 | L3 | PASS | 产品 API 清理后只读 SQL 核对 `REM_P1_045_%` active count=`0`；共享 L4 manifest 未写入 |

验证命令：

```text
mvn -q -DskipTests compile
mvn -q -Dnet.bytebuddy.experimental=true -Dtest=OpsCalendarRosterHistoricalGroupTest test
npx playwright test test/rem-p1-045-ops-roster-remediation-cleanup.spec.js --workers=1 --output=/tmp/rem-p1-045-l3-pass
```

反向时间创建在首次 L3 中返回 `200`，证据位于 `/tmp/rem-p1-045-l3`。它超出本事件“不改变时间语义”的范围，恢复 L4 后单独登记，不将该部分覆盖提升为 PASS。
