# REM-P0-001 复验总结报告

> 当前总状态：`CLOSED`。第 1–10 节保留各轮历史结论，最终关闭结算见第 11 节。

## 1. 结论

| 项目 | 结果 |
|---|---|
| 复验 runId | `REM_P0_001_20260713_2311_lint_fix` |
| 复验日期 | 2026-07-13 |
| 事件结论 | `FAIL` |
| 事件状态 | `IN_PROGRESS` |
| 是否可以关闭 | **否** |
| 下一门禁 | 完成返修后重新执行 L1；L1 全 PASS 才进入 L2/L3 |

核心越权用户表现已经修复：活动 group assignment 在 membership 移除后，Wiki 与共享文件对原 session、session touch 后会话和新登录 session 均立即返回 403；重新入组不会恢复旧 assignment；tenant assignment、多角色并集和多组独立性在本轮夹具中保持正确。

但是，方案 B 要求的软删除元数据没有落库，旧主组兼容删除分支仍未撤销 assignment，三条有效 assignment 查询也没有完全实现 SPEC 定义的统一不变量。因此本轮只能形成“复验有结论”的闭环，不能形成 `REM-P0-001` 的关闭闭环。

## 2. 验证基线

- branch：`lint-fix`
- commit：`5d3c5b6ff1995247c47c4cf8a9609802f42636b5` + 3 个未提交业务文件
- authorization：`ENFORCED`，epoch `1`；复验前后相同
- backend：当前工作区构建镜像，运行字节码包含本事件 SQL
- 浏览器：独立 Google Chrome + Playwright，不依赖应用内浏览器
- superadmin：关键字段复验前后相同；凭据未写入本报告和证据摘要

## 3. 结果摘要

### 3.1 定向单元测试

| 测试类 | 结果 |
|---|---:|
| `RoleAssignmentServiceTest` | 4/4 PASS |
| `RbacServiceAuthorizationModeTest` | 5/5 PASS |
| `GroupMembershipServiceTest` | 4/4 PASS |
| `AuthorizationServiceTest` | 11/11 PASS |
| 合计 | **24/24 PASS** |

命令通过 `-Dnet.bytebuddy.experimental=true` 兼容宿主 Java 26。完整日志：`test-results/REM_P0_001_20260713_2311_lint_fix/REM-P0-001/maven-targeted-tests.log`。

### 3.2 L1 运行时检查

| 总检查点 | PASS | FAIL | 原始结论 |
|---:|---:|---:|---|
| 54 | 51 | 3 | `FAIL` |

原始结果：`test-results/REM_P0_001_20260713_2311_lint_fix/REM-P0-001/result.json`。

通过的核心行为：

- 同组活动 membership + 两个 group assignments 的 Wiki/共享文件访问均为 200；
- membership 删除后，原 session、session touch 后和新 session 的两资源访问均为 403；
- UI 新 session 隐藏 Wiki 入口，直接访问共享文件路由被重定向；
- 两条目标 group assignments 被逻辑删除，并产生两条逐 assignment 审计和一条 membership 审计；
- 重新入组后旧 assignment 不恢复；
- tenant assignment 在无 membership 时仍生效；
- expired assignment 被拒绝；
- 多组场景只撤销目标组 assignment，另一组继续生效；
- 本轮创建的用户、角色、membership 和 assignment 均已清理；活动孤儿 group assignment 为 0；
- authorization mode/epoch 与 superadmin 关键字段前后相同。

## 4. 验收项结算

| AC | 结果 | 结论摘要 |
|---|---|---|
| `AC-001` | `PASS` | 双资源 allow、多角色并集和首页点击路径通过 |
| `AC-002` | `PASS` | membership 删除后原 session 双资源均 403 |
| `AC-003` | `PASS` | session touch 后与新登录 session 双资源均 403 |
| `AC-004` | `FAIL` | 三条查询未完全实现同一 active role/tenant/group 合同 |
| `AC-005` | `PASS` | tenant assignment 不依赖 membership |
| `AC-006` | `BLOCKED` | expiry、union、多组已通过；future `validFrom` 因 L1 失败门禁未继续 |
| `AC-007` | `BLOCKED` | 五类独立拒绝、reasonCode 与数据库无变化矩阵未执行 |
| `AC-008` | `FAIL` | 正常主组/非主组路径通过，但旧主组兼容分支仍不撤销 assignment |
| `AC-009` | `PASS` | rejoin 不恢复旧 assignment |
| `AC-010` | `FAIL` | `is_deleted=true`，但 assignment 与 membership 的 `deletedAt/deletedBy` 均为空 |
| `AC-011` | `BLOCKED` | 现有 5 条模式单测通过；真实 SQL 的 SHADOW/LEGACY/ENFORCED 矩阵因 L1 失败未展开 |
| `AC-012` | `BLOCKED` | 本轮可清理对象为 0；前一轮遗留 3 个 runId group 无产品删除入口 |
| `AC-013` | `BLOCKED` | 无 5xx/后端异常；低权限首页产生的 403 console error 尚未逐请求归因 |
| `AC-014` | `PASS` | 当前 checkout 已重建索引并完成 `detect_changes(scope=all)` |

