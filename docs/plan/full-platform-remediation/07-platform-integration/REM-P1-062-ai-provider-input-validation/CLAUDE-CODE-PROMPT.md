# REM-P1-062 执行入口

本事件只处理 AI Provider 配置输入边界。先读根 Goal 合同、检查点、SPEC 与 VERIFICATION；编辑符号前运行 GitNexus upstream impact，提交前运行 detect_changes。

必须证明非法 URL/model/key/prompt HTTP 400 且无部分写入、合法规范化、密钥不泄露/留空不覆盖、隔离 mock 成功与业务失败反馈、配置精确恢复。不得使用 SQL 写入、restore、Redis/卷清空或全租户授权切换。L1-L3 后独立提交、`--no-ff` 合并，再在同一 L4 run 重验 `AI-002/003`。
