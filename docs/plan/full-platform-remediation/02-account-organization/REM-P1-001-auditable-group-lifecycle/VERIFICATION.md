# REM-P1-001 验证与证据矩阵

## 1. 文档合同

| 属性 | 值 |
|---|---|
| 事件 ID | `REM-P1-001` |
| 当前事件状态 | `CLOSED` |
| 当前验证状态 | `21 PASS / 0 FAIL` |
| 实际 runId | `REM_P1_001_20260714_1018_lint_fix` |
| 证据根目录 | `test-results/<runId>/REM-P1-001/` |
| 验收来源 | [SPEC.md](./SPEC.md) `AC-001..021` |

`NOT_RUN` 仅表示事件尚未开始实施或验证，不是最终用例结果。用例一旦执行，只能登记为 `PASS / FAIL / BLOCKED / N/A`；本事件合同中的必测项不得用 `N/A` 规避。每个 `FAIL` 必须关联缺陷与首次失败证据，每个 `BLOCKED` 必须写明解除条件。

## 2. 原始问题与证据

原始测试事实和修复后证据必须分开保存，不得覆盖或改写。

| 来源 | 标识 | 当前结论 | 证据 |
|---|---|---|---|
| 全量测试 run | `FQA_20260712_0329_lintfix` | 发现测试组无法通过产品能力精确清理 | `docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/` |
| 前序整改事件 | `REM-P0-001` | 核心授权缺陷 PASS，事件因清理阻塞 | `../../01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/FINAL-SUMMARY-REPORT.md` |
| 前序关闭项 | `REM-P0-001 / AC-012` | `PASS`，P0 已 CLOSED | `../../01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/VERIFICATION.md` |
| 最新运行时证据 | `REM_P0_001_20260714_0254_lint_fix` | `54 PASS / 1 FAIL`，唯一失败为 groups `11..15` 仍活动 | `test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/cleanup.json` |

## 3. 结果规则

- `PASS`：预期全部成立，UI/API/数据库/审计/日志证据完整。
- `FAIL`：任一预期不成立，立即登记缺陷并保存首次失败证据。
- `BLOCKED`：环境、审批或外部条件阻塞，记录解除条件且不得伪造执行。
- `N/A`：当前版本合同明确不适用，必须有源码或产品证据；本 SPEC 的关闭项原则上不接受 `N/A`。
- 401 不能代替 403；UI 隐藏不能代替直接 API 反向验证；当前数据库无某类引用不能代替构造夹具。

## 4. AC 追溯矩阵

| AC | Case ID | 测试层 | 核心断言 | 预期证据 | 初始结果 |
|---|---|---|---|---|---|
| `AC-001` | `GLC-ARC-001` | L1 | active 空 business group preflight eligible；archive 后 `is_deleted/deleted_at/deleted_by/updated_at/updated_by` 落库 | `api/archive-empty.json`、`db/archive-empty.json`、audit | `NOT_RUN` |
| `AC-002` | `GLC-ARC-002..004` | L1 | built-in、unassigned、cross-tenant 分别拒绝，目标与审计均无变化 | 三类 API/DB before-after | `NOT_RUN` |
| `AC-003` | `GLC-AUTH-001..003` | L1 | 缺 permission、group scope、expired assignment 分别真实 403；不泄露跨租户对象 | session、assignment、response、DB | `NOT_RUN` |
| `AC-004` | `GLC-REF-001..022` | L1/L2 | SPEC 5.2 每个 active blocker 独立返回稳定 key、count、reasonCode 和 resolution | `reference-blocker-matrix.json` | `NOT_RUN` |
| `AC-005` | `GLC-ARC-005` | L1 | blocked archive 不修改 group/reference/audit；成功 archive 不级联修改任何引用 | transaction before-after、audit count | `NOT_RUN` |
| `AC-006` | `GLC-CON-001..002` | L1 | archive 与每类直接 FK writer 的 writer-first/archive-first 交错无归档组活动引用 | PostgreSQL 并发测试、锁序日志 | `NOT_RUN` |
| `AC-007` | `GLC-CON-003..004` | L1/L2 | membership/primary group/assignment writer 与 archive 两种交错一致 | PostgreSQL 并发测试、关系快照 | `NOT_RUN` |
| `AC-008` | `GLC-CON-005..006` | L1/L2 | owner、ACL、`visibleGroups`、运维规则 JSON writer 与 archive 两种交错一致 | 参数化 trigger 测试、DB 快照 | `NOT_RUN` |
| `AC-009` | `GLC-AUD-001..002` | L1 | 成功 audit 含 before/after/reference hash；audit insert 失败整体回滚 | audit JSON、rollback integration test | `NOT_RUN` |
| `AC-010` | `GLC-ARC-006` | L1 | 重复 archive 返回 `changed=false` 且不重复成功审计 | 两次响应、audit count | `NOT_RUN` |
| `AC-011` | `GLC-RST-001..004` | L1/L2 | restore 只恢复 group；Active 重复 restore、code/version 冲突 409；不恢复关系 | API、关系 before-after、audit | `NOT_RUN` |
| `AC-012` | `GLC-ACT-001..004` | L2/L3 | archived group 不出现在 active list/选择器，不参与 permission/scope/ACL | UI、API、授权裁决、DB | `NOT_RUN` |
| `AC-013` | `GLC-HIS-001..004` | L2/L3 | 历史日报、结束任务、过往排班、审计仍显示名称并标记 archived | 页面/API/导出证据 | `NOT_RUN` |
| `AC-014` | `GLC-WRT-001..N` | L1/L2 | SPEC 4.3 所有应用 writer 与 DB trigger 拒绝 archived/missing/cross-tenant/non-business group，错误为 `GROUP_REFERENCE_INACTIVE` | writer/trigger 参数化矩阵 | `NOT_RUN` |
| `AC-015` | `GLC-PRG-001..005` | L1/L2 | purge 缺 permission/scope、未达保留期、历史引用、catalog drift 均拒绝且无变化 | API、catalog、DB、audit count | `NOT_RUN` |
| `AC-016` | `GLC-PRG-006` | L1 | 独立零引用 purge 夹具物理删除；audit 保留；restore 404/409 | API、DB row=0、audit | `NOT_RUN` |
| `AC-017` | `GLC-UI-001..008` | L1/L3 | UI loading/blocker/cancel/confirm/409 refresh/archive/restore/purge visibility 与稳定 testId | screenshot、trace、network、console | `NOT_RUN` |
| `AC-018` | `GLC-CLN-001` | L1/L3 | 新 runId 活动对象/session/MinIO 为 0；软删除组登记且零活动引用；purge 夹具物理行=0；非测试状态不变 | manifest、cleanup、baseline diff | `PASS`（修复后；历史 incident 已披露并接受） |
| `AC-019` | `GLC-HISGRP-001` | 受控操作 | 经明确授权后只用产品 API archive groups `11..15`；历史 membership/assignment 数量不变 | 五组 preflight/archive/audit/DB 快照 | `PASS`，审计 `7422..7426` |
| `AC-020` | `GLC-P0-001` | 前序复验 | `REM-P0-001 / AC-012` 只复跑清理断言并 PASS；复核 P0 其他既有门禁仍有效并由 P0 独立关闭 | P0 新 evidence、既有门禁复核与文档回写 | `PASS`，`10/10`；P0 已 CLOSED |
| `AC-021` | `GLC-GOV-001` | L3 | GitNexus 影响仅含预期流程；未解释 5xx/Console/backend exception=0 | `gitnexus-audit.md`、日志汇总 | `NOT_RUN` |