结算：`PASS=6 / FAIL=3 / BLOCKED=5 / N/A=0`。按照 [VERIFICATION.md](./VERIFICATION.md) 的门禁，L1 任一 FAIL 必须停止扩大回归，因此本轮未执行 L2/L3，也未执行发布级 `275+78`。

## 5. 未关闭缺口

### 5.1 已运行确认：软删除元数据未持久化

membership `199` 与 assignments `205/206` 均为 `is_deleted=true`，但 `deleted_at`、`deleted_by` 均为空。代码在调用 MyBatis-Plus `deleteById(entity)` 前只修改了实体字段，没有执行可持久化这些字段的 update。

这违反方案 B、审计可追溯和 SPEC `AC-010`。当前库历史统计也显示该问题不是单条偶发：已逻辑删除 assignment 191 条中 188 条缺少至少一个删除元数据；已逻辑删除 membership 162 条中 159 条缺少至少一个删除元数据。

### 5.2 源码确认：旧主组兼容分支未收敛 assignment

`GroupMembershipService.removeByGroup` 在找不到 membership、但 `user.groupId` 仍指向目标组时，只清空 `user.groupId` 并返回，没有调用 assignment 撤销逻辑。该入口可能留下活动 group assignment；运行时过滤会暂时拒绝，但重新入组后旧 assignment 可能恢复，违反“不自动恢复”合同。

### 5.3 源码确认：有效 assignment 查询仍不等价

- `RoleAssignmentMapper.findEffectiveRoleIds/findEffectiveScopes` 未关联活动且同租户的 role；
- `ScopedPermissionMapper.findAssignments` 未要求 `r.tenant_id = a.tenant_id`；
- 三条查询均未明确排除不能作为授权作用域的 `unassigned` group；
- 同一谓词被复制三次，后续继续漂移的概率较高。

### 5.4 源码确认：事务与并发边界未闭合

membership 删除和 assignment 新增没有共同的用户/组级锁或数据库约束。并发交错时可能在撤销查询之后创建新 assignment，留下可恢复授权。该项尚未运行并发验证。

### 5.5 源码确认：聚合审计 remark 存在长度上限

membership 审计把全部 `revoked_assignment_ids` 拼入 `audit_log.remark VARCHAR(512)`。assignment 数量较多时可能使删除事务因审计写入失败而整体回滚。逐 assignment 审计已经能追溯 ID，membership remark 应采用有界摘要。

### 5.6 清理阻塞

Claude 前一轮遗留 group `11/12/13`，均带本事件 runId，但产品没有 group delete/archive/purge 入口。本轮没有直接 SQL 清理；解除条件是新增产品清理能力，或由用户明确批准仅针对这三个已确认 runId group 的辅助软删除。

## 6. GitNexus 影响结论

当前 checkout 已强制重建索引：9,863 symbols、21,214 edges、300 flows。`detect_changes(scope=all)` 识别 3 个业务文件、8 个 changed symbols 和 4 条 Wiki/共享文件流程；聚合风险为 `MEDIUM`，但单符号风险为：

- `RoleAssignmentMapper.findEffectiveRoleIds`：`CRITICAL`，18 个上游、4 条流程；
- `ScopedPermissionMapper.findAssignments`：`HIGH`，11 个上游；
- `findEffectiveScopes`、`removeMembership` 与新增撤销方法：图谱为 `LOW`，但仍处于授权/事务关键路径。

完整影响证据：`test-results/REM_P0_001_20260713_2311_lint_fix/REM-P0-001/gitnexus-audit.md`。全局 GitNexus registry 仍有两个同名 checkout，后续必须显式传入 `/Users/byron/AI/cwgsyw-platform`。

## 7. 返修要求

1. 用显式 update + 逻辑删除，或项目统一的可审计软删除方法，确保 membership/assignment 的 `isDeleted/deletedAt/deletedBy` 同事务落库。
2. 让旧主组兼容分支复用同一撤销路径，并新增“无 membership 行但存在 legacy primary group”的回归用例。
3. 复用一个权威的 effective-assignment SQL 片段/查询实现，统一 active role、role tenant、group tenant/type、membership、expiry 语义。
4. 明确并实现 membership 删除与 assignment 新增的并发串行化合同；添加真实 PostgreSQL 并发集成测试。
5. 将 membership 审计改为有界摘要；保留逐 assignment 审计作为 ID 追溯来源。
6. 增加真实 PostgreSQL 集成测试，不再只依赖 Mockito：覆盖 role/membership/group 逻辑删除、跨 tenant、future/expired、多组、legacy 分支和事务回滚。

