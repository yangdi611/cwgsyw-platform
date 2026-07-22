# REM-P1-057 执行入口

按全局 Codex Goal、根 `AGENTS.md` 和本目录 SPEC，只修复子资源 owner-group 空值初始化。

保持独立事件分支。共享初始化器为 HIGH 风险：只允许在传入 owner group 为空且父 descriptor 存在时使用父 owner group；setgid 继续覆盖显式组，根资源、default ACL、组校验、Wiki/Sharedfile 其余创建路径保持不变。完成 L1-L3、真实 WIKI-024 allow/deny/non-leak、精确清理、detect_changes、event commit 和 `lint-fix` no-ff merge后，恢复同一 L4 run affected-only。高风险授权切换、restore、历史回填或不可逆动作立即暂停。
