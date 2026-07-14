# Claude Code Prompt：REM-P0-001 第二轮返修与复验

> 使用方式：将本文件全文交给 Claude Code，并让它在项目根目录 `/Users/byron/AI/cwgsyw-platform` 执行。不要只让 Claude 阅读或给计划；要求它从现有检查点继续完成代码返修、验证、证据和文档回写。

你现在位于 `/Users/byron/AI/cwgsyw-platform`。

继续处理唯一事件：

`REM-P0-001：membership 移除后 group assignment 立即失效`

这是第二轮返修，不是重新开始。第一轮实现和独立复验已经完成了一部分工作。你必须读取现有检查点，从第一个未关闭缺口继续，不得重建另一套 SPEC，不得覆盖历史证据，不得重复执行已经有充分证据且代码未受本次返修影响的工作。

## 1. 当前权威结论

- 事件状态：`IN_PROGRESS`
- 实施状态：`REWORK_REQUIRED`
- 当前复验结论：`FAIL`
- 当前 branch：`lint-fix`
- 基线 commit：`5d3c5b6ff1995247c47c4cf8a9609802f42636b5`，另有本事件未提交修改
- authorization：`ENFORCED`，epoch `1`
- 定向单测：24/24 PASS
- L1 运行时检查：51 PASS / 3 FAIL
- L2/L3/L4：尚未执行；L1 未全 PASS 前禁止扩大回归

已经取得真实运行证据的行为：

1. 活动 group membership + group assignment 时，Wiki 和共享文件均允许访问。
2. membership 删除后，原 session、session touch 后会话和新登录 session 的 Wiki/共享文件访问均为真实 403。
3. UI 新 session 隐藏 Wiki 入口，共享文件直接路由被重定向。
4. rejoin 不恢复已撤销的旧 assignment。
5. tenant assignment 不依赖 membership。
6. expired assignment、多角色 permission union、多组独立失效的定向场景已通过。
7. 本轮创建的 user、role、membership、assignment 已清零。
8. superadmin 关键字段、authorization mode/epoch 前后未变化。

不得把以上通过结果重新描述为未验证，也不得用它们掩盖下面的返修缺口。

## 2. 必读文件

开始任何编辑前，按顺序完整读取：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `backend/AGENTS.md`、`backend/CLAUDE.md`（存在时）
4. `docs/standards/code-quality-baseline-rules.md`
5. `docs/standards/code-review-checklist.md`
6. `docs/plan/full-platform-remediation/INDEX.md`
7. 本事件目录的 `README.md`
8. 本事件目录的 `SPEC.md`
9. 本事件目录的 `VERIFICATION.md`
10. 本事件目录的 `IMPLEMENTATION-RECORD.md`
11. 本事件目录的 `REVERIFICATION-REPORT.md`
12. 本事件目录的 `CLAUDE-CODE-PROMPT.md`
13. `test-results/REM_P0_001_20260713_2311_lint_fix/REM-P0-001/result.json`
14. 同证据目录的 `session-matrix.json`
15. 同证据目录的 `db-after-membership-removal.json`
16. 同证据目录的 `cleanup.json`
17. 同证据目录的 `maven-targeted-tests.log`
18. 同证据目录的 `gitnexus-audit.md`
19. 原始失败证据 `test-results/FQA_20260712_0329_lintfix/RBAC-026-membership-removal/result.json`

若文档出现冲突，优先级为：当前 `AGENTS.md` → 当前源码/运行数据库 → `REVERIFICATION-REPORT.md` → `SPEC.md` → 旧实施记录。

## 3. 本轮必须修复的五项缺口

### 3.1 软删除元数据必须真实落库

第一轮运行证据已经确认：

- assignments `205/206`：`is_deleted=true`，但 `deleted_at/deleted_by` 为空；
- membership `199`：`is_deleted=true`，但 `deleted_at/deleted_by` 为空。

根因线索：当前实现先在实体上设置 `deletedAt/deletedBy`，随后调用 MyBatis-Plus `deleteById(entity)`；实际 SQL 只完成逻辑删除，没有持久化此前设置的元数据。

要求：

1. 使用项目一致的显式 update + 逻辑删除方式，或抽取最小的可审计软删除方法。
2. `isDeleted/deletedAt/deletedBy` 必须在同一事务内成功落库。
3. assignment、membership 两类记录都要覆盖。
4. 任一更新或审计失败时，membership 删除事务整体回滚。
5. 不允许物理删除。

### 3.2 修复旧主组兼容分支

当前 `GroupMembershipService.removeByGroup` 在找不到 membership 行、但 `user.groupId` 等于目标组时，只清空 `user.groupId` 并返回，没有撤销该组 assignments。

