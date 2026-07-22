# Claude Code Prompt：执行 REM-P0-001

> 使用方式：把本文件全文作为 Claude Code 的任务输入，并让它在项目根目录 `/Users/byron/AI/cwgsyw-platform` 运行。真正启动本 prompt，视为已批准本文第 4 节的事件内产品决策；不代表批准本文明确排除的高风险操作。

你现在位于 `/Users/byron/AI/cwgsyw-platform`，要持续完成唯一整改事件：

`REM-P0-001：membership 移除后 group assignment 立即失效`

这是 P0 权限越权修复，不是调研或只写计划。请从事件现有状态继续，完成根因修复、自动化测试、分层验证、证据和文档回写；不要重新创建另一套 SPEC，不要扩展到其他整改事件。未达到对应关闭条件时，不得声称完成或把事件标记为 `CLOSED`。

## 0. 当前检查点：从返修继续，不要重新开始

2026-07-13 已完成一次独立 L1 复验。开始前必须先读同目录 [REVERIFICATION-REPORT.md](./REVERIFICATION-REPORT.md)，并读取以下证据：

- `test-results/REM_P0_001_20260713_2311_lint_fix/REM-P0-001/result.json`
- 同目录 `session-matrix.json`、`db-after-membership-removal.json`、`cleanup.json`
- 同目录 `maven-targeted-tests.log`、`gitnexus-audit.md`

当前权威状态：

- 事件：`IN_PROGRESS`；实施：`REWORK_REQUIRED`；复验结论：`FAIL`；
- 定向单测 24/24 PASS；L1 运行时检查 51 PASS / 3 FAIL；
- Wiki/共享文件在 membership 删除后对原 session、touch 后 session、新 session 均已真实 403；
- tenant assignment、expired、多角色 union、多组独立性、rejoin 不恢复已取得通过证据；
- 本轮创建的 user/role/membership/assignment 已清零，authorization 保持 `ENFORCED/epoch=1`，superadmin 关键字段不变；
- L1 因实现缺陷 FAIL，尚未执行 L2/L3/L4。

本次不要重新证明或覆盖上述历史结果。先修复下面五项，再以新 runId 重跑完整 L1：

1. membership 与 matching assignments 逻辑删除后，`deletedAt/deletedBy` 必须和 `isDeleted` 同事务持久化；不能继续依赖“先 set 字段再 `deleteById(entity)`”的未成立假设。
2. `removeByGroup` 的旧主组兼容分支必须复用同一 assignment 撤销语义，防止重新入组恢复旧 assignment。
3. 解决 `SPEC.md` 的统一 effective-assignment 不变量与旧 prompt “保留各查询当前 role 过滤差异”之间的冲突：以 SPEC 为权威，三条查询必须对 active role、role tenant、有效 group/membership/expiry 给出一致判定；不得顺手扩展到无关角色管理整改。
4. 明确 membership 删除与 assignment 新增的并发串行化合同，并用真实 PostgreSQL 集成测试证明不会遗留可在 rejoin 后恢复的 assignment。
5. membership 审计不得把无界 assignment ID 列表拼入 `audit_log.remark VARCHAR(512)`；保留逐 assignment 审计，membership remark 使用有界摘要。

前一轮遗留 groups `11/12/13` 无产品 delete/archive/purge 入口。不要直接 SQL 清理；保持 manifest 记录，并把解除条件写入报告。该清理阻塞不授权扩大业务代码范围。

## 1. 必读顺序

开始任何编辑前，按顺序完整读取：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `backend/AGENTS.md`、`backend/CLAUDE.md`（存在时）
4. 所有拟修改文件所在更深目录的 `AGENTS.md` / `CLAUDE.md`
5. `docs/standards/code-quality-baseline-rules.md`
6. `docs/standards/code-review-checklist.md`
7. `docs/plan/full-platform-remediation/README.md`
8. `docs/plan/full-platform-remediation/INDEX.md`
9. `docs/plan/full-platform-remediation/01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/README.md`
10. 同目录 `SPEC.md`
11. 同目录 `VERIFICATION.md`
12. 同目录 `IMPLEMENTATION-RECORD.md`、`REVERIFICATION-REPORT.md`
13. `docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md` 中 `BUG-FQA-017`
14. 同一 run 目录的 `unique-case-ledger.md`、`state-cross-module-ledger.md`、`evidence-index.md`、`test-data-manifest.json` 中 `RBAC-026`、`XL-RBAC-002/006/009` 及原夹具清理记录
15. `test-results/FQA_20260712_0329_lintfix/RBAC-026-membership-removal/result.json`

