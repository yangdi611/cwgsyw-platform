# REM-P0-001 第三轮返修实施记录

## 最终状态

| 属性 | 值 |
|---|---|
| 事件 | `REM-P0-001` |
| 实施状态 | `IMPLEMENTED_AND_VERIFIED` |
| 事件状态 | `CLOSED` |
| 返修轮次 | 第三轮实施 + Codex 最终收口 |
| 完成时间 | 2026-07-14 |
| 基线 | branch `lint-fix`, commit `5d3c5b6f` + 第三轮修改（未提交）|
| 编译状态 | ✅ PASS |
| L1-A 代码级门禁 | `PASS` |

## 已完成的四个代码缺口修复

### ✅ 缺口 3.1：主组 NULL 真实持久化

**修复方案**：
- 新增 `UserMapper.clearPrimaryGroup` 原子更新方法
- 使用显式 SQL UPDATE 设置 `group_id = NULL`，包含完整条件检查
- 新增 `clearPrimaryGroupIfMatches` 私有方法，检查 update count = 1
- Primary membership 删除路径和旧主组兼容路径都调用此方法

**修改文件**：
- `UserMapper.java`: 新增 `clearPrimaryGroup` 方法
- `GroupMembershipService.java`: 使用新方法替代 `setGroupId(null) + updateById`

### ✅ 缺口 3.2：所有关键更新必须检查影响行数

**修复方案**：
- 新增三个原子更新方法到 mapper：
  - `UserGroupMembershipMapper.softDeleteActive`
  - `RoleAssignmentMapper.softDeleteActiveGroupAssignment`
  - `RoleAssignmentMapper.softDeleteActiveAssignment`
- 所有方法包含完整 WHERE 条件（id + tenantId + userId + groupId + is_deleted=false）
- 所有调用检查返回值 = 1，否则抛 `IllegalStateException` 触发回滚
- `audit` 方法也检查 insert 返回值 = 1

**修改文件**：
- `UserGroupMembershipMapper.java`: 新增 `softDeleteActive`
- `RoleAssignmentMapper.java`: 新增两个 `softDelete` 方法
- `GroupMembershipService.java`: 所有更新调用检查返回值

### ✅ 缺口 3.3：实现 assignment add 与 membership remove 的并发串行化

**修复方案**：
- 新增 `AuthorizationWriteLockMapper` 调用 `pg_advisory_xact_lock`
- 新增 `AuthorizationWriteLockService.lockGroupAssignment` 计算稳定 lock key
  - 使用 SHA-256 hash `"group-assignment:" + tenantId + ":" + userId + ":" + groupId`
  - 取前 8 字节转为 signed long
- `GroupMembershipService.remove` 和 `removeByGroup` 在获取锁后重新读取 active membership
- 锁在 `@Transactional` 边界内自动持有到 commit/rollback
- 重命名 `removeMembership` → `removeMembershipLocked`
- 重命名 `revokeMatchingGroupAssignments` → `revokeMatchingGroupAssignmentsLocked`

**新增文件**：
- `AuthorizationWriteLockMapper.java`
- `AuthorizationWriteLockService.java`

**修改文件**：
- `GroupMembershipService.java`: 添加锁逻辑和重新读取

### ✅ 缺口 3.4：统一使用权威 groupType 合同

**修复方案**：
- 三条 effective-assignment 查询全部从 `g.code != 'unassigned'` 改为 `g.group_type = 'business'`
- 与平台其他模块使用相同的权威字段

**修改文件**：
- `RoleAssignmentMapper.java`: `findEffectiveRoleIds` 和 `findEffectiveScopes`
- `ScopedPermissionMapper.java`: `findAssignments`

## Git 变更统计

```
 ScopedPermissionMapper.java          |  29 +++-
 GroupMembershipService.java          | 162 +++++++++++++++---
 UserGroupMembershipMapper.java       |  21 +++
 RoleAssignmentMapper.java            | 111 ++++++++++++--
 UserMapper.java                      |  15 ++
 AuthorizationWriteLockMapper.java    |  新增
 AuthorizationWriteLockService.java   |  新增
 7 files changed, 301 insertions(+), 37 deletions(-)
```

## 最终收口追加记录

### 写路径与并发合同

