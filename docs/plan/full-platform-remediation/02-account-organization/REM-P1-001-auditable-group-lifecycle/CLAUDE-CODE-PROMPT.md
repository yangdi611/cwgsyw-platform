# Claude Code Prompt：执行 REM-P1-001

> 使用方式：把本文件全文作为 Claude Code 的任务输入，并让它在项目根目录 `/Users/byron/AI/cwgsyw-platform` 运行。启动本 prompt 视为批准按本事件 PRD/SPEC 修改代码、增加 V72 和使用全新 runId 测试夹具；**不代表批准 archive groups `11..15`、Purge 非测试数据、直接 SQL 清理、提交 Git 或任何全租户高风险操作**。

你现在位于 `/Users/byron/AI/cwgsyw-platform`，要持续完成唯一整改事件：

`REM-P1-001：可审计用户组归档、恢复与清除能力`

这是实施与验证任务，不是调研或只写计划。请从现有事件 checkpoint 继续，完成 V72、后端、前端、自动化测试、L1-L3 真实验证、证据和文档回写；不要重新创建另一套 PRD/SPEC，不要扩展到其他整改事件。未达到对应门禁时，不得声称完成或把事件标记为 `CLOSED`。

## 0. 当前 checkpoint：从 READY 继续

当前事件目录：

`docs/plan/full-platform-remediation/02-account-organization/REM-P1-001-auditable-group-lifecycle/`

权威状态：

- 事件 `READY`，实施与验证均为 `NOT_STARTED`；
- PRD、SPEC、VERIFICATION 和本 Prompt 已固化；
- `GroupMapper` 已知 upstream impact 为 `HIGH`：15 个直接消费者、23 个上游符号；
- groups `11..15` 已只读确认是 tenant `default`、非内置 `business` 历史测试组，当前活动引用为 0；group 12/13 有必须保留的软删除 membership/assignment；
- 前序 `REM-P0-001` 核心授权缺陷已经 PASS，唯一阻塞是 `AC-012` 无产品能力精确清理上述历史组；
- 工作区存在 `REM-P0-001` 大量未提交修改，它们属于用户已有工作，必须完整保留，不得 reset、checkout、覆盖或擅自重构；
- 当前文档树可能被 `.gitignore` 的 `docs/*` 忽略，这不允许你漏写文档；本任务不 stage/commit。

先读取 [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)。若已有其他执行者追加实施或验证，从第一个未完成门禁继续；不要重做已有充分证据的步骤，不要覆盖追加式历史。

## 1. 必读顺序

开始任何编辑前，按顺序完整读取：

1. `AGENTS.md`
2. `CLAUDE.md`
3. `backend/AGENTS.md`、`backend/CLAUDE.md`（存在时）
4. `frontend/AGENTS.md`、`frontend/CLAUDE.md`
5. 所有拟修改文件所在更深目录的 `AGENTS.md` / `CLAUDE.md`
6. `docs/standards/code-quality-baseline-rules.md`
7. `docs/standards/code-review-checklist.md`
8. `docs/plan/full-platform-remediation/README.md`
9. `docs/plan/full-platform-remediation/INDEX.md`
10. 本事件 `README.md`
11. 本事件 `PRD.md`
12. 本事件 `SPEC.md`
13. 本事件 `VERIFICATION.md`
14. 本事件 `IMPLEMENTATION-RECORD.md`
15. 前序事件 `01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/FINAL-SUMMARY-REPORT.md`
16. 前序事件同目录 `VERIFICATION.md` 中 `AC-012`
17. `test-results/REM_P0_001_20260714_0254_lint_fix/REM-P0-001/cleanup.json`

读取完成后，先向用户报告：当前 checkpoint、最新 branch/commit、已有工作区改动、GitNexus freshness、实时 group reference 分母和你将修改的候选符号。不要停在报告阶段，若未触发停止条件就继续 Phase A。

## 2. 唯一目标与运行时不变量

实现一套可预检、可归档、可恢复、严格清除、事务原子、并发安全且可审计的用户组生命周期。

必须同时成立：

