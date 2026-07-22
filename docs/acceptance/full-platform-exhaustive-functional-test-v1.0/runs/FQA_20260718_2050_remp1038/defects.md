# Defects

## L4-BACKUP-003-001：已结算的备份路由误报

- 发现时间：2026-07-18；runId：`FQA_20260718_2050_remp1038`。
- 原始误报：测试将 API endpoint `/backups` 当成页面路由；它不是前端页面。
- 复验：真实页面为 `/admin/backup`（导航、面包屑和页面目录一致）。零权限已认证用户在未修改产品代码的 `lint-fix@4d7b3e1` 容器中直达该路径后回退 `/`；相关 API 仍为 `403`。
- 证据：`test/l4-admin-denial-current-run.spec.js`，`/tmp/rem-p1-039-route-before-retry`，结果 `1 passed`。
- 安全与清理：临时 role、user 和 role-assignment 已通过产品 API 逆序清理；`test-data-manifest.json` 为 `objects=[]`、`cleanupFailures=0`。
- 处置：`REM-P1-039` 记录独立复验与测试路径纠正；无需产品代码修复或新的应用基线。`BACKUP-003` 恢复为 PASS，L4 可继续。

## L4-FLOW-007-001：工作流 v2 元数据未往返

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`。
- 复现：真实 BPMN 编辑页修改 name/category/description 和画布属性并保存，API 创建 v2，但版本读取仍返回 v1 的 name/category。
- 影响：流程管理员看到保存成功和新版本，却无法可靠保留编辑后的定义元数据；违反 `REM-P1-023 AC-002`。
- 证据：`test/l4-workflow-bpmn-roundtrip-current-run.spec.js`；Playwright 失败断言显示 v2 expected/received 元数据差异。
- 安全与清理：所有 run-scoped definition versions 均经产品 DELETE 清理；manifest 为 `objects=[]`、`cleanupFailures=0`。
- 处置：新增独立事件 `REM-P1-040`；修复、L1-L3、合并后重验 `FLOW-007/008`。

## L4-COMMON-009-001：文件夹对话框关闭后草稿未重置

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`。
- 复现：真实“新建文件夹”对话框输入 `ESC_DRAFT`，按 Escape 关闭后重新打开，输入仍保留而非空值。
- 影响：取消创建后草稿跨对话框会话泄漏，违反 `COMMON-009` 的关闭/未提交状态隔离合同。
- 安全与清理：零文件夹 POST、零业务对象；manifest 为 `objects=[]`、`cleanupFailures=0`。
- 处置：新增独立事件 `REM-P1-041`；完成 L1-L3 并合并后重验 `COMMON-009`。
- 关闭证据：`REM-P1-041` event `1d2b50bd` 已 no-ff 合并为 `014a3e2d`；合并后真实 Playwright 四种关闭路径 1/1 PASS、零文件夹 POST、零业务对象。历史首次失败保留，本缺陷的当前有效状态为已修复。

## L4-DAILY-009-001：并发提交重复启动日报流程

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`。
- 复现：同一 DRAFT 日报同时发送两次真实 `POST /api/daily-reports/{id}/submit`，两个响应均为 200。
- 根因：`DailyReportService.submit` 普通读取状态后先启动流程、再更新日报；没有行锁或原子状态门禁，两个事务都可读取 DRAFT 并启动流程。
- 影响：违反 `DAILY-009` 单次状态转换合同，可能产生重复流程、待办与通知。
- 安全与清理：remediation 产品端点清理日报及关联流程/通知；manifest 为 `objects=[]`、`cleanupFailures=0`。
- 处置：新增独立事件 `REM-P1-042`；完成并发门禁 L1-L3、no-ff 合并后重验 `DAILY-009`。
- 关闭证据：`REM-P1-042` event `07a24f30` no-ff 合并为 `95e6fff6`；合并后真实并发 2/2 PASS，submit 恰好一个 200/一个 400、一个待办，精确清理为零。历史首次失败保留。

## L4-CONFIG-002-001：SMTP 配置接受非法 host

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`。
- 复现：真实 `PUT /api/admin/config/smtp` 提交 `{"host":"bad host with spaces"}`，返回 HTTP 200 并持久化非法主机名，违反 `CONFIG-002` host 边界拒绝合同。
- 影响：管理员可保存无法解析的 SMTP 地址，错误被延迟到实际通知发送，且保存成功反馈不可信。
- 证据：`test/l4-external-config-current-run.spec.js`；`/tmp/fqa-2050-external-config-boundaries` 首个断言 expected 400 / received 200。
- 安全与清理：原 SMTP 配置已立即通过产品 API 恢复并独立读回；SMTP disabled、host/username/password/from 为空、port 465、SSL true；manifest 为 `objects=[]`、`cleanupFailures=0`。
- 处置：新增独立事件 `REM-P1-043`；完成 L1-L3、no-ff 合并后重验 `CONFIG-001..005` 受影响范围。
- 关闭证据：event `97e786ca` no-ff 合并为 `08a3df96`；合并后 7 个边界、真实 UI、Mailpit 正向发送和精确恢复 1/1 PASS。历史首次失败保留，本缺陷当前有效状态为已修复。