- `RoleAssignmentService.add` 已按 `(tenant,user) → (tenant,role) → (tenant,user,group)` 获取锁，并在锁后重读活动 role、membership，再检查重复并写入。
- `GroupMembershipService` 的 membership 新增/删除、主组清理和匹配 assignment 撤销使用同一锁序；关键更新、审计写入均检查影响行数。
- `AuthorizationMigrationService` 覆盖 tenant/platform/group 用户锁，并在锁后重读 legacy user-role、用户、角色、membership 与组状态。
- `AuthorizationCutoverService`、`AuthorizationRelationshipCleanupService` 与 legacy compatibility assignment 写入口采用相同的 `user → role → group` 顺序，避免旁路写入重新制造 active orphan。
- `UserService.update/delete` 在任何 user 行或授权关系写入前获取 user lock 并锁后重读，消除“user row lock → advisory lock”的反向死锁窗口。
- `RoleManagementService.delete` 获取 role lock 后重新读取 role 和引用计数，并用条件软删除检查影响行数；所有 assignment writer 共享 role lock，消除“引用计数后新增 assignment”的 active orphan 窗口。
- 三条 effective-assignment 查询统一校验 assignment、role、tenant、business group、membership、scope 与有效期。

### 最终验证

| 门禁 | 结果 |
|---|---:|
| PostgreSQL/Testcontainers | `18/18 PASS` |
| `AuthorizationServiceTest` 拒绝层级 | `13/13 PASS` |
| 授权相关测试集群 | `117/117 PASS` |
| 完整后端测试 | `315/315 PASS` |
| 最新 backend L1-B | `54 PASS / 1 FAIL` |
| 未解释 failed request / HTTP 5xx / 后端异常 | `0 / 0 / 0` |

最新运行时证据位于 `test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/`。核心场景已覆盖 Wiki/共享文件、原 session、新 session、session touch、tenant assignment、expiry、多组、rejoin、审计和数据库回读；`concurrency-regression.json` 记录两种 role delete/assignment 交错和 user update 等待锁场景。

2026-07-14 03:11 最终重跑确认 PostgreSQL/Testcontainers `18/18 PASS`、授权影响集群 `117/117 PASS`、完整后端 `315/315 PASS`。`concurrency-regression.json` 已补入 user delete 等待锁场景；`final-reverification.json` 固化最终分母、运行镜像和唯一阻塞。运行证据中误存的 JWT 已替换为布尔通过标记。

### GitNexus 最终审计

最终重建索引后，`detect_changes(scope=all)` 结果为 `HIGH`：20 个已跟踪变更文件、90 个 changed symbols、9 条 affected processes。新增 `AuthorizationWriteLockService` 已纳入索引，影响为 `MEDIUM`（13 个上游、8 个直接消费者）。范围与 SPEC 中 Wiki、共享文件、Org、RBAC、User、Authorization 预期一致；`git diff --check` 通过。旧索引的 `CRITICAL / 92 / 23` 仅保留为历史检查点。

### 唯一剩余阻塞

L1-B 唯一失败是历史 runId groups `11..15` 仍活动。产品没有 group delete/archive/purge，未经明确授权不得直接 SQL 清理。解除方式只有：

1. 产品提供可审计的 group archive/delete/purge；或
2. 用户明确批准仅对已核验 groups `11..15` 做受控精确清理，并保留前后快照。

因此核心缺陷结论为 `PASS`，事件状态为 `BLOCKED`；发布候选版 L4 `275+78` 仍是版本级关闭门禁，未在本轮伪报执行。

## 事件关闭追加记录（2026-07-14）

- 用户已明确批准在 `REM-P1-001` L1-L3 通过后，通过产品 API archive groups `11..15`。
- 五组 preflight 均为 eligible；archive 审计 ID 为 `7422..7426`，历史 membership/assignment 数量和 ID 边界未变化。
- 只复跑本事件 `AC-012`，结果 `10/10 PASS`；其余 13 个 AC 复核既有 PASS 证据，未重跑。
- authorization 保持 `enforced / epoch=1`；superadmin 指纹、非测试授权和资源状态未变化；active orphan assignment、P0 session、P0 活动对象均为 0。
- 无法证明属于本事件的旧 `FQA_mrirwe7s.md` MinIO 元数据未删除，也不计为本事件 manifest 泄漏。
- 事件状态由 `BLOCKED` 更新为 `CLOSED`；发布候选版 L4 `275+78` 仍是独立版本门禁。
