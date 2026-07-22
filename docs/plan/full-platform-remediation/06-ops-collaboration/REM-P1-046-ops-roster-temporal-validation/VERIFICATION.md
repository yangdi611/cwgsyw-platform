# REM-P1-046 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| create/update 反向及相等时间拒绝、零写入 | L1/L2 | PASS | 定向 Java 测试；真实 API create/update 均 400 |
| 合法同日及跨日时间保存读取 | L1/L2 | PASS | 真实 API 同日创建、跨日更新回读一致 |
| 当前 backend 与完整 OPS-016 | L3 | PASS | backend `c88e30da37a4` healthy；Playwright `1/1 PASS` |
| 精确清理、manifest 为空 | L3 | PASS | 产品 API 清理；active `REM_P1_045_%` roster count=`0` |

命令：`mvn -q -f backend/pom.xml -DskipTests compile`；`mvn -q -f backend/pom.xml -Dnet.bytebuddy.experimental=true -Dtest=OpsCalendarRosterHistoricalGroupTest test`；`npx playwright test test/rem-p1-045-ops-roster-remediation-cleanup.spec.js --workers=1 --output=/tmp/rem-p1-046-ops016-l3-complete`。