最终事件结算：`PASS=21 / FAIL=0 / BLOCKED=0 / NOT_RUN=0 / N/A=0`。`AC-001..021` 均为 `PASS`；`AC-018` 为修复后通过，历史 incident 已披露并经用户明确接受。

`AC-018` 历史 incident 证据为 `test-results/REM_P1_001_20260714_1018_lint_fix/REM-P1-001/final-verification-summary.json` 与 `ac-018-invariants.json`：旧启动默认值曾触发全量会话注销。后续 session epoch 修复保留 Redis session key，并在 backend-only 重启前后验证 session 集合与非测试授权/ACL 行级指纹不变。2026-07-14 用户明确接受不可恢复的既有会话失效作为残余风险，故本事件将该验收项结算为“修复后 `PASS`，incident 已披露”。

`AC-019` 的解除条件：`AC-001..018`、`AC-021` 和 L1-L3 全部 PASS，保存 groups `11..15` 产品 preflight 与操作前快照，并由用户再次明确批准 archive。`AC-020` 只能在 `AC-019` PASS 后执行。

## 5. Reference 分母验证

### 5.1 Archive active blocker

必须逐类构造唯一活动引用，不得将多类引用混在一个用例中：

`leaders`、`primaryUsers`、`memberships`、`roleAssignments`、`openDailyReports`、`devices`、`deviceCredentials`、`openOpsTasks`、`currentFutureRosters`、`enabledOpsRules`、`runningWorkflowLinks`、`wikiSpaceOwners`、`wikiPageOwners`、`sharedFolderOwners`、`sharedFileOwners`、`resourceAcls`、`wikiPageAcls`、`wikiSpaceAcls`、`sharedFolderAcls`、`sharedFileVisibleGroups`。

每类断言：preflight count 恰当、blocker 独立、reasonCode 稳定、archive 409、group/reference/audit 无变化、解除引用后重新 preflight eligible。

### 5.2 Purge 历史引用

Purge 必须分别覆盖：直接 FK、软删除 membership/assignment/ACL、owner group、JSON groupId、Flowable runtime/history identity link、identity membership、privilege mapping、audit 例外和完整 versioned reference registry drift。除 `audit_log` 外任一引用非零都必须阻止 purge。

### 5.3 Writer 分母

SPEC 4.3 每个 writer 都执行：合法 Active 同租户、Archived、Missing、Cross-tenant、Non-business；支持 UPDATE 的入口再验证从合法组改向非法组。应用层与数据库 trigger 必须给出一致业务合同，且不得出现 HTTP 500。

