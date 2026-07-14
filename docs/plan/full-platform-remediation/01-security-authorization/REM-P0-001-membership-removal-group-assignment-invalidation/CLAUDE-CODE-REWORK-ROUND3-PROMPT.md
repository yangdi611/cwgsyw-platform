# Claude Code Prompt：REM-P0-001 第三轮返修与闭环复验

> 使用方式：将本文件全文交给 Claude Code，并让它在项目根目录 `/Users/byron/AI/cwgsyw-platform` 执行。必须从现有检查点继续完成实际代码返修、测试、证据和事件文档回写；不要只输出方案或总结。

你现在位于：

`/Users/byron/AI/cwgsyw-platform`

继续处理唯一事件：

`REM-P0-001：membership 移除后 group assignment 立即失效`

这是第三轮返修，不是重新开始。前两轮已经修复并验证了大量串行主流程。你必须读取现有证据，只处理尚未关闭的根因和验证门禁；不得新建另一套 SPEC，不得覆盖历史失败证据，不得把已确认通过的行为重新写成“未验证”，也不得因旧脚本错误再次声称测试环境无法创建 membership 或 assignment。

## 1. 当前权威状态

- 事件状态：`IN_PROGRESS`
- 实施状态：`REWORK_PARTIAL_COMPLETE`
- 当前结论：`FAIL / INCOMPLETE`
- branch：`lint-fix`
- 基线 commit：`5d3c5b6ff1995247c47c4cf8a9609802f42636b5` + 本事件未提交修改
- authorization：`ENFORCED`，epoch `1`
- 第二轮主 L1：`53 PASS / 1 FAIL`
- 补充组管理入口：`14/14 PASS`
- 补充六 assignment 有界审计：`21/21 PASS`
- 定向单测：`24/24 PASS`
- L2/L3/L4：未执行；扩展 L1 全 PASS 前禁止执行

第二轮已经取得真实证据的行为：

1. 活动 group membership + group assignment 时，Wiki 和共享文件均允许访问。
2. membership 删除后，原 session、session touch 后会话和新登录 session 的 Wiki/共享文件访问均为真实 403。
3. assignment 和 membership 的 `isDeleted/deletedAt/deletedBy` 已在当前串行路径真实落库。
4. 用户授权删除入口和组管理删除入口均已覆盖。
5. tenant assignment、expired assignment、多角色并集、多组独立性、串行 rejoin 不恢复均已通过。
6. 六条 matching assignments 的逐条审计完整，membership 审计已使用 `revoked_count + first_5 + ...` 有界摘要。
7. 第二轮创建的 user、role、membership、assignment 已全部清零。
8. superadmin 与 authorization mode/epoch 前后未变化。

以上 PASS 证据必须保留。返修代码影响到对应路径时才进行定向重跑，不得删除或覆盖旧 evidence。

## 2. 必读顺序

开始任何编辑前，按顺序完整读取：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `backend/AGENTS.md`、`backend/CLAUDE.md`（若存在）
4. 所有拟修改文件作用域内更深层的 `AGENTS.md` / `CLAUDE.md`
5. `docs/standards/code-quality-baseline-rules.md`
6. `docs/standards/code-review-checklist.md`
7. `docs/plan/full-platform-remediation/INDEX.md`
8. 本事件目录 `README.md`
9. 本事件目录 `SPEC.md`
10. 本事件目录 `VERIFICATION.md`
11. 本事件目录 `IMPLEMENTATION-RECORD.md`
12. 本事件目录 `REVERIFICATION-REPORT.md`，重点读取第 9 节
13. 本事件目录 `CLAUDE-CODE-REWORK-PROMPT.md`
14. `test-results/REM_P0_001_20260714_0013_lint_fix/REM-P0-001/round2-reverification-summary.json`
15. 同目录 `result.json`
16. 同目录 `group-remove-entry.json`
17. 同目录 `bounded-audit.json`
18. 同目录 `primary-group-readback.json`
19. 同目录 `gitnexus-round2-audit.md`
20. 同目录 `session-matrix.json`、`db-after-membership-removal.json`、`cleanup.json`、`ui-result.json`
21. 同目录 `maven-targeted-tests.log`
22. 原始失败证据 `test-results/FQA_20260712_0329_lintfix/RBAC-026-membership-removal/result.json`

