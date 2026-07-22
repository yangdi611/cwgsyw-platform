# REM-P1-043 执行入口

从 `lint-fix@95e6fff6` 的独立事件分支最小修复 SMTP 输入校验。保持部分更新、密码掩码和 Mailpit 单标签 host 兼容；完成 DTO/Controller L1、真实 API 边界与无写入 L2、当前分支 backend/配置 UI/Mailpit/恢复 L3。所有临时配置用内存快照和 `finally` 恢复，不记录秘密；通过后回写事件与全局台账、提交并 no-ff 合并，再恢复完整 L4。
