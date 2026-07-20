# REM-P1-064 实施合同

## 目标

系统配置页保存日报提醒开关、cron 周期和通知模板后，唯一正式内置 `daily_report` 运维规则在同一事务内反映并实际消费这些值。

## 范围

- 通知配置请求先完成边界校验，再原子写入旧兼容键与正式规则。
- `reminderEnabled` 同步规则 enabled。
- `reminderCron` 同步规则 `triggerType=cron` 与 `triggerConfig.expression`，保持六字段 Spring cron 合同。
- `reminderTemplate` 同步规则 `reminderConfig.bodyTemplate`，保留既有 stages，并由正式通知消息正文消费；空模板使用稳定默认文案。
- 只允许更新当前租户唯一内置名称 `日报未提交提醒` 且 `taskType=daily_report` 的规则；缺失或重复时拒绝且不部分写入。
- 保留旧 `notify.reminder.*` 键用于页面读取和兼容，不恢复旧 scheduler。

## 非目标

不新增第二条调度链路，不恢复 `DailyReportReminderScheduler`，不改变其他运维规则、通知收件人、任务状态机、数据库结构或租户授权。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 开关保存与正式规则 enabled 一致，刷新后保持。 |
| AC-002 | 合法 cron 保存后正式规则使用同一表达式；非法 cron 返回 400 且配置和规则均不变。 |
| AC-003 | 模板保存后正式规则和实际通知正文使用该模板；空模板使用稳定默认值。 |
| AC-004 | 规则缺失/重复拒绝且无部分写入；其他规则保持不变。 |
| AC-005 | 真实 API/UI、调度通知、精确恢复和 manifest 0/0 全部通过。 |

## 回滚

回滚事件提交恢复旧配置写入行为；无迁移或历史数据批改。运行时复验结束后仅通过产品 API 精确恢复原配置和正式规则状态。