若旧实施总结与第二轮独立复验冲突，以当前 `AGENTS.md`、当前源码/运行数据库、`REVERIFICATION-REPORT.md` 第 9 节和 `round2-reverification-summary.json` 为权威。

## 3. 第三轮必须修复的四个代码缺口

## 3.0 已确定的实现方案：必须按此施工

本轮不再讨论 A/B 方案，也不允许只给建议。直接采用以下实现：

1. 必须新增 `com.cwgsyw.platform.module.authorization.AuthorizationWriteLockMapper`，提供：

   ```java
   @Mapper
   public interface AuthorizationWriteLockMapper {
   @Select("SELECT pg_advisory_xact_lock(#{lockKey})")
       Object lock(@Param("lockKey") long lockKey);
   }
   ```

2. 必须新增 `com.cwgsyw.platform.module.authorization.AuthorizationWriteLockService`，负责把 `tenantId + userId + groupId` 稳定计算为 64 位 lock key。必须使用：

   ```text
   lockKey = first 8 bytes of SHA-256("group-assignment:" + tenantId + ":" + userId + ":" + groupId)
   ```

   将 8 字节按 big-endian 转为 signed long。相同三元组必须跨 JVM/进程得到相同 key。

3. `RoleAssignmentService.add` 对 `scopeType=group`：完成 user/role/scope 基础校验后、读取 membership 前调用 transaction advisory lock；获得锁后重新查询活动 membership，再检查 duplicate，再 insert。
4. `GroupMembershipService.remove` 和 `removeByGroup`：拿到目标 tenant/user/group 后，在读取/撤销 assignments 和删除 membership 前调用同一 advisory lock。正常入口与旧主组入口必须使用同一 key 和同一顺序。
5. 锁必须使用 `pg_advisory_xact_lock`，由现有 `@Transactional` 自动持有到 commit/rollback。禁止 `pg_advisory_lock`、Java `synchronized`、Redis lock 或全租户锁。
6. `RoleAssignmentService.add`、`GroupMembershipService.remove` 和 `GroupMembershipService.removeByGroup` 必须保留为经过 Spring proxy 调用的 public `@Transactional` 边界；锁方法只能在这三个活动事务中调用，不得把 `@Transactional` 移到 private 方法。
7. 在现有 mapper 中新增下面 3 个原子 `@Update` 方法，生产 service 必须调用这些方法，不再用实体 `updateById/deleteById` 或临时 Lambda wrapper 完成这三类写入。
8. membership 和 assignment 每次更新都检查 update count 恰好为 1，失败即抛 `IllegalStateException` 触发回滚。
9. 三条 effective-assignment SQL 把 `g.code != 'unassigned'` 统一替换为 `g.group_type = 'business'`。
10. 不新增 Flyway migration；现有 PostgreSQL advisory lock 不需要 schema 变更。

三个入口必须按以下伪代码实现，禁止在 lock 前完成最终有效性判断：

```text
RoleAssignmentService.add(group scope):
  requireUser / requireRole / validateScope / validateOperatorScope
  authorizationWriteLockService.lock(tenantId, userId, scopeId)
  re-read active membership from DB
  if absent -> 4xx
  validate builtin/delegation
  re-read duplicate active assignment
  insert assignment
  audit

GroupMembershipService.remove(membershipId):
  preliminary read membership only to obtain tenant/user/group and validate path ownership
  authorizationWriteLockService.lock(tenantId, userId, groupId)
  re-read the same active membership by id + tenant + user + group
  if absent -> 4xx/conflict
  removeMembershipLocked(...)

GroupMembershipService.removeByGroup(groupId):
  requireUser only to validate tenant/user
  authorizationWriteLockService.lock(tenantId, userId, groupId)
  re-read active membership by tenant + user + group
  if present -> removeMembershipLocked(...)
  else -> re-read user and validate legacy user.groupId == groupId
          revoke matching assignments
          clearPrimaryGroupIfMatches(...)
          audit legacy removal
```

`removeMembershipLocked` 和 `revokeMatchingGroupAssignmentsLocked` 必须是 `GroupMembershipService` 的 private 方法，只能由完成 `lockGroupAssignment(...)` 的 `remove/removeByGroup` 调用。必须把现有 `removeMembership` 和 `revokeMatchingGroupAssignments` 重命名为上述 `Locked` 名称，并确认没有其他调用入口。

必须新增的生产文件：

