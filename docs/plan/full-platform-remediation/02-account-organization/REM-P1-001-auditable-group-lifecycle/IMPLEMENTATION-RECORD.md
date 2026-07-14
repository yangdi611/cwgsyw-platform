# REM-P1-001 实施记录

> 本文件为追加式事件台账。不得覆盖历史检查点；每次实施、验证、失败、状态变化和高风险操作授权都追加记录。

## 1. 当前状态

| 属性 | 当前值 |
|---|---|
| 事件状态 | `IN_PROGRESS` |
| 实施状态 | `PHASE_A_COMPLETE` |
| 验证状态 | `NOT_STARTED` |
| 当前门禁 | Phase B：V72 数据保护 |
| 历史组操作 | `PASS`：经用户授权仅 archive groups `11..15`，审计 `7422..7426` |
| 最近更新 | 2026-07-14 |

## 2. 事件来源

- 源全量测试：`FQA_20260712_0329_lintfix`。
- 前序事件：`REM-P0-001`。
- 前序阻塞：`AC-012` 测试夹具逆序清理。
- 最新证据：`test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/cleanup.json`。
- 当前结论：P0 核心授权缺陷已技术闭环；groups `11..15` 因没有产品 archive/delete/purge 能力而保持活动，前序事件不能 `CLOSED`。

## 3. 已完成的只读基线

### 2026-07-14 文档建档

完成内容：

1. 创建独立事件目录 `REM-P1-001-auditable-group-lifecycle`。
2. 固化 PRD、实施 SPEC、验证矩阵和 Claude Code 执行入口。
3. 只读核验 groups `11..15` 均为 tenant `default` 的非内置 `business` group，均无 leader，活动引用为 0。
4. 只读核验 group 12 历史软删除 membership 2、assignment 2；group 13 历史软删除 membership 35、assignment 39；其他三组无历史 membership/assignment。
5. 只读核验五组在共享文件 `visible_groups`、启用运维规则、Flowable runtime/history group link 中均为 0；新发现的 `act_id_membership` 和 `act_id_priv_mapping` 尚待 Phase A 补做只读计数。
6. 只读核验当前 `sys_group` 直接 FK 六类：`daily_report`、`device`、`sys_user`、`ops_schedule_task`、`ops_duty_roster`、`sys_user_group_membership`。

本检查点未修改业务代码、数据库、容器或测试数据，未执行 archive/restore/purge，未提交 Git。

## 4. GitNexus 基线

| 目标 | 方向 | 风险 | 已知影响 |
|---|---|---|---|
| `GroupMapper` | upstream | `HIGH` | 15 个直接消费者、23 个上游符号；涉及 Org、Authorization、User、Wiki、SharedFile、Daily、Device、Ops Calendar 等 |

该结果只用于规划，不能代替实施前对每个实际修改 symbol 的最新 `impact`。实施者必须先确认索引 freshness，再对 Controller、Service、Mapper、validator、各 writer 和前端目标 symbol 分别运行 impact；`HIGH/CRITICAL` 先向用户告警并在本文件记录。

## 5. 已批准合同

1. UI “删除”统一改为“归档”。
2. Archive 复用 `sys_group.is_deleted/deleted_at/deleted_by`，不新增重复 lifecycle 状态列。
3. Archive 只改变 group 自身，不级联修改 membership、assignment、ACL、资源或业务数据。
4. 活动引用阻止 archive；已结束或软删除历史引用保留且继续可读。
5. Restore 只恢复 group 自身，不恢复旧关系。
6. Purge 仅限有效 `group:purge` + platform scope、达到保留期、除 audit 外零历史引用的 archived group。
7. group reference 应用 writer 与数据库 trigger 必须共同保证 Active 同租户 business group 不变量。
8. groups `11..15` 只 archive、永不 purge；必须先完成新功能 L1-L3，再向用户请求单独授权。
9. 归档完成后只复跑 `REM-P0-001 / AC-012`；发布候选版 L4 `275+78` 是独立门禁。

## 6. 预计实施范围

以下为 SPEC 允许范围，不代表可以跳过 impact 后直接修改：

- V72：permission、索引、Active group helper/trigger。
- Org：`GroupController`、`GroupService`/新 `GroupLifecycleService`、`GroupMapper`/新 lifecycle mapper、DTO/VO/error contract。
- Reference inventory：直接 FK、逻辑 owner/ACL、JSON 和 Flowable token 统计。
- Active reference validation：membership、primary group、assignment、Wiki/SharedFile owner/ACL、Daily、Device/Credential、Ops task/roster/rule、Workflow group token。
- Audit：archive/restore/purge 的 before/after/reference snapshot 与原子写入。
- Frontend groups page、API client、lifecycle dialog、archived tab 和稳定 `data-testid`。
- 真实 PostgreSQL 集成测试、后端 service/controller 测试、前端交互测试和本事件 evidence 脚本。
- 本事件五份文档与总 `INDEX.md`。

