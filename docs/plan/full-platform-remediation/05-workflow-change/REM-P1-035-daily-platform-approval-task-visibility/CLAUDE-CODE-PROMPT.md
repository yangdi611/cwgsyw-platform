# REM-P1-035 执行入口

仅修复 tenant/platform 日报审批候选任务的可见性。编辑 `candidateGroupTokens` 前执行 GitNexus upstream impact，并明确报告 `MyTasks/GroupTasks` 流程影响。tenant/platform 只能枚举同租户活动组；不得扩大组级 scope、绕过 adapter `canApprove` 或改 Flowable 定义。以 Java 21 定向测试、当前分支 backend 容器 Playwright 的完整 runId 日报审批链和产品精确清理完成 L1-L3 后，再提交并 `--no-ff` 合并。