## 6. 分层验证节奏

### L1：事件定向门禁

1. V72 从 V71 升级、permission/索引/函数/trigger 存在且不改现有 group 数据。
2. lifecycle service 的 preflight/archive/restore/purge 状态机、权限、scope、tenant、version、幂等和审计原子性。
3. PostgreSQL 参数化 trigger 与 writer-first/archive-first 并发矩阵。
4. UI preflight loading、blocker、取消、确认、409 刷新、归档和恢复。
5. 新 runId 夹具精确清理与前后基线一致。

L1 任一 FAIL，立即保存首次失败证据并停止扩大回归。

### L2：根因聚类回归

- primary user、membership、group assignment；
- Wiki/SharedFile owner、ACL、`visibleGroups`；
- Daily、Device、Credential；
- Ops task、roster、rule JSON；
- Workflow runtime/history；
- restore 不恢复历史关系；
- purge 历史引用和 schema inventory drift。

### L3：受影响模块回归

- Groups、User、RBAC、Authorization；
- Wiki、SharedFile；
- Daily、Workflow；
- Device、Ops Calendar；
- Audit、历史名称展示、active-only 选择器；
- 稳定页面 Console、network、backend log。

### L4：发布候选版门禁

完整主功能 `275` + 状态/跨模块 `78` 按发布候选版本实时分母执行。L4 是版本级门禁，不用其他层结果代替，也不为关闭本事件伪造执行。

## 7. UI/API/数据库联合断言

每条可由用户触发的 lifecycle 用例至少保存：

1. 从登录首页进入用户组页面的真实 UI 点击路径；
2. 控件可见性、loading/disabled/error/success 状态；
3. 直接路由和直接 API；
4. permission、assignment scope/expiry、authorization mode/epoch；
5. HTTP 状态、`errorCode/reasonCode` 和响应摘要；
6. group、reference、audit 的数据库前后快照；
7. Console error、失败请求和后端异常；
8. 清理结果与非测试数据一致性。

## 8. Evidence 目录合同

```text
test-results/<runId>/REM-P1-001/
├── environment.json
├── fixture-manifest.json
├── coverage.json
├── api-summary.json
├── reference-blocker-matrix.json
├── writer-trigger-matrix.json
├── concurrency-matrix.json
├── permission-scope-matrix.json
├── audit-matrix.json
├── db-before.json
├── db-after.json
├── cleanup.json
├── gitnexus-audit.md
├── logs/
└── ui/
```

报告只引用相对路径和脱敏摘要。密码、token、cookie、Authorization header 和个人敏感资料不得进入证据。

## 9. groups 11..15 受控归档验证

该步骤不是普通测试夹具清理，未获授权前保持 `BLOCKED`：

1. 使用产品 preflight 分别保存五组的 group snapshot、active/historical counts、blockers 和 snapshotHash。
2. 核对 ID、tenant、code/name、`groupType=business`、`builtin=false` 和 leader；发现漂移立即停止。
3. 核对所有 active blocker 为 0；不得为归档而修改非测试引用。
4. 保存软删除 membership/assignment 的数量与 ID 摘要。
5. 向用户报告 preflight 并请求明确 archive 授权。
6. 获批后逐组调用产品 archive API，每组成功后立即登记 auditId 和 manifest。
7. 核对 group 软删除元数据、活动列表不可见、历史关系数量完全不变；禁止 purge。
8. 只重新执行 `REM-P0-001 / AC-012`，不重跑 P0 其他用例；同时复核其既有 PASS 证据和全部关闭门禁仍有效，再在 P0 事件文档中独立形成关闭结论并更新总索引。

## 10. 清理与恢复

- 所有新对象使用本次 runId，创建成功后立即登记 manifest。
- 按引用依赖逆序撤销新 assignment、membership、ACL、资源和用户会话。
- 普通 archive/restore 夹具通过产品 API 恢复或清理；purge 只处理专用零引用夹具。
- 不直接 SQL 清理 groups `11..15` 或授权关系，不执行全局 session 清理。
- 最终断言 runId active objects/session/MinIO object 为 0；archive/restore 产生的软删除 group 行全部登记且活动引用为 0；独立 purge 夹具物理行=0。
- superadmin 全字段、authorization mode/epoch、非测试角色权限、membership、assignment 和资源 ACL 与前快照一致。

## 11. 关闭门禁

只有以下全部成立才可将事件标记为 `CLOSED`：

1. `AC-001..021` 全部 PASS，`NOT_RUN/FAIL/BLOCKED=0`；
2. V72、PostgreSQL trigger 和并发矩阵 PASS；
3. L1/L2/L3 PASS；
4. groups `11..15` 经用户批准并通过产品 archive，历史关系未改变；
5. `REM-P0-001 / AC-012` 复跑 PASS；
6. 新 runId 清理 100%；
7. GitNexus `detect_changes`、`git diff --check` 和相关构建/测试通过；
8. 未解释 HTTP 5xx、Console error、backend exception 为 0；
9. superadmin、非测试授权/ACL 和 authorization mode/epoch 未改变；
10. [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)、事件卡与总索引已同步。