随后检查 `IMPLEMENTATION-RECORD.md`。如果已有其他执行者完成了部分步骤，从第一个未完成门禁继续，不覆盖原记录、不重做已有充分证据的步骤。

## 2. 原始缺陷基线（历史事实）

- 源测试 runId：`FQA_20260712_0329_lintfix`。
- 原夹具 membership `55` 已软删除；assignment `63` 在复现窗口仍 active，之后已通过产品 API 清理。
- membership 删除后，原 session 和新登录 session 的 `GET /api/wiki/spaces` 都返回 200 和 6 个空间。
- 因新 session 也放行，这不是仅存在于 JWT/token 的旧权限缓存。
- `JwtAuthFilter` 每次请求会重新加载 `SecurityUser`，但当前有效 assignment 查询仍返回孤儿 group assignment。
- 修复前的 `RoleAssignmentMapper.findEffectiveRoleIds/findEffectiveScopes` 未要求 group scope 对应活动 membership。
- 修复前的 `ScopedPermissionMapper.findAssignments` 也未要求活动 membership，资源级统一授权存在同类缺口；当前未提交实现已添加 membership 过滤，但仍须按第 0 节完成返修。
- 原失败证据只实际覆盖 Wiki；共享文件是修复后必须补齐的高风险回归，不得伪称已有共享文件失败证据。

## 3. 唯一任务目标

实现并证明以下不变量：

> `scopeType=group` 的 role assignment 只有在 assignment 本身有效、tenant/user/group 均匹配、目标 group 有效，并且用户对 `scopeId` 存在活动 membership 时，才能参与功能 permission、role IDs、highest scope 或资源级授权裁决。

membership 删除事务提交后，从用户下一次业务请求开始：

- 原 session、全新登录 session、刷新 token session 都不得继续使用该 assignment；
- Wiki 和共享文件都必须拒绝；
- 其他组的有效 assignment、tenant assignment、有效期和多角色并集不得回归；
- 不依赖全局 session 清理或管理员额外手工撤销才能保证正确性。

## 4. 本次执行已批准的产品决策

启动本 prompt 即批准以下事件内决策，Claude Code 不需要再次询问：

1. 采用 `SPEC.md` 的 **方案 B + 运行时过滤**。
2. 所有运行时有效 assignment 查询都必须过滤缺少活动 membership 的 group assignment，以防御历史孤儿数据、竞态和其他写入口。
3. membership 删除时，在同一事务中软撤销与 `tenantId + userId + scopeType=group + scopeId=removedGroupId` 精确匹配的活动 assignments，并保留 `deletedAt/deletedBy`。
4. membership 删除审计必须能追溯被撤销的 assignment IDs；可为每条撤销写现有风格审计，或在 membership 删除审计中记录结构化 ID 集合，但不得写非法 JSON。
5. 任一 assignment 撤销、membership 删除、主组同步或审计失败，整个事务必须回滚。
6. 用户重新加入同一组时，旧 assignment 不自动恢复；必须由管理员显式重新授予。
7. 存量孤儿 assignments 本事件只做只读统计与运行时失效，不做批量数据清理或迁移。
8. tenant/platform assignment、legacy role、authorization configured/effective mode、cutover epoch 和 break-glass 合同保持不变。

如果当前数据模型或产品 API 无法安全实现上述任一项，停止并记录 `BLOCKED`，不得擅自改成重新入组自动恢复或批量迁移历史数据。

## 5. 强制 GitNexus 门禁

该仓库已索引为 `cwgsyw-platform`。必须遵守：

