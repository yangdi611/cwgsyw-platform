# REM-P1-074 执行 Prompt

从 `lint-fix@1f4e3138` 创建 `codex/rem-p1-074-cmdb-status-change-notification-chain`，严格按同目录 `SPEC.md` 实施。

硬约束：

1. 编辑 `CiInstanceCommandService.update` 前复核 GitNexus upstream impact；已知风险 LOW、3 个直接调用者。
2. 复用 `CiNotificationService.notifyStatusChange`，不复制收件人或通知写入逻辑。
3. 仅真实状态变化通知；同状态、未提供状态和其他字段更新不得新增通知。
4. 补齐成功、静默、批量/导入复用和通知失败事务回滚测试。
5. 完成 L1-L3、生产 backend、真实 API/UI、change/notification 只读核对和产品清理后才能标 VERIFIED、提交并 no-ff 合并。
6. 合并后仅重跑同一 L4 run 的 `XL-CMDB-006`，保留其余 PASS。
