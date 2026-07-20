# REM-P1-064 执行入口

本事件只处理系统通知配置与唯一正式日报提醒规则的同步和模板消费。先读根 Goal、检查点、SPEC、VERIFICATION；编辑每个符号前运行 GitNexus upstream impact，提交前运行 detect_changes。

必须证明开关、合法/非法 cron、模板、规则缺失/重复、无部分写入、其他规则无变化、真实 UI/API、实际通知正文、精确恢复和 manifest 0/0。不得恢复旧 scheduler、创建第二条提醒路径、直接 SQL 写入、restore、清空 Redis/卷/会话或切换授权模式。L1-L3 后独立提交、no-ff 合并，再在同一 L4 run 重验 `CONFIG-003`。