- `backend/src/main/java/com/cwgsyw/platform/module/authorization/AuthorizationWriteLockMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/authorization/AuthorizationWriteLockService.java`

锁服务直接按以下骨架实现：

```java
@Service
@RequiredArgsConstructor
public class AuthorizationWriteLockService {
    private final AuthorizationWriteLockMapper lockMapper;

    public void lockGroupAssignment(String tenantId, Long userId, Long groupId) {
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("group assignment lock requires an active transaction");
        }
        String source = "group-assignment:" + tenantId + ":" + userId + ":" + groupId;
        byte[] digest;
        try {
            digest = MessageDigest.getInstance("SHA-256")
                .digest(source.getBytes(StandardCharsets.UTF_8));
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 unavailable", exception);
        }
        long lockKey = ByteBuffer.wrap(digest).getLong();
        lockMapper.lock(lockKey);
    }
}
```

锁 mapper：

```java
@Mapper
public interface AuthorizationWriteLockMapper {
    @Select("SELECT pg_advisory_xact_lock(#{lockKey})")
    Object lock(@Param("lockKey") long lockKey);
}
```

三个原子写 mapper 必须按以下合同实现：

```java
// UserMapper
@Update("""
    UPDATE sys_user
       SET group_id = NULL,
           updated_by = #{operatorId},
           updated_at = NOW()
     WHERE id = #{userId}
       AND tenant_id = #{tenantId}
       AND group_id = #{groupId}
       AND is_deleted = false
    """)
int clearPrimaryGroup(@Param("tenantId") String tenantId,
                      @Param("userId") Long userId,
                      @Param("groupId") Long groupId,
                      @Param("operatorId") Long operatorId);

// UserGroupMembershipMapper
@Update("""
    UPDATE sys_user_group_membership
       SET is_deleted = true,
           deleted_at = NOW(),
           deleted_by = #{operatorId},
           updated_at = NOW(),
           updated_by = #{operatorId}
     WHERE id = #{membershipId}
       AND tenant_id = #{tenantId}
       AND user_id = #{userId}
       AND group_id = #{groupId}
       AND is_deleted = false
    """)
int softDeleteActive(@Param("membershipId") Long membershipId,
                     @Param("tenantId") String tenantId,
                     @Param("userId") Long userId,
                     @Param("groupId") Long groupId,
                     @Param("operatorId") Long operatorId);

// RoleAssignmentMapper
@Update("""
    UPDATE sys_role_assignment
       SET is_deleted = true,
           deleted_at = NOW(),
           deleted_by = #{operatorId},
           updated_at = NOW(),
           updated_by = #{operatorId}
     WHERE id = #{assignmentId}
       AND tenant_id = #{tenantId}
       AND user_id = #{userId}
       AND scope_type = 'group'
       AND scope_id = #{groupId}
       AND is_deleted = false
    """)
int softDeleteActiveGroupAssignment(@Param("assignmentId") Long assignmentId,
                                    @Param("tenantId") String tenantId,
                                    @Param("userId") Long userId,
                                    @Param("groupId") Long groupId,
                                    @Param("operatorId") Long operatorId);
```

为普通 assignment remove 再提供同语义的 `softDeleteActiveAssignment(id, tenantId, userId, operatorId)`，包含 `is_deleted=false` 条件并更新全部删除元数据。`RoleAssignmentService.remove` 也改用它，避免同一事件内保留另一条错误的 `setDeletedAt + deleteById` 路径。

所有 mapper 多参数都显式加 `@Param`，不要依赖编译器参数名。

### 3.1 主组 NULL 必须真实持久化

当前实现存在确定性运行缺陷：

```java
user.setGroupId(null);
userMapper.updateById(user);
```

MyBatis-Plus 默认 `NOT_NULL` update strategy 不会把 null 写入 `sys_user.group_id`。

第二轮数据库反证：

- user `184`：membership `210`、assignment `217` 已软删除，但 `sys_user.group_id` 仍为 `13`；
- user `185`：membership `211`、assignments `218..223` 已软删除，但 `sys_user.group_id` 仍为 `13`。

具体修改方法：

1. 新增私有方法 `clearPrimaryGroupIfMatches(tenantId, userId, groupId, operatorId)`。
2. 方法内部只调用上述 `userMapper.clearPrimaryGroup(...)`：

   ```java
   int updated = userMapper.clearPrimaryGroup(tenantId, userId, groupId, operatorId);
   if (updated != 1) {
       throw new IllegalStateException("主组清理失败或状态已变化");
   }
   ```