1. `ActiveGroupReference`：任何影响当前身份、授权、ACL、owner、数据范围或未结束业务的 group reference，只能指向同 tenant、`is_deleted=false`、`group_type='business'` 的 group。
2. `ArchiveNoCascade`：Archive 只软删除 group 自身，不级联撤销、迁移、删除或改写任何关系和业务数据。
3. `ArchiveSerializableWithReferenceWrite`：group reference writer 与 archive 共用 group 行锁；writer-first 时 archive 锁后能看到引用并返回 409，archive-first 时 writer 在解锁后拒绝，任何交错都不能留下指向 archived group 的活动引用。
4. `HistoryReadableNotEffective`：历史记录能显示 archived group 名称，但 archived group 不进入活动选择器、permission、highest scope、ACL 或新业务写入。
5. `RestoreNoRelationshipResurrection`：Restore 只恢复 group 行，历史 membership、primary group、assignment、ACL、owner 和业务关系不恢复。
6. `PurgeStrict`：只有 archived、达到保留期、有效 `group:purge` + platform scope、schema inventory 无漂移且除 audit 外所有活动/历史引用为 0 时才能物理删除。
7. `AuditAtomic`：archive/restore/purge 的状态变化和 audit 同事务；影响行数或 audit 插入不为 1 就整体回滚。

## 3. 已批准产品与技术决策

以下合同已决定，不得临场改成另一套设计：

1. UI “删除”改为“归档”；Archive 复用 `sys_group.is_deleted/deleted_at/deleted_by`，不新增 `status/archived` 重复字段。
2. Preflight 用于展示，执行事务必须锁 group 后重新计算；不得信任跨请求的旧 count 或 snapshotHash。
3. 活动身份、授权、ACL、owner 和未结束业务引用阻止 archive；已结束或软删除历史引用允许保留。
4. Restore 只恢复 group，不恢复任何历史关系；成功后再次对 Active group 调用 restore 必须返回 409 `GROUP_NOT_ARCHIVED`，不返回幂等成功。
5. Purge 默认保留期 30 天，只允许 platform scope；测试只能用隔离配置把保留期设为 0，不能篡改时间字段。
6. `group:delete` 用于 archive，`group:update` 用于 restore，V72 新增 `group:purge`；运行时按有效 permission + assignment scope/expiry 判定，不按固定角色名放行。
7. Break-glass 不得绕过 tenant isolation、protected group、reference blockers、retention、inventory drift、确认名称和版本检查。
8. 所有 reference 统计由唯一 `GroupReferenceInventoryService` 提供；Controller 不拼 SQL，archive 和 purge 不各维护一套分母。
9. group writer 应用层使用统一 `ActiveGroupReferenceValidator`；数据库 trigger 是并发和漏接入口的最终兜底。
10. Flowable 表不安装 lifecycle trigger；创建 runtime group token 的业务入口必须在同一事务中锁定并验证 group。runtime token 阻止 archive，history token只阻止 purge。
11. groups `11..15` 只 archive、永不 purge；本 Prompt 未授权执行它们的 archive。
12. L1-L3 全 PASS 后，先输出五组产品 preflight 和前快照，然后停止并请求用户明确授权；未获批准时 `AC-019/020` 保持 `BLOCKED`，事件不得 `CLOSED`。

若源码/schema 证明某项合同无法安全实现，停止并写明冲突、影响和备选方案；不得静默改变 PRD/SPEC。

## 4. 强制 GitNexus 和工作区门禁

