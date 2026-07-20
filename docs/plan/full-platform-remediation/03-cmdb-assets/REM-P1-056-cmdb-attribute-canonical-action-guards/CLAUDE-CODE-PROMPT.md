# REM-P1-056 执行入口

按全局 Codex Goal、根 `AGENTS.md` 和本目录 SPEC，只修复 CMDB 属性 canonical action consumer 漂移。

保持独立事件分支；编辑前使用已记录的 GitNexus impact。后端四个属性 CRUD guard 与前端属性页 read/create/update/delete 必须逐项对应，不得用一个 broad manage/update 权限替代。补齐 annotation、canonical allow/deny、legacy denial和真实 UI/API 测试；仅使用 runId 自有对象并通过产品 API 逆序清理。完成 L1-L3、证据回写、detect_changes、event commit 和 `lint-fix` no-ff merge后，恢复同一 L4 run affected-only。高风险授权、restore 或不可逆动作立即暂停。