3. 正常 primary membership 删除路径和旧主组兼容路径都调用这个方法。
4. 正常 non-primary membership 删除路径不调用它。
5. 不得通过改变全局 MyBatis-Plus field strategy 修复。
6. update 必须处于原 membership 删除事务中。
7. 只有目标用户、目标 tenant、目标 group 匹配时才能清空。
8. 数据库集成测试必须断言删除事务提交后 `group_id IS NULL`。
9. 删除非主 membership 时不得清空其他主组。

### 3.2 所有关键更新必须检查影响行数

当前以下写入忽略返回值：

- membership 显式软删除 update；
- matching assignment 显式软删除 update；
- 主组清空 user update；
- 旧主组兼容分支 user update。

当前代码可能在 update 返回 0 时仍：

- 把 assignment ID 加入 `revokedIds`；
- 写“撤销成功”审计；
- 返回 membership 删除成功。

具体修改方法：

1. 把 assignment 撤销封装为 `softDeleteAssignment(...)`，内部调用上述 mapper 原子 update；update count 必须为 1，否则抛 `IllegalStateException`。
2. `softDeleteAssignment` 成功返回后，才能 `revokedIds.add(id)` 和写逐条审计。
3. 把 membership 软删除封装为 `softDeleteMembership(...)`，调用上述 mapper 原子 update；update count 必须为 1，否则抛异常。
3. assignment 更新条件必须包含 id、tenantId、userId、scopeType、scopeId、`isDeleted=false`。
4. membership 更新条件必须包含 id、tenantId、userId、groupId、`isDeleted=false`。
5. user 主组清空条件必须包含 id、tenantId、当前 `groupId=removedGroupId`、`isDeleted=false`。
6. update 成功后才能加入 `revokedIds` 和写成功审计。
7. 删除路径不得再使用 `LambdaUpdateWrapper`、`updateById` 或 `deleteById`；重复删除第二次必须更新 0 行并触发回滚/冲突，不得虚假成功。
8. 单元测试用 mapper mock 返回 0 验证抛异常且不写成功审计；PostgreSQL 集成测试验证真实事务回滚。
9. `audit(...)` 内部也检查 `auditLogMapper.insert(...) == 1`；返回 0 时抛异常，使审计失败与业务写入一起回滚。

### 3.3 实现 assignment add 与 membership remove 的并发串行化

当前确定性竞态：

- `RoleAssignmentService.add` 先查询 active membership，再插入 assignment；
- `GroupMembershipService.remove/removeByGroup` 先查询 assignments，再删除 membership；
- 两条写路径没有共同锁或数据库约束。

可能交错：删除事务完成 assignment 查询后，并发新增 assignment 成功；最终留下 active orphan，重新入组后旧授权可能恢复。

固定实现：

1. 按 3.0 节实现 transaction advisory lock，不再选择行锁方案。
2. assignment add 和两个 membership remove 入口必须先计算相同 key，再调用 `pg_advisory_xact_lock`。
3. 本事件每个事务只获取一个 group-assignment key，不得引入多 key 循环。
4. 不允许全租户锁或 JVM 本地锁；部署可能多实例。
5. 加锁后重新读取 active membership，不依赖锁前快照。
7. membership 已删除时 assignment add 必须返回可理解的 4xx，不得插入 orphan。
8. 删除先完成时 add 被拒绝；add 先完成时删除必须撤销新 assignment。
9. 不改变 tenant/platform assignment 的行为；锁只约束 group assignment。
10. 真实 PostgreSQL 集成测试必须覆盖两种并发顺序、超时上限、最终 membership/assignment/审计状态和 rejoin 不恢复。

### 3.4 统一使用权威 `groupType` 合同

当前三条有效 assignment SQL 使用：

```sql
g.code != 'unassigned'
```

这是合同漂移。平台权威分类字段是 `sys_group.group_type`：

- V71 数据库约束与唯一索引使用 `group_type`；
- `RoleAssignmentService` 使用 `group.getGroupType()`；
- Authorization、资源迁移和 Wiki 等现有 SQL 使用 `group_type <> 'unassigned'`。

固定修改：

