# REM-P1-053 执行入口

从本目录五件套与全局 checkpoint 恢复，只修复 Workflow 审批意见导致审计 remark 超界 500 的根因。

硬约束：

1. 完整审批意见保留在既有流程/业务数据中；只生成 ≤512 的审计摘要。
2. 覆盖日报与 Wiki 两个 adapter，不改变权限、候选人、状态机、通知、API、schema 或正式 binding。
3. 编辑每个函数/类前运行 GitNexus upstream impact；提交前运行 staged 与 master compare detect_changes。
4. 完成 Java 21 L1、日报/Wiki/权限 L2、当前分支 backend 与真实 API/UI L3。
5. 密码只从 `FQA_SUPERADMIN_PASSWORD` 读取；全部 runId 对象产品 API 精确清理。
6. 回写本事件文档、全局索引/矩阵/checkpoint，独立 event commit 后按顺序 no-ff 合并到 `lint-fix`。
7. 不 push、不 restore、不清卷/Redis、不修改非测试数据。