不得把 `BUG-FQA-016`、授权 cutover、break-glass、全租户模式切换、组织模型重构、无关 DTO/lint 或依赖升级混入本事件。

## 7. 实施 checkpoint

| Phase | 门禁 | 状态 | 实际结果/证据 |
|---|---|---|---|
| A | branch/commit/status、环境、schema/reference 分母、GitNexus query/context/impact | `PASS` | `lint-fix@5d3c5b6f`；Flyway V71；混合 compose 来源已冻结；GroupMapper HIGH 15 direct/23 upstream |
| B | V72 migration、permission/index/function/triggers、V71→V72 集成验证 | `IN_PROGRESS` | 执行中 |
| C | lifecycle API/service/inventory/audit/active writer validation | `NOT_STARTED` | 待追加 |
| D | frontend archive/archived/restore/purge UI 与 testId | `NOT_STARTED` | 待追加 |
| E | L1/L2/L3、构建部署、真实 UI/API/DB、清理、detect_changes | `NOT_STARTED` | 待追加 |
| F | groups `11..15` preflight、用户授权、产品 archive、P0 AC-012 复跑 | `PASS` | archive 审计 `7422..7426`；P0 AC-012 `10/10 PASS` |

## 8. 实际变更记录

当前无业务代码或数据库变更。实施开始后逐批追加：

| 时间 | 文件/符号 | 修改目的 | GitNexus risk | 验证 | 证据 |
|---|---|---|---|---|---|
| 2026-07-14 | 本事件文档 | 固化独立整改合同与执行入口 | 文档，不适用 symbol impact | 文档一致性校验 | 本目录 |
| 2026-07-14 | Phase A 只读冻结 | 提取 V71、FK/非 FK/JSON/Flowable reference 与运行容器来源 | `GroupMapper HIGH`；`GroupController LOW` | GitNexus index 9,991 nodes / 21,715 edges / 300 flows | 实施记录与命令输出 |

### 2026-07-14 Phase A 结论

- branch `lint-fix`，commit `5d3c5b6f`；保留 REM-P0-001 的 20 个已跟踪修改文件及新增锁/集成测试文件。
- backend 容器来自当前工作区 `docker-compose.dev.yml`；frontend/nginx/PostgreSQL/Redis 标签含旧 iCloud checkout，属于混合来源。真实 UI 验证前只用 `--no-deps` 替换 backend/frontend，不重启 PostgreSQL、Redis、MinIO、Nginx。
- PostgreSQL Flyway 为 V71。实时引用包含 6 个直接 FK、无 FK credential/assignment、4 个 owner、unified/legacy ACL、共享文件 JSON、运维规则 JSON，以及 Flowable runtime/history identity link、identity membership、privilege mapping。
- GitNexus 索引 commit 与当前 HEAD 一致。`GroupMapper` upstream impact 为 HIGH（15 direct、23 upstream）；范围落在 SPEC 已批准模块。`GroupController.list/create/update` 和类级 impact 为 LOW。
- 未修改 groups `11..15`、superadmin、authorization mode/epoch 或非测试授权/ACL。

## 9. 验证记录

当前未执行本事件代码验证。实施后每次命令按以下格式追加，不得只写“测试通过”：

| 时间 | 层级 | 命令/用例 | 结果统计 | 首次失败/证据 | 处理结论 |
|---|---|---|---|---|---|
| 待执行 | L1 | 待追加 | `NOT_RUN` | - | - |

### 2026-07-14 实施与验证结算

| 属性 | 结果 |
|---|---|
| 实际 runId | `REM_P1_001_20260714_1018_lint_fix` |
| V72 / PostgreSQL 定向 | `66 PASS / 0 FAIL` |
| 受影响集群 | `123 PASS / 0 FAIL` |
| 完整后端 | `386 PASS / 0 FAIL`；冻结复验 `439 PASS / 0 FAIL`（JDK 21） |
| 前端 | lint、typecheck、build 均 `PASS`；真实 UI `17 PASS / 0 FAIL` |
| 引用与并发 | archive blocker 23 类、purge reference 26 类、writer 20 类、并发交错 40 条均 `PASS` |
| 历史组 | groups `11..15` 仅经产品 API archive；审计 `7422..7426`；历史 membership/assignment 数量与 ID 边界不变 |
| 前序事件 | `REM-P0-001 / AC-012` 复跑 `10/10 PASS`，P0 已 `CLOSED` |
| AC 结算 | `PASS=20 / FAIL=1 / BLOCKED=0 / NOT_RUN=0` |

`AC-018` 为唯一失败：最终 backend 替换时，`AUTHORIZATION_INVALIDATE_SESSIONS_ON_STARTUP=true` 触发 `AuthSessionService.invalidateAllSessions()`，清除了 7 条 Redis 会话，其中包含无法从 retained evidence 精确证明属于本 run 的记录；同时未保存非测试授权/ACL 的完整运行前快照。详见 `test-results/REM_P1_001_20260714_1018_lint_fix/REM-P1-001/final-verification-summary.json` 和 `ac-018-invariants.json`。

