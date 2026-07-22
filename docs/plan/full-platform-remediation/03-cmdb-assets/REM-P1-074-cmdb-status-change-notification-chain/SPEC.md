# REM-P1-074 规格

## 范围

- 在 `CiInstanceCommandService.update` 中保留更新前状态。
- 复用现有 `CiNotificationService.notifyStatusChange` 和既有收件人策略。
- 仅当持久化后的状态与更新前不同才发送通知。
- 通知与实例更新、审计、canonical change record 保持同一事务结果。

## 非目标

- 不改变状态枚举、CMDB API、change history DTO、统计缓存或通知文案/收件人策略。
- 不为通知新增删除、批量清理或外部发送能力。
- 不改变实例创建、删除、导入和批量更新的既有业务语义；批量更新继续复用单条更新。

## 验收标准

- AC-001：真实状态变化写入准确 before/after change record，并向既有 owner/admin 目标发送一次状态通知。
- AC-002：未提供状态或新旧状态相同不发送通知，其他字段更新合同不变。
- AC-003：API 与批量更新均通过同一更新路径，不重复通知。
- AC-004：通知写入失败时事务整体回滚，不留下半写状态。
- AC-005：当前事件分支 Java 21、CMDB 聚类、生产 backend、真实 API/UI/只读持久化核对和精确清理全部通过。

## 回滚

移除 `CiInstanceCommandService` 对 `CiNotificationService` / transaction manager 的依赖、batch 每 item transaction template、旧状态快照和调用；无需数据库迁移或数据回滚。
