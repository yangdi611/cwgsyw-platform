# REM-P0-005 执行入口

在 `codex/rem-p0-005-platform-superadmin-resource-acl-bypass` 完成 platform 超级管理员对 Wiki/共享文件 ACL 的已批准资源层绕过。先读根 `AGENTS.md`、总索引、检查点和本事件五件套；编辑 `AuthorizationService` 前必须运行并记录 upstream impact。

仅允许有效 `super_admin@platform` assignment 绕过资源 ACL/祖先 traverse；不得绕过功能 permission、资源存在或迁移完整性，不得扩大 tenant/group/document admin 或 break-glass。L1-L3 通过后回写台账、提交并 `--no-ff` 合并到 `lint-fix`；不执行授权模式切换或非测试 ACL 修改。