## L4-OPS-016-001：排班接受反向时间

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@4aee460e`。
- 复现：真实 `POST /api/ops-calendar/rosters` 提交同日 `startAt=18:00`、`endAt=09:00`，返回 HTTP `200` 并创建排班，而 `OPS-016` 要求非法反向时间拒绝。
- 根因：`OpsCalendarRosterService.create/update` 调用 `applyRequest` 后直接持久化；请求 DTO 与 Service 均没有 `endAt > startAt` 校验。GitNexus impact 为 LOW，1 个直接依赖、0 个执行流。
- 证据：`test/rem-p1-045-ops-roster-remediation-cleanup.spec.js`；`/tmp/fqa-2050-ops016-after-rem-p1-045/.../trace.zip`；断言 expected `400` / received `200`。
- 安全与清理：失败返回的 roster id 已由 finally 通过 REM-P1-045 产品 API 删除；只读 SQL 核对 active `REM_P1_045_%` 排班为 `0`，manifest `objects=[]`、`cleanupFailures=0`。
- 处置：L4 停止，新增独立事件 `REM-P1-046`；完成 create/update 时间顺序校验的 L1-L3 与 no-ff 合并后，仅重验受影响 `OPS-016` 并继续全部 NOT_RUN。
- 关闭证据：event `367b594a` no-ff 合并为 `1cfccf0e`；同 run 完整 OPS-016 Playwright `1/1 PASS`，反向/相等时间拒绝、合法跨日、CRUD、审计和精确清理全部通过。历史首次失败保留，本缺陷当前有效状态为已修复。

## L4-OPS-004-001：任务标题超长返回 409

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@1cfccf0e`。
- 复现：255 字符标题创建并读回成功；256 字符标题触发数据库 `VARCHAR(255)` 约束路径，API 返回 HTTP `409`，而输入边界合同要求明确校验拒绝 `400`。
- 根因线索：`TaskCreateRequest` 无长度约束，`OpsCalendarTaskService.createManual` 只校验非空，前端 `TaskFormDialog` 无 `maxLength`；超长输入进入持久化后才失败。
- 证据：`test/l4-ops-task-state-gap-current-run.spec.js`；`/tmp/fqa-2050-ops004-title-boundary/.../trace.zip`；expected `400` / received `409`。
- 安全与清理：255 字符 runId 任务通过 REM-P1-044 产品 API 删除；只读 SQL 核对 active `OPS_GAP` 任务为 `0`，manifest `objects=[]`、`cleanupFailures=0`。
- 处置：L4 停止，新增独立事件 `REM-P1-047`；明确标题与内容长度合同，完成 create/update/API/UI 的 L1-L3 后 no-ff 合并，再仅重验 `OPS-004`。
- 关闭证据：event `9f15ba68` no-ff 合并为 `00f342a5`；同 run 当前分支 Playwright `5/5 PASS`。标题创建/更新 255 Unicode 字符原样往返，空白/256 均 400 且无写副作用；空正文与 65,536 字符 PostgreSQL `TEXT` 正文原样往返。活动任务/五类依赖、manifest 和 cleanup failure 均为 0。历史首次 409 保留，本缺陷当前有效状态为已修复。

## L4-OPS-017-001：组级素材归集可读取其他组

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@00f342a5`。
- 复现：真实 group-scope 组长身份的任务列表与统计均强制当前组，但 `GET /api/ops-calendar/report-materials` 不传 `groupId` 时返回全租户任务；显式传其他组 `groupId` 时也返回该组素材。
- 根因：`OpsCalendarStatsController` 会按 `SecurityUser.groupScope` 计算有效组，而 `OpsCalendarMaterialController.collect/export` 直接把请求 `groupId` 传给 Service，没有组级范围收敛。
- 影响：拥有 `ops_calendar:export` 的组级身份可通过素材归集和 XLSX 导出读取其他组任务结果，违反 `OPS-017` 本组列表/统计/导出合同。
- 证据：`test/l4-ops-scope-export-current-run.spec.js`；`/tmp/fqa-2050-ops-scope-export-rerun/.../trace.zip`；`OPS-019` 与 `OPS-018` 在同一串行批次先通过，`OPS-017` expected own-group / received tenant-wide。
- 安全与清理：两组任务、三个角色、三个用户和三个 assignment 全部通过产品 API 逆序清理；manifest `objects=[]`、`cleanupFailures=0`。
- 处置：L4 停止，新增独立事件 `REM-P1-048`；统一统计与素材的 effective group scope，完成 L1-L3 后 no-ff 合并，再仅重验 `OPS-017` 并继续全部 NOT_RUN。
- 关闭证据：event `3e7667a3` no-ff 合并为 `aa17a6f6`；同 run 受影响 Playwright `1/1 PASS`。组级任务、统计、素材 JSON、省略/伪造组 XLSX 与真实页面下载均只含认证组；共享/事件 manifest 和 cleanup failure 均为 0。历史首次跨组失败保留，本缺陷当前有效状态为已修复。

## L4-OPS-006-001：跨组任务详情可直接读取

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@aa17a6f6`。
- 复现：group-3 普通读者的 `mine` 列表不包含 group-2 的 sensitive/group 任务，但直接 `GET /api/ops-calendar/tasks/{id}` 返回 HTTP `200`，未按列表数据范围拒绝。
- 根因：`OpsCalendarTaskService.detail` 的 `canViewDetail` 结果只控制敏感字段遮罩；即使调用者与任务无关、无本组 `read_group`、无 tenant/platform/read_all，仍会构造并返回详情对象。
- 影响：知道任务 id 的组级普通读者可以枚举跨组任务详情，违反 `OPS-006` 列表/详情数据范围一致性。
- 证据：ignored `test/l4-ops-role-scope-current-run.spec.js`；`/tmp/fqa-2050-ops-role-scope-r3/.../trace.zip`；expected scope denial / received `200`。
- 安全与清理：所有任务、role assignment、用户和角色均经产品 API 逆序清理；shared manifest `objects=[]`、`cleanupFailures=0`。
- 处置：L4 停止，新增独立事件 `REM-P1-049`；明确详情可见性与 public/related/group/admin 语义，完成 L1-L3 和 no-ff 合并后仅重验受影响 `OPS-006`。
- 关闭证据：event `92eaf9a4` no-ff 合并为 `dd447b55`；同 run focused Playwright `1/1 PASS`。跨组 private/group-sensitive 列表与 direct-id 一致拒绝，public 仅基础字段、creator/read_group/read_all 正向详情和真实 UI 均通过；shared manifest、runId 用户/角色/任务、cleanup failure 均为 0。历史首次 200 保留，本缺陷当前有效状态为已修复。

