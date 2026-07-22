# REM-P1-001 可审计用户组生命周期

## 事件卡

| 属性 | 值 |
|---|---|
| 事件 ID | `REM-P1-001` |
| 标题 | 可审计用户组归档、恢复与清除能力 |
| 优先级 | P1 |
| 领域 | 账号与组织 |
| 状态 | `CLOSED` |
| 实施状态 | `IMPLEMENTED_AND_ACCEPTED` |
| 负责人 | 待分配 |
| 创建时间 | 2026-07-14 |
| 更新时间 | 2026-07-14 |
| 根因聚类 | 组织对象缺少生命周期与引用收敛合同 |
| GitNexus 风险 | `HIGH`：`GroupMapper` 15 个直接消费者、23 个上游符号 |

## 一句话问题

用户组管理页面已经展示“删除”操作并调用 `DELETE /api/groups/{id}`，但后端没有对应生命周期入口，也没有引用预检、并发隔离、软删除元数据、审计、恢复或清除合同，导致测试组和业务组都无法通过产品能力安全退出。

## 用户影响

- 管理员点击删除只能得到失败，无法判断被哪些成员、授权、资源或业务数据阻塞。
- 测试产生的空组无法通过产品接口清理，`REM-P0-001 / AC-012` 因 groups `11..15` 长期保持 `BLOCKED`。
- 如果仅补一个直接 DELETE，可能破坏 membership、primary group、group assignment、Wiki/共享文件 ACL、日报、设备、运维日历和 Workflow 的引用一致性。
- 没有恢复和审计合同时，误操作无法安全撤回，也无法回答“谁在何时因为什么处理了哪个组”。

## 来源与追溯

| 来源 | 标识 | 说明 |
|---|---|---|
| 全量测试 run | `FQA_20260712_0329_lintfix` | 当前版本全面功能测试来源 |
| 前序整改事件 | `REM-P0-001` | membership 移除后 group assignment 失效 |
| 前序关闭项 | `AC-012` | 测试夹具逆序清理与非测试状态一致性 |
| 最新运行时 run | `REM_P1_001_20260714_1018_lint_fix` | `AC-001..021` 均 PASS；AC-018 incident 已披露并接受 |
| 运行证据 | `test-results/REM_P1_001_20260714_1018_lint_fix/REM-P1-001/final-verification-summary.json` | P1 完整运行与关闭结论 |
| 前序最终结论 | `01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/FINAL-SUMMARY-REPORT.md` | `REM-P0-001` 已 CLOSED；AC-012 复跑 10/10 PASS |

## 已批准产品决策

1. 页面上的“删除”改为明确的“归档”；归档使用 `sys_group.is_deleted/deleted_at/deleted_by`，不物理删除历史。
2. 归档前必须执行引用预检；归档事务在锁后再次预检，禁止以 UI 预检结果代替事务内裁决。
3. 归档不得级联删除、改写或搬迁日报、设备、运维任务、资源 owner、ACL、membership、assignment 或 Workflow 数据。
4. 活动身份、授权、访问控制和未完成业务引用阻止归档；已结束的历史业务记录可以保留，并继续显示归档组名称。
5. 恢复只恢复 group 自身，不恢复旧 membership、primary group、assignment、ACL 或资源归属。
6. Purge 是独立的不可逆操作，只允许已归档、达到保留期且除审计外所有历史引用为 0 的组执行。
7. groups `11..15` 只执行 archive，不执行 purge；其历史软删除 membership/assignment 必须保留用于追溯。
8. `REM-P1-001` 自身通过完整 L1-L3 后，才允许对 groups `11..15` 执行受控归档；归档完成后，`REM-P0-001` 只复跑 `AC-012`。

## 实时基线

2026-07-14 只读数据库核验：groups `11..15` 均为 tenant `default` 的非内置 `business` group，均无 leader，当前活动引用全部为 0。

| Group ID | 活动引用 | 历史 membership | 历史 group assignment | 目标动作 |
|---:|---:|---:|---:|---|
| 11 | 0 | 0 | 0 | archive |
| 12 | 0 | 2 | 2 | archive，禁止 purge |
| 13 | 0 | 35 | 39 | archive，禁止 purge |
| 14 | 0 | 0 | 0 | archive |
| 15 | 0 | 0 | 0 | archive |