1. 记录 branch、commit、`git status --short`、当前最新 Flyway version、运行镜像和容器来源；保留所有用户已有改动。
2. 读取 `gitnexus://repo/cwgsyw-platform/context` 或运行仓库规定的状态命令确认索引 freshness；过期则运行 `node .gitnexus/run.cjs analyze`。
3. 用 GitNexus `query` 探索 group CRUD、membership/assignment writer、owner/ACL、Daily、Device、Ops、Workflow、group selector 和 audit 流程。
4. 对实际候选 symbol 先用 `context` 获取 caller/callee。
5. **编辑任何函数、类或方法前**，对该 symbol 运行 upstream `impact`，把 direct callers、affected processes、modules 和风险追加到 `IMPLEMENTATION-RECORD.md`。
6. `HIGH/CRITICAL` 结果先向用户明确告警。若影响未超过 SPEC 已登记的 Org、User、RBAC、Authorization、Wiki、SharedFile、Daily、Device、Ops、Workflow、Audit 范围，可在告警后按 SPEC 继续；若出现新的核心模块或需要改变 cutover/break-glass/tenant 合同，停止并请求确认。
7. 完成后运行 GitNexus `detect_changes({scope:"compare", base_ref:"master"})`，结合初始工作区 diff 区分用户既有 P0 改动与本事件改动；结果写入实施记录。
8. 不 commit、不 push、不创建 PR，除非用户后续明确要求。

可以用 subagent 并行做互不依赖的只读 schema inventory、模块 writer 审计、测试矩阵、前端入口审计和证据一致性检查。主执行者必须亲自完整读取规则和事件合同、做所有高风险判断、整合代码和回写文档。禁止多个 agent 同时编辑同一文件；V72、`GroupLifecycleService`、`GroupReferenceInventoryService` 和 `GroupMapper` 必须由同一实现者串行维护。

## 5. 安全边界

- 不输出或写入密码、token、cookie、secret、Authorization header。
- 不修改 superadmin 的密码、状态、资料、旧角色、membership、primary group、assignment 或权限。
- 不执行全租户 Enforce/Rollback、实际 restore、全局 session 清理、历史数据批量迁移或 break-glass。
- 不直接写业务/授权表制造运行时 PASS；隔离 PostgreSQL 集成测试可用 SQL 构造参数化 fixture，但真实 UI/API 验证必须通过产品入口。
- 所有共享环境新对象使用 `REM_P1_001_YYYYMMDD_HHMM_<branchShort>`，创建成功立即登记 manifest，只清理能确认属于本次的数据。
- 不修改或删除无法确认属于本次的数据；不可精确恢复时停止并标记 `BLOCKED`。
- 不执行性能测试、安全渗透或故障注入；audit rollback 使用隔离自动化测试，不破坏共享运行栈。
- 不重启 PostgreSQL、Redis、MinIO、Nginx；如需更新运行镜像，只重建并 `--no-deps` 替换 backend/frontend。
- groups `11..15` 未再次获批前只允许 GET preflight 和只读 DB 核验，不允许 archive/restore/purge 或为归档而清理引用。

## 6. 实施方法与顺序

严格按 Phase A→F 执行。每个 Phase 完成后更新 checkpoint，失败时保留首次证据，不要扩大回归。

### Phase A：冻结环境并重建实时分母

1. 记录环境、Git、镜像、Flyway、authorization configured/effective mode 和 epoch。
2. 从 `pg_constraint`、`information_schema` 和源码 writer 重新提取全部 group reference：直接 FK、无 FK groupId、owner、ACL、JSON、Flowable runtime/history identity link、`act_id_membership`、`act_id_priv_mapping`、活动选择器和历史 lookup。
3. 建立 SPEC 5.3 的 versioned reference registry，并把实时分母与 SPEC 4.3/5.2/5.4/5.5 比较。漂移检测必须同时覆盖 FK、表列、trigger、JSON/Flowable 来源和应用 writer symbol，不能只检查 `pg_constraint`。若有漂移，先更新 PRD、SPEC、VERIFICATION 和 implementation checkpoint；不得只在 trigger 或 SQL 中暗加。
4. 保存 groups `11..15`、superadmin、非测试 group/authorization/ACL 前快照，只读不改。
5. 对每个拟修改 symbol 完成 GitNexus impact 并记录风险。

### Phase B：实现 V72 数据保护

新增 `backend/src/main/resources/db/migration/V72__auditable_group_lifecycle.sql`，按 SPEC 4.2 实现：