要求：

1. 旧主组兼容分支复用统一 assignment 撤销逻辑。
2. 清理 primary group、撤销 assignments 和写审计必须处于同一事务。
3. 离组后重新加入该组不得恢复旧 assignment。
4. 增加“没有 membership 行但存在 legacy primary group + group assignment”的自动化测试。

### 3.3 统一 effective-assignment 查询合同

以 `SPEC.md` 的 `effectiveAssignment` 定义为权威。以下三条查询必须语义等价：

- `RoleAssignmentMapper.findEffectiveRoleIds`
- `RoleAssignmentMapper.findEffectiveScopes`
- `ScopedPermissionMapper.findAssignments`

三条路径都必须正确处理：

1. assignment tenant/user、逻辑删除、`validFrom/validUntil`；
2. role 存在、未删除且与 assignment 同 tenant；
3. group scope 的 `scopeId` 非空；
4. group 存在、未删除、同 tenant，且不是不能作为授权作用域的 `unassigned` group；
5. membership 存在、未删除，并且 tenant/user/group 全匹配；
6. tenant/platform assignment 不依赖 group membership；
7. permission、role IDs、highest scope 和 scoped assignment 对同一夹具给出一致结果。

优先复用一个权威 SQL 片段、公共 mapper 方法或其他不会继续漂移的最小实现。不要为去重而进行大范围授权重构。

### 3.4 明确并发串行化合同

membership 删除与 assignment 新增目前没有共同锁。可能出现：删除事务完成撤销查询后，并发新增一条同组 assignment，导致离组后仍残留可恢复授权。

要求：

1. 先通过 GitNexus 和数据库事务语义确定最小锁定点。
2. 使同一 `tenantId + userId + groupId` 的 membership 删除与 group assignment 新增不能产生竞态残留。
3. 不扩大为全租户锁，不改变 tenant/platform assignment 合同。
4. 用真实 PostgreSQL 集成测试覆盖两个并发顺序和最终数据库状态。
5. 禁止在共享运行环境进行故障注入；并发测试只放在隔离测试事务/容器中。

### 3.5 审计 remark 必须有界

`audit_log.remark` 为 `VARCHAR(512)`。当前 membership 审计拼接全部 `revoked_assignment_ids`，assignment 较多时可能使整个事务回滚。

要求：

1. 保留逐 assignment 审计，作为完整 ID 追溯来源。
2. membership 审计只写有界摘要，例如撤销数量、前若干 ID 和明确截断标识。
3. remark 长度不得超过数据库合同。
4. 添加大量 matching assignments 的测试，证明不会因 remark 超长失败。

## 4. 强制 GitNexus 流程

当前全局 registry 有两个同名 checkout。所有 GitNexus 调用必须显式指定当前绝对路径：

`/Users/byron/AI/cwgsyw-platform`

执行顺序：

1. 确认索引路径和当前 commit；如果不一致，从当前项目根重新 analyze。
2. 用 `query` 查找 membership 删除、assignment 新增、有效权限和资源裁决流程。
3. 对每个拟修改符号运行 `context`。
4. 编辑任何函数、类或方法前，运行 upstream `impact`。
5. `HIGH/CRITICAL` 风险先向用户输出明确告警，再继续本 SPEC 已授权范围内的最小修改。
6. 修改完成后运行：
   - `detect_changes(scope=all)`，核对本事件未提交改动；
   - `detect_changes(scope=compare, base_ref=master)`，仅作为分支累计影响背景，不把全分支差异归因于本事件。
7. 把实际影响、流程和风险追加到 `IMPLEMENTATION-RECORD.md`。

已知风险基线：

- `findEffectiveRoleIds`：`CRITICAL`；
- `findAssignments`：`HIGH`；
- `removeMembership` 和撤销写路径虽然图谱可能显示 `LOW`，仍属于 P0 授权事务关键路径。

## 5. 修改范围

优先限制在：

- `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleAssignmentMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/authorization/ScopedPermissionMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/org/GroupMembershipService.java`
- 为锁定、统一软删除或 mapper 复用确有必要的相邻 service/mapper
- 本事件相关单元测试、PostgreSQL 集成测试和复验脚本
- 本事件目录文档与总 `INDEX.md`

禁止：

- 修复无关缺陷；
- 修改授权模式、cutover epoch、legacy role、break-glass 合同；
- 批量迁移历史 assignment；
- 直接修改 password hash；
- 修改 superadmin；
- 全局 session 清空；
- 未经批准执行 Enforce/Rollback、restore 或生产数据修复；
- 提交 Git、push 或创建 PR；
- 为清理遗留 group `11/12/13` 直接执行 SQL。

