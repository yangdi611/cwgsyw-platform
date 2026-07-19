# REM-P1-050 执行入口

按 `CODEX-GOAL-PROMPT.md` 从检查点继续。只修复 `OPS-007` 跨组负责人 UI/API 候选一致性，并补齐任务人员同租户启用资格校验。禁止放宽通用 `/api/users`；候选只返回 `id/username/realName/groupId`。

完成 L1-L3、当前容器真实 API/UI、非法 ID 零写入、read-only 403、精确清理、detect、独立提交和 no-ff 合并；合并后同 run 仅重验 `OPS-007`。
