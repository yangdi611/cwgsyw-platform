# REM-P1-049 执行入口

按 `CODEX-GOAL-PROMPT.md` 从检查点继续本事件。只修复 `OPS-006` direct-id 详情数据范围：tenant/platform/read_all、任务相关人、own-group read_group、public 允许；其他无关 private/group 拒绝并保持非枚举语义。

`canViewDetail` impact 为 HIGH，不改变其敏感字段遮罩职责。完成 Java 21 L1、当前 backend、真实跨组 API/UI、精确清理、证据回写、detect_changes、独立提交和 no-ff 合并；合并后同 run 仅重验 `OPS-006`。
