# 实施记录

## 2026-07-17：认领、合同与影响分析

- 基线：`lint-fix@039502b4`；分支：`codex/rem-p0-005-platform-superadmin-resource-acl-bypass`。
- L4 真实 superadmin 读取 Wiki 页面 `#50` 后产生 5 条 active Shadow diff：legacy allow、unified `RESOURCE_ACCESS_DENIED`，strict preflight `latestDecisionDiffs=5`。
- 用户明确确认：platform 超级管理员绕过 Wiki/共享文件 ACL。
- GitNexus upstream impact：`AuthorizationService.decideOrdinary` 为 HIGH（32 受影响符号，Wiki/Sharedfile/Search，`listFiles` 执行流）；`resourcePermissions` 为 HIGH（28 符号，Wiki/Sharedfile）。本事件仅添加有效 `super_admin@platform` 的资源层绕过，不放宽功能 permission 或其他管理员。

## 2026-07-17：实现与 L1-L3 复验

- 实现：新增 `ScopedPermissionMapper.hasActivePlatformSuperAdminAssignment`；`AuthorizationService.resourcePermissions` 对 Wiki、共享文件、共享文件夹且具有有效 `super_admin@platform` 的用户返回 `platform_super_admin/7`。裁决仍先完成资源存在/迁移、功能 permission 与 scope 验证，因此不能绕过缺失功能 permission。
- L1：Java 21 buildcheck 容器中 `AuthorizationServiceTest` 和编译均通过。新增 Wiki ACL allow、共享文件夹祖先 allow、非 super_admin ACL deny、缺功能 permission deny 四条合同断言。
- L3：当前分支 backend 以 `AUTHORIZATION_DECISION_MODE=SHADOW` 重建并健康。真实 superadmin 会话读取 Wiki 页面 `#50` 和共享文件列表均为 200，Nginx UI 页 `/wiki/7/50` 正确渲染且 console error=0。
- Shadow strict preflight：`eligible=true`、`latestDecisionDiffs=0`、`unobservedPermissionGrants=0`。历史差异审计行保持不删除；未执行 Enforce、Rollback、break-glass 或 ACL/角色/assignment 写入。