## 8. 再复验顺序

1. **L1**：24 条定向单测 + PostgreSQL 集成测试 + 本报告 54 个运行时检查；要求 FAIL=0，且可归属本轮的 active objects=0。
2. **L2**：`XL-RBAC-002/006/009`、future/expired、多角色、多组、rejoin、三种 authorization mode、五类 reasonCode。
3. **L3**：Org、RBAC、登录/会话、Wiki、SharedFile 与运维日历间接消费者。
4. **L4**：仅在发布候选版本执行实时完整 `275+78`，不要求每次返修迭代重复全量。

在 L1、L2、L3 全 PASS，清理阻塞解除，且未解释 console error/5xx/异常为 0 前，不得把事件更新为 `CLOSED`。

## 9. 第二轮返修复验追加结论（2026-07-14）

### 9.1 结论

| 项目 | 结果 |
|---|---|
| runId | `REM_P0_001_20260714_0013_lint_fix` |
| 主 L1 | `53 PASS / 1 FAIL` |
| 补充组管理入口 | `14/14 PASS` |
| 补充有界审计 | `21/21 PASS` |
| 事件结论 | `FAIL / INCOMPLETE` |
| 事件状态 | `IN_PROGRESS` |
| 是否可以关闭 | **否** |

第二轮已经真实修复并验证：软删除元数据、正常 membership 删除、组管理删除入口、原/新/touch session 立即失效、tenant/expiry/multi-role/multi-group/rejoin 和大于五条 assignment 的有界审计。本轮新建的 user、role、membership、assignment 均已清零，authorization 与 superadmin 未变化。

### 9.2 仍阻止闭环的事项

| 门禁 | 结果 | 原因 |
|---|---|---|
| 并发串行化 | `FAIL` | add assignment 与 remove membership 没有共同锁或约束，缺口 3.4 未实现 |
| 主组同步 | `FAIL` | `setGroupId(null) + updateById` 未把 NULL 写入数据库；用户 184/185 删除 membership 后仍保留 `group_id=13` |
| 更新行数合同 | `FAIL` | membership/assignment update 返回值未检查，更新 0 行仍可能记录成功撤销审计 |
| 三查询权威合同 | `FAIL` | 使用 `g.code` 排除未分配组，而平台权威字段是 `group_type` |
| PostgreSQL 等价矩阵 | `BLOCKED` | 未提供 future/cross-tenant/deleted role/group/membership 的 mapper 集成测试 |
| 旧主组兼容分支 | `BLOCKED` | 源码存在修复，但产品 API 无法构造“无 membership 行”的安全夹具 |
| 清理门禁 | `FAIL` | 活动整改组 `11..15` 无产品删除入口；第二轮新增了 `14/15` |
| Console 归因 | `BLOCKED` | 低权限页面的预期/非预期 403 未按 URL 分类 |

主 L1 原始唯一 FAIL 为五个遗留组未清理；但即使取得这 54 项全 PASS，也不能替代第二轮 Prompt 明确要求的并发、旧主组、future/跨租户/删除态和审计扩展分母。

### 9.3 证据

- `test-results/REM_P0_001_20260714_0013_lint_fix/REM-P0-001/result.json`
- 同目录 `session-matrix.json`、`db-after-membership-removal.json`、`cleanup.json`、`ui-result.json`
- 同目录 `group-remove-entry.json`
- 同目录 `bounded-audit.json`
- 同目录 `primary-group-readback.json`
- 同目录 `gitnexus-round2-audit.md`、`round2-reverification-summary.json`
- 同目录 `maven-targeted-tests.log`

### 9.4 下一门禁

1. 用显式 update wrapper 把主组列置 NULL，并对所有 membership/assignment/user update 精确断言影响行数；
2. 返修 add/remove 的同一用户组并发串行化，并增加真实 PostgreSQL 两种交错测试；
3. 将未分配组判断统一到 `group_type`，增加三查询等价矩阵；
4. 为旧主组兼容分支提供隔离集成测试，不在共享环境直接写授权表；
5. 提供 group delete/archive/purge 产品能力，或由用户明确批准只清理 groups `11..15`；
6. 重跑扩展后的完整 L1。全部 PASS 后才进入 L2/L3。

## 10. 最终收口复验（2026-07-14）

### 10.1 结论