1. archived list 部分索引。
2. 幂等插入 `group:purge` permission，并只通过 migration 绑定产品既有受保护 platform 管理角色；不得写运行时固定角色名 bypass。
3. 实现 `require_active_business_group(tenantId, groupId)`：同 tenant、active、business，使用 group 行锁；稳定 SQLSTATE/消息可映射为 `GROUP_REFERENCE_INACTIVE`。
4. 为实时 schema 中每个直接/逻辑/JSON reference writer 安装 BEFORE INSERT/UPDATE trigger。只有活动 row 或恢复/改向活动状态时检查；nullable groupId 按字段合同处理。
5. JSON 中同时支持数字和数字字符串，先校验并提取，再按排序后的唯一 groupId 顺序加锁，避免多组死锁；非法值按现有输入合同拒绝，不能静默忽略。
6. 迁移必须从 V71 前进执行，不修改任何现有 group/reference 数据，不提供自动 down migration。

先用真实 PostgreSQL/Testcontainers 证明 V72 升级、函数、trigger、SQLSTATE、合法写入和所有拒绝矩阵。失败不要继续后端 API。

### Phase C：后端 lifecycle 和统一 writer 保护

按 SPEC 7 节创建或最小扩展：

- `GroupLifecycleService`
- `GroupReferenceInventoryService`
- `GroupLifecycleMapper` 或 `GroupMapper` 原子方法
- `ActiveGroupReferenceValidator`
- lifecycle DTO/VO/result/blocker/error contract
- `GroupController` lifecycle endpoints

具体方法：

1. `lockByTenantAndIdIncludingDeleted` 显式绕过逻辑删除，`SELECT ... FOR UPDATE`；所有写方法 WHERE 必须包含 tenant、id、当前 `is_deleted`、`expectedUpdatedAt`，且严格检查影响行数为 1。
2. Preflight、archive、purge 共用一个 inventory service；每种 reference key 独立 count，稳定 reasonCode/resolution，snapshot 使用规范排序 JSON 后 SHA-256，避免 Map 顺序漂移。
3. Archive 事务顺序必须是：校验 reason → 锁 group → tenant/protected/幂等/名称/版本 → 锁后 inventory → blocker 409 → 原子软删除 → 原子 audit → commit。
4. Restore：锁 archived group → 权限/scope/tenant/protected/名称/版本 → active code 冲突 → 原子清除删除元数据 → audit `restoredRelations=false`。
5. Purge：锁 archived group → platform permission/scope/确认/版本 → retention → 完整 versioned registry drift → 全量历史 snapshot → 原子 hard delete → audit；FK/约束转换成 409，不能返回 500。
6. archive/restore/purge 的 audit 记录 before/after/reference snapshot、snapshotHash、reason 和 operator；remark ≤512，JSON 不含秘密；audit 失败整体回滚。
7. 重复 archive 返回 200 `changed=false`，不重复写成功 audit。
8. 错误合同精确按 SPEC 6.6；跨 tenant 返回 404 不泄露存在性，permission/scope 拒绝为真实 403，不能用 401 代替。

统一 writer 保护：

1. 找出 SPEC 4.3 的每个应用写入口，在写事务内、产生引用前调用同一 `ActiveGroupReferenceValidator` 并锁定 group；不要在 Controller 里做可绕过的只读 exists 检查。
2. 多 groupId 写入按 tenant + groupId 稳定排序去重后加锁。
3. membership、primary group、group assignment 入口必须保留 `REM-P0-001` 已实现的授权写锁和 effective-assignment 合同；新增 lifecycle 行锁时统一锁顺序，写并发测试证明无死锁，不要删掉 P0 锁。
4. Flowable group token 生成前在同一事务调用 validator；识别 `<id>` 和 `group_<id>` 两种历史 token 只用于 inventory。
5. 历史读取使用明确的 including-deleted mapper，只返回名称 + `archived=true`；不得复用到 permission、scope、ACL 或活动选择器。

### Phase D：前端生命周期交互

在现有 groups 页面和 API client 风格内实现：