后续预防修复已完成：`docker-compose.dev.yml` 与 `backend/src/main/resources/application.yml` 的启动全量注销默认值均改为 `false`，管理员仍可显式设置该环境变量为 `true`。影响分析为 `LOW`：`invalidateAllSessions()` 仅由启动监听器直接调用。JDK 21 下本轮 P1 定向集 `103/103 PASS`，`mvn -DskipTests package` 与 `git diff --check` 均通过。

事件状态更新为 `BLOCKED`，而非 `CLOSED`。解除条件：新隔离 runId 先保存会话与非测试授权/ACL 的权威前快照，验证 backend 替换不全量注销，精确清理 run 对象并重跑 `AC-018`。

### 2026-07-14 AC-018 预防修复复验

使用当前共享环境的全行级只读快照，连续执行两次 `docker compose -f docker-compose.dev.yml up --no-deps -d backend`；PostgreSQL、Redis、MinIO、Nginx 和 frontend 均未重启。两次启动均健康，日志为“已保留 Redis 会话，未递增全局会话 epoch”。

| 断言 | 结果 |
|---|---|
| Redis `auth:session:*` key 集合 | 前后 SHA-256 一致：`4807b24832b5ce7955c603ed9cb08d628722a91b6b5ade720de84c36f6a52a7c` |
| 全局 session epoch | 前后均不存在（初始 epoch `1`） |
| 非测试状态全行级指纹 | 前后 SHA-256 一致：`d0671323f35f6c63028d3c17eb9fe51f5c06d414e694bdd5cce10e513e5a8703` |
| 覆盖表 | `sys_role_permission`、`sys_user_group_membership`、`sys_user`、`sys_role_assignment`、`resource_acl_entry`、`wiki_page_acl`、`wiki_space_acl`、`shared_folder_acl` |
| 认证回归 | JDK 21：`AuthSessionServiceTest`、`SessionInvalidateOnStartupTest`、`JwtAuthFilterTest`、`AuthServiceTest` 全部 PASS |

显式 `AUTHORIZATION_INVALIDATE_SESSIONS_ON_STARTUP=true` 现在只会原子递增 Redis `auth:sessionEpoch`；新会话写入当前 epoch，旧会话下次请求被拒绝为 401，但 session key 保留到其 TTL 到期。旧 epoch 缺失时兼容初始 epoch `1` 的历史 session。

本复验证明问题不会再次发生，并补齐了当前窗口的权威前后快照；但不能恢复先前错误删除的会话。因此需由用户决定是否接受该已披露历史影响作为残余风险，并将 `AC-018` 由历史 `FAIL` 更新为“修复后 PASS（历史 incident 已记录）”，再关闭事件。

### 2026-07-14 用户风险接受与关闭

用户已明确接受历史全量会话注销 incident 的不可恢复影响作为残余风险。`AC-018` 结算为“修复后 `PASS`，incident 已披露”；`AC-001..021` 全部 `PASS`，事件状态更新为 `CLOSED`。P1 不替代发布候选版 L4 `275+78` 回归，该独立版本门禁仍为 `NOT_RUN`。

## 10. 数据变更与恢复记录

| 对象 | 动作 | runId/ID | 前快照 | 后快照 | 恢复/清理 |
|---|---|---|---|---|---|
| groups `11..15` | archive | 历史 P0 夹具 | 产品 preflight 与 DB 前快照 | 审计 `7422..7426`，历史关系不变 | `PASS`，仅 archive、未 purge |

所有新对象必须使用 `REM_P1_001_...` runId，并在创建成功后立即登记。不得事后补记或修改无法确认属于本批次的数据。

## 11. 风险与停止条件

- 发现 SPEC 未登记的 group FK、逻辑引用或 writer，先更新分母和测试合同再实施。
- impact 扩大到未批准核心模块，停止并请求确认。
- 需要自动迁移或修改非测试业务引用才能 archive，停止。
- archive/restore/purge 出现部分成功、未解释 5xx、审计缺失、死锁或孤儿引用，立即 FAIL 并保留首次证据。
- 需要直接 SQL 修改 groups `11..15`、全租户切换、restore、全局 session 清理或 break-glass，停止并请求明确授权。
- groups `11..15` preflight 发生任何身份、授权、ACL 或未结束业务 blocker 漂移，停止，不为归档而自动清理。

## 12. 最终关闭记录

事件尚未达到关闭条件。最终关闭时必须追加：

- `AC-001..021` 结算；
- L1/L2/L3 统计与证据根目录；
- groups `11..15` 授权时间、操作者、archive auditId 和关系不变证明；
- `REM-P0-001 / AC-012` 复跑结果；
- runId 清理、superadmin/非测试授权与 ACL 一致性；
- GitNexus `detect_changes`、构建和 `git diff --check`；
- 残余风险、回滚状态和最终批准。
