# REM-P2-027 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 继续唯一事件 `REM-P2-027：变更文档创建 CI 关联合同`。先读根 `AGENTS.md`、整改目录 README/INDEX/检查点、事件五件套与 L4 `CHANGE-002` 记录；不要重做已完成事件。

仅允许修改创建请求 DTO 与创建事务中 CI 链接持久化的最小根因范围。创建必须复用同租户校验和去重链接能力；不得改权限、模板、审批、导出、CI 数据、历史文档或数据库卷。编辑符号前运行 GitNexus upstream impact，提交前运行 detect_changes。

以 `REM_P2_027_<timestamp>` 创建最小草稿，仅通过产品 DELETE 清理。完成 DTO/服务定向验证、真实会话 API 正反验证、当前分支容器真实页面验证后，回写事件卡、验证矩阵、实施记录、全局台账；再提交并 no-ff 合并到 `lint-fix`，从最新合并头重跑 L4 `CHANGE-002`。不得 push 或改动非测试数据。