1. `findEffectiveRoleIds`、`findEffectiveScopes`、`findAssignments` 全部使用 `g.group_type = 'business'`。
2. 不使用 `code`、name 或 `<> 'unassigned'` 的松散判断。
3. 不依赖当前种子恰好让 `code=groupType=unassigned`。
4. 三条查询对同一夹具必须给出等价结果。

## 4. 必须新增的 PostgreSQL 集成测试

当前仓库没有覆盖本事件 SQL/事务合同的真实 PostgreSQL 集成测试。第三轮必须增加，不接受仅 Mockito 或手工 psql 摘要替代。

固定测试基础设施：

1. 在 `backend/pom.xml` 增加 test-scope 依赖：

   ```xml
   <dependency>
     <groupId>org.testcontainers</groupId>
     <artifactId>postgresql</artifactId>
     <scope>test</scope>
   </dependency>
   <dependency>
     <groupId>org.testcontainers</groupId>
     <artifactId>junit-jupiter</artifactId>
     <scope>test</scope>
   </dependency>
   ```

   依赖版本必须使用当前 Spring Boot dependency management；如果当前 BOM 不管理 Testcontainers，则在 `dependencyManagement` 中只引入一个 Testcontainers BOM，禁止分别声明两个不同版本。

2. 新增 `@SpringBootTest` + `@Testcontainers` 的 PostgreSQL 集成测试类，使用 `PostgreSQLContainer<?>` 和 `@DynamicPropertySource` 注入 datasource。
3. Redis/MinIO/邮件等无关依赖必须 mock、禁用或用 test profile 隔离；测试不得依赖当前共享 dev PostgreSQL。
4. Flyway 在容器内执行当前 migrations，确保测试 schema 与产品一致。
5. 并发测试使用两个 Spring `TransactionTemplate` 或两个独立 JDBC connections。用 `CountDownLatch/CyclicBarrier` 控制交错，future 必须设置 10 秒以内 timeout。
6. 每个测试使用唯一 tenant/runId 数据，并在测试结束时由容器销毁；不得读取固定用户、角色、group ID。

至少覆盖：

### 4.1 effective-assignment 等价矩阵

对以下每一行，同时断言：

- `findEffectiveRoleIds`
- `findEffectiveScopes`
- `ScopedPermissionMapper.findAssignments`
- `RbacService.getUserPermissions/getHighestScope`

场景：

1. active group + active membership + active role + active assignment；
2. missing membership；
3. deleted membership；
4. membership tenant/user/group 任一不匹配；
5. deleted group；
6. unassigned group；
7. cross-tenant group；
8. deleted role；
9. cross-tenant role；
10. future `validFrom`；
11. expired `validUntil`；
12. active tenant assignment，无 membership；
13. active platform compatibility assignment，无 membership；
14. 多角色并集与多组独立性。

### 4.2 membership 删除事务

覆盖：

1. primary membership：user.groupId 真实变为 NULL；
2. non-primary membership：其他主组不变；
3. 正常 membership 删除：membership/assignment 三个软删除字段完整；
4. 旧主组无 membership 行：groupId 清空、assignments 撤销、审计完整；
5. update 0 行：整个事务回滚且无成功审计；
6. >5 assignments：有界 membership 审计 + 全量逐 assignment 审计；
7. rejoin：旧 assignment 不恢复。

### 4.3 并发交错

使用真实 PostgreSQL、两个独立事务/连接、可控 barrier/latch：

1. add 先持锁并提交，然后 remove：最终 membership 删除、assignment 撤销；
2. remove 先持锁并提交，然后 add：add 返回拒绝，最终无 active assignment；
3. 任一路径回滚后另一事务按最终活动 membership 状态处理；
4. 测试有明确超时，失败时不无限等待；
5. 最终 active orphan group assignments=0。

测试数据必须隔离并自动回收。不得依赖共享开发数据库中的固定 ID。

## 5. 强制 GitNexus 门禁

全局 registry 可能存在两个同名 checkout。所有 GitNexus 调用必须显式指定：

`repo=/Users/byron/AI/cwgsyw-platform`

并且每次都传：

`worktree=/Users/byron/AI/cwgsyw-platform`

执行顺序：

