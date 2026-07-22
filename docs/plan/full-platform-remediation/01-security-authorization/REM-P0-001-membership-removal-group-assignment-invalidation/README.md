# REM-P0-001：membership 移除后 group assignment 立即失效

| 属性 | 值 |
|---|---|
| 事件 ID | `REM-P0-001` |
| 优先级 | P0 |
| 领域 | 安全与统一授权 |
| 状态 | `CLOSED` |
| 创建日期 | 2026-07-13 |
| 来源 runId | `FQA_20260712_0329_lintfix` |
| 根因聚类 | 授权关系生命周期与运行时有效性漂移 |
| 下一门禁 | 事件已关闭；发布候选版另执行 L4 `275+78` |

## 一句话说明

用户的组成员关系被移除后，指向该组的 group-scoped role assignment 仍被运行时当作有效授权来源，使原会话和新会话继续读取 Wiki；这是持续越权，不是单纯 token 缓存。

## 用户与业务影响

- 已离组用户仍可能保留该组授予的功能 permission、group scope 和资源访问能力。
- 新登录仍放行，说明重新认证不能解除风险。
- 同一有效 assignment 查询链被 Wiki、共享文件、登录权限集合和资源级裁决使用，影响面跨授权、组织、Wiki、共享文件和会话。
- P0 未关闭前，不应把统一授权整改视为可发布状态。

## 来源追溯

| 类型 | 标识 / 路径 |
|---|---|
| 缺陷 | `BUG-FQA-017`，见原运行 [defects.md](../../../../acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md) |
| 主功能用例 | `RBAC-026` |
| 状态/跨模块用例 | `XL-RBAC-002`、`XL-RBAC-006`、`XL-RBAC-009` |
| 原始证据 | `test-results/FQA_20260712_0329_lintfix/RBAC-026-membership-removal/result.json` |
| 执行台账 | [unique-case-ledger.md](../../../../acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/unique-case-ledger.md)、[state-cross-module-ledger.md](../../../../acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/state-cross-module-ledger.md) |

原始复现夹具 ID 为 membership `55`、assignment `63`。夹具已通过产品 API 清理，仅用于证据追溯，不得复用或直接修改。

## 本事件范围

- 统一定义 group assignment 的运行时有效性：必须同时满足 assignment 本身有效、目标组有效、用户对 scopeId 存在活动 membership。
- 使功能权限集合、最高 scope、角色 ACL 来源和资源级 `ScopedPermission` 裁决采用同一规则。
- 保证 membership 移除后，原 JWT 会话、新登录会话和刷新后的会话从下一次请求起均不能继续使用该 group assignment。
- 覆盖主组 membership、非主组 membership、多组、多角色、有效期和 tenant assignment 不受影响等回归。
- 保留 membership 删除与 assignment 后续显式撤销之间的可审计关系。

## 非目标

- 不把 `BUG-FQA-016` 的成员列表软删除显示问题混入本事件。
- 不改变 tenant/platform assignment 的有效性语义。
- 不修改 legacy role、authorization mode、cutover epoch 或 break-glass 合同。
- 不通过全局 session 清空实现权限失效。
- 不在本事件中批量删除历史孤儿 assignment；历史数据治理若需要，另建事件并审批迁移方案。

## 关键决策

目标采用运行时防御为必选、写路径收敛为可选增强的策略：

1. 所有有效 assignment 查询必须在读取时排除没有活动 membership 的 group assignment，确保即使历史或竞态产生孤儿记录也不会授权。
2. membership 删除事务可以把匹配的 group assignment 标记失效/撤销并写审计，但不得以此替代运行时校验；是否物理收敛须在实施前确认产品历史保留合同。
3. 不以撤销所有用户 session 作为正确性前提。当前 `JwtAuthFilter` 每次请求都会重新加载 `SecurityUser`，修正有效 assignment 查询后旧会话应自然获得最新权限。

## 风险告警

GitNexus 评估 `RoleAssignmentMapper.findEffectiveRoleIds` 为 `CRITICAL`：17 个上游符号、4 条执行流程、6 个模块受影响；`ScopedPermissionMapper.findAssignments` 为 `HIGH`，影响授权、Wiki 和共享文件。详见 [SPEC.md](./SPEC.md) 的影响分析。