1. 先读 `gitnexus://repo/cwgsyw-platform/context`，确认索引与当前 commit 是否一致；过期则在项目根运行仓库指定的 analyze 命令后再继续。
2. 用 `query` 探索 membership 删除、assignment 有效性、请求认证和资源裁决执行流。
3. 对候选符号先用 `context` 获取真实 callers/callees。
4. **编辑任何函数、类或方法前**，对该符号运行 upstream `impact`，把 direct callers、affected processes、modules 和风险写入 `IMPLEMENTATION-RECORD.md`。
5. 已知基线风险：
   - `RoleAssignmentMapper.findEffectiveRoleIds`：`CRITICAL`，此前为 17 upstream、4 flows、6 modules；
   - `ScopedPermissionMapper.findAssignments`：`HIGH`，此前为 11 upstream，涉及 Authorization、Wiki、SharedFile；
   - `RbacService.getUserPermissions`：`HIGH`。
6. 对上述 `HIGH/CRITICAL` 结果，先向用户输出一句明确告警。若最新影响未超过本 SPEC 已记录的模块和合同，可继续实施；若出现新的高风险模块、平台 assignment、break-glass、cutover 或迁移链路，停止并请求确认。
7. 代码修改完成后运行 `detect_changes({scope:"compare", base_ref:"master"})`，并结合当前工作区 diff 区分用户既有改动与本事件改动；结果写入实施记录。

不要用 grep 代替 GitNexus 的 query/context/impact；grep/rg 只用于补充定位文本和验证覆盖。

可以尽可能使用 subagent 并行完成互不依赖的只读任务，例如：原始证据复核、mapper SQL 测试设计、Wiki/共享文件回归矩阵、文档追溯检查。主执行者必须亲自完整读取规则和事件合同，并统一负责核心方案、代码整合、风险判断和最终回写。`RoleAssignmentMapper`、`ScopedPermissionMapper`、`GroupMembershipService` 只能由一个实现者串行修改，禁止多个 agent 并发编辑授权核心文件。

## 6. 工作区与修改范围

开始时记录：branch、commit、`git status --short`。工作区可能已有用户改动，必须保留，不得 reset、checkout 或覆盖。

预计允许修改的生产代码仅限根因所需的最小集合：

- `backend/src/main/java/com/cwgsyw/platform/module/rbac/RoleAssignmentMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/authorization/ScopedPermissionMapper.java`
- `backend/src/main/java/com/cwgsyw/platform/module/org/GroupMembershipService.java`
- 只有根因实现确实需要时，才修改相邻的 assignment service/mapper、审计 DTO 或错误合同；必须先做 GitNexus impact 并写明必要性。

允许新增或修改的测试限于：

- mapper/PostgreSQL 集成测试；
- `RoleAssignmentServiceTest`；
- `RbacServiceAuthorizationModeTest`；
- `AuthorizationServiceTest`；
- `GroupMembershipServiceTest`；
- 本事件专用测试脚本或 evidence 生成脚本。

允许更新的文档：本事件目录四份事件文档、总 `INDEX.md`，以及修复运行对应的证据索引。不要改写源测试 run 的失败事实。

明确非目标：

- `BUG-FQA-016` 成员列表软删除仍展示；
- `XL-RBAC-008` 已删除角色 permissions 泄露；
- 无关 DTO、页面、格式化、依赖升级或权限模型重构；
- 新数据库迁移，除非证明现有字段无法满足软撤销；若确实需要迁移，先停止并请求批准。

## 7. 实施要求

### 7.1 实施前冻结

1. 重新核验运行环境的 authorization configured/effective mode 和 epoch，预期仍为 `ENFORCED`、epoch `1`；若漂移，记录并停止真实权限回归，先确认环境。
2. 只读统计活动 group assignments 中缺失活动 membership 的数量，按 tenant 汇总；不得输出用户名、密码或敏感资料。
3. 确认第 4 节决策已写入 `IMPLEMENTATION-RECORD.md`，事件保持 `IN_PROGRESS`；不得回退为 `DRAFT`。
4. 保存非测试 assignment/membership/ACL 和 superadmin 关键字段的测试前只读摘要，用于最终一致性核验。

### 7.2 运行时有效性