1. `query`：查 assignment add、membership remove、权限加载和资源裁决流程。
2. `context`：检查每个拟修改符号的 callers/callees。
3. 编辑任何函数、类或方法前运行 upstream `impact`。
4. 已知 `findEffectiveRoleIds=CRITICAL`、`findAssignments=HIGH`；先向用户明确告警，再在本 SPEC 范围内继续。
5. 分别对 `RoleAssignmentService.add`、`GroupMembershipService.remove`、`GroupMembershipService.removeByGroup`、`findEffectiveRoleIds`、`findEffectiveScopes`、`findAssignments` 和两个新增 lock 符号运行 impact，并把结果写入实施记录。
6. 修改完成后运行 `detect_changes(scope=all)`。
7. 另运行 `detect_changes(scope=compare, base_ref=master)`，只把它作为分支累计风险背景，不把全分支差异归因到本事件。
8. 把当前绝对 checkout、changed symbols、flows、modules 和风险写入 `IMPLEMENTATION-RECORD.md`。

禁止用 grep 代替 GitNexus；`rg` 只用于补充文本定位。

## 6. 修改范围

允许修改：

- `backend/src/main/java/com/cwgsyw/platform/module/org/GroupMembershipService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/org/UserGroupMembershipMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/user/UserMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleAssignmentService.java`
- `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleAssignmentMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/authorization/ScopedPermissionMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/authorization/AuthorizationWriteLockMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/authorization/AuthorizationWriteLockService.java`
- `backend/pom.xml`，仅增加 Testcontainers test-scope 依赖/BOM
- 本事件相关单元测试和 PostgreSQL 集成测试
- 本事件专用复验脚本和 evidence
- 本事件目录文档与总 `INDEX.md`

如需触碰其他生产文件，必须先证明必要性、运行 impact 并记录原因。

禁止：

- 修改无关业务缺陷；
- 修改 superadmin；
- 修改 legacy role、cutover、break-glass 或 authorization mode 合同；
- 全局 session 清空；
- 直接修改 password hash；
- 批量迁移历史 assignment；
- 执行 Enforce/Rollback 或 restore；
- 修改非测试 ACL/assignment/membership；
- 提交 Git、push 或创建 PR；
- 为了清理遗留 group 直接执行 SQL，除非用户另行明确批准。

## 7. 测试环境与遗留组边界

不要再次报告“membership/assignment API 环境不可用”。第二轮独立复验已经通过产品 API 完成：

- 主 L1 角色/用户/membership/assignment 生命周期；
- 组管理删除入口；
- 六 assignment 有界审计。

旧失败原因是复用了已经软删除的 role `160`，不是产品环境问题。第三轮所有夹具必须新建、带新 runId、即时登记并可逆清理。

当前活动遗留组：`11、12、13、14、15`。它们均为 REM-P0-001 测试对象，但产品没有 group delete/archive/purge 入口。

处理规则：

1. 不再创建新的测试 group；复用确认属于本事件且无非测试资源/成员的一个遗留业务组作为运行夹具。
2. 不得直接 SQL 清理 `11..15`，除非用户另行明确批准。
3. 新增 user、role、membership、assignment 必须全部通过产品 API 清理。
4. 清理报告分别列出“本轮新增对象=0”和“历史遗留 groups `11..15` BLOCKED”。
5. 不能把历史遗留组算成本轮新污染，但关闭门禁仍要求最终解除。

## 8. 第三轮验证顺序

### L1-A：代码级门禁

1. 新增/修改的 PostgreSQL 集成测试；
2. `GroupMembershipServiceTest`；
3. `RoleAssignmentServiceTest`；
4. `RbacServiceAuthorizationModeTest`；
5. `AuthorizationServiceTest`；
6. 编译、相关测试、格式和后端检查；
7. GitNexus `detect_changes(scope=all)`。

任一 FAIL：保存首次失败证据并停止，不进入 L1-B。

### L1-B：真实运行时矩阵

使用新 runId：

`REM_P0_001_YYYYMMDD_HHMM_<branchShort>`

重跑并扩展第二轮矩阵：

1. Wiki/SharedFile × 原 session/new session/touch session；
2. 用户授权删除入口；
3. 组管理删除入口；
4. primary group 数据库回读必须为 NULL；
5. assignment/membership 三个软删除字段；
6. tenant、future、expired、多角色、多组、rejoin；
7. update 行数失败的事务测试证据；
8. 两种并发交错的集成测试证据；
9. 有界审计；
10. Console/Network/backend logs/HTTP 5xx；
11. 本轮夹具清零；
12. superadmin、authorization mode/epoch 前后一致。

