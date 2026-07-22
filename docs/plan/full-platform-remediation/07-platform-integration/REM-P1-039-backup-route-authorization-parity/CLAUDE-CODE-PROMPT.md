# REM-P1-039 执行入口

在 `codex/rem-p1-039-backup-route-authorization-parity` 上完成且只完成备份路由授权一致性。先读取根规则、事件五件套、L4 `FQA_20260718_2050_remp1038` 缺陷证据和检查点。编辑任何符号前运行 GitNexus upstream impact。

先确认真实页面路由：`/admin/backup`；`/backups` 仅为 API。若既有页面守卫已经符合合同，则不修改产品代码，只记录独立 L1-L3 复验。不得执行 restore、改后端、改非测试授权或带入用户工作区改动。提交前运行 `detect_changes`，回写全局台账后单独提交并 no-ff 合并到 `lint-fix`；随后从 merge head 新建零状态最终 L4。