1. 对 `RoleAssignmentMapper.findEffectiveRoleIds`、`findEffectiveScopes` 和 `ScopedPermissionMapper.findAssignments` 应用语义等价的 group membership 条件。
2. membership 条件只约束 `scopeType=group`；tenant/platform 不要求 membership。
3. group 路径同时保证 tenant、user、group、scopeId 与逻辑删除状态正确。
4. 以 `SPEC.md` 的 `effectiveAssignment` 定义为权威，使三条查询的 active role、role tenant、group/membership 和 expiry 判定一致；只做满足本事件不变量所需的最小改动，不扩展到角色页面、历史迁移或其他已登记缺陷。
5. 使用真实 PostgreSQL 集成测试证明 SQL 的逻辑删除、跨 tenant、scopeId、时间边界行为；不能只用 Mockito。

### 7.3 删除写路径

1. 在现有 membership 删除事务中，精确查出匹配的活动 group assignments。
2. 使用项目软删除语义撤销，写 `deletedAt/deletedBy`，不得物理删除。
3. 对用户入口和组入口两条删除路径都生效；不要复制两套不一致逻辑。
4. 先明确并测试主组清理、assignment 撤销、membership 删除和审计的事务顺序。
5. 审计记录必须符合合法 JSON/camelCase 合同，且能关联 membership/group/user 和 assignment IDs。
6. 为原子性写自动化测试；不要在共享运行环境执行故障注入。

### 7.4 会话与裁决

1. 不新增全局 session revoke 作为正确性前提。
2. 证明旧 session 下一请求经 `JwtAuthFilter -> UserDetailsServiceImpl -> RbacService` 得到修复后的权限。
3. 证明 `AuthorizationService` 不再选择孤儿 group assignment，也不返回其 `matchedRoleAssignmentId`。
4. 保持 `FUNCTION_PERMISSION_DENIED / ROLE_SCOPE_NOT_COVERED / RESOURCE_ACCESS_DENIED / ANCESTOR_TRAVERSE_DENIED` 的裁决层级。
5. break-glass 仍不能绕过功能 permission 或 assignment scope 缺失。

## 8. 测试数据与安全边界

- 所有新测试对象使用 `remediationRunId = REM_P0_001_YYYYMMDD_HHMM_BRANCHSHORT`，其中 `BRANCHSHORT` 在运行时替换为当前分支的安全短名。
- 每创建一个对象立即写 manifest；只通过产品已有 UI/API 建立和清理授权关系，不直接写授权表制造 PASS。
- 不修改 superadmin 的密码、状态、旧角色、membership、primary group、assignment、资料或任何权限。
- prompt 不包含任何密码；需要登录时由用户通过受控环境变量或当前会话提供，禁止写入文件、命令输出和报告。
- 禁止全租户 Enforce/Rollback、restore、全局 session 清空、历史 assignment 批量迁移、修改非测试 ACL/assignment/membership。
- 不执行性能测试、安全渗透、故障注入。
- 若无法通过产品接口精确清理本次数据，停止并记录 BLOCKED，不得用 SQL 强删。

## 9. 验证顺序

先运行最小自动化测试，成功后再扩大范围。最多针对本事件失败迭代三次；不得修无关失败。

### L1：每次实现迭代

- 新增/修改的 mapper PostgreSQL 集成测试；
- `GroupMembershipServiceTest`、`AuthorizationServiceTest`、`RbacServiceAuthorizationModeTest` 和相关 `RoleAssignmentServiceTest`；
- `RBAC-026`、`XL-RBAC-009`；
- Wiki + 共享文件 × 原 session / 新 session / refresh session；
- tenant assignment unaffected；
- runId 清理闭环。

L1 任一 FAIL，立即保存首次失败证据并停止扩大回归。

本轮 L1 还必须新增并通过：

- assignment 与 membership 的 `isDeleted/deletedAt/deletedBy` 数据库断言；
- 用户授权删除入口、组管理删除入口、旧主组无 membership 行兼容入口；
- 并发 assignment add vs membership remove；
- 大量 matching assignments 时的有界审计；
- role 已删除/跨 tenant、group 已删除/`unassigned`、future `validFrom` 的三查询等价性。

### L2：L1 全 PASS 后

