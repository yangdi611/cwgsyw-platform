# 实施记录

## 2026-07-17：认领与只读分类

- 基线：`lint-fix@612b71ec`；分支：`codex/rem-p0-004-historical-authorization-decision-reconciliation`。
- 用户已明确授权处理 8 条历史授权判定差异（含陈旧测试观测），但未授权授权模式切换或批量变更非测试 ACL。
- 只读核对：6 条 `byron` Wiki 差异与 2 条已删除 runId 资源的 superadmin 观测。历史审计将保留；严格预检已只统计活跃资源。
- GitNexus：`AuthorizationService.resourcePermissions` upstream 为 HIGH（26 符号、Wiki/Sharedfile、1 个执行流）。实施只限 Wiki 页面空间 ACL 合并与系统 Wiki 策略，不改变共享文件判定。

## 2026-07-17：实现与 L1-L3 复验

- GitNexus 补充影响：`ResourceDescriptorRepository.find` 为 HIGH（44 个上游符号）；未改变其共享文件查询合同，仅补充 Wiki page 的 `acl_inherited` 描述字段。`decideWithPolicyCompatibility` 为 LOW。
- 实现：系统策略 allow 直接形成明确的 `RESOURCE_POLICY_ALLOWED` 决策；普通 Wiki 写路径要求对应功能权限后才接受 legacy space/page ACL；统一页面写判定合并所属空间的显式 access ACL。自定义页面 ACL 不再从 owner 或 mode 回退，防止 Release Notes 可见性旁路。共享文件未改。
- L1：Java 21 容器运行 `AuthorizationServiceTest, AuthorizationCutoverServiceTest, WikiSpaceServiceTest, WikiPageServiceTest` 全部通过；`mvn -q -DskipTests compile` 通过。
- L3：基于当前分支以 `AUTHORIZATION_DECISION_MODE=SHADOW` 重建 backend，health=UP。以 byron 真实会话验证 Bug 反馈 create/update/publish=200、delete=403、既有 Wiki page read=200、Release Notes read=403；runId 页面由 superadmin 以产品 API DELETE=200 清理。
- strict preflight：`latestDecisionDiffs=0`、`unobservedPermissionGrants=0`、`eligible=true`。历史 `authorization_decision_diff` 行未删除；未执行 Rollback、Enforce 或任何非测试 ACL/角色/assignment 写入。
- 最终门票收敛后再次以当前分支 Shadow backend 复验：Java 21 定向测试和编译通过；byron 既有页面读取 200、Release Notes 403；strict preflight 继续为 `latestDecisionDiffs=0`、`unobservedPermissionGrants=0`、`eligible=true`。未创建新的业务对象，未执行切换。
