# 实施记录

## 2026-07-20：认领与失败快照

- 从 `lint-fix@daa73689` 创建独立事件分支 `codex/rem-p1-064-notification-config-ops-rule-sync`。
- 同 run `CONFIG-003` 探测保存 disabled、cron 和唯一模板标记后，正式规则 `1` 的 enabled、17:00 触发和 reminderConfig 完全不变。
- 原 disabled、17:00、中文模板配置已通过产品 API 精确恢复；正式规则未被修改，共享 manifest 为 0/0。
- 失败快照提交为 `8ac92182`，位于 L4 continuation 分支，不属于事件实现提交。

## 预计范围与边界

- 预计修改配置 Controller/协调服务、正式规则更新入口与通知正文生成，补充 Java/Playwright 测试。
- 单一正式规则继续负责调度；不恢复旧 scheduler、不新增迁移、不直接 SQL 写入、不切换授权模式。
- 第一门禁：对每个拟修改符号完成 GitNexus upstream impact；HIGH/CRITICAL 先告警。

## 2026-07-20：运行时根因补充

- 首次自然 scheduler 探测未生成任务，但 finally 完整恢复且 manifest 0/0。
- 正式日报规则为租户级汇总规则，没有 groupId；`generateForRule` 却无条件校验 groupId，导致插入前失败。
- `generateForRule` 既有 GitNexus impact 为 LOW：2 个直接调用者、0 条已索引流程；修复仅在 groupId 非空时执行组引用校验，保留所有分组规则保护。

## 2026-07-21：实现与 L1-L3 收敛

- 新增 `NotificationConfigService`，先校验完整 Spring cron 与模板默认值，再在同一事务中同步唯一正式日报规则和三个兼容配置键；正式规则缺失或重复时返回 400 且不产生部分写入。
- `OpsCalendarRuleService.syncDailyReportReminder` 同步 enabled、cron 和 `reminderConfig.bodyTemplate`，保留 stages、description 和其他业务字段；启用时显式清空 `next_generate_at` 以触发重新扫描。MyBatis-Plus 默认忽略 null，因此使用 update wrapper 写入 null，并在生成 SQL 前清空 entity 中的旧值以避免重复列。
- 租户级正式日报规则没有 groupId；生成任务时仅在 groupId 非空时执行活动组引用校验。分组规则仍保持原保护。
- `OpsCalendarNotificationService` 仅对 `sourceType=rule`、`taskType=daily_report`、`stage=created` 消费任务正文模板；其他任务类型和通知阶段继续使用原默认模板。
- `OpsCalendarTaskService.purgeRemediationTest` 按 tenant、`refType=ops_task`、taskId 精确清理事件创建的通知，未扩大普通删除合同。
- 编辑前 upstream impact 均已执行：`updateNotification`/Controller、`OpsCalendarRuleService`/`generateForRule`/`setEnabled`/`tick` 为 LOW；notification `send` 与 `purgeRemediationTest` 为 MEDIUM，直接调用者分别为 5 和 6；无 HIGH/CRITICAL、无索引流程越界。
- L1 定向 51/51 PASS。L2 配置、运维日历与通知聚类在排除未修改的历史 `OpsCalendarMaterialExportTest` Mockito unnecessary stub 后退出码 0；该无关历史测试未修改。
- Java 21 生产构建成功，552 source files；当前事件工作区构建的 backend 镜像 `sha256:8765661e40d95afe3a4ad6c96dac21ab58d05f55619412fb6cf4eda0231dadf4` 已运行且 healthy。Docker Desktop 曾在验证中自行重启，未删除或重建数据卷，服务恢复后重新核验健康。
- UI/API 证据 `/tmp/rem-p1-064-l3-r1` 为 1/1 PASS：保存、唯一规则 readback、preview、非法 cron 无副作用、Console/5xx 0，配置和规则业务字段均通过产品 API 恢复。
- 自然 scheduler 证据 `/tmp/rem-p1-064-l3-runtime-r4` 为 1/1 PASS：任务 `149,150`、通知 `809`，正文为配置模板渲染结果；任务及关联通知通过产品 remediation API 精确清理，manifest 0/0。
- 正式配置已恢复为 disabled、`0 0 17 * * MON-FRI` 和原中文模板；正式规则恢复 enabled、daily/17:00、原 stages、负责人/收件人合同。真实 scheduler 将 `lastGeneratedAt` 正常推进至 `2026-07-20T16:01:00.001111`，这是运行元数据，不回退也不宣称时间戳完全恢复。
- 回滚只需回滚事件提交；无迁移、历史回填、直接 SQL 写入、restore、授权切换或外部系统修改。