1. “删除”改成“归档”，默认 active 页签，新增 archived 页签。
2. 抽取 `GroupLifecycleDialog`，包含 `loading/error/eligible/blocked` 四态、blocker 表、10–500 字原因、精确名称确认和 submit disabled 条件。
3. 409 时保持弹窗与用户输入，展示服务端最新 preflight/blockers；不得只 toast 后关闭。
4. Restore 明示“不恢复历史成员和权限”；Purge 仅对有效 permission + platform scope session 渲染并做不可逆二次确认。
5. 使用 `getApiErrorMessage` 和现有 query key；成功后精确 invalidate groups 和 group option keys，不全局刷新 session。
6. 添加 SPEC 11.2 的所有稳定 `data-testid`，不引入新的 lint error 或无界 `any`。

### Phase E：按 L1→L3 验证

每次先运行最小相关测试，再扩大。不要修无关失败；最多针对本事件失败迭代三次，每次写实施记录。

#### L1 定向门禁

- V71→V72 migration；
- lifecycle state、permission/scope/tenant/protected/version/幂等/audit rollback；
- SPEC 5.2 每个 active blocker 独立参数化用例；
- SPEC 4.3 每个 writer 的 Active/Archived/Missing/Cross-tenant/Non-business 矩阵；
- writer-first/archive-first 的直接 FK、membership/assignment、owner/ACL/JSON 并发交错与超时；
- restore 不恢复关系、purge retention/history/catalog drift；
- REJECTED 日报仍可编辑/重提，必须作为 archive blocker，不得按历史终态处理；
- UI loading/blocker/cancel/confirm/409 refresh/archive/restore；
- 新 runId 清理。

#### L2 根因聚类

- primary user/membership/assignment；
- Wiki/SharedFile owner/ACL/visibleGroups；
- Daily/Device/Credential；
- Ops task/roster/rule JSON；
- Workflow runtime/history；
- historical readable but not effective；
- versioned reference registry drift（FK、非 FK、JSON、Flowable、trigger 和源码 writer）。

#### L3 模块回归

- Groups/User/RBAC/Authorization；
- Wiki/SharedFile；
- Daily/Workflow；
- Device/Ops Calendar；
- Audit、历史名称展示、所有 active-only group selector；
- stable page Console/network/backend logs。

L1 任一 FAIL 时停止 L2/L3；L2 任一 FAIL 时停止 L3。每个 FAIL 立即登记到 implementation record 与 verification，保存首次响应、DB、trace、console、network 和 backend log。

### Phase F：历史组受控归档与 P0 复跑

只有 L1-L3、`AC-001..018` 和 `AC-021` 全部 PASS 后才进入：

1. 使用产品 API 对 groups `11..15` 做 GET preflight，保存 group snapshot、active/historical counts、blockers 和 snapshotHash。
2. 核对五组 ID/tenant/code/name/type/builtin/leader 与文档基线；核对 active blockers=0，历史 membership/assignment 数量未漂移。
3. 向用户报告预检结果并明确请求 “允许通过产品 API archive groups `11..15`”。
4. **在用户明确回复批准前停止**；不得把启动本 Prompt 当作批准，不得直接 SQL，不得 purge。
5. 获批后逐组 archive，每组成功立即记录 auditId、软删除字段和 manifest；历史关系数量必须完全不变。
6. 只重新执行 `REM-P0-001 / AC-012` 清理断言，不重跑 P0 其他用例；PASS 后复核其余既有 PASS 证据和全部关闭门禁仍有效，再在 P0 文档中独立形成关闭结论，不能由 P1 自动代批。

## 7. 真实运行与证据

共享环境 runId：

`REM_P1_001_YYYYMMDD_HHMM_<branchShort>`

证据保存到：

`test-results/<runId>/REM-P1-001/`

至少生成：

- `environment.json`
- `fixture-manifest.json`
- `coverage.json`
- `api-summary.json`
- `reference-blocker-matrix.json`
- `writer-trigger-matrix.json`
- `concurrency-matrix.json`
- `permission-scope-matrix.json`
- `audit-matrix.json`
- `db-before.json`
- `db-after.json`
- `cleanup.json`
- `gitnexus-audit.md`
- 必要的 `ui/`、`logs/`、trace、network、console 和 screenshots

每条 lifecycle 用户操作同时断言：真实首页点击路径、UI 状态、直接路由、直接 API、HTTP/errorCode/reasonCode、permission/scope/expiry、DB before-after、audit、Console/network/backend log。报告和证据不得包含密码、token、cookie 或敏感内容。

