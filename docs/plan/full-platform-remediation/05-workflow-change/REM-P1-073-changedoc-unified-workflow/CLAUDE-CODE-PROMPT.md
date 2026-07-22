# REM-P1-073 执行入口

只处理 `CHANGE-020` 变更文档统一工作流缺口。先读根 Goal、checkpoint、本目录五件套、`REM-P1-065` binding 已批准合同和失败提交 `231bc59b`。

编辑任何已有函数/类/方法前必须运行 GitNexus upstream impact；`getActiveBinding` 为 HIGH，只允许调用，不修改其实现。保持无 binding 的旧内部审批，binding 启用时统一流程恰好启动一次；运行中流程禁止旧 approve 旁路。完成 L1-L3、真实 `/workflow/todo` UI/API、精确流程和业务清理、detect_changes、独立提交和 no-ff 合并后，回到同一 L4 run affected-only 重验 `CHANGE-020`。