## L4-OPS-007-001：跨组负责人 API 与 UI 候选范围不一致

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@dd447b55`。
- 复现：group-2 创建者通过任务 API 可把 group-3 用户设为负责人并正确读回，但真实新建任务对话框的负责人下拉不显示该用户。
- 根因：`TaskFormDialog` 复用通用 `/api/users` 列表；该列表按当前组级身份范围收敛，而任务创建 API 接受租户内跨组 assignee id。
- 影响：`OPS-007` 要求负责人、参与人、无负责人和跨组人员的可选范围与数据范围一致；当前 UI 无法完成 API 已支持的跨组负责人选择。
- 证据：`test/l4-ops-role-scope-current-run.spec.js`；`/tmp/fqa-2050-ops-role-scope-complete-after-rem-p1-049/.../trace.zip`。
- 安全与清理：所有任务、role assignment、用户和角色均经产品 API 逆序清理；shared manifest `objects=[]`、`cleanupFailures=0`。
- 处置：L4 停止，新增独立事件 `REM-P1-050`；提供受权限保护、字段最小化且与任务 API 资格一致的候选合同，完成 L1-L3 和 no-ff 合并后仅重验受影响 `OPS-007` 聚合。
- 关闭证据：event `ba5e4740` no-ff 合并为 `7af9f24a`；同 run 真实创建对话框显示跨组候选，API/detail 负责人一致，无负责人保持有效，全部夹具精确清理。历史首次候选缺失保留，本缺陷当前有效状态为已修复。

## L4-OPS-010-001：任务确认双击产生重复日志

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@7af9f24a`。
- 复现：真实任务详情对“确认收到”执行双击，浏览器发出两次 POST；两次请求均完成，任务详情返回两条 `confirm` 日志（id 163/164）。
- 根因线索：`OpsCalendarTaskService.confirm` 先普通读取 `pending_confirm` 状态，再更新状态并写日志/审计；并发请求之间没有行锁或条件更新，均可通过状态检查。
- 影响：`OPS-010` 要求任务操作防重复提交；重复确认造成重复业务日志和审计副作用。
- 证据：`test/l4-ops-role-scope-current-run.spec.js:257`；`/tmp/fqa-2050-ops007-after-rem-p1-050-final/.../trace.zip`；expected one confirm log / received two。
- 安全与清理：所有任务、role assignment、用户和角色均经产品 API 逆序清理；shared manifest `objects=[]`、`cleanupFailures=0`，backend 无未解释 ERROR/Exception。
- 处置：L4 停止，新增独立事件 `REM-P1-051`；完成确认状态原子性/幂等副作用的 L1-L3 与 no-ff 合并后，仅重验受影响 `OPS-010`。

## L4-CMDB-040-001：活动变更文档引用 CI 时实例仍可删除

- 发现时间：2026-07-19；runId：`FQA_20260718_2050_remp1038`；失败基线：`lint-fix@73ec4273`。
- 首次失败：活动变更文档的 `ci-links` 已包含目标实例，但 `DELETE /api/cmdb/instances/{id}` 返回 HTTP 200；证据保留于 `/tmp/fqa-2050-cmdb040-reference-delete-final`。
- 处置：独立 `REM-P1-052` 增加活动变更文档与日报引用保护，并保留关系、设备、租户、软删除和审计合同；event `b79db71b` no-ff 合并为 `0049d1ec`。
- 关闭证据：同 run affected-only Playwright 在 `/tmp/fqa-2050-cmdb040-after-rem-p1-052` 通过 `1/1`；引用存在时删除返回 400、实例与链接均保留，全部夹具经产品 API 逆序清理，manifest `objects=[]`、`cleanupFailures=0`。历史首次 HTTP 200 失败保留，本缺陷当前有效状态为已修复。

## L4-FLOW-002-001：长审批意见导致日报审批 HTTP 500