- `XL-RBAC-002`：主组、非主组、多组独立失效；
- `XL-RBAC-006`：无 permission、membership/scope、expired、ACL、ancestor 五类独立拒绝；
- assignment `validFrom/validUntil`；
- 多角色 permission union；
- 离组再入组不恢复旧 assignment；
- `ENFORCED/SHADOW/LEGACY` 合同。

### L3：合并前模块回归

- Org：membership 增删、primary group；
- RBAC：assignment CRUD、role reference、validUntil；
- Wiki：list/read/create/comment 与 ACL；
- SharedFile：list/upload/download 与 ACL；
- Auth/session：permissions、highest scope、requiredActions；
- 运维日历组长查找这一 GitNexus 间接消费者。

### L4：发布关闭门禁

完整 `275+78` 以发布候选版本的实时分母为准。当前修复任务完成 L1-L3 后，可以把事件置为 `VERIFYING` 并将 L4 明确记录为发布门禁；除非用户要求本次立即做发布关闭，不要为了声称 `CLOSED` 伪造 L4。

## 10. 每项验证必须断言

- UI 可见性或入口行为；
- 直接路由；
- 直接 API 的真实 403，不接受 401 代替权限拒绝；
- reasonCode（若合同返回）；
- 数据库无未预期变化；
- assignment scope/expiry、membership/primary group、authorization mode/epoch；
- Wiki/共享文件 ACL 与祖先链；
- 原 session、新 session、refresh session；
- Console error、失败请求和后端异常；
- 审计记录和最终清理。

修复后 evidence 保存到：

`test-results/{remediationRunId}/REM-P0-001/`

至少包含 `environment.json`、`fixture-manifest.json`、`api-summary.json`、数据库前后摘要、`session-matrix.json`、`reason-code-matrix.json`、`cleanup.json`，以及必要的 console/network/log/screenshots/trace。不得覆盖原始失败证据。

## 11. 必须实时回写

不要测试结束后一次性补文档：

1. 每次关键实现或失败立即追加 `IMPLEMENTATION-RECORD.md`：时间、文件、符号、GitNexus、决策、命令、结果、证据、数据影响。
2. 每完成一项更新 `VERIFICATION.md` 的 `AC-001..014` 状态和证据路径。
3. 状态变化同时更新事件 `README.md` 和总 `INDEX.md`。
4. 原 `FQA_20260712_0329_lintfix` 报告保持历史事实；只新增修复 run 与其映射。
5. 不提交 Git、不 push、不创建 PR，除非用户之后明确要求。

## 12. 停止条件

出现以下任一情况立即停止危险操作，保留当前证据并报告：

- GitNexus 最新 impact 超出 SPEC 的授权、组织、Wiki、共享文件、认证和运维日历范围；
- 需要改变 tenant/platform、legacy、cutover、break-glass 或 authorization mode 合同；
- 需要新 Flyway 迁移、批量修复历史数据或修改非测试授权；
- tenant assignment 或同组合法访问被错误拒绝；
- membership 删除出现部分成功、审计缺失或无法精确回滚；
- 未解释 HTTP 5xx、后端异常或数据污染；
- authorization mode/epoch、superadmin、非测试 assignment/membership/ACL 发生变化；
- runId 对象无法通过产品接口精确清理。

## 13. 完成定义与最终回复

只有 `SPEC.md` 的 `AC-001..014` 全有真实证据，`RBAC-026`、`XL-RBAC-002/006/009` 全部 PASS，L1-L3 通过，清理和非测试数据一致性通过，才能把实现阶段结论标为 PASS。

- 若 L4 也完成且全部发布关闭条件满足，事件可标 `CLOSED`。
- 若 L1-L3 完成而 L4 等待发布候选，事件标 `VERIFYING`，总索引下一门禁写清楚“执行 L4 全量回归”。
- 任一功能合同失败标 `FAIL`；外部或高风险授权阻塞标 `BLOCKED`，写解除条件。

最终只简洁报告：

1. 事件当前结论和状态；
2. 实际修改文件与核心行为；
3. L1/L2/L3/L4 结果；
4. 证据和实施记录路径；
5. 清理与非测试数据核验；
6. 仍需用户决定或授权的事项。

现在开始：先完整读取规则、事件文档和原始证据，核对 checkpoint/实施记录，然后直接执行第一个未完成门禁。不要停在计划阶段。