L1-A 或 L1-B 任一 FAIL，事件保持 `IN_PROGRESS / FAIL`，停止 L2/L3。

### L2：仅在扩展 L1 全 PASS 后

- `XL-RBAC-002`
- `XL-RBAC-006`
- `XL-RBAC-009`
- permission/scope/expiry/ACL/ancestor 五类独立拒绝与 reasonCode
- `ENFORCED/SHADOW/LEGACY`
- multi-role、multi-group、rejoin 完整矩阵

### L3：仅在 L2 全 PASS 后

- Org：membership 增删与 primary group
- RBAC：assignment CRUD、validFrom/validUntil、角色状态
- Auth/session：permissions、role IDs、highest scope、旧会话
- Wiki：list/read/create/comment/ACL
- SharedFile：list/upload/download/ACL
- 运维日历组长查找间接消费者

### L4：发布候选版本

完整 `275+78` 只在发布候选版本执行。L1-L3 全 PASS、仅等待 L4 时，事件可更新为 `VERIFYING`；L4 未完成不得标 `CLOSED`。

## 9. 新 evidence 要求

保存到：

`test-results/<newRunId>/REM-P0-001/`

至少包含：

- `environment.json`
- `fixture-manifest.json`
- `targeted-tests.log`
- `postgres-equivalence-matrix.json`
- `membership-delete-transaction.json`
- `concurrency-result.json`
- `session-matrix.json`
- `primary-group-readback.json`
- `audit-result.json`
- `reason-code-matrix.json`
- `ui-result.json`
- `console-errors.json`
- `backend-errors.log`
- `cleanup.json`
- `gitnexus-audit.md`
- `result.json`
- 必要 screenshots、trace 和 network 摘要

证据不得包含密码、token、Authorization header 或敏感资料。

## 10. 文档实时回写

不要等全部结束后一次性补写。每完成一个关键修改或验证批次，立即更新：

1. `IMPLEMENTATION-RECORD.md`：追加第三轮实际修改、影响分析、命令、结果和证据；
2. `VERIFICATION.md`：逐项更新 `AC-001..014`，不得批量猜测 PASS；
3. `REVERIFICATION-REPORT.md`：保留前两轮事实，追加第三轮章节；
4. 事件 `README.md`：当前状态和下一门禁；
5. 总 `INDEX.md`：状态、风险和 Claude Prompt 入口。

状态规则：

- 任一代码/功能门禁失败：`IN_PROGRESS / REWORK_REQUIRED`；
- L1-L3 全 PASS，仅 L4 未执行：`VERIFYING`；
- L4 与全部关闭门禁通过，历史 groups `11..15` 清理问题也解除：才允许 `CLOSED`。

## 11. 停止条件

出现以下任一情况，停止危险操作并报告：

- 需要改变 tenant/platform、legacy、cutover、break-glass 合同；
- 需要新 Flyway migration 且无法用现有表/索引安全完成；
- 最新 GitNexus impact 超出授权、组织、认证、Wiki、SharedFile、运维日历范围；
- tenant assignment 或同组合法访问回归；
- membership 删除出现部分成功、虚假审计或不可回滚；
- 并发测试出现死锁、无限等待或 active orphan；
- HTTP 5xx、后端异常或本轮数据无法产品清理；
- authorization mode/epoch、superadmin、非测试授权或资源 ACL 变化；
- 清理历史 groups `11..15` 需要直接 SQL 或新增产品删除能力。

这些停止条件不等于任务完成；必须记录为 `FAIL` 或 `BLOCKED` 和明确解除条件。

## 12. 最终回复格式

最终只报告：

1. 事件状态和结论；
2. 四个代码缺口各自的实际修复文件和方法；
3. PostgreSQL 等价矩阵、事务和并发测试结果；
4. L1/L2/L3/L4 的 PASS/FAIL/BLOCKED 数量；
5. evidence 和事件报告路径；
6. 本轮清理结果与历史 groups `11..15` 状态；
7. superadmin、authorization mode/epoch、非测试授权核验；
8. 尚需用户授权的事项。

现在开始执行：先完整读取规则、第二轮复验结论和证据，运行 GitNexus query/context/impact，然后从“主组 NULL 真实持久化”开始返修。不要停在计划阶段，不要重做前两轮，不要在扩展 L1 失败时进入 L2/L3。
