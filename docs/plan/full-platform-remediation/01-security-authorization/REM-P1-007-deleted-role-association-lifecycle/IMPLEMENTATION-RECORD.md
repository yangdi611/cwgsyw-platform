# REM-P1-007 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`。
- 规划基线：`lint-fix@842dc84f`。
- 来源缺陷：`BUG-FQA-055`、`BUG-FQA-093`；用例：`RBAC-009`、`RBAC-018`。
- 根因聚类：RoleController/RbacService 的关联读取缺少租户、存在性和软删除校验；删除事务未形成明确的关系收敛合同。
- GitNexus：索引已刷新至当前规划基线并完成领域 query；尚未编辑业务符号，因此未伪造逐符号 impact 结果。
- 代码、数据、容器：未修改、未启动、未创建测试对象。
- 下一步：认领独立分支后读取本事件全部文档，对候选符号逐项执行 upstream impact，再从 `AC-001` 开始。

## 追加规则

后续只追加状态变化、实际文件/符号、impact、提交/diff、测试命令、证据、清理、回滚和剩余风险；不得覆盖历史记录。

## 2026-07-15：认领、实现与 L1-L3 验证

- 分支：`codex/rem-p1-007-deleted-role-association-lifecycle`，基线：`lint-fix@12d602a`。
- GitNexus：`RbacService.getPermissionsByRoleId` upstream 为 LOW，2 个直接消费者：`RoleController.getRolePermissions` 与 `WikiSpaceService.computeRoleForcedGrants`；后者继续到 Wiki 空间/页面 ACL 展示。`getRolePermissions` 与 `computeRoleForcedGrants` 自身均为 LOW。未发现新的授权语义或跨租户操作。
- 根因：helper 直接由 roleId 查询 `sys_role_permission`，缺少租户与逻辑删除前置；RoleController 因而可读取软删除角色的历史权限关系。Wiki 的强制授权列表亦不应跨租户枚举角色。
- 修复：`RbacService.getPermissionsByRoleId` 改为显式接收 tenantId，并仅在有效角色存在时读取；RoleController 传入当前会话租户；Wiki ACL forced-grants 查询同租户有效角色并调用新 helper。没有物理删除历史 role-permission 关系、没有修改 assignment 模型或数据迁移。
- L1：RBAC/Wiki 定向单测和 backend compile 通过。L3：当前分支 backend 容器重建后 health=`UP`。`REM_P1_007_20260715013545` API 矩阵确认有效角色 200、软删除后 400；`REM_P1_007_UI_20260715013826` Playwright 确认角色管理页真实创建/删除和列表消失。
- 清理：所有测试角色仅由产品 API 删除，remaining=0；未使用 SQL、Redis、对象存储或全量会话操作。回滚为 event commit 的普通 revert。
- 结论：L1-L3 PASS，状态为 `VERIFIED`，等待最终 L4。
