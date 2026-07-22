# REM-P1-058 执行入口

按全局 Codex Goal、根 `AGENTS.md` 和本目录 SPEC，只修复同租户活动用户组的 trim-normalized 名称唯一性。

保持独立事件分支。`GroupMapper` 为 HIGH 风险共享接口：只新增独立活动名称冲突查询；create/update 返回稳定 400，restore 保持生命周期 409；跨租户、归档复用、大小写、membership、ACL 和授权模式合同不变。完成 L1-L3、真实 RBAC-007、精确清理、detect_changes、event commit 和 `lint-fix` no-ff merge 后，恢复同一 L4 run affected-only。历史数据修改、restore、purge、授权切换或不可逆动作立即暂停。