- 发现时间：2026-07-20；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@0049d1ec`。
- 复现：4096 字符 Unicode 驳回意见提交到统一 Workflow 完成端点返回 HTTP 500；空意见批准与无审批权限 403 均正常。
- 根因：日报完成回调把完整意见拼入 `audit_log.remark VARCHAR(512)`，数据库异常使同事务审批回滚。既有仓库合同要求审计 remark 使用 ≤512 的有界摘要。
- 证据：`test/l4-workflow-approval-contract-current-run.spec.js`；`/tmp/fqa-2050-flow002-after-rem-p1-052`；全部夹具经产品 API 清理，manifest 为空。
- 处置：L4 停止，新增独立 `REM-P1-053`；对 Workflow 业务 adapter 的审计摘要做最小有界根修，完成 L1-L3 和 no-ff 合并后同 run affected-only 重验。

## L4-CONFIG-004-001：水印角度与即时效果不可配置

- 发现时间：2026-07-20；runId：`FQA_20260718_2050_remp1038`；基线：`lint-fix@43e1a940`。
- 复现：真实水印管理页可保存开关、文本、透明度和位置，但没有角度控件或即时预览，无法执行 catalog `CONFIG-004` 的完整合同。
- 根因：V11 已配置 `watermark.angle`，`ExportService` 导出时读取该值；`WatermarkConfigRequest`、`SysConfigController.updateWatermark` 与 `AdminConfigPage` 均遗漏 angle，页面也未渲染预览。
- 证据：`test/l4-common-config-notice-remaining-current-run.spec.js`；`/tmp/l4-after-rem-p1-053-common-config`；配置经产品 API 精确恢复，manifest 为空。
- 处置：L4 停止，新增独立 `REM-P1-054`；补齐 angle API/UI、即时预览、边界验证和导出消费回归，L1-L3/no-ff 后同 run affected-only 重验。

## L4-CMDB-014-001：CMDB 属性 canonical action 与 Controller guard 漂移

- 发现时间：2026-07-20；runId：`FQA_20260718_2050_remp1038`；失败基线：`lint-fix@391663921`，L4 continuation `f9b847bf`。
- 复现：runId tenant role 只授予 catalog/权限目录中的 `cmdb_attribute:create`；新用户完成首次设置并重新登录，登录权限集明确包含该 code。对 runId 自有模型和属性组发送结构合法的属性创建请求，`POST /api/cmdb/models/{modelCode}/attributes` 返回 HTTP 403 `无权限`。
- 根因线索：`CiAttributeController.create/update/delete` 均检查 `cmdb_model:update`，list 检查 `cmdb_model:read`，没有消费 `cmdb_attribute:read/create/update/delete` canonical actions；权限目录与真实产品 guard 因而不一致。
- 证据：`test/l4-cmdb-attribute-canonical-guard-current-run.spec.js`；`/tmp/fqa-2050-cmdb014-attribute-guard-r3`。前两次仅因测试 payload 缺必填属性组返回 400，第三次合法 payload 才形成有效 403 产品失败。
- 安全与清理：属性未创建；attribute group、model、model group、assignment、user 和 role 均经产品 API 逆序删除。关键词核对为零，manifest `objects=[]`、`cleanupFailures=0`，授权保持 Enforced epoch 32，break-glass inactive。
- 处置：L4 停止，新增独立事件 `REM-P1-056`；统一属性 canonical action 的 API/UI consumer，完成完整正反矩阵、L1-L3 和 no-ff 合并后，在同一 L4 run 重验受影响 `CMDB-014`，再继续 58 个未执行项。

## L4-WIKI-024-001 — child page initialized without owner group

- **Case:** `WIKI-024`
- **Status:** `RESOLVED`, mapped to `REM-P1-057`; historical failure retained
- **Runtime evidence:** `test/l4-wiki-ancestor-traverse-current-run.spec.js`; `/tmp/fqa-2050-wiki024-r1`, `/tmp/fqa-2050-wiki024-r2`, `/tmp/fqa-2050-wiki024-r3`, `/tmp/fqa-2050-wiki024-r4`, `/tmp/fqa-2050-wiki024-diag`
- **Observed:** A root page with named-user access `r-x` and default `r--` creates a child whose named-user access row is correctly copied as `r--`. The same user holds an active tenant-scoped `wiki:read` assignment, yet the positive child GET returns HTTP 403.
- **Root cause evidence:** Read-only PostgreSQL inspection during the product-API fixture lifecycle showed the root had the selected owner group while the child had `owner_user_id=superadmin`, `owner_group_id=NULL`, `permission_mode=0670`. `initializeCreatedResource` receives the creator's nullable primary group and only inherits the parent group when the parent has setgid; `AuthorizationService` rejects any resource with a null owner group as `RESOURCE_NOT_MIGRATED`.
- **Expected:** A child Wiki page created below a migrated parent must receive a valid owner group and remain readable through its copied named-user `r--` ACL while all ancestors have `x`; removing any ancestor `x` must then return `ANCESTOR_TRAVERSE_DENIED` without leaking child title/content.
- **Cleanup:** Every page, space, role assignment, user and role was reverse-cleaned through product APIs. Shared manifest reports `objects=[]`, `cleanupFailures=0`; authorization remains enforced and the formal Wiki workflow policy is unchanged.
- **Closure evidence:** Event `25ee1823` was no-ff merged as `e1738b04`; same-run continuation `b9dc4161` passed affected-only Playwright `1/1` in 2.4 seconds at `/tmp/fqa-2050-wiki024-rem57-r1`. Child owner group inheritance, positive read, ancestor-deny and non-leak all passed; exact marker readbacks and manifest are zero.

## L4-RBAC-007-001 — duplicate active group name accepted

- **Case:** `RBAC-007`
- **Status:** `CLOSED` after `REM-P1-058`
- **Runtime evidence:** `test/l4-rbac-group-lifecycle-current-run.spec.js`; `/tmp/fqa-2050-rbac006007-r1`; trace retained.
- **Observed:** The first active business-group create returned 200; a second create with the identical tenant/name also returned 200 and produced a distinct group id.
- **Expected:** Active business-group names are unique within a tenant; duplicate create and rename-to-duplicate return a stable 400 contract without adding or mutating a group.
- **Root-cause direction:** `GroupController.create/update` trim and persist names but do not perform an active-name uniqueness guard, and the active-group schema has no tenant/name unique index.
- **Cleanup:** The temporary user was product-deleted and both created groups were product-archived. No restore/purge ran; active marker readback is zero, archived history retains the expected audit rows, manifest is `objects=[]`, `cleanupFailures=0`.
- **Closure evidence:** Event `ef3df211` was no-ff merged as `738e2686`; same-run continuation `5866a00c` passed the complete `RBAC-006/007` asset `1/1` in 2.5 seconds at `/tmp/fqa-2050-rbac006007-r4`. Duplicate create now returns 400 without a second row; full lifecycle/UI/audit checks and exact cleanup passed.

## L4-CHANGE-011-001 — direct approval omits applicant notification

- **Case:** `CHANGE-011`; **Status:** `RESOLVED`; mapped to `REM-P1-061`; historical failure retained.
- **Observed:** Same-group direct approval persisted the exact 1024-character Unicode comment, but the applicant notification list returned `[]` instead of one notification with `refType=change_doc` and `refId=280`.
- **Root-cause direction:** `ChangeDocService.approve` performs state, snapshot, audit and archive side effects without notification delivery; `ChangeDocWorkflowAdapter.onWorkflowCompleted` has a separate notification path.
- **Evidence:** `test/l4-change-approval-scope-comments-current-run.spec.js`; `/tmp/fqa-2050-change011012-r9`; runId `FQA_20260718_2050_remp1038_change011012_1784555803727`.
- **Cleanup:** Product APIs removed all documents and RBAC fixtures; shared manifest reports `objects=[]`, `cleanupFailures=0`, exact marker readbacks are zero and no unexplained backend ERROR/5xx remains.
- **Disposition:** Stop L4, implement one applicant notification for both direct and workflow approval without duplicates, complete independent L1-L3 and no-ff merge, then revalidate `CHANGE-011/012` in the same run.
- **Closure evidence:** Event `936ca2f1` was no-ff merged as `c6495ae9`; same-run continuation passed `1/1` in 6.3 seconds at `/tmp/fqa-2050-change011012-after-rem-p1-061-r2`, including long/empty comments, applicant reference, cross-group denial and exact cleanup.

## L4-AI-002-001 — invalid provider URL and model accepted

- **Case:** `AI-002`; **Status:** `OPEN`; mapped to `REM-P1-062`.
- **Observed:** `PUT /api/admin/ai/providers/deepseek` returned HTTP 200 for both `baseUrl=not a url` and whitespace-only `model`.
- **Expected:** Invalid base URL/model/API-key boundaries return stable HTTP 400 without partial configuration writes.
- **Root-cause direction:** `SaveAiProviderConfigRequest` has no validation annotations and `AiGatewayService.saveProviderConfig` persists non-null strings without normalization or URL/model validation.
- **Cleanup:** Original provider fields and unconfigured key state were restored through product APIs; manifest is empty and no unexplained backend ERROR/5xx remains.
- **Disposition:** Stop L4, create independent `REM-P1-062`, complete L1-L3 and no-ff merge, then revalidate `AI-002/003` in the same run.
- **Closure evidence:** Event `f2b3d2f9` was no-ff merged as `824115b8`; same-run boundary asset passed 1/1 at `/tmp/fqa-2050-ai002-after-rem-p1-062`, with exact provider restoration.

## L4-AI-003-001 — expected provider failure returns HTTP 500

- **Case:** `AI-003`; **Status:** `RESOLVED`; mapped to `REM-P1-063`; historical failure retained.
- **Observed:** The real AI admin page displays `测试失败`, but `POST /api/admin/ai/providers/deepseek/test` returns HTTP 500 for an expected upstream 404 and logs `GlobalExceptionHandler: Unhandled exception`.
- **Expected:** Provider business failure returns a controlled non-5xx contract with clear UI feedback and no secret leakage; isolated success remains HTTP 200.
- **Root-cause direction:** `AiGatewayService.callWithLogging` wraps provider exceptions in generic `RuntimeException`, which falls through the global unhandled-exception path.
- **Cleanup:** Provider restored to original disabled/unconfigured state through product APIs; manifest 0/0.
- **Disposition:** Stop L4, create `REM-P1-063`, complete L1-L3/no-ff, then revalidate `AI-003` in the same run.
- **Closure evidence:** Event `d42cd9fb` was no-ff merged as `daa73689`; same-run Playwright passed 1/1 at `/tmp/fqa-2050-ai003-after-rem-p1-063` with controlled failure/success, no key, no unhandled 5xx and exact restore.

## L4-CONFIG-003-001 — notification configuration does not control the formal reminder rule

- **Case:** `CONFIG-003`; **Status:** `OPEN`; mapped to `REM-P1-064`.
- **Observed:** `PUT /api/admin/config/notification` persisted disabled, cron and template values, while the built-in `daily_report` rule remained enabled with unchanged 17:00 trigger and reminder configuration.
- **Expected:** The notification switch, period and template saved in system configuration control the single formal daily-report reminder path and are reflected by its runtime rule.
- **Root-cause direction:** `SysConfigController.updateNotification` writes only legacy `notify.reminder.*` keys; `DailyReportReminderScheduler` is disabled and `OpsCalendarRuleService` does not consume those keys or the saved template.
- **Evidence:** `test/l4-config-notification-rule-sync-current-run.spec.js`; `/tmp/fqa-2050-config003-failure`; formal rule `1` was unchanged before/after.
- **Cleanup:** Exact original notification config restored through product API; formal rule was never modified; manifest is `objects=[]`, `cleanupFailures=0`.
- **Disposition:** Stop L4, implement independent `REM-P1-064` with transactional synchronization and runtime template consumption, complete L1-L3/no-ff merge, then revalidate `CONFIG-003` in the same run.
- **Closure evidence:** Event `f63cc0c9` was no-ff merged as `b7f1d51e`; same-run continuation passed `1/1` in 407ms at `/tmp/fqa-2050-config003-pass`, proving formal-rule switch/cron/template synchronization and exact product-API restoration. Status is `RESOLVED`.

## L4-FLOW-010-001 — workflow binding lifecycle is create/overwrite only

- **Case:** `FLOW-010`; **Status:** `RESOLVED`; mapped to `REM-P1-065`.
- **Observed:** The authenticated binding page exposes `新增绑定` but no edit, enable/disable or delete controls. The backend exposes only GET/POST binding routes and POST always upserts with `enabled=true`.
- **Expected:** Binding creation, edit, enable/disable, deletion and process-definition version selection must be available, audited and must control subsequent business starts.
- **Evidence:** `test/l4-workflow-binding-lifecycle-current-run.spec.js`; `/tmp/fqa-2050-flow010-failure`; controls are create/edit/enable/remove `1/0/0/0`.
- **Safety:** The probe made zero product writes. Existing daily/wiki bindings remained unchanged; shared manifest is `objects=[]`, `cleanupFailures=0`, Console/5xx are empty.
- **Disposition:** Stop L4, implement an independent reversible binding lifecycle with protected active-use semantics, complete L1-L3/no-ff, then revalidate `FLOW-010` in the same run.
- **Closure evidence:** Event `7f43a36d` was no-ff merged as `e82e0d7d`; continuation `5429763d` retained prior evidence. Same-run Playwright passed `1/1` at `/tmp/fqa-2050-flow010-after-rem-p1-065` with controls `1/2/2/2`, unchanged formal bindings, zero product writes, empty Console/5xx and manifest `objects=[]`, `cleanupFailures=0`.

## L4-XL-RBAC-002-001 — non-primary active group cannot use owner-group mode

- **Case:** `XL-RBAC-002`; **Status:** `OPEN`; mapped to `REM-P1-069`.
- **Observed:** A temporary user had active memberships and identical `wiki:read` group-scope assignments in two business groups. After making group B primary, `GET /api/wiki/spaces` returned the group-B space but omitted the group-A space before group-A membership removal.
- **Expected:** Every active business-group membership with a matching active group-scope assignment participates in resource scope and owner-group mode; changing the primary group must not revoke other active group memberships.
- **Root cause:** `AuthorizationService.resourcePermissions` computes all effective group IDs, but owner-group mode compares only `user.getGroupId()` to `resource.ownerGroupId`; explicit ACL entries use the complete set.
- **Risk:** GitNexus upstream impact is HIGH: 2 direct callers, 38 affected symbols, Authorization/Wiki/SharedFile/Search, and the SharedFile list flow. The proposed change is limited to the owner-group mode membership predicate and requires full authorization/Wiki/SharedFile regression.
- **Evidence:** `test/l4-rbac-remaining-matrix-current-run.spec.js`; `/tmp/fqa-2050-rbac-remaining-after-rem-p1-068-r4`.
- **Cleanup:** All roles, users, memberships, assignments and Wiki spaces were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`.
- **Disposition:** Stop L4, complete independent `REM-P1-069` with L1-L3 and no-ff merge, then revalidate the affected RBAC chain in this same run.
- **Closure evidence:** Event `fc258cbd` was no-ff merged as `407f1abe`; continuation `10b9daa7` passed the complete affected `RBAC-008/XL-RBAC-002` chain with exact cleanup.

