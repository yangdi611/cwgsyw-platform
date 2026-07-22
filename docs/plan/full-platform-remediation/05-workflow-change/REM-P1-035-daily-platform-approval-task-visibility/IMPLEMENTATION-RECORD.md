# REM-P1-035 实施记录

## 2026-07-17：认领与影响分析

- 基线：`lint-fix@19e77077`；分支：`codex/rem-p1-035-daily-platform-approval-task-visibility`。
- L4 复现：平台管理员提交自己的日报后状态为 `SUBMITTED`，但详情页不显示“审批此日报”。
- GitNexus：`candidateGroupTokens` 上游 10 个符号，`MyTasks/GroupTasks` 两条流程；`listGroupTasks` 两个直接 Controller；按 MEDIUM 风险验证。

## 2026-07-17：实现与复验

- 根因：adapter 的 `canApprove` 对 tenant/platform 放行，但候选 token 仅使用 `SecurityUser.groupId`，平台会话无主组时返回空列表。
- tenant/platform 会话现在读取本租户所有活动组并生成 `group_{id}` token；组级会话仍仅使用自身组，角色 token 和 adapter 二次授权不变。
- Java 21 容器定向测试通过；本机 Java 26 的 Mockito/Byte Buddy 初始化限制已记录但不作为业务失败。
- 仅重建 backend，health UP；Playwright 真实 UI 从创建、提交、显示审批、通过、`APPROVED` 到受限 runId 清理均通过。无非测试对象或授权关系变更。