| 项目 | 结果 |
|---|---|
| 最新 runId | `REM_P0_001_20260714_0254_lint_fix` |
| 核心缺陷 | `PASS` |
| PostgreSQL/Testcontainers | `18/18 PASS` |
| 拒绝层级 | `13/13 PASS` |
| 授权相关集群 | `117/117 PASS` |
| 完整后端 | `315/315 PASS` |
| L1-B | `54 PASS / 1 FAIL` |
| 事件状态 | `BLOCKED` |
| 是否可标 `CLOSED` | **否** |

第三轮报告中尚未完成的 assignment add 锁、旁路 assignment 写入口、锁后权威重读、PostgreSQL 并发测试和最新 backend 运行时矩阵均已完成。最终差异审计额外发现的 UserService 反向锁序与 role delete 竞态也已按统一 `user → role → group` 合同修复并通过真实 PostgreSQL 交错。核心越权路径以及同根因回归已经形成技术闭环。

### 10.2 运行时证据

- membership 删除前，group assignment 对 Wiki 与共享文件正常放行；删除后原 session、新 session、session touch 均返回真实 403。
- tenant assignment 不依赖 membership；expired assignment 被拒绝；多组仅撤销目标组；rejoin 不恢复旧 assignment。
- UI Console 中的 403 已逐 URL 归因：删除前为最小权限账号访问首页无权模块，删除后 `/api/files*` 为本事件预期拒绝。
- failed request、未解释 HTTP 5xx、后端异常均为 0。
- authorization 保持 `enforced / epoch=1`，superadmin 未变化，active orphan group assignments 为 0。
- 本轮 run 用户、角色、assignment、membership 均为 0。

证据目录：`test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/`，包括 `result.json`、`session-matrix.json`、`ui-result.json`、`cleanup.json`、`fixture-manifest.json`、`concurrency-regression.json` 与数据库前后快照。

### 10.3 唯一未通过项

`result.json` 的唯一失败检查为 `all remediation groups cleaned`。数据库仍有历史整改 groups `11..15`；它们可追溯到本事件前序 run，但产品不存在 delete/archive/purge。直接 SQL 清理不在已授权范围内，因此不得为了把计数改成 0 而绕过产品合同。

解除条件：产品提供可审计清理入口，或用户明确批准只对已核验 groups `11..15` 做受控精确清理并保留前后快照。解除前，事件只能为 `BLOCKED`。

### 10.4 最终影响审计

本节原检查点使用的旧索引尚未识别新增锁服务，不能作为最终影响分母；最终结果以 10.6 重建索引后的数据为准。`git diff --check` 通过。

### 10.5 分层门禁结算

- L1/L2/L3 中与本事件及其影响链相关的代码、数据库、拒绝层级、模块和运行时场景均已通过。
- L4 实时全量 `275+78` 是发布候选版关闭门禁，不要求每轮 P0 返修重复执行；本报告不声称本轮已重跑 L4。
- 当前结论应表述为：**核心缺陷技术闭环完成，事件级清理闭环 BLOCKED**。

### 10.6 最终证据校正

- 2026-07-14 03:11 重新执行授权影响集群与完整后端，实际分母为 PostgreSQL/Testcontainers `18/18`、授权影响集群 `117/117`、完整后端 `315/315`，全部 failure/error/skipped 为 0。
- GitNexus 索引已重建为 9,991 nodes / 21,715 edges / 300 flows；最新结论为 20 个已跟踪变更文件、90 个 changed symbols、9 条 affected processes、aggregate risk `HIGH`。新增 `AuthorizationWriteLockService` 影响为 `MEDIUM`（13 个上游、8 个直接消费者）。
- `result.json` 中误存的 JWT 已脱敏为布尔通过标记；最终摘要写入 `final-reverification.json`。
- 运行栈存在非本事件引入的混合 checkout 标签：backend 来自当前工作区，frontend/Nginx/Redis 标签指向旧 iCloud checkout，PostgreSQL 标签来自 `docker-compose.yml`。该事实不改变本次 backend 授权运行时结论，但发布级 L4 前必须重新冻结为单一来源。

## 11. AC-012 单项复跑与事件关闭（2026-07-14）

`REM-P1-001` 经用户批准使用产品 API archive groups `11..15` 后，本事件仅复跑 `AC-012`。机器结果 `10/10 PASS`：run 用户、角色、assignment、membership、session 均为 0；五组均已归档；active orphan assignment 为 0；authorization 为 `enforced:1`；superadmin 指纹不变。

证据：`test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/ac-012-recheck/result.json`。P1 archive 审计 ID `7422..7426`，历史关系数量与 ID 边界不变。其余 AC 未重跑，只复核既有 PASS 证据；发布级 `275+78` 不属于本次事件关闭复验。最终结算：`PASS=14 / FAIL=0 / BLOCKED=0 / N/A=0`，事件状态 `CLOSED`。