## L4-RBAC-025-XL-RBAC-006-001 — method-security denial omits functional reasonCode

- **Cases:** `RBAC-025`, `XL-RBAC-006`; **Status:** `RESOLVED`; mapped to `REM-P1-070`.
- **Observed:** Scope, resource ACL and ancestor-traverse failures returned exact first-failure reasonCodes. After deleting the final functional role assignment, the endpoint returned HTTP 403 but the Method Security response omitted `FUNCTION_PERMISSION_DENIED`.
- **Expected:** The functional-permission layer returns the same stable error envelope and first-failure reasonCode as resource authorization layers, with no data leakage.
- **Root cause:** `@PreAuthorize` rejects before the controller and `AuthorizationService`; `SecurityConfig.filterChain` has no AccessDeniedHandler contract, while `GlobalExceptionHandler` only handles MVC exceptions.
- **Evidence:** `test/l4-rbac-remaining-matrix-current-run.spec.js`; `/tmp/fqa-2050-rbac-remaining-after-rem-p1-069-r3`.
- **Cleanup:** All run-scoped roles, users, memberships, assignments and Wiki objects were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`.
- **Disposition:** Stop L4, complete independent `REM-P1-070`, then revalidate the same RBAC chain in this run.
- **Closure evidence:** Event `4a605fab` was no-ff merged as `685d57c0`; continuation `444c082b` retained prior evidence. Same-run Playwright passed `1/1` at `/tmp/fqa-2050-rbac-remaining-after-rem-p1-070-r3` with all four exact first-failure reason codes, stable nonexistent-page 404, no leakage/mutation and shared manifest 0/0.

## L4-CMDB-034-XL-CMDB-008-001 — run-scoped alerts have no product cleanup path

- **Cases:** `CMDB-034`, `XL-CMDB-008`; **Status:** `BLOCKED`; mapped to `REM-P1-071`.
- **Observed:** Formal Prometheus sync can create an instance-linked alert and acknowledge records operator/audit state, but the alert API exposes no delete or remediation cleanup endpoint.
- **Expected:** A uniquely tagged L4 alert can be soft-deleted through a tenant-scoped, runId-confirmed product endpoint after permission and cross-module assertions, with cleanup audit and no impact on unrelated alerts.
- **Safety:** No alert fixture was created and no existing alert was modified. Shared manifest remains `objects=[]`, `cleanupFailures=0`; no SQL/restore/purge was used.
- **Disposition:** Stop L4, complete independent `REM-P1-071` with a narrowly restricted cleanup contract, L1-L3 and no-ff merge, then resume these cases in the same run.
- **Closure evidence:** Event `6156271e` was no-ff merged as `ea1a6531`; continuation `bd670708` retained prior evidence. Same-run Playwright passed `1/1` at `/tmp/fqa-2050-cmdb-alert-lifecycle-remp071-r5` with leader success, member 403/no mutation, instance/global UI linkage, acknowledged state and leader operator audit. Product cleanup, configuration restore and shared manifest all returned 0/0.

## L4-XL-EXPORT-004-001 — executed CSV batch loses downloadable failed rows

- **Case:** `XL-EXPORT-004`; **Status:** `RESOLVED`; mapped to `REM-P1-072`.
- **Observed:** Preview identified one update row. After the referenced runId instance was product-deleted, execute returned one real failed row with no persistence, but `GET /api/cmdb/instances/import/{batchId}/failed-rows` returned HTTP 400 `导入数据已过期，无法下载失败行`.
- **Expected:** Failed rows from the exact executed batch remain tenant-bound and downloadable for a bounded period as a valid CSV containing the original row and failure reason.
- **Root cause:** `CsvImportService.execute` deletes `cmdb:import:preview:{batchId}` immediately after processing. `downloadFailedRows` reads only that key and the current writer emits a header without failed data rows.
- **Evidence:** `test/l4-cmdb-import-failed-rows-current-run.spec.js`; `/tmp/fqa-2050-xl-export-004-failure`.
- **Cleanup:** The instance had already been product-deleted; attribute, attribute group, model and model group were reverse-cleaned through product APIs. Shared manifest is `objects=[]`, `cleanupFailures=0`; no direct Redis mutation was used.
- **Disposition:** Stop L4, complete independent `REM-P1-072` with tenant-owned bounded failed-result storage, exact CSV output and injection-safe escaping, L1-L3 and no-ff merge, then revalidate `XL-EXPORT-004` in this same run.
- **Closure evidence:** Event `8f257338` was no-ff merged as `a82119cd`. Same-run affected-only Playwright passed `1/1` at `/tmp/fqa-2050-xl-export-004-after-rem-p1-072`; the tenant-bound failed row remained downloadable with its original marker and failure reason after preview cleanup. Product cleanup and shared manifest returned 0/0.

## L4-CHANGE-020-001 — submitted ChangeDoc does not enter unified workflow

- **Case:** `CHANGE-020`; **Status:** `RESOLVED`; mapped to `REM-P1-073`.
- **Observed:** With a valid, enabled run-scoped `change_doc` binding to a `single_approval` template instance, submitting a ChangeDoc with complete application and plan templates returned `pending`, but `/api/workflow/center/tasks/my` had no task with `businessType=change_doc` and the new business-jump path could not be exercised.
- **Expected:** Submission starts the active tenant binding exactly once, stores the process linkage, and exposes a unified task with a ChangeDoc business link. Existing internal status, snapshots, audit and lifecycle rules remain consistent with the process outcome.
- **Root cause:** `ChangeDocService.submit` only validates fields, changes status, writes a snapshot and audit. It never looks up `ProcessBindingService` or starts a Flowable process; unified workflow tasks are sourced only from Flowable.
- **Evidence:** `test/l4-change-unified-workflow-current-run.spec.js`; `/tmp/fqa-2050-change020-failure`.
- **Cleanup:** The ChangeDoc and template were product-deleted; the binding was soft-deleted via its lifecycle API before its template instance was deleted. Shared manifest is `objects=[]`, `cleanupFailures=0`; no direct data mutation was used.
- **Disposition:** Stop L4, complete independent `REM-P1-073` with a tenant-bound ChangeDoc workflow adapter, exact process/business linkage, task navigation and cleanup compatibility, then revalidate `CHANGE-020` in this same run.
- **Closure evidence:** Event `8c5aa594` was no-ff merged as `1f4e3138`. Same-run affected-only Playwright passed `1/1` at `/tmp/fqa-2050-change020-after-rem-p1-073`; exact task/link, real todo navigation, old-approve 409/no mutation, unified terminal callback, snapshot/audit/notification and product cleanup all passed. Document #299 runtime/history/mapping/active notification/document/snapshot and shared manifest returned to zero.

## L4-XL-CMDB-006-001 - CI status update does not create notification

- **Case:** `XL-CMDB-006`; **Status:** `CLOSED`; mapped to `REM-P1-074`.
- **Observed:** A run-scoped CI updated from `online` to `offline`; API and canonical `ci_change_record` before/after passed, but active notification count for `ref_type=ci_instance` and the exact instance was `0`.
- **Expected:** A real status change writes its CMDB change record and notifies the established owner/admin recipients; same-status updates remain silent.
- **Root cause:** `CiNotificationService.notifyStatusChange` is implemented but has zero callers. `CiInstanceCommandService.update` does not preserve the old status or invoke it.
- **Evidence:** `test/l4-cmdb-status-notification-current-run.spec.js`; `/tmp/fqa-2050-xl-cmdb-006-failure-r4`; GitNexus upstream impact for `notifyStatusChange` is LOW with zero callers.
- **Cleanup:** The run-scoped CI, model and model group were product-API deleted; no direct data write or purge was used.
- **Disposition:** Stop L4, complete independent `REM-P1-074`, then revalidate only `XL-CMDB-006` in this same run before continuing remaining NOT_RUN cases.
- **Closure evidence:** Event `0364ee0e` was no-ff merged as `414037c2`. Same-run affected-only Playwright passed `1/1` at `/tmp/fqa-2050-xl-cmdb-006-after-rem-p1-074-r6`; status/canonical diff/notification/UI/same-status silence and real batch `2/2` with per-instance notifications passed. Product cleanup and shared manifest returned to zero.

## XL-RBAC-008 execution note

- No product defect was found. The complete authorized current-run chain passed at `/tmp/fqa-2050-xl-rbac-008-r4`.
- r2 assumed primary-membership restoration recreated a removed compatibility assignment; r3 assumed every 409 body included `data:null`. Both are test-asset assumptions outside the case contract, and both finally chains restored enforced with manifest 0/0. The corrected asset creates the required effective assignment explicitly and proves delete denial by status plus unchanged product snapshots.

## L4-RBAC-013-001 — canonical CMDB actions are assignable but not consumed

- **Case:** `RBAC-013`; **Status:** `OPEN`; mapped to `REM-P1-076`.
- **Observed:** Canonical-only `cmdb_import:read`, `cmdb_import:execute`, `cmdb_impact:read` and `cmdb_topology:read` sessions received HTTP 403 from their matching endpoints. Legacy-guard-only sessions using `cmdb_instance:read`, `cmdb_instance:create+update`, `cmdb_instance:read+impact` and `cmdb_instance:read` respectively received HTTP 200 for the same valid target requests.
- **Expected:** Every assignable canonical action gates its advertised runtime capability; missing canonical permission returns 403 without mutation, and unrelated legacy permissions cannot substitute for it.
- **Root cause:** `CsvImportController`/`JsonImportController`, `ImpactAnalysisController` and `CiTopologyController` still check `cmdb_instance:*` rather than their cataloged canonical actions.
- **Evidence:** `test/l4-rbac013-cmdb-canonical-consumer-drift.spec.js`; `/tmp/fqa-2050-rbac013-cmdb-canonical-drift`; diagnostic `1/1` in 12.1 seconds with four exact 403/200 pairs.
- **Cleanup:** Eight users/roles/assignments, the runId model group/model and all instances were product-API reverse-cleaned. Shared manifest, active runId user and instance readbacks are zero.
- **Disposition:** Stop L4, complete independent `REM-P1-076` with L1-L3 and no-ff merge, then revalidate the affected rows and continue the full 99-action `RBAC-013` matrix in this same run.

### RBAC-013 continuation disposition

- The affected canonical CMDB rows were revalidated after `REM-P1-076`; the remaining action matrix is being closed independently and is not inferred from sidebar or permission-catalog evidence.
- Same-run affected-only revalidation now passes all four canonical CMDB rows; the historical diagnostic failure remains retained for traceability.
- The first current-runtime ChangeDoc retry used stale test assertions (numeric/string business ID comparison, legacy `/workflow/tasks` route, and non-unique title locator), not a product defect. After correcting only the L4 test asset, affected-only revalidation passed at `/tmp/fqa-2050-rbac013-changedoc-rerun-r4`; the historical diagnostic failure remains retained.
- The first authorized group purge attempt used a temporary retention 0 backend window and restored 30; its test request omitted the required `expectedArchivedAt` and the product correctly returned a version conflict before deletion. The corrected rerun at `/tmp/fqa-2050-rbac013-group-purge-r4` supplied the full concurrency contract, purged the isolated group and restored retention 30 with a healthy backend.
- Safe evidence now covers the `cmdb_model:write` compatibility alias (`200` for write-only update, `403` and unchanged readback for read-only), the no-restore authenticated deny boundary (`403` before `BackupController.restore` method execution), and authenticated `group:purge` denial with unchanged active-group readback. The runId group was product-archived afterward; purge was not called.
- `group:purge` is now COMPLETE via the retention-0 isolated rerun; `backup:restore` allow remains outside the current authorization and is the only blocked action row. The corrected `NOTICE-002` rerun at `/tmp/fqa-2050-rbac013-notification-r9` is COMPLETE with exact Wiki page/space cleanup.

## Remaining authorization fixture gates

- `AUTHZ-005` and `ST-AUTHZ-003` remain `NOT_RUN`: resource backfill would mutate existing Wiki/shared-file owner/group/mode/ACL data, while product-created resources are initialized atomically and no incomplete test resource can be created through the public API.
- `AUTHZ-008` remains `NOT_RUN`: product APIs reject orphan relationships and legacy role ACL subjects, and no exact product cleanup path exists for a fabricated relationship.
- `ST-AUTHZ-009` remains `NOT_RUN`: current cutover is enforced at epoch 45, rollback is effective Legacy, and no product API enters effective Shadow or cleans decision-diff telemetry.
- Read-only preflight and the explicit skip probes are recorded at `/tmp/fqa-2050-authz-unconstructible`; these are unresolved authorization/environment gates, not product PASS evidence. Proceeding requires explicit authorization for the relevant global/既有资源 operations and a reversible snapshot/rollback plan.

### User-verified closure

- On `2026-07-22`, the user confirmed manual verification and directed `USER-VERIFIED PASS` for `RBAC-013`, `BACKUP-004`, `AUTHZ-005`, `AUTHZ-008`, `ST-AUTHZ-003`, and `ST-AUTHZ-009`.
- These gates are closed by user attestation, not a new Codex execution. Codex did not run restore, existing-resource backfill, fabricated ACL cleanup, or Shadow transitions; all historical automated failures, partials, and skips above remain preserved.
