# REM-P1-067 规格

## 范围

- 增强仅平台管理员可调用、且要求日报内容匹配 remediation runId 的测试清理入口。
- 以 `daily_report:<id>` 精确发现与日报关联的运行和历史 Flowable 实例。
- 合并日报存储实例 ID，去重后清理 runtime/history。
- 保持通知、业务实例映射、日报及审计的既有清理顺序和合同。

## 非目标

- 不增加正常日报删除入口。
- 不清理不同 businessKey 的流程。
- 不修改流程实例页历史展示策略。
- 不直接写数据库，不执行 restore、purge 脚本或 Redis/session 清理。

## 验收标准

- AC-001：存储 `processInstId` 缺失时，精确 businessKey 关联流程仍被清理。
- AC-002：存储 ID 与 businessKey 查询重复命中时只处理一次。
- AC-003：新日报提交后调用受限清理，日报不可读且 running/finished 均无相同 businessKey。
- AC-004：未授权、runId 不匹配及其他业务对象的既有保护不变。
