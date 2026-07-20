# REM-P1-064 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21：`SysConfigControllerTest` 9、`NotificationConfigServiceTest` 3、`OpsCalendarRuleServiceTest` 6、`OpsCalendarNotificationServiceTest` 2、`OpsCalendarTaskServiceTest` 31 | PASS，51/51 |
| L2 | Java 21：`com.cwgsyw.platform.module.config.**`、`opscalendar.**`、`notification.**`；排除未修改且已有历史 Mockito unnecessary stub 的 `OpsCalendarMaterialExportTest` | PASS，15 suites，退出码 0 |
| L3 build | `docker run --rm -v "$PWD":/app -v "$HOME/.m2/repository":/root/.m2/repository -w /app eclipse-temurin:21-jdk-alpine ... mvn -q -DskipTests package`；`docker compose -f docker-compose.dev.yml build backend && ... up -d backend` | PASS；552 source files；镜像 `sha256:8765661e...`；backend `healthy` |
| L3 UI/API | `FQA_REM_P1_064_EVIDENCE_DIR=/tmp/rem-p1-064-l3-r1 npx playwright test test/rem-p1-064-notification-config-ops-rule-sync.spec.js --output=/tmp/rem-p1-064-l3-r1/playwright` | PASS，1/1；开关、cron、模板与唯一正式规则同步；preview 成功；非法 cron 400 且无部分写入；Console/5xx 为 0 |
| L3 scheduler | `FQA_REM_P1_064_RUNTIME_EVIDENCE_DIR=/tmp/rem-p1-064-l3-runtime-r4 npx playwright test test/rem-p1-064-notification-config-runtime.spec.js --output=/tmp/rem-p1-064-l3-runtime-r4/playwright` | PASS，1/1；自然 scheduler 生成任务 `149,150`，通知 `809` 正文消费模板且占位符完成渲染 |
| Cleanup | `/tmp/rem-p1-064-l3-r1/manifest.json`、`/tmp/rem-p1-064-l3-runtime-r4/manifest.json`；产品 remediation API 删除任务及关联通知 | PASS；两个 manifest 均 `objects=[]`、`cleanupFailures=0`，runId 任务/通知均为 0 |

## 验收结论

| AC | 结果 | 证据 |
|---|---|---|
| AC-001 | PASS | UI 保存 disabled 后配置与正式规则一致，刷新/API readback 保持。 |
| AC-002 | PASS | 合法六字段 cron 写入正式规则；非法 cron 返回 400，配置和规则快照不变。 |
| AC-003 | PASS | `reminderConfig.bodyTemplate` 保留 stages；自然调度通知正文使用模板并渲染 `{calendarDate}`、`{taskTitle}`。 |
| AC-004 | PASS | service 单测覆盖正式规则缺失/重复时事务回滚，其他规则不变。 |
| AC-005 | PASS | 当前分支构建、真实 UI/API、自然调度、产品 API 清理和配置恢复全部通过。 |