## 6. 测试要求

### L1：返修后必须全 PASS

先运行最小自动化测试：

1. `GroupMembershipServiceTest`
2. `RoleAssignmentServiceTest`
3. `RbacServiceAuthorizationModeTest`
4. `AuthorizationServiceTest`
5. 新增的真实 PostgreSQL mapper/事务/并发集成测试

然后使用新的 runId 重跑运行时 L1：

`REM_P0_001_YYYYMMDD_HHMM_<branchShort>`

必须覆盖：

1. Wiki + 共享文件 × 原 session、新 session、session touch/refresh；
2. 用户授权 membership 删除入口；
3. 组管理 `removeByGroup` 入口；
4. 无 membership 行的旧主组兼容入口；
5. assignment 与 membership 的 `isDeleted/deletedAt/deletedBy`；
6. active/deleted/cross-tenant role；
7. active/deleted/unassigned/cross-tenant group；
8. missing/deleted/cross-tenant membership；
9. future/expired assignment；
10. tenant assignment unaffected；
11. 多角色、多组、rejoin；
12. 并发 add assignment vs remove membership；
13. 大量 assignments 的有界审计；
14. UI、直接路由、直接 API、数据库和审计；
15. Console、Network、后端日志和 HTTP 5xx；
16. runId 清理与非测试状态一致性。

L1 任一 FAIL：立即保存首次失败证据，停止 L2/L3，不要声称完成。

### L2：仅在 L1 全 PASS 后执行

- `XL-RBAC-002`
- `XL-RBAC-006`
- `XL-RBAC-009`
- 五类独立拒绝和 reasonCode
- `ENFORCED/SHADOW/LEGACY`
- scope、expiry、multi-role、multi-group、rejoin 完整矩阵

### L3：仅在 L2 全 PASS 后执行

- Org membership/primary group
- RBAC assignment CRUD/role reference/validUntil
- Auth 登录、权限集合、highest scope、旧会话
- Wiki list/read/create/comment/ACL
- SharedFile list/upload/download/ACL
- 运维日历组长查找间接消费者

### L4：发布候选版本门禁

完整 `275+78` 只在发布候选版本执行。L1-L3 全 PASS 后可以把事件更新为 `VERIFYING`；L4 未执行时不得标 `CLOSED`。

## 7. 测试数据与证据

1. 管理员密码只从受控环境变量读取，不写入文件、命令输出、日志或报告。
2. 所有新对象带新 runId，创建成功后立即写 manifest。
3. 只通过产品 API/UI 创建和清理授权关系；数据库只用于核验。
4. 本轮对象按依赖逆序清理。
5. 前一轮遗留 groups `11/12/13` 无产品删除入口，保持 `BLOCKED` 并记录解除条件；不要直接 SQL 清理。
6. evidence 保存到：

`test-results/<newRunId>/REM-P0-001/`

至少生成：

- `environment.json`
- `fixture-manifest.json`
- `result.json`
- `session-matrix.json`
- `effective-assignment-matrix.json`
- `reason-code-matrix.json`
- `db-after-membership-removal.json`
- `concurrency-result.json`
- `audit-result.json`
- `cleanup.json`
- `gitnexus-audit.md`
- 必要的 screenshots、trace、network、console 和 backend logs

## 8. 文档实时回写

不要在最后一次性补写。每完成一个关键修复或验证批次，立即更新：

1. `IMPLEMENTATION-RECORD.md`
2. `VERIFICATION.md` 的 `AC-001..014`
3. `REVERIFICATION-REPORT.md`，保留第一次 FAIL 事实并追加新一轮结果
4. 事件 `README.md`
5. 总 `INDEX.md`

如果 L1 仍 FAIL：状态保持 `IN_PROGRESS / REWORK_REQUIRED`。

如果 L1-L3 全 PASS、只剩 L4：状态更新为 `VERIFYING`，下一门禁写“发布候选版本执行 L4”。

只有 L4 和全部关闭门禁都满足时，才能更新为 `CLOSED`。

## 9. 最终回复格式

最终只简洁报告：

1. 当前事件状态和结论；
2. 实际修改的文件和根因修复；
3. L1/L2/L3/L4 的 PASS/FAIL/BLOCKED 数量；
4. 证据目录和报告路径；
5. 测试数据清理、superadmin、authorization mode/epoch 核验；
6. 尚未解除的风险或需要用户授权的事项。

现在开始执行。先完整读取规则、复验报告、实施记录和证据，从五项返修缺口的第一个未完成项继续。不要停在计划阶段，不要重新开始第一轮测试，不要在 L1 失败时扩大回归。