2026-07-13 复验确认核心越权路径已被阻断，但 L1 为 `51 PASS / 3 FAIL`：软删除元数据未落库，旧主组兼容分支仍未收敛 assignment，且前序测试组清理仍受产品删除能力阻塞。事件保持 `IN_PROGRESS`，不得关闭。详见 [REVERIFICATION-REPORT.md](./REVERIFICATION-REPORT.md)。

2026-07-14 第二轮复验：主 L1 `53 PASS / 1 FAIL`，组管理入口 `14/14 PASS`，有界审计 `21/21 PASS`。但主组 NULL 未落库、更新行数未校验、并发串行化未实现，`unassigned` 使用非权威 `code` 字段，PostgreSQL 等价矩阵和旧主组隔离测试缺失，且活动整改组已累积为 `11..15`。事件仍为 `IN_PROGRESS / FAIL`，不能闭环。

2026-07-14 最终独立复验：Claude 遗留的 assignment add、migration、cutover、relationship cleanup 与 legacy compatibility 写入口已纳入统一 advisory transaction lock 和锁后权威重读合同；最终差异审计又发现并修复 `UserService.update/delete` 反向锁序和 role delete × assignment writer 竞态。锁序统一为 `user → role → group`。PostgreSQL/Testcontainers `18/18 PASS`、拒绝层级 `13/13 PASS`、授权相关集群 `117/117 PASS`、完整后端 `315/315 PASS`。最新 backend 的 L1-B 为 `54 PASS / 1 FAIL`，唯一失败是历史整改 groups `11..15` 没有产品 delete/archive/purge；核心越权缺陷与相关回归已形成技术闭环，事件状态改为 `BLOCKED`，不能标 `CLOSED`。详见 [FINAL-SUMMARY-REPORT.md](./FINAL-SUMMARY-REPORT.md)。

最终证据摘要：`test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/final-reverification.json`。运行证据已移除误存 JWT；发布级 L4 前需把当前混合 checkout 容器标签重新冻结为单一工作区来源。

2026-07-14 闭环复验：`REM-P1-001` 完成可审计 group lifecycle 后，经用户批准仅通过产品 API 归档 groups `11..15`，审计 ID `7422..7426`；历史 membership/assignment 数量与 ID 边界不变。随后只复跑 `AC-012`，10/10 PASS，authorization 保持 `enforced:1`，superadmin 指纹不变，active orphan assignment、P0 session 与本事件活动对象均为 0。事件状态正式更新为 `CLOSED`。证据：`test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/ac-012-recheck/result.json`。

## 依赖与关联事件

- 依赖：稳定的 runId 测试用户、业务组、只读角色、Wiki/共享文件资源夹具和产品级清理能力。
- 关联但不阻塞：`BUG-FQA-016` 应另建成员列表一致性事件。
- 发布门禁：本事件定向、根因聚类与受影响模块回归已通过；发布候选版本仍需执行实时全量 `275+78`，该 L4 不冒充本轮事件复验结果。

## 目录导航

- [SPEC.md](./SPEC.md)：目标合同、影响范围、实施步骤、回滚与验收。
- [VERIFICATION.md](./VERIFICATION.md)：原始证据、验收项与分层复查矩阵。
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)：交给 Claude Code 的事件专用执行入口。
- [CLAUDE-CODE-REWORK-PROMPT.md](./CLAUDE-CODE-REWORK-PROMPT.md)：从 2026-07-13 复验 FAIL 检查点继续的第二轮返修入口。
- [CLAUDE-CODE-REWORK-ROUND3-PROMPT.md](./CLAUDE-CODE-REWORK-ROUND3-PROMPT.md)：从第二轮 `FAIL/INCOMPLETE` 结论继续的第三轮返修入口。
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)：后续实施、验证与关闭的追加式记录。
- [REVERIFICATION-REPORT.md](./REVERIFICATION-REPORT.md)：2026-07-13 独立复验结果、缺口和返修门禁。
- [FINAL-SUMMARY-REPORT.md](./FINAL-SUMMARY-REPORT.md)：2026-07-14 第三轮核心修复复验、剩余关闭门禁与最终结论。
- [整改总索引](../../INDEX.md)：所有事件状态和下一门禁。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
