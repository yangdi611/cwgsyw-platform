# WP-10 授权终态收口

**状态：** VERIFIED  
**范围：** 用户角色关系、Wiki/共享文件资源 ACL、授权影子与迁移兼容层  
**不包含：** 改变业务角色、资源权限语义或删除非授权领域数据

## 1. 终态决策

授权域只保留两类权威关系：

- `sys_role_assignment`：用户角色与作用域的唯一来源。
- `resource_acl_entry`：Wiki 空间/页面和共享文件夹/文件的唯一 ACL 来源，主体为 `user`、`group` 或 `role`。

授权判断固定使用上述模型。不得保留按租户切换的 `LEGACY`、`SHADOW`、`ENFORCED` 模式，不保留旧权限回退、判定差异记录或迁移异常处置页面。

## 2. 迁移顺序

1. 扩展权威 ACL 表以支持 `role` 主体，并将旧 ACL 记录转换为相同资源的权威 ACL 记录；转换仅在目标资源和主体仍有效时写入。
2. 将用户角色关系写入 `sys_role_assignment`，把用户管理和登录权限读取改为该表。
3. 将 Wiki、共享文件的读写、ACL 管理和前端编辑器固定到 `AuthorizationService` / `ResourceAccessService`。
4. 删除旧 ACL 表、`sys_user_role`、迁移/影子/cutover 表、迁移控制器和所有兼容调用。

每一步都在同一递增 Flyway migration 中使用精确目标表及条件。目标系统尚未上线，旧授权数据可删除；迁移仍不得触碰任务外的非授权表或数据。

## 3. 删除对象

```text
sys_user_role
wiki_space_acl
wiki_page_acl
shared_folder_acl
authorization_migration_run
authorization_migration_exception
authorization_migration_lineage
authorization_account_rollout
authorization_decision_diff
authorization_tenant_cutover
```

对应 Java 实体、Mapper、迁移/影子/cutover 服务、兼容判断 API、迁移异常页面和旧 ACL 对话框必须在消费者切换后物理删除。

## 4. 验证

- V79 -> latest 与 V1 -> latest 均无上述对象，且非授权哨兵数据保留。
- 角色分配、用户/组/角色 ACL、资源继承、tenant 隔离和删除账户清理使用唯一模型。
- Wiki 与共享文件没有 `WithCompatibility`、`AuthorizationModeService` 或旧 ACL 表消费者。
- 后端定向授权/Wiki/共享文件测试、编译及前端 lint/typecheck/build 通过。
- `detect-changes --scope all` 记录本工作包影响。

## 5. 失败处理

迁移失败仅回滚当前 Flyway 事务；不提供运行时双读、双写或回退模式。测试数据库通过 Testcontainers 重建。

## 6. 实施结果（2026-07-23）

- V93 保留 V1-V79 历史并以增量方式完成终态转换：旧 `sys_user_role`、三张旧 ACL 表及全部授权迁移/影子/cutover 表均被物理删除。
- 为仍有效用户从旧 `sys_user.group_id` 补齐缺失的活动业务组成员关系后，再转换组作用域角色，确保终态 `ScopedPermissionMapper` 可继续判定该作用域；已有 primary membership 不会被覆盖。
- 旧 ACL 仅在 migration 中读取一次，转换为 `resource_acl_entry` 的 `user`、`group`、`role` 位权限记录。运行时没有旧表、兼容服务、切换模式、回退接口或旧 UI 消费者。
- `UnifiedTaskIncrementalMigrationTest` 在 V79 旧库中插入角色、角色 ACL、用户 ACL 和组 ACL 哨兵数据，实际升级至 V93 后验证成员关系、角色分配、三类 ACL 位权限及旧表删除。
- `AuthorizationServiceTerminalRoleAclTest` 验证转换后的组作用域 assignment、membership 与角色 ACL 可被终态 `AuthorizationService` 实际判定为允许访问。

验证命令：

```bash
cd backend
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -DskipTests compile
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=AuthorizationServiceTerminalRoleAclTest,UnifiedTaskIncrementalMigrationTest test
JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home \
  mvn -q -Dtest=ResourceAuthorizationInitializerTest,ResourceAccessServiceTest,GroupLifecycleMigrationIntegrationTest test
```
