# REM-P0-001 实施 SPEC

## 1. 目标

修复 group membership 与 group-scoped role assignment 生命周期脱节造成的持续越权。在不改变 tenant/platform assignment、legacy role、authorization mode 和资源 ACL 语义的前提下，确保用户失去某组的活动 membership 后，指向该组的 assignment 立即停止参与所有运行时授权决策。

## 2. 权威输入

- 事件卡：[README.md](./README.md)
- 验证矩阵：[VERIFICATION.md](./VERIFICATION.md)
- 源缺陷：`BUG-FQA-017`
- 源运行：`FQA_20260712_0329_lintfix`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/RBAC-026-membership-removal/result.json`
- 源码基线：branch `lint-fix`，commit `5d3c5b6ff1995247c47c4cf8a9609802f42636b5`
- GitNexus 索引：9863 symbols、21190 relationships、300 flows；indexed commit 与源码基线一致。

## 3. 问题定义

### 3.1 当前行为

`RoleAssignmentMapper.findEffectiveRoleIds` 和 `findEffectiveScopes` 只检查：

- assignment tenant/user；
- `is_deleted=false`；
- `validFrom` / `validUntil`。

`ScopedPermissionMapper.findAssignments` 还检查 role 和 permission，但也没有要求 group assignment 的 `scopeId` 对应活动 membership。

因此 membership 被软删除后：

1. `RbacService` 在 `ENFORCED` 下仍把 assignment 的角色转换为 authorities；
2. `getHighestScope` 仍返回 group scope；
3. `AuthorizationService` 的资源级功能 permission/scope 匹配仍可能命中该 assignment；
4. `JwtAuthFilter` 虽然每次请求重新加载用户，但加载到的仍是错误的有效 assignment，原会话与新会话都继续放行。

### 3.2 目标不变量

定义 `effectiveAssignment(a, u, now)`：

```text
sameTenant(a, u)
AND activeUser(u)
AND activeAssignment(a, now)
AND activeRole(a.roleId)
AND (
  a.scopeType IN {platform, tenant}
  OR (
    a.scopeType = group
    AND a.scopeId IS NOT NULL
    AND activeGroup(a.tenantId, a.scopeId)
    AND activeMembership(a.tenantId, a.userId, a.scopeId)
  )
)
```

所有运行时权限与 scope 查询必须使用等价语义，不允许一个查询认为 assignment 有效而另一个查询认为无效。

## 4. 行为合同

### 4.1 assignment 有效性

| 场景 | 目标结果 |
|---|---|
| 活动 group assignment + 活动同组 membership | assignment 可参与后续 permission、scope 和 ACL 裁决 |
| membership 软删除或不存在 | assignment 保留为历史记录也不得参与运行时授权 |
| membership 属于其他 tenant/user/group | 不得匹配 |
| group 已删除、跨租户或 `scopeId=null` | 不得参与授权，并进入数据诊断范围 |
| assignment 未到 `validFrom` 或已到 `validUntil` | 不得参与授权 |
| tenant assignment | 不要求 group membership，行为保持不变 |
| platform compatibility assignment | 行为保持不变，不由通用入口生成或撤销 |
| 多个 assignments | 只对各自满足不变量的项做 permission 并集和最高 scope 计算 |

### 4.2 membership 删除即时性

- 成功删除 membership 的事务提交后，用户下一次业务请求必须看到新授权状态。
- 原 session、新登录 session、刷新 token session 的结果一致。
- 不要求管理员执行额外 session 清空、角色撤销或缓存刷新。
- 如果删除事务回滚，membership 和授权状态都保持原状，不得出现半失效。

### 4.3 功能权限与 scope

- `RbacService.getUserPermissions` 在 `ENFORCED` 下只从有效 assignments 取 permission。
- `RbacService.getUserRoleIds` 供角色 ACL 使用时遵守同一有效性规则。
- `RbacService.getHighestScope` 不得因孤儿 group assignment 返回 group；若不存在任何有效 assignment，必须沿用当前产品对“无有效 scope”的兼容合同，不在本事件擅自引入新枚举。
- `SHADOW` 下 legacy 返回行为保持不变，但 assignment 侧的 shadow 比较必须使用修复后的有效性规则。
- `LEGACY` 下不得因本事件改变 legacy role 授权结果。

### 4.4 资源级统一授权

- `ScopedPermissionMapper.findAssignments` 必须应用同一 group membership 有效性规则。
- Wiki 与共享文件的 permission → assignment scope → ACL/mode → ancestor traverse 顺序保持不变。
- membership 不满足时，不得把该 group assignment 作为 `matchedRoleAssignmentId`。
- 若不存在其他有效 permission assignment，拒绝应为现有合同的 `FUNCTION_PERMISSION_DENIED`；若另有有效 permission assignment 但 scope 不覆盖，则保持 `ROLE_SCOPE_NOT_COVERED`。不得把 membership 缺失伪装成 ACL 拒绝。
- break-glass 不得绕过功能 permission 或 assignment scope 缺失；现有仅可绕过资源拒绝的边界保持不变。

### 4.5 写路径与历史记录

运行时过滤是必须项。以下写路径增强必须在实现前二选一并记录到实施台账：

**方案 A：只做运行时失效，保留 assignment 历史状态。**

- membership 删除不修改 assignment；
- assignment 仍可在管理 UI 中展示，但必须明确其因 membership 缺失而 `ineffective`；若当前 DTO 无此状态，本事件可先保留展示，另建体验事件；
- 用户重新加入同一组后，原 assignment 是否自动恢复必须明确。默认合同为**不自动恢复**，避免离组再入组意外恢复旧授权；若数据模型无法表达，必须采用方案 B。

**方案 B：删除 membership 时事务性撤销匹配的 group assignments。**

- 仅处理相同 `tenantId + userId + scopeType=group + scopeId=removedGroupId` 的活动 assignments；
- 使用产品已有软删除/撤销语义，保留 `deletedAt/deletedBy`；
- 为每条撤销写可追溯审计，或在 membership 审计中保存明确的 assignment IDs；
- 用户重新加入组后旧 assignment 不自动恢复；必须由管理员显式重新授予；
- 任一撤销或审计失败时整个 membership 删除事务回滚。

除非产品负责人明确要求“重新入组自动恢复旧授权”，实施默认选择 **B + 运行时过滤**：写路径收敛防止孤儿持续积累，运行时过滤防御历史数据、竞态和其他写入口。

### 4.6 API 与 UI

- membership 删除 API 的成功响应合同保持不变。
- 删除失败必须返回现有可理解的 4xx/5xx 合同且无部分写入；不新造前端专用状态码。
- 管理 UI 删除确认流程保持不变。
- 低权用户的受保护入口应在下一次权限数据刷新后隐藏；即使 UI 尚未刷新，直接路由和直接 API 必须拒绝。
- 本事件不要求新增全局 session 撤销 UI。

### 4.7 审计与可观测性

membership 删除审计至少能回答：tenant、operator、user、group、membershipId、时间、结果。若采用方案 B，还必须能追溯被撤销 assignment IDs。

禁止记录密码、token、完整 Authorization header。失败日志必须能区分事务失败与正常的 authorization deny，不得把预期 403 记录为未解释 5xx。

## 5. 预计修改面

### 5.1 必要候选

| 文件 / 符号 | 目的 | 实施前要求 |
|---|---|---|
| `RoleAssignmentMapper.findEffectiveRoleIds` | 功能 permission 和角色 ACL 来源排除无 membership 的 group assignment | 再次运行 GitNexus `impact` |
| `RoleAssignmentMapper.findEffectiveScopes` | 最高 scope 与组织约束采用相同有效性 | 再次运行 GitNexus `impact` |
| `ScopedPermissionMapper.findAssignments` | 资源级功能 permission/scope 裁决排除孤儿 assignment | 再次运行 GitNexus `impact` |
| `GroupMembershipService.removeMembership` | 若采用方案 B，事务性撤销匹配 assignments 并审计 | 再次运行 GitNexus `impact` |

### 5.2 预计测试修改

- `RoleAssignmentServiceTest` 或新增 mapper 集成测试：tenant/group/expiry/membership 等价类。
- `RbacServiceAuthorizationModeTest`：ENFORCED/SHADOW/LEGACY 和多角色并集。
- `AuthorizationServiceTest`：membership 缺失不命中 assignment，reasonCode 层级不漂移。
- `GroupMembershipServiceTest`：删除 membership 与 assignment 撤销/回滚/审计原子性（若采用方案 B）。
- 真实数据库集成测试：逻辑删除字段、时间边界、tenant 隔离和 SQL join 行为。

不得为了通过测试改写与本事件无关的授权合同。

## 6. GitNexus 影响分析

分析基线：commit `5d3c5b6f`。

| 符号 | 风险 | 影响摘要 |
|---|---|---|
| `GroupMembershipService.removeMembership` | LOW | 4 个上游符号；直接调用者为 `remove`、`removeByGroup`，再上游为用户和组两个删除入口 |
| `RoleAssignmentMapper.findEffectiveRoleIds` | CRITICAL | 17 个上游符号、4 条流程、6 个模块；涉及 Wiki `createPage/createComment`、共享文件 `upload/listFiles`、Org、RBAC、User、Service |
| `RoleAssignmentMapper.findEffectiveScopes` | LOW | 7 个上游符号、2 个模块；影响最高 scope 和组织规则 |
| `RbacService.getUserPermissions` | HIGH | 7 个上游符号、3 个模块；直接影响登录、每请求用户加载和运维日历组长选择 |
| `RbacService.getHighestScope` | LOW | 4 个上游符号；影响登录与每请求用户加载 |
| `ScopedPermissionMapper.findAssignments` | HIGH | 11 个上游符号、1 组已索引流程、3 个模块；影响 Authorization、Wiki、SharedFile |

结论：这是认证授权关键路径的 `CRITICAL` 变更。实现必须独立提交，不与 `BUG-FQA-016`、DTO 清理或页面调整混合。任何 SQL 语义扩张、legacy 行为变化或 tenant assignment 回归都触发停止。

## 7. 实施步骤

### Step 0：实施前冻结

1. 更新源码基线 commit、运行栈和 authorization mode/epoch。
2. 只读统计活动 group assignments 中缺失活动 membership 的数量，按 tenant/user/group 汇总，不输出敏感资料。
3. 对每个拟修改符号重新运行 GitNexus `impact`，把结果写入 `IMPLEMENTATION-RECORD.md`。
4. 确认选择方案 A 或 B；未确认不得开始写路径修改。

### Step 1：建立统一查询不变量

1. 为角色 ID、scope 和 scoped permission 三条查询应用相同 membership 条件。
2. group 条件只作用于 `scopeType=group`；tenant/platform 路径保持原样。
3. 同时过滤跨租户、逻辑删除和无效 group。
4. 用真实 PostgreSQL 集成测试覆盖时间边界和逻辑删除，避免仅 Mockito 验证 SQL 合同。

### Step 2：收敛 membership 删除写路径

若选择方案 B：

1. 在现有 `@Transactional` 边界内查找匹配 assignments；
2. 使用软删除/撤销语义更新；
3. 写审计关联；
4. 再删除 membership/清理主组；
5. 通过故意让审计或撤销失败的测试验证原子回滚，不在真实环境做故障注入。

若选择方案 A，必须用单独验收证明重新入组不会恢复旧授权；证明不了则停止并改为方案 B。

### Step 3：校准运行时与 reasonCode

1. 验证 `JwtAuthFilter` 原 session 下一请求重新构造的 `SecurityUser` 已失去权限；不新增全局 session 清理。
2. 验证 `AuthorizationService` 不命中孤儿 assignment。
3. 验证拒绝层级和 reasonCode，不允许落到资源 ACL 层才拒绝。
4. 验证 SHADOW 只改变新模型比较侧，LEGACY 返回合同不变。

### Step 4：分层验证与发布

严格按 [VERIFICATION.md](./VERIFICATION.md) 执行：

1. 定向用例；
2. 根因聚类回归；
3. Wiki/共享文件/组织/RBAC 模块回归；
4. 发布候选版本全量 `275+78`。

前 3 层全部 PASS 才允许合并；第 4 层用于版本关闭，不要求每次代码迭代重复执行。

## 8. 数据与兼容策略

- 本事件不自动清理存量孤儿 assignments，除非另有已批准迁移步骤。
- 运行时过滤上线后，存量孤儿 assignment 立即变为无效，不需要重启数据库或 Redis。
- 若上线前只读统计发现内置 platform assignment、compatibility assignment 或跨 tenant 异常被 group 条件命中，立即停止并修正查询范围。
- authorization configured/effective mode 和 cutover epoch 不因本事件改变。
- 不重启 PostgreSQL、Redis、MinIO 或 Nginx；如需部署，仅替换 backend，按环境流程验证。

## 9. 回滚

### 9.1 代码回滚

- 回滚本事件独立提交即可恢复旧查询；不得夹带数据库 schema 变更。
- 回滚前保存修复后验证证据和实际失效 assignment 清单摘要。

### 9.2 数据回滚

- 若仅做运行时过滤，无数据回滚。
- 若方案 B 已软撤销 assignments，默认**不自动恢复**，因为恢复可能重新授予已离组用户权限。
- 只有在 membership 删除事务整体回滚时，assignment 才随事务恢复。
- 任何人工恢复 assignment 必须基于逐条管理员确认和审计，不允许批量 SQL 恢复。

### 9.3 回滚判定

出现以下任一情况立即停止发布并回滚代码：

- tenant/platform assignment 被错误过滤；
- 同组活动 membership 的合法访问被拒绝；
- LEGACY 模式行为改变；
- membership 删除产生部分成功或审计丢失；
- 直接 API 出现未解释 5xx；
- authorization mode/epoch、superadmin 或非测试授权发生变化。

## 10. 验收条件

| ID | 验收条件 |
|---|---|
| `AC-001` | 活动 membership + 活动 group assignment 的 Wiki/共享文件合法访问保持 PASS。 |
| `AC-002` | 删除 membership 后，原 session 下一请求的 Wiki/共享文件访问均为真实 403，无业务数据返回。 |
| `AC-003` | 删除 membership 后，新登录和刷新 token session 的同类访问均为 403。 |
| `AC-004` | 运行时 permission、role IDs、highest scope 和 scoped permission 查询均不采用孤儿 group assignment。 |
| `AC-005` | tenant assignment 不依赖 membership，活动 tenant assignment 的合法访问保持 PASS。 |
| `AC-006` | assignment validFrom/validUntil、多角色 permission 并集和多组独立失效保持正确。 |
| `AC-007` | 无 permission、scope 不覆盖、过期、ACL 拒绝、祖先 traverse 拒绝仍命中各自正确层级；break-glass 不绕过前两层。 |
| `AC-008` | 主组与非主组 membership 删除均只使目标组 assignment 失效，其他组保持不变。 |
| `AC-009` | 重新加入组不会静默恢复旧 assignment；若产品明确选择自动恢复，则必须另行批准并更新本 SPEC。 |
| `AC-010` | membership 删除及关联 assignment 撤销/审计（如采用 B）满足事务原子性。 |
| `AC-011` | `ENFORCED` 修复生效，`SHADOW` 比较侧正确，`LEGACY` 返回行为不变；mode 和 epoch 不变。 |
| `AC-012` | 所有 runId 夹具通过产品接口清理，数据库、session、MinIO 和非测试授权前后核验一致。 |
| `AC-013` | 无未解释 Console error、HTTP 5xx 或后端异常。 |
| `AC-014` | GitNexus `detect_changes` 只报告预期授权/组织流程；超出范围必须评审。 |

事件只有在 `AC-001..014` 全部有可定位证据且 `RBAC-026`、`XL-RBAC-002/006/009` 全部 PASS 后，才可从 `VERIFYING` 进入 `CLOSED`。