补充核验：五个组在共享文件 `visible_groups`、启用的运维规则、Flowable runtime/history group identity link 中的计数均为 0。Flowable identity membership 和 privilege mapping 是本事件新增发现的 purge/archive 分母，实施 Phase A 必须补做五组只读计数，不得沿用旧快照推定为 0。

## Scope

- 用户组 lifecycle preflight、archive、restore、purge API 与服务合同。
- 用户组列表的 active/archived 状态筛选和归档 UI。
- 统一的 group reference inventory，覆盖直接外键、逻辑引用、JSON 引用和 Workflow group token。
- 数据库级活动组引用保护和 archive/writer 并发串行化。
- `group:delete` 归档权限和新增 `group:purge` 权限。
- 完整的 before/after/reference snapshot 审计及事务回滚。
- 归档组的历史名称展示，不允许归档组重新参与授权或新业务写入。
- 用新 runId 测试夹具验证，再经明确批准归档 groups `11..15`。
- 更新 `REM-P0-001 / AC-012` 并形成双向追溯。

## Non-Goals

- 不把 membership 列表软删除展示缺陷 `BUG-FQA-016` 混入本事件。
- 不自动迁移成员、授权、资源、日报、设备、任务或 Workflow。
- 不修改授权 Enforce/Rollback、cutover epoch 或 account rollout。
- 不物理清除 groups `11..15`。
- 不改变历史日报、已结束运维任务或审计记录的业务含义。
- 不在本事件中重构所有模块的组选择控件或组织模型。
- 不以本事件验证替代发布候选版 L4 `275+78`。

## 关键依赖

- `REM-P0-001` 当前未提交的授权写锁与 effective-assignment 修复必须保留，不得覆盖。
- Flyway 当前最新版本为 V71；实现预计新增 V72。
- `sys_group` 已继承逻辑删除字段，可复用而无需新增 lifecycle 状态列。
- 审计复用 `audit_log`；Purge 权限需要扩展 `group` resource/action。
- 真实 PostgreSQL 集成测试用于验证行锁、触发器、事务回滚和并发交错。

## 风险与门禁

- `GroupMapper` 影响为 `HIGH`，实现前必须重新运行 GitNexus impact 并记录。
- 任何未纳入 reference inventory 的 group writer 都可能在 archive 并发中制造新引用，属于关闭阻断项。
- 任何自动级联删除业务数据、直接 SQL 清理 groups `11..15`、Purge 仍有历史引用的实现都必须停止。
- 实施、定向回归和模块回归未完成前，不得操作历史 groups `11..15`。
- 操作 groups `11..15` 前必须保存 preflight、数据库前快照并获得用户明确批准。

## 关闭结论与后续门禁

`REM_P1_001_20260714_1018_lint_fix` 已完成 V72、L1-L3、真实 UI/API/数据库验证、groups `11..15` 的受控 archive（审计 `7422..7426`）以及 `REM-P0-001 / AC-012` 的 10/10 PASS 复跑。

`AC-018` 曾发生 incident：最终替换 backend 时，旧默认值 `AUTHORIZATION_INVALIDATE_SESSIONS_ON_STARTUP=true` 调用了全量会话注销，删除了无法从保留证据中精确归属的 Redis 会话；同时缺少部分非测试授权/ACL 的权威运行前快照。该问题已通过 session epoch 机制与默认值 `false` 修复，已删除会话不能安全重建。

2026-07-14 用户明确接受该历史 incident 作为残余风险：`AC-018` 记为“修复后 `PASS`，incident 已披露”，`REM-P1-001` 正式 `CLOSED`。发布候选版 L4 `275+78` 仍是独立版本门禁，未在本事件中执行。

预防修复复验：连续 backend-only 重启前后，Redis session key 集合和全部 P1 关注的非测试授权/ACL 行级指纹均一致，默认启动未递增 epoch。

## 文件导航

- [PRD.md](./PRD.md)：产品需求、用户流程和产品验收。
- [SPEC.md](./SPEC.md)：API、数据、并发、审计和实施合同。
- [VERIFICATION.md](./VERIFICATION.md)：`AC-*` 验证与证据矩阵。
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)：Claude Code 独立执行入口。
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)：追加式实施和验证记录。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