## 8. 清理合同

1. 每个新对象创建成功后立即写 manifest。
2. 按依赖逆序撤销新 assignment、membership、ACL、资源、用户和 session。
3. 普通 archive/restore 夹具通过产品 API 恢复或清理；Purge 只使用独立零引用专用夹具。
4. 不直接 SQL 清理业务或授权对象，不全局清 session，不修改非测试 ACL/assignment/membership。
5. 最终断言本 runId active objects/session/MinIO object 为 0；archive/restore 软删除 group 行全部登记且无活动引用；独立 purge 夹具物理行=0。
6. superadmin 全字段、authorization mode/epoch、非测试角色 permissions、membership、assignment 和资源 ACL 与前快照一致。

## 9. 必须实时回写

不要结束后一次性补文档：

1. 每次关键实现、GitNexus impact、失败或测试批次立即追加 `IMPLEMENTATION-RECORD.md`。
2. 每完成一个 AC 更新 `VERIFICATION.md` 的状态、caseId 和证据路径。
3. 状态变化同步更新事件 `README.md` 和总 `INDEX.md`。
4. 运行时发现 reference/schema 漂移，先同步更新 PRD/SPEC/VERIFICATION 的分母，再实现。
5. 原始 FQA 和 P0 证据保持历史只读；只新增 REM-P1-001 run 和 P0 AC-012 复跑证据。

状态节奏：

- 开始代码实现：事件 `IN_PROGRESS`；
- L1-L3 全 PASS、等待历史组授权：事件 `BLOCKED`，实施 `CODE_AND_VERIFICATION_COMPLETE`；
- 用户批准后正在归档/复跑：事件 `VERIFYING`；
- `AC-001..021` 全 PASS 且清理一致：事件 `CLOSED`。

## 10. 停止条件

遇到以下任一情况，立即停止危险操作，保留证据并报告：

- GitNexus impact 超出 SPEC 列出的模块或要求改变 authorization/cutover/break-glass 合同；
- schema/source 发现未登记 group reference 或无法建立完整 writer 保护；
- 需要自动修改非测试业务数据才能 archive；
- V72 修改现有数据或 trigger 阻塞合法 Active group 写入；
- archive/restore/purge 出现部分成功、审计缺失、死锁、孤儿引用或未解释 5xx；
- archived group 仍参与 permission/scope/ACL 或 active selector；
- runId 对象无法通过产品入口精确清理；
- superadmin、authorization mode/epoch、非测试授权/ACL 发生变化；
- groups `11..15` preflight active blocker 非 0 或用户尚未明确批准 archive。

## 11. 完成定义

只有以下全部成立才能把 `REM-P1-001` 标记为 `CLOSED`：

1. `VERIFICATION.md` 的 `AC-001..021` 全 PASS，`NOT_RUN/FAIL/BLOCKED=0`；
2. V72、PostgreSQL trigger 与全部并发交错 PASS；
3. L1/L2/L3 PASS，未解释 5xx/Console/backend exception=0；
4. 用户明确批准后 groups `11..15` 通过产品 archive，历史关系不变；
5. `REM-P0-001 / AC-012` 复跑 PASS 并关闭前序阻塞；
6. 新 runId 活动对象/session/MinIO 为 0，软删除组全部登记且零活动引用，purge 夹具物理行=0，superadmin/非测试授权/ACL/mode/epoch 不变；
7. GitNexus detect_changes、相关 build/test 和 `git diff --check` 通过；
8. 实施记录、验证矩阵、事件卡和总 INDEX 完整同步。

L4 全量主功能 `275` + 状态/跨模块 `78` 是发布候选版本级门禁。本事件关闭不等于 L4 已执行，不得在报告中伪称完成发布全量回归。

最终回复只报告：事件结论、实际修改文件/符号、测试统计、证据路径、清理结果、groups `11..15` 是否获得授权和仍需用户决定事项。

现在开始：完整读取规则和事件 checkpoint，执行 Phase A，不要停在计划阶段。
