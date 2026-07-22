# REM-P1-065 执行入口

本事件只处理 `FLOW-010` 流程绑定完整生命周期。先读根 Goal、checkpoint、本目录五件套、`BR-009` 与首败证据。编辑每个函数/类/方法前运行 GitNexus upstream impact；`WorkflowProcessBinding` 已为 CRITICAL、`bind/getActiveBinding` 已为 HIGH，必须保留告警和跨模块回归。

用户批准 SPEC 的待决语义前禁止修改业务代码。批准后只实现已批准的 create/edit/enable/disable/delete、版本选择、审计和业务启动消费，不终止/迁移实例，不删除定义/模板，不修改日报/Wiki/变更状态机，不直接 SQL、不 restore、不操作正式 binding。完成 L1-L3、当前分支双构建/双容器、真实 UI/API/业务启动、精确清理、detect_changes、独立提交和 no-ff 合并后，在同一 L4 run affected-only 重验 `FLOW-010`。
