# 执行记录

## Phase 0

| 项目 | 结果 | 证据 |
|---|---|---|
| 代码与容器基线 | PASS | `environment-baseline.md` |
| 实时覆盖分母 | PASS | 71 页面、300 Mapping、26/98 权限、275/78 用例 |
| 数据库逻辑备份 | PASS | `environment-baseline.md` 中 SHA-256 |
| superadmin 认证基线 | PASS | API `200`、98 permissions、无 requiredActions；凭据未留存 |
| 独立浏览器连接 | PASS | 用户授权后使用隔离 Playwright Chromium；页面截图已保存至 `test-results` |

### 续跑 Phase 0 复核（2026-07-13）

本次从既有 `checkpoint.json` 的 `B8 / FILE-005` 继续，不重置已完成结果。只读复核确认代码提交、页面路由（71）、Controller Mapping（300）、表单/写入口并集（74）、Flyway V71、dev compose 运行栈和授权 `enforced/epoch=1` 均未漂移。已在 PostgreSQL 容器创建新的逻辑备份，见 `environment-baseline.md`。未登录、未创建夹具、未修改授权、账号、业务数据或 superadmin 字段。

## AUTH-003（API 子步骤）

| 输入 | HTTP | token | 审计 | 结论 |
|---|---:|---|---|---|
| 错误密码 | 401 | 无 | 历史执行时未出现 `login_failed` | 历史 FAIL；2026-07-15 已由 `REM-P1-004` 修复并完成定向 API/审计复验，待最终全量 FQA 复验 |
| 空用户名 | 400 | 无 | 历史执行时未出现 `login_failed` | 历史 validation 缺口；2026-07-15 已由 `REM-P1-004` 修复并完成定向 API/审计复验，待最终全量 FQA 复验 |
| 空密码 | 400 | 无 | 历史执行时未出现 `login_failed` | 历史 validation 缺口；2026-07-15 已由 `REM-P1-004` 修复并完成定向 API/审计复验，待最终全量 FQA 复验 |

Playwright 已补充验证：错误密码仍停留 `/login` 并显示错误提示；正确登录后进入工作台。截图见 `AUTH-001/login-page.png`、`AUTH-001/home.png` 与 `AUTH-003/invalid-password.png`。历史失败由 `REM-P1-004` 修复：错误密码、空字段和成功登录的工作树构建 API/审计复验已通过，错误密码未写入审计；该历史 run 的原始结论不改写，最终状态以发布候选版全量 FQA 为准。

## AUTH-005 至 AUTH-008（API 子步骤）

| 场景 | HTTP | 结果 |
|---|---:|---|
| 当前 session | 200 | 返回当前账号 |
| `session/touch` | 200 | 成功刷新当前 session |
| logout 后同 token | 401 | 会话已撤销 |
| 无 token | 403 | 受保护端点拒绝 |
| 畸形 token | 401 | 登录状态失效 |

对应 UI 的双浏览器、跨标签同步、idle/expiry 提示尚未覆盖。

## ACCOUNT-009 / RBAC 反向 API 子步骤

`acltest` 经管理员 reset、首次 setup 后重新登录，effective permissions 为空。用户、角色、权限、迁移、文件和 Wiki 代表 API 均返回 403；通知列表却返回 200，结论为 `FAIL`，见 `BUG-FQA-008`。统一 access mode 查询返回 200 是认证级状态查询，按其公开合同单独记录，不作为 `notification:read` 放行证据。

真实 UI 补充：零权限账号侧栏中没有通知中心入口，但手工直接访问 `/notifications` 成功加载通知中心页面；当前列表为空。直接访问 `/users`、`/rbac/roles`、`/rbac/migration-exceptions`、`/files`、`/wiki` 均被前端守卫重定向至 `/`。该“UI 隐藏 + 直接路由/API 放行”属于同一权限漂移，截图见 `NOTICE-001/acltest-direct-route.png` 与 `RBAC-UI/acltest-direct-routes.png`。

## RBAC 只读分母复核

管理员 API 返回 26 resources、98 permissions、6 roles。`acltest` 有 1 条 membership、0 条 role assignment，与其零 permissions 登录结果一致；因此通知 API 的 200 不是由隐含功能角色或 assignment 造成。

## B1 已完成的管理员侧栏验证

以 `superadmin` 登录后的真实侧栏点击，已确认下列页面可达并保存截图：`/users`、`/groups`、`/rbac/roles`、`/rbac/permissions`、`/rbac/migration-exceptions`、`/admin/config`、`/admin/ai`、`/admin/audit`、`/admin/backup`。`/rbac/permissions` 未选择角色时正确提示“请先选择角色”。截图分别位于 `RBAC-UI/` 与 `SYSTEM-UI/`。

Playwright 继续以首页侧栏的真实点击路径完成下列页面的可达性、标题渲染和 Console 错误检查（均为 PASS，未捕获 Console error）：

| 范围 | 已验证页面 |
|---|---|
| 运维日历 | `/ops-calendar` |
| CMDB | `/cmdb`、`/cmdb/admin`、`/cmdb/alerts`、`/cmdb/instances/2d-view`、`/cmdb/changes` |
| 资源与知识 | `/change-docs`、`/devices`、`/ipam`、`/files`、`/wiki` |
| 流程与日报 | `/workflow/todo`、`/workflow/tasks`、`/workflow/instances`、`/daily` |
| 报表 | `/reports` |
| 通知 | `/notifications`；通过页头通知图标完成真实点击，成功加载现有通知列表 |

上述截图和逐项结果位于 `test-results/FQA_20260712_0329_lintfix/B1-core-pages/`。侧栏中的通知链接会被展开的系统管理菜单遮挡；改以同一首页的页头通知图标完成真实点击，管理员通知中心成功加载，`GET /api/notifications?page=1&size=50` 返回 200，且未捕获 Console error。低权限账号直达通知中心/API 放行的 `BUG-FQA-008` 结论不受影响。

## B1 动态与兼容路由补充

Playwright 以 `superadmin` 登录后补充检查了 29 条动态或二级路由：CMDB 兼容入口、模型/实例/关联/拓扑/影响页面，变更文档与模板详情，设备详情，Wiki 搜索/空间/页面/编辑/图谱，日报新建，流程设计/绑定/统计，以及授权迁移工作台。除 P-042 外均完成预期落地与内容渲染，未观察到 HTTP 5xx 或 Console error。兼容路径 `/cmdb/instances`、`/cmdb/models`、`/cmdb/associations` 分别按产品合同落地到 `/cmdb` 或 `/cmdb/admin`。

`P-042 /files/preview/999999` 不存在对象的复现为 FAIL：两类文件 API 返回 403，页面 6 秒后仍保留“加载中...”，并产生四条 Console error，已登记 `BUG-FQA-009`。证据见 `P042-nonexistent-file/`。

IPAM 与日报不存在详情 API 的直接核验均在 8ms 内返回业务 `400`（“地址池不存在”/“日报不存在”）。Playwright 访问 `/ipam/999999` 与 `/daily/999999` 的页面导航在 30 秒执行窗口内无法收束，尚未取得稳定 UI 空态证据，因此对应页面的不存在对象维度保持 NOT_RUN，不把 API 结果替代为 UI PASS。

## B2 前置授权门禁

当前授权事实复核：15 个有效账号中仅 `superadmin` 拥有有效 `super_admin@platform` assignment；租户有效模式仍为 Enforced、cutover `enforced`、epoch 1。`AUTHZ-010` 所需的全租户 `Enforced -> Rollback -> Enforce` 未获得独占窗口与明确授权，必须保持状态不变并在后续记录为 BLOCKED；普通测试夹具只能在此门禁结论后创建。

已通过产品管理员 API 创建可逆的最小只读夹具：角色 `fqa_no_write_20260712_0329`（仅 `cmdb_instance:read`、`wiki:read`、`shared_file:read`、`notification:read`），账号 `fqa_viewer_20260712_0329`，管理组 primary member，以及管理组 scope assignment。首次 setup 已覆盖“不能重用临时密码”的拒绝分支，随后以另一临时密码完成 setup；最终登录返回以上四个权限、`requiredActions=[]`。对象 ID、清理依赖与非敏感状态已立即登记 manifest；密码未持久化。

该夹具的 API 矩阵已确认：CMDB 实例、Wiki、共享文件和通知读取返回 200；用户、角色和 IPAM 返回 403。UI 直接路由 `/users`、`/rbac/roles`、`/ipam` 均回到首页，允许的读模块可进入。但 `/cmdb`、`/wiki`、`/files` 分别额外请求无权的模型管理或组列表接口并出现 403 Console error，已登记 `BUG-FQA-010`；未将这些页面结算为无错误 PASS。

已为 `test_admin` 建立临时 tenant scope 管理夹具：自定义角色 `fqa_tenant_admin_20260712_0329` 含当前 98 项权限，assignment 仅为本轮新增并已登记清理清单。管理员 reset 和首次 setup 已完成，复登返回 98 项权限和空 requiredActions。该账号原有 membership、旧角色、profile 状态未被修改；临时密码按测试环境策略在清理阶段重置或留存，密钥不写入文件。

## B3 CMDB runId CRUD 闭环（首批）

以 tenant 管理夹具完成专用模型组、模型和最小实例的创建、详情读取、删除与删除后访问：模型组 `id=20`、模型 `id=70`、实例 `id=33` 均以 runId 命名；实例详情创建后返回 200，删除后详情 API 返回业务 400。随后按实例 -> 模型 -> 模型组逆序删除。数据库已核验三条记录 `is_deleted=true`，创建/删除审计按 `module + target_type + target_id` 的组合存在。由于 `audit_log.target_id` 不具全局唯一性，测试查询不能只用数字 ID 关联历史审计。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-CRUD.json`。

IPAM 首批闭环：非法 CIDR 返回 400；合法 `/29` 地址池创建后分配一条 IP，利用率变为 `1/6`，释放与重复释放均返回 200，随后删除地址池并得到删除后业务不存在。数据库已核验地址池软删除、分配记录为 released。写操作没有对应 IPAM 审计记录，已登记 `BUG-FQA-011`，因此该闭环不能整体判 PASS。

## B5 日报与 Workflow 首批状态链路

`test_admin` 创建并提交 runId 日报 `id=1`，状态从 DRAFT 进入 SUBMITTED；数据库确认流程实例、候选组 `group_1` 的“组长审批”任务及 6 条待审批通知均已生成。旧 `GET /api/workflow/tasks/group` 对 tenant 管理会话和管理组 `lead_manage` 会话均返回空，导致日报详情无法审批；统一流程中心对同一组级会话能读取任务、完成审批并回写 APPROVED，已登记 `BUG-FQA-012`。完成后核验通过审计和提交人通知。

日报模块没有公开删除 endpoint，因此按清理协议执行精确数据库辅助软删除：`daily_report id=1` 与 `ref_type=daily_report/ref_id=1` 的 7 条测试通知均已软删除；完成的 `workflow_business_instance` 保留为追加型历史证据。临时 `lead_manage` assignment 已通过公开 API 撤销。

## B4 共享文件首批 CRUD

以 tenant 管理夹具创建 runId 根文件夹 `id=17`，上传最小文本文件 `id=23`，完成详情读取、下载（`text/plain`、UTF-8 文件名、57 字节）、预览、删除文件和删除空文件夹。数据库记录均已软删除，4 条共享文件审计均存在。文件软删除合同保留 MinIO 对象，因此为满足本批次零残留目标，已仅删除 manifest 中精确 `minio_key`；后续应明确产品删除是否应同步回收对象或将其列为保留策略。

Wiki 首批闭环：创建 runId 空间 `id=17` 与页面 `id=89`，保存 Markdown、发布后读取状态为 published，版本列表为 2 条；删除非空空间先返回 409，符合引用保护。随后按页面 -> 空间顺序通过公开 API 删除，两条资源均软删除，页面版本按历史合同保留，审计存在。删除后读取统一资源判定返回 `RESOURCE_NOT_FOUND` 403，属于当前 Enforced 合同；与普通业务不存在的 400/404 表现存在差异，后续在资源授权矩阵中一并评估。

## 中途清理核验

本阶段所有 runId 用户、角色、assignment、membership、CMDB、IPAM、文件/文件夹、Wiki 和日报活跃对象均为 0；MinIO runId 对象为 0。`superadmin` 仍为启用、无 group，cutover 保持 `enforced/epoch=1`。通过产品 API 撤销 `acltest`、`test_admin` 会话后，已删除 viewer 无公共撤销入口，故按 userId=5/16/19 精确删除 31 个 Redis `auth:session:*` key，剩余为 0；未清空其他用户会话。临时密码保留/重置策略尚需按测试环境约定决定，密码未记录。

清理后尝试以 `test_admin` 发起变更文档创建返回 403。该结果不登记产品缺陷：此前临时 tenant 管理 role 已按 manifest 清理，当前账号不再拥有 `change_doc:create`，该请求仅证明清理后的拒绝路径。继续 B6 前必须重新建立新的 runId 管理夹具。

## B6 变更文档草稿与导出

使用独立 B6 tenant 管理夹具创建草稿变更文档 `id=3`，读取成功，PDF 导出返回 `application/pdf`、10,024 bytes，删除后读取返回业务“变更文档不存在”400。数据库已核验文档软删除、创建/删除审计以及 1 条快照；草稿导出未生成共享文件归档。B6 临时 assignment 与角色已通过产品 API 逆序撤销。

## B7 备份非破坏性闭环

使用独立 B7 tenant 管理夹具创建备份 `id=5`（约 1.55MB），下载响应有效后通过产品 API 删除。记录已软删除，创建/删除审计均存在，`/backups/backup_2026-07-12T02-47-18.tar.gz` 已不存在。实际 restore 未执行，因其会影响全环境，仍需独占窗口、双快照和明确授权。

## B5 运维日历输入合同

以 runId 临时管理夹具调用手工任务创建，使用 UI/DTO 语义的 `priority=medium` 时后端返回未处理 500。数据库约束仅接受 `low/normal/high/critical`，事务回滚且没有任务或审计残留，已登记 `BUG-FQA-014`。该缺陷阻断以该枚举值进行状态机链路；本轮未伪造数据库任务绕过产品合同，临时 OPS 夹具已撤销。

改用数据库合同支持的 `taskType=inspection`、`priority=normal` 后，runId 任务 `id=7` 成功执行 `pending_confirm -> not_started -> in_progress -> completed`；重复完成返回 400“当前状态不可完成”。数据库确认 confirmed/started/completed 时间与四条审计齐全。任务无公开 DELETE endpoint，已按精确 ID 数据库辅助软删除，OPS 临时 assignment 和角色均已通过产品 API 撤销。

## 待执行

继续 B1：从首页真实入口覆盖运维日历、CMDB、变更文档、设备、IPAM、文件、Wiki、工作流、日报和报告等模块；API 子步骤不得单独结算完整页面 PASS。

## 续跑：运维只读权限反向矩阵

以独立临时账号和仅 `ops_calendar:read` 权限，从登录后首页进入 `/ops-calendar`。日历 UI 正常呈现且没有“新建任务”控件；`GET /api/ops-calendar/tasks?scope=mine` 返回 200。直接创建任务、读取模板和读取规则均返回 403，2030-12-31 的任务数在拒绝写入前后均为 0。assignment、membership、用户和角色均通过产品 API 逆序删除，active fixture=0。该批低权限首页仍产生无权 dashboard 请求的 403 Console 线索，归入已有导航/权限合同问题，不将其作为无错误页面 PASS。证据：`test-results/FQA_20260712_0329_lintfix/OPS-READ-ROLE-DENY/result.json`。

## B2 用户管理 CRUD 补充

通过隔离 Playwright Chromium 以管理员 UI 登录后，完成用户管理 API 的输入拒绝、创建、详情读取、删除与删除后访问检查。临时用户 `fqa_user_20260712_0329`（id=20）已由产品删除接口软删除；数据库同时确认用户关系清理审计。为测试管理能力而创建的临时角色 `fqa_user_admin_20260712_0329`（id=21）及其对 `test_admin` 的 assignment（id=56）已按 assignment -> role 顺序通过产品 API 撤销和删除，数据库确认均为软删除。没有残留活跃 FQA 用户、角色或 assignment；截图见 `test-results/FQA_20260712_0329_lintfix/USER-CRUD/cleanup-confirmation.png`。

## B2 用户组与成员关系 CRUD

隔离 Playwright Chromium 创建 runId 用户组 `id=9` 和测试用户 `id=21`，完成成员添加、成员列表、成员移除、用户删除及删除后访问。成员关系数据库已软删除，但移除后的成员列表仍返回该用户，已登记 `BUG-FQA-016`。空对象创建请求未执行输入校验并返回未处理 `500`，已登记 `BUG-FQA-015`。用户组没有公开删除端点（亦与既有 `group:delete` 无 consumer 的 `BUG-FQA-013` 一致），因此在成员关系和用户已清理后，只对 manifest 精确标识的组执行数据库辅助软删除；活跃 runId 用户组为 0。

## 授权迁移工作台安全路径

通过首页侧栏展开“身份与权限”并真实点击进入迁移工作台。严格预检返回 `eligible=true`、15 个有效账号、0 个待处理账号/异常/权限 diff，UI 显示严格 Enforced 与紧急回退操作。为验证确认词门禁，仅提交小写 `rollback`；API 返回 400，随后读取确认 configured/effective mode、cutover status 和 epoch 均保持 `enforced/enforced/1`。未执行实际回退或 Enforce。

## B2 作用域授权有效期

隔离 Playwright Chromium 创建仅含 `wiki:read` 的 runId 功能角色、用户及管理组主成员关系。用户首次登录完成“初始密码修改 + 资料补全”后，未来 `validUntil` 的 group assignment 允许 `GET /api/wiki/spaces`（200）；撤销后改建过去时间 assignment，以新会话读取相同端点返回 403。两条 assignment、membership、用户和角色均按依赖逆序由产品 API 清理；数据库确认软删除，审计包含首次改密、资料更新、assignment 增删、membership 移除及角色/用户删除。

## B2 assignment scope 拒绝路径

隔离 Playwright Chromium 创建 runId 用户、仅含 `wiki:read` 的角色及非成员业务组。为该用户尝试 group scope assignment 时返回 400“用户不属于目标作用域组”；成功创建 tenant assignment 后，重复同作用域返回 400；tenant assignment 传入 groupId 也返回 400。只有一条正确的 tenant assignment 被创建，随后经产品 API 撤销并删除用户/角色。非成员组没有公开删除端点，按清理协议仅对 manifest 标识的 `id=10` 执行数据库辅助软删除；活跃 FQA users/roles/assignments/groups 全为 0。

## B2 成员移除后的 group assignment 会话矩阵

创建 runId 用户、管理组 primary membership 和仅含 `wiki:read` 的 group assignment 后，完成首次安全设置；移除 membership 前 Wiki 空间读取为 200。通过产品 API 删除 membership 后，原会话和重新登录的新会话读取相同 Wiki 端点都仍为 200，违反“移除成员即失效”的 scope 合同，已登记 P0 `BUG-FQA-017`。数据库显示 membership 已软删除，但 group assignment 在测试检查期间仍存在；只读诊断定位 `RoleAssignmentMapper.findEffectiveRoleIds/findEffectiveScopes` 未关联 active membership。复现后 assignment、用户和角色均经产品 API 删除，数据库确认软删除。

## B2 自定义角色引用保护

创建 runId tenant assignment 后，删除关联自定义角色返回 400“角色仍有有效分配，无法删除”；撤销 assignment 后再删角色返回 200。临时用户、assignment 和角色均经产品 API 回收，数据库确认软删除，符合引用保护与依赖逆序清理合同。

## B2 内置角色保护与新授权边界

读取 `super_admin` 角色元数据及 98 项 permissions 快照后，创建 runId 用户并尝试通过新作用域 assignment API 授予内置角色，返回 400；对内置角色 update 和 delete 也均返回 400。随后重新读取角色，名称、code、builtin 标记和完整 permission 集与前快照相同，测试用户无 assignment 后被产品 API 删除。

## B2 禁用用户与会话撤销

创建 runId 用户并建立登录会话后，管理员更新 status=0。该会话访问当前 session 和受保护 Wiki API 均返回 401 `SESSION_REVOKED`；重新启用同一用户后新登录会话恢复 200。用户审计记录包含 create、disable、update、login_success 和 delete；测试用户随后通过产品 API 删除。

## B2 管理员重置密码与首次设置

创建 runId 用户并建立会话后，管理员通过 reset-password 将临时密码重置（newPassword 与 confirmPassword 一致）。原会话立即返回 401 `SESSION_REVOKED`；以重置后的密码登录强制进入 `/account/setup`。尝试在 setup 中把新密码设置为刚重置的临时密码，被密码历史策略拒绝且停留 setup。验证后用户已删除。一次缺少 `confirmPassword` 的初始请求被 DTO validation 拒绝且没有变更密码，对应临时用户在重试前已删除，不计为产品缺陷。

## B3 设备凭据库 CRUD

以 superadmin 的独立 Playwright 会话只读选择现有 CMDB 实例 `id=32` 作为关联，创建 runId 标记的设备。缺少 CI 的创建和空凭据输入均返回 400；设备完成详情读取、分类/说明更新、凭据添加、密码查看、凭据删除、设备删除和删除后访问（400）。密码查看在运行内与提交值匹配，但证据仅保留匹配布尔值，不持久化秘密。数据库确认设备与凭据软删除，设备创建/更新/凭据增删/查看密码/删除审计均存在；关联 CI 未被修改。

## B3 设备跨组数据范围

创建归属数据库组的 runId 设备，再以仅含 `device:read` 且管理组 group scope 的临时用户读取。设备列表正确为空，但直接 `GET /api/devices/{id}` 返回 200 和数据库组设备详情，已登记 `BUG-FQA-018`。诊断显示详情路径只对凭据使用 group filter，没有对设备自身 groupId 做拒绝。临时设备、用户、角色、membership 和 assignment 均已按依赖逆序清理。

## B3 CMDB 动态必填字段

通过产品 API 创建 runId 模型组、模型、属性分组及必填 `singlechar` 字段 `asset_tag`。省略必填动态字段创建实例返回 400；合法创建后详情包含字段定义和值，更新为 `FQA-002` 后刷新详情仍显示新值及字段元数据。按实例、属性、属性分组、模型、模型组逆序删除，所有 API 返回 200；数据库确认模型组、模型、字段、属性分组及实例均已软删除，实例 create/update/delete 与模型 create/delete 审计存在。

## B3 CMDB 关联状态链

创建 runId 自关联模型与两个实例。`connect` kind 的手工关系创建按产品合同返回 400（连接由端点连接管理维护），清理后改用 `depend` kind。关联创建、列表读取、metadata 更新、删除均成功；重复相同关系返回 400“该关联关系已存在”，删除后列表为空。按 relation、instances、association definition、model、model group 逆序删除，模型、定义和实例均已数据库软删除，CMDB 审计存在。

## B3 CMDB CSV 导入

以页面内真实 multipart 构造 runId CSV 导入。缺少必填 `asset_tag` 列的 preview 返回 400；合法 CSV preview 返回一条待创建记录、UTF-8 编码与 batchId。execute 返回 200 且实际写入实例，但结果为 `created=0/failed=1`，失败原因是导入审计将非 JSON 的 `batch_id=...` 写入 JSON `after_json` 字段，已登记 `BUG-FQA-019`。实例查询确认该条记录确已落库，形成写入与结果不一致；随后按实例、属性、属性分组、模型、模型组逆序清理，均已软删除。

## B4 共享文件删除后访问

根目录创建在 Enforced 资源策略下正确返回 403；改在已有且可创建的 `test` 目录下创建 runId 子目录和文本文件。删除前详情、下载和预览均为 200，并返回正确 `text/plain` 与 attachment/inline 文件名头。删除文件后，详情、下载、预览均一致返回 403 `RESOURCE_NOT_FOUND`；删除空目录成功。数据库确认文件和目录软删除及 create/upload/delete/delete_folder 审计；软删除合同保留 MinIO 对象，因此按 manifest 精确 key 移除后确认无 runId 对象残留。

## B4 Wiki 版本与删除后访问

创建归属管理组的 runId 空间与页面，完成两次保存、发布和详情读取；版本列表包含初始版本与两次保存共三条记录，详情为 published。删除非空空间正确返回 409；页面删除后详情和版本 API 均返回 403 `RESOURCE_NOT_FOUND`，随后空间删除成功。数据库确认空间/页面软删除、create/update/publish/delete 审计；三条页面版本作为历史合同保留。

## B5 运维日历模板 CRUD

空模板请求返回 400“模板名称必填”。创建 runId checklist 模板后列表可读取；更新标题、正文、检查项和 enabled=false 后列表立即反映新值；删除后列表为空。数据库 `ops_schedule_template` 记录已软删除，审计包含 create/update/delete。

## B5 运维日历周期规则状态链

空规则请求返回 400“规则名称必填”。以 weekly/creator 最小合同预览六个未来 occurrence，时间、到期时间和标题均正确。创建 disabled 规则后详情可读；enable 和 disable 均即时反映 enabled 状态；更新名称/说明后回读一致，删除后 get 返回 400“规则不存在”。短暂启用未生成 runId 任务，规则已软删除，审计包含 create、enable、disable、update、delete。

## B5 节假日配置 CRUD

空请求与 `holidayType=custom` 都触发未处理 500；数据库只接受 `legal/company/campaign`，已登记 `BUG-FQA-020`。使用数据库合法 `company` 类型创建未来 runId 节假日后列表可读；更新名称、日期范围、调休日、enabled=false 和备注均立即回读，删除后列表不含该记录，重复删除返回 400“节假日不存在”。数据库软删除与 create/update/delete 审计均已核验。

## B5 工作流定义版本状态链

空流程定义请求因缺少 key 返回未处理 500，已登记 `BUG-FQA-021`。使用最小 runId BPMN 创建定义版本 1，详情可读取 XML；按 key 更新生成版本 2，随后 suspend/activate 版本 2 均成功。删除版本 2 后版本 1 仍存在，按产品删除接口继续删除版本 1；最终 latest-definition 列表不含 runId key，审计包含创建、更新与两次删除。

## B7 系统配置与 AI 只读/拒绝合同

通过真实系统配置页面和 API 读取配置及 3 个 AI provider。SMTP 密码当前未配置，因此不存在掩码值；未将其视为失败。向通用配置 PUT 提交非白名单 runId key 后，响应 HTTP 为 200 但 body `code=500`“不支持的配置项”，已登记 `BUG-FQA-022`；二次读取、数据库和审计均确认没有配置写入或副作用。

## B7 审计日志读取与过滤

从首页侧栏进入系统管理 → 审计日志，页面标题正常且无 Console error。只读 API 查询却未遵守分页合同：`page=1,size=20` 返回 2,737 条记录但 `total=0`；`module=cmdb,page=1,size=50` 返回 150 条 CMDB 记录但同样 `total=0`；`page=1,size=2` 仍返回全量历史。未来日期查询正确返回空集，证明条件过滤有效而分页/计数失效。该问题已登记为 P1 `BUG-FQA-023`；未创建任何测试数据。

## B7 报表导出正常与反向日期

从首页展开“报表分析”并点击“综合报表”进入 `/reports`。同日范围 `2026-07-12` 导出得到非空 Excel（3,804 bytes），建议文件名为 `日报汇总_2026-07-12_2026-07-12.xlsx`；反向日期 `2026-07-12` 至 `2026-07-11` 被页面阻止并提示“开始日期不能晚于结束日期”。页面与下载过程没有 Console error 或 HTTP 5xx。此处完成 `REPORT-002` 的可用导出和日期反向边界；`REPORT-001` 的多日期/明确空态及 `REPORT-003` 聚合比对仍待执行。

## B7 通知读取、单条已读与目标跳转

通过首页通知铃铛进入通知中心。列表请求返回 31 条 records 却声明 `total=0`，已登记 P2 `BUG-FQA-024`。唯一未读消息为本轮 Wiki 发布产生的 `id=42`，因此安全点击该消息完成单条已读验证：`POST /api/notifications/42/read` 返回 200，刷新后 `isRead=true`、未读数从 1 变为 0，且无 Console error。该消息含 `refType=wiki_page/refId=90`，但前端没有链接，点击不会离开通知页，已登记 P2 `BUG-FQA-025`。未执行“全部已读”，避免修改历史通知；双标签广播保持待执行。

## B7 报表空态与统计源数据比对

通过首页侧栏再次进入综合报表，导出 `1999-01-01` 同日范围得到仅含标题和表头（0 条数据行）的 Excel，文件名正确、无 Console error/HTTP 5xx，满足明确空态合同。当前 `/reports` 产品页只提供日报 Excel 导出，未呈现 CMDB/Workflow 统计组件；以同一会话只读调用统计 API 并对数据库源表聚合。Workflow 的 `dailyReportApproval` API 为 total=1、finished=1、running=0，与 `act_hi_procinst` 一致；CMDB 今日/本周/本月 action 汇总亦一致。但 30 日内源记录存在多个 instanceId，`top10Instances` 却为空，已登记 P2 `BUG-FQA-026`。没有创建、修改或清理任何对象。

## B8 统一 ACL 入口与旧入口 Enforced 门禁

并行隔离会话确认 `GET /api/access/mode/wiki` 与 `shared_file` 都返回 `state=enforced`、`enforced=true`、`useUnifiedEditor=true`；非法模块返回 400。旧 Wiki 空间/页面及共享文件夹 ACL GET 在 Enforced 下均返回 409 并引导使用统一资源权限接口；不存在统一 Wiki/共享文件资源均返回 400，未泄露内容。无对象创建、无授权或 ACL 变更、Console/HTTP 5xx 均为 0。`AUTHZ-016`、`WIKI-027`、`FILE-019`、`RBAC-025` 通过。

## B1 首页交互、命令面板与浏览历史

隔离浏览器从首页真实点击主内容快捷卡，确认待办、CMDB 概览、变更新建、流程任务、用户管理、告警、变更记录和日历均落到预期路由。`Meta+K` 打开命令面板，输入不存在关键字显示空态，`Escape` 关闭；进入流程任务页后，浏览器后退返回首页、前进和刷新均保留任务页。未创建对象，Console error 与失败请求均为 0。`HOME-002`、`HOME-004`、`HOME-006` 通过。

## B1 首页三种视口

独立浏览器以 1440×1000、1024×768、390×844 进入首页，三种视口的文档宽度均等于 viewport、无水平溢出，页头可见，关键按钮分别为 12/12/10 个；未捕获 Console error。`HOME-007` 通过。

## B1 主题切换与主题表面

从首页进入综合报表、Wiki Markdown 阅读和流程设计页，默认主题下三种表面均可读且未见 Console error。但页头、个人菜单、侧栏、报表页均没有主题切换控件，应用根元素也没有主题状态，因此无法执行深浅主题切换和刷新持久化。该完整用例判 FAIL，登记 P2 `BUG-FQA-027`；未修改任何数据或配置。

## B3 CMDB 概览、模型空态与实例详情只读链路

从首页真实进入 CMDB 概览；兼容路由 `/cmdb/instances` 正确落到 `/cmdb`。host 模型显示 6 个实例，san_switch、net_switch、storage 三个当前模型正确显示空态。由 UI 选择既有 host `id=24` 进入详情，基本信息、关联关系、拓扑、变更历史、告警、关联资源、变更文档/资源管理各 Tab 均可达；相关 CMDB 请求均为 200，Console/失败请求均为 0。`CMDB-001`、`CMDB-002` 通过。模型、实例、变更与历史接口同时出现 records 非空但 `total=0`，归入已登记的分页根因簇 `BUG-FQA-023`，不另记重复缺陷。

## B6 变更文档列表与既有详情只读链路

从首页展开“变更文档”进入文档列表。列表显示 2 条已通过文档；待审批/待补填/已拒绝/草稿均为 0，全部与已通过均为 2。首条记录可打开详情抽屉并进入完整详情，列表、详情和 CI 关联 API 均返回 200，Console error 为 0。未创建或修改文档。`CHANGE-001` 通过。

## B5 流程与日报只读链路

从首页进入待办中心，个人与组待办均正确为空态；我的任务也正确提示无待审批项。流程实例页运行中为空、已完成列表为 1 条，详情可打开；但已完成实例活动历史全部显示“进行中”，已登记 P2 `BUG-FQA-028`。日报审批页当前月日历和状态图例正常加载。所有请求为只读，未捕获 4xx/5xx/Console error。`FLOW-001`、`FLOW-003`、`DAILY-001` 通过，`FLOW-004` 失败。

## B4 Wiki 空间、阅读、图谱与搜索只读链路

从首页进入知识库，显示 6 个可读空间。进入 Release Notes 空间后，已有版本树、图谱控制和既有页面阅读均可用；全文搜索 `a` 返回 20 条结果。全程无 Console error 或失败请求，未写入任何 Wiki 数据。`WIKI-001`、`WIKI-013`、`WIKI-014` 通过。当前选中页面无反向链接，不能用空态证明链接回溯行为，`WIKI-012` 的 backlink 子场景保持 NOT_RUN。

## B3 设备密码库与 IPAM 只读入口

从首页进入设备密码库，列表有 2 条记录，既有设备详情的账号密码区域正确显示空凭据状态；未调用任何 reveal/copy 接口。IP 地址池页当前为空，API 和 UI 均返回明确空态。两页均无 Console/4xx/5xx，未写入对象。`DEVICE-001`、`IPAM-001` 通过当前数据可达的读取范围。设备列表 records=2 且 total=0，继续归入 `BUG-FQA-023` 分页根因簇。

## B4 共享文件夹树、列表与搜索空态

从首页进入共享文档，文件夹树加载 3 项，当前根目录文件列表为空且显示明确空态。输入 runId 不匹配关键字后，搜索请求返回 0 条且空态保持正确；无 Console error 或文件 API 4xx/5xx。未创建或读取文件内容。`FILE-001` 通过当前数据可达的读取/搜索空态范围。

## B5 运维日历视图与日期导航

从首页进入运维日历，月视图为 2026 年 7 月；切换周视图、列表视图及点击“今天”均成功。月、周、列表对应的任务查询范围分别切换，当前任务均为空；节假日接口返回 7 条数据。无 Console/4xx/5xx，未创建或改变任务。`OPS-002` 通过当前无任务数据下的视图、日期和筛选范围合同。

## B7 备份页只读入口复核

从首页系统管理进入备份与恢复页，列表返回 3 条记录且页面标题正常，无 Console/备份 API 错误。本次没有创建、删除、下载或恢复备份；创建/下载/删除闭环仍以既有 `BACKUP-CRUD` 证据为准，不重复结算用例。列表响应 records 非空但 total=0，继续归入 `BUG-FQA-023` 分页根因簇。

## 中途清理清单纠偏

发现 manifest 与 checkpoint 不一致：清单仍把早期 RBAC 夹具列为 active。通过产品 API 回读确认 viewer `id=19` 已不存在、该用户与 `test_admin` 的临时 assignment 均为 0；有效角色列表不含本轮 `fqa_no_write_20260712_0329` 和 `fqa_tenant_admin_20260712_0329`，仅保留既有非本轮测试角色。已将 6 条过期 active manifest 条目更正为 cleaned；无用户、角色、assignment 或 membership 残留。

## B7 系统配置与 AI 只读入口复核

从首页系统管理依次进入系统配置和 AI 配置。SMTP 配置表单、保存入口及 AI provider 列表均正常显示；`/api/admin/config` 和 `/api/admin/ai/providers`（3 个 provider）均成功，未见 Console/4xx/5xx。为不改变环境，本次未保存配置、修改 provider 或调用外部测试连接；现有 `SYSTEM-CONFIG-READ-BOUNDARY` 结论不变。

## B5 运维日历管理页只读覆盖

在已认证会话中读取模板、周期规则、排班、节假日、统计复盘和素材归集六个管理页。模板和排班当前为空，规则返回 6 项、节假日返回 7 项，统计成功加载；所有页面可达且未见 Console/4xx/5xx。未执行启停、导入、保存、删除或导出；既有 CRUD/状态链结论不变。

## B5 运维日历入口权限

隔离会话从首页“查看日历”真实点击进入 `/ops-calendar`，日历入口、月/周/列表以及我的/本组/全部范围均按当前平台管理员权限可见且读请求成功。无 Console/失败请求。`OPS-001` 通过；低权限角色的反向入口与 API 拒绝仍保持待覆盖。

## B3 CMDB 告警、2D、变更与统计辅助页

读取告警中心、2D 拓扑、变更记录和 CMDB 统计四个页面。告警当前为空；2D 与统计页面、变更记录均正常加载，相关请求没有 Console/4xx/5xx。模型列表与变更记录继续出现 records 非空而 total=0，归入 `BUG-FQA-023` 分页根因簇，未新增重复缺陷。

## B2 用户组只读入口

从首页展开身份与权限进入用户组页，列表读取 7 个用户组，页面标题正常，无 Console/组 API 4xx/5xx。未新增、修改或删除用户组/成员；已有空输入、成员移除与范围问题的缺陷结论不变。

## B5 流程配置管理页只读覆盖

读取流程模板、流程设计、流程绑定、流程配置和流程统计页。模板返回 3 项、binding 返回 1 项、流程定义分页 total=2、统计返回 2 项；全部页面可达且无 Console/4xx/5xx。未发布定义、修改模板/绑定或执行任何流程管理 mutation。

## B1/B2 superadmin 账号页面冻结验证

从首页头像菜单依次打开个人资料和修改密码真实入口，分别落到 `/account/profile`、`/account/password`，页面标题与 profile 读取正常，未见 Console/账号 API 错误。没有填写或提交任一字段，superadmin 密码及资料保持冻结。`ACCOUNT-010` 通过。

## B6 变更模板管理页只读入口

从首页变更文档菜单进入模板管理页，现有 4 个模板和 2 条变更文档读取成功，页面标题正常且无 Console/4xx/5xx。未新增、编辑、删除模板或修改字段类型；模板 CRUD/导出用例仍以既有和后续夹具覆盖为准。

## B3 CMDB 动态路由只读补充

验证模型兼容路由、模型管理/属性页、既有实例关联页、拓扑、拓扑比较和影响分析。`/cmdb/models` 按兼容合同重定向至 `/cmdb/admin`；其余 6 条动态路由均正常渲染，未出现 Next 404、Console error 或 CMDB API 4xx/5xx。仅覆盖落地/读取合同，不替代关联、差异和影响分析的业务操作用例。

## B3/B5/B6 新建表单页面只读渲染

加载新建变更文档、设备和日报三个路由，均正常渲染表单控件（分别 26/20/26 个 input/textarea/button），无 Next 404、Console 或 API 4xx/5xx。为避免创建未登记数据，本次不填写或提交；创建、输入边界和状态链仍保留为独立执行项。

## B6 变更模板动态详情页

由模板列表的真实链接进入 `/admin/change-doc-templates/4`，详情页正常渲染，无 Next 404、Console 或模板 API 错误。未保存字段、排序或预览变更；仅补充动态详情页面落地证据。

## B2 身份权限管理页只读覆盖

读取用户、角色、权限矩阵和授权迁移异常四个管理页。用户 15 条、角色 6 条、资源 26 项、permission 98 项，迁移异常当前为空；页面和 API 均无 Console/4xx/5xx。用户列表 records=15 且 total=0，归入 `BUG-FQA-023` 分页根因簇。未创建/编辑用户角色、保存权限或执行迁移写操作。

## B7 通知已读后稳态复核

此前 runId Wiki 发布通知已被安全地单条标记为已读；重新打开通知中心后未读数为 0，`id=42` 保持 `isRead=true`，页面显示无未读提示且无 Console/4xx/5xx。通知列表 records=31 但 total=0，继续归入 `BUG-FQA-024`/分页根因簇；未执行全部已读以避免修改历史通知。

## B4 Wiki 编辑入口可发现性核验

读取 Release Notes 空间的现有发布页树，页面仅暴露空间首页、已发布页面、图谱和导出入口，没有编辑动作；全程无 Console/Wiki API 错误。未通过猜测 URL 进入编辑页，`P-047` 仍保持未执行，等待具备编辑权限且可安全恢复的专属夹具。

## NP-001 当前会话刷新保留

以 superadmin 登录后进入个人资料并浏览器刷新，仍停留在受保护路由；profile API 连续返回同一 `superadmin`，无 Console error。未 logout、touch、修改资料或密码；会话撤销/失效分支继续以既有专属账号证据为准。

## B1 首页指标读取

superadmin 登录后工作台正常渲染；首页关联的 CMDB 告警、组待办和运维日历摘要请求均完成，没有 Console 或 API 失败。仅覆盖管理员正向指标加载，不替代低权限首页过滤矩阵。`HOME-001` 通过管理员正向路径。

## B7 系统路由刷新与返回合同

从首页侧边栏依次真实进入系统配置、AI 配置、审计日志、备份与恢复、通知中心五页；每页刷新后保持原路由，浏览器返回回到首页。目标 API 均为 200，无 Console/4xx/5xx。未写入配置、provider、备份或通知；审计分页缺陷仍由 `BUG-FQA-023` 单独追踪。

## NP-002 命令面板键盘选择

从首页以快捷键打开全局搜索，输入 `CMDB` 并等待异步结果稳定后，通过 ArrowDown + Enter 选择首项；面板关闭并跳转至真实 Wiki 搜索结果 `/wiki/6/64`，无 Console/4xx/5xx。该路径不修改任何业务数据。`HOME-004` 的键盘结果跳转子场景通过。

## B7 报表导出服务端日期边界

前端会阻止反向日期，但以认证会话直接调用导出 API 时，`startDate=2026-07-12/endDate=2026-07-11` 仍返回 HTTP 200、XLSX MIME 和 3,805 bytes 文件。已登记 P2 `BUG-FQA-029`；请求不写入数据。

## B5 运维日期范围服务端边界

同一反向日期范围下，统计接口正确返回 400；任务列表却返回 200 空数组，已登记 P2 `BUG-FQA-030`；素材归集接口返回未处理 500，已登记 P2 `BUG-FQA-031`。三个请求均只读、无数据写入。

## B3 日报与日期参数服务端边界

认证态下，日报组查询的 `month=2026-99` 与 `month=foo` 均返回未处理 500，已登记 P2 `BUG-FQA-032`。此外，运维任务列表的 `startDate=invalid` 同样返回 500，确认 `@DateTimeFormat` 类型转换失败未被全局异常处理器转换为 400，已登记 P2 `BUG-FQA-033`。三个请求均只读、未创建或修改任何业务数据。

## B5 运维排班、统计与素材第二轮只读边界

从首页真实导航到排班、统计与素材页。排班正常范围加载 HTTP 200、空态无异常，`OPS-016` 只读部分通过；素材归集 HTTP 200、零指标和空态正确，`OPS-019` 归集只读部分通过。统计页正常范围为 200，反向范围被服务端正确拒绝为 400，但页面持续“加载中…”并产生 Console error，登记 P2 `BUG-FQA-034`，`OPS-018` 页面错误态失败。素材下载按钮存在但未执行下载，MIME/建议文件名/字节合同仍保持未结算；本批次没有任何写操作或测试夹具。

## B5 运维素材导出浏览器合同

从首页进入运维日历并通过“管理 → 素材归集”触发“导出 Excel”。认证态 GET 返回 200，MIME 为 XLSX；浏览器建议文件名为 `运维素材_2026-05-01_2026-07-31.xlsx`，下载内容 4,295 bytes、ZIP 签名 `504b0304`，无下载失败和 Console error。临时下载文件在核验后立即删除；未创建或修改业务数据。`OPS-019` 下载合同通过。

## B7 系统管理导航权限合同审计

只读审计确认系统管理父菜单及 AI 子项使用 `notification:manage`，但审计、备份和 AI 页面/API 分别按 `audit:read`、`backup:read`、`ai_config:read` 控制。此导航合同使仅具备实际功能读权限的用户无法从首页进入已授权页面，登记 P1 `BUG-FQA-035`。没有可安全复用的低权限会话，`CONFIG-006`、`AI-004`、`AUDIT-003`、`BACKUP-003` 的精确运行时拒绝仍不结算；未登录低权限账号、未写入数据。

## B5 流程统计只读合同

从首页进入流程统计，接口 HTTP 200 并返回两个现有流程定义，但卡片的 key/计数/通过率为空且平均时长呈 `NaN 小时`。源码确认后端 Map 使用 snake_case、页面 DTO 使用 camelCase，登记 P2 `BUG-FQA-036`；未创建、修改或终止流程实例。

## B4 Wiki 空间导出浏览器合同

从首页真实进入知识库 → `Release Notes` 空间，触发“导出空间”。认证态 GET 返回 200，Content-Type 为 `application/zip`、Content-Disposition 为 `Release Notes.zip`；浏览器建议文件名相同，下载 28,140 bytes 且 ZIP 签名为 `504b0304`，没有 Console/请求错误。临时下载文件在核验后立即删除，未写入 Wiki 数据。`WIKI-017` 空间导出通过。

## B6 变更文档现有数据导出浏览器合同

从首页侧栏进入文档列表，打开现有已通过记录的详情并触发“导出方案 PDF”。认证态下载建议文件名 `CHG-20260628-001_方案.pdf`，内容 10,034 bytes、PDF 签名 `25504446`，没有 Console/请求错误。临时下载文件已删除，未创建、编辑或删除文档。`CHANGE-013` 已通过已通过状态的方案 PDF 导出路径；其他状态与 Word 格式继续按用例矩阵结算。

同一已通过文档的“导出方案 Word”也通过真实页面下载：建议文件名 `CHG-20260628-001_方案.docx`、12,445 bytes、DOCX ZIP 签名 `504b0304`，无 Console/请求错误；临时文件已删除。

## B2 用户创建输入拒绝边界

认证态直接提交三类必然无效的用户创建请求：缺少用户名/密码、非法手机号和弱密码，均返回 HTTP 400 与明确字段/密码策略消息。随后按两个带前缀用户名精确查询，结果均为空，确认无用户残留。该批只覆盖拒绝输入边界，不替代创建、资料、会话和授权状态链；未修改 `superadmin`、角色或 membership。

## B5 排班日期服务端边界

认证态查询排班正常范围为 200 空数组；反向范围也返回 200 空数组，登记 P2 `BUG-FQA-037`。非法日期 `from=invalid` 返回 500，作为 `BUG-FQA-033` 全局 `@DateTimeFormat` 异常映射缺陷的又一端点表现保留证据。三次均为 GET、无写入。

## B3 设备与 IPAM 不存在资源、分页边界

认证态下，不存在设备、凭据、地址池和地址池利用率均返回明确 400 业务消息；不存在 CI 的地址分配查询返回 200 空集。`page=0&size=0` 的设备列表却返回 2 条 records 且 total=0，作为 `BUG-FQA-023` MyBatis-Plus 分页根因簇的再次证据。所有请求为 GET，未读取密码内容、未写入设备/IP 数据。

## B1/B3/B4/B5/B6 动态不存在资源错误态复核

直接动态路由补充验证显示，设备、IPAM、变更文档和日报均能在页面呈现明确不存在提示，但各自 API 400 被浏览器记录为 Console error；Wiki 不存在页面呈现“页面不存在或已删除”，其后端使用 403/`RESOURCE_NOT_FOUND` 合同。CMDB 不存在实例在 4.5 秒后完成三次 400 重试并显示“加载实例失败（400）：实例不存在”，不是永久 loading。各路径均为只读；前述不一致的 HTTP/Console 合同继续按现有 `BUG-FQA-009/033` 类问题簇追踪，不重复创建缺陷。

## B3 CMDB CSV 模板下载合同

从首页进入中文显示名模型“应用”的实例列表，打开导入 CSV 后点击“下载 CSV 模板”。页面将路由参数二次编码，模板接口返回 400、无下载且出现 Console error，登记 P2 `BUG-FQA-039`。认证态对照证明原始“应用”与 ASCII `app` 都能返回正确 CSV 表头；全程未上传、预览或执行导入。

## B5 日报导航与 B3 ASCII 模型模板对照

从首页进入日报审批，月份由 `2026 年 7 月` 正常切换至 `2026 年 6 月` 并可回到原月，期间无 Console/API 错误，`DAILY-001` 月份导航子路径通过。再从首页进入 CMDB 的 ASCII 模型 `app`，导入弹窗成功下载 `app_import_template.csv`（45 bytes、表头 `app_name,app_code,owner,repo_url,description`），无错误；确认 `BUG-FQA-039` 是中文模型路由参数编码路径问题而非模板服务全局故障。

## B3 CMDB 现有数据只读复核

从首页真实进入 CMDB，概览、ASCII 模型 6 条实例、多个中文模型空态、告警、变更、可见的变更统计入口和 `/cmdb/instances` 兼容跳转均正常。实例、模型、变更列表仍复现非空 records 配合 total=0，继续归入 `BUG-FQA-023`，无新缺陷；未创建、编辑、导入、导出或删除。

## B5 Workflow 只读复核

待办中心、我的任务、流程实例及统计页均可读取和刷新；没有审批、挂起、终止或定义变更。流程统计仍显示空指标和 `NaN 小时`，复现既有 `BUG-FQA-036`，没有新缺陷。

## B7 配置与 AI 标签只读复核

从首页系统管理进入系统配置，邮箱、日报提醒、文档水印和流程配置四个标签均可切换；AI 配置显示 3 个 Provider 卡片及掩码密码输入控件。未点击保存或测试，未发生业务写入、Console 或 API 失败；仅认证登录和 session touch 请求被记录为非业务会话操作。

## B3 CMDB 拓扑与影响分析只读合同

选择现有主机实例 `id=24`，拓扑 GET depth=2 正常返回单节点空图（1 node、0 edge）；影响分析 POST 仅执行读计算，返回 200。未创建、修改关联或实例。该数据范围只覆盖空图/空影响结果，不替代包含关系和循环的状态矩阵。

## B7 报表与通知只读复核

综合报表的 `2026-07-12` 同日 XLSX（3,804 bytes）与 `1999-01-01` 空日 XLSX（3,803 bytes）均下载成功且建议文件名正确。通过首页页头铃铛进入通知中心，刷新后仍保持页面、无 Console/4xx/5xx；当前页面没有筛选控件，无法执行筛选动作。通知 API 仍返回 31 条 records、total=0、unread=0，继续归入 `BUG-FQA-024`，没有标记任何通知已读。

## B7 审计筛选与备份只读复核

审计页的模块筛选 `device` 正常生效，但 records 非空且 total=0，继续归入 `BUG-FQA-023`。页面只有模块和日期控件，缺少动作、操作人和关键词筛选，后端也未支持 action/keyword 参数，登记 P2 `BUG-FQA-040`。备份页读取 3 条记录，首条 `.tar.gz` 下载成功（1,462,314 bytes）并在核验后删除；恢复确认弹窗明确提示覆盖不可撤销，点击取消后关闭，未执行恢复/删除/新建备份。

## B4 Wiki 搜索与图谱重测

首页全局搜索 `v0.34.0` 命中并跳转至 Wiki 页面，刷新后路由稳定；`Release Notes` 图谱显示 27 个页面、0 条引用，既有空空间图谱显示 0/0 与空态。无 Console/HTTP 错误、无写入；此前脚本因定位器歧义失败的记录不作为产品结论。

## B5 运维任务拒绝输入边界

认证态 POST 空任务体返回 400“标题必填”，反向计划/截止时间返回 400；非法优先级返回未处理 500，补充归入 `BUG-FQA-014` 的枚举/数据库约束漂移。按当天范围回读不存在 runId 标题任务，确认无测试任务残留。

## B3 IPAM 最小 CRUD 与清理闭环

创建 runId `/30` 地址池 `id=3`，读取确认初始 2 个可用地址和零分配，更新描述/DNS 后回读一致；未创建 allocation，随后通过产品 API 删除。删除后详情返回 400“地址池不存在”，清理闭环完成。`IPAM-002` 创建/更新和 `IPAM-010` 无 allocation 删除子路径通过；对象已立即写入清单并标记 cleaned。

## B3 设备最小 CRUD 与清理闭环

使用现有主机 CI `id=24` 创建 runId 设备 `id=5`，确认名称/IP/设备类型均由 CI 派生、凭据列表为空；更新 category/description 后回读一致。未创建或查看凭据，随后通过产品 API 删除，删除后详情返回 400“设备不存在”。`DEVICE-002` 创建关联、`DEVICE-004` 可编辑字段和 `DEVICE-008` 删除子路径通过；对象立即写入清单并标记 cleaned。

## B4 Wiki 页面导出范围合同

从首页进入 `Release Notes` 的既有页面后点击页面“导出”，下载成功但实际请求为空间导出端点，生成整个 `Release Notes.zip`。单页导出端点存在，按钮语义与下载范围不一致，登记 P2 `BUG-FQA-038`。临时 ZIP 已删除，没有 Wiki 写入。

## B4 旧 ACL 读取入口 Enforced 门禁复核

在 Enforced 模式下，认证态分别读取既有共享文件夹、Wiki 空间和 Wiki 页面 ACL 入口，三个请求均返回 HTTP 409 和明确迁移提示“新授权模型已生效，请使用资源权限接口读取 ACL”。该轮仅执行 GET，无数据写入；`FILE-019` 与 `WIKI-027` 的旧入口门禁子路径通过，不替代统一资源权限接口的完整授权矩阵。

## B7 通知与系统配置只读稳态复核

复核同一运行的独立浏览器证据：通知铃铛入口、列表读取、刷新和返回均正常；通知接口仍返回非空 records 与 `total=0`，并且页面没有筛选控件，继续归入 `BUG-FQA-024`。系统配置通过首页进入、四个标签、刷新和返回均正常。该复核未执行单条/全部已读或两标签广播，故不将 `NOTICE-001`、`NOTICE-003` 结算为通过；无写入、下载或账号变更。

## B7 通知无权限 guard 运行时复核

新建隔离角色/账号，仅授予 `group:read` 并建立管理组范围 assignment。账号完成首次改密后有效权限仍只有 `group:read`；没有 `notification:read` 时，通知列表、未读数和对不存在通知的标记已读请求均返回 HTTP 200，而该权限矩阵的 deny 合同要求 403。不存在 ID 的标记未产生通知状态变化。该复现补强既有 P1 `BUG-FQA-008`，不新增重复缺陷；夹具已按 assignment → membership → user → role 逆序通过产品 API 清理，角色/用户回读为零，未持久化凭据或修改 `superadmin`。

## B7 通知只读 allow 夹具

复用并重置已登记的 runId 通知只读夹具，完成首次 setup 后复登确认有效权限仅 `notification:read`。通知列表与未读数均返回 HTTP 200，满足该读取权限的 allow 合同；未执行任何通知状态写入。随后按 assignment → membership → user → role 的产品 API 逆序清理，四步均为 200，用户/角色回读匹配数均为零。与无权限 200 的结果结合，说明 allow 路径正常但 guard 未实际区分权限，继续归入 `BUG-FQA-008`。

## B7 审计专属权限运行时矩阵

创建并完成首次 setup 的 `audit:read` 专属组范围夹具。审计列表读取返回 200，而 AI、备份和系统配置读取均被 403 拒绝，验证该 API 的 allow/deny 边界。真实首页中“系统管理”及审计链接均不可见，直接访问审计路由未渲染审计内容；该首页可达性漂移稳定归入既有 P1 `BUG-FQA-035`，不新增重复缺陷。夹具已按 assignment → membership → user → role 逆序清理，回读无角色或账号残留。

## B5 日报不存在详情错误态复核

独立 Playwright 从 `/login` 登录并通过首页“日报审批”进入 `/daily`，随后打开不存在详情 `/daily/999999999`。后端 GET 返回业务 400，页面在 15 秒内退出加载并明确显示“日报不存在”；仅产生对应 400 的 Console error，无业务写请求。此前该页面错误态的 NOT_RUN 子项现有稳定 UI 证据，但 400 仍应作为已解释业务拒绝而非成功响应处理。

## B3 IPAM 指定分配与释放状态子链

创建 runId `/30` 地址池后，指定地址分配成功；释放成功，重复释放以成功幂等语义返回且计数保持可删除状态。随后通过产品 API 删除地址池，删除后读取明确返回“地址池不存在”。分配已释放且地址池已清理；本子链未覆盖自动分配或释放后再分配，因此不将完整 `IPAM-005`、`IPAM-007` 主用例结算为通过。

## B3 IPAM 自动分配后再分配

创建 runId `/30` 地址池后，首次自动分配成功并得到 `10.255.252.1`，释放成功。再次自动分配错误地再次选择该已释放地址，但插入时被 `(pool_id, ip_address)` 唯一约束拒绝，返回 HTTP 500；后续释放没有可释放对象。已通过产品 API 删除地址池，删除后读取返回“地址池不存在”，无活动测试对象。`IPAM-007` 记 FAIL，登记 `BUG-FQA-041`；不将失败的自动再分配误记为覆盖通过。

## B8 授权切换只读安全复核

读取 cutover、strict preflight、pending users 与 open/resolved migration exceptions 均成功：当前为 Enforced、epoch 1、preflight eligible、pending/open exception 均为零。分别提交无效 `ENFORCE` 和 `ROLLBACK` 确认词，均被 400 拒绝，前后 cutover 完全一致。未执行任何授权状态转换；`AUTHZ-010` 仍需独占窗口和明确授权，继续保持 BLOCKED。

## B1 独立浏览器连接前置检查

`http://localhost` 可达，独立 Chrome 正在运行且扩展与原生宿主登记正常，但两次浏览器控制绑定均返回 extension unavailable。因此本批没有尝试登录、导航或 UI 操作，未将任何 API 或旧浏览器证据冒充新的 UI 执行结果。恢复选定 Chrome 配置的扩展连接后，需从首页重新执行剩余 UI 主路径。

## B1/B4 独立 Playwright 首页、Wiki 与共享文件只读复核

改用独立 Playwright Chromium 后，从登录页真实登录并到达首页。首页点击进入知识库，打开既有 `Release Notes` 空间并刷新成功；首页点击进入共享文件，按文件名搜索并刷新成功。全程无 Console error、失败请求或业务写操作，只有登录和 session touch。该批补强了 Wiki/文件入口与刷新证据；Wiki 页面未提供本页搜索控件，不将其替代全文搜索完整用例。

## B1/B5/B7 独立 Playwright 运维日历与报表只读复核

从首页侧栏进入运维日历，完成月/周/列表切换、日期前进以及“我的/本组/全部/排班/公共”范围切换，均呈现稳定空态；经管理菜单进入统计页并以合法日期读取零值/空态。再从首页进入综合报表，四种日期快捷范围均可切换；同日导出获得 `日报汇总_2026-07-12_2026-07-12.xlsx`（3,803 bytes、ZIP 签名），临时下载已清理。全程无 Console error 或失败请求；不替代任务创建、状态转换或跨组范围正确性完整用例。

## B3 独立 Playwright CMDB 只读复核

从首页进入 CMDB 概览、2D 视图与 host 模型既有实例列表，页面均正常渲染且未调用创建、导入、编辑或删除。动态影响路由补充验证 `/cmdb/impact/1` 时，`GET /api/cmdb/instances/1/impact` 返回 400 并显示框架错误页，登记 P2 `BUG-FQA-042`。该探针仅验证不存在/无效动态路径错误态，不替代既有实例影响分析的完整图谱用例。

## B5 独立 Playwright 日报与流程只读复核

从首页进入待办中心、我的任务和流程实例，个人/组待办与任务空态正常，运行中/已完成实例标签可切换。打开既有已完成日报审批实例后，活动历史仍全部显示“进行中”，复现既有 `BUG-FQA-028`，不重复登记；无 Console/失败请求和业务写入。日报与流程统计等剩余页面因本批定位器提前终止，保持 NOT_RUN。

## B2/B8 独立 Playwright 身份权限与迁移工作台只读复核

从首页发现侧栏入口后依次进入用户、用户组、角色、权限和授权迁移工作台；每页均完成渲染、可用只读筛选（存在时）、刷新及浏览器返回首页。89 条页面 API 响应均为 200，无 Console error、失败请求或业务写入，仅保留认证/login 与 session touch。权限配置未选择角色时显示“请先选择角色”，符合当前路由合同；此批不替代角色保存、授权关系或迁移写状态用例。

## B7 独立 Playwright 系统管理只读复核

从首页侧栏依次进入系统配置、AI 配置、审计日志、备份与恢复和通知中心。系统配置/AI 读取与刷新正常；审计页面控件与刷新正常；备份列表中恢复确认弹窗可打开并取消，未执行 restore；通知列表和刷新正常且未标记已读。75 条 API 响应均为 200，无 Console/请求错误、无业务写请求；该批不替代配置保存、AI 连通性、备份创建/删除、实际 restore 或通知状态链用例。

## B6 独立 Playwright 变更文档与模板只读复核

从首页真实进入变更文档，侧栏文档列表与模板管理子入口均可点击。既有文档列表、状态筛选、刷新和详情阅读正常；已通过文档 Word 导出获得 12,445 bytes，临时文件已清理。模板列表、类型筛选、刷新及既有模板字段配置详情均正常。无 Console error 或业务写入；路由切换中的 Next RSC 预取 `ERR_ABORTED` 均为被取消预取、对应页面/API 最终 GET 成功，不作为产品缺陷。

## B5 独立 Playwright 流程配置只读复核

从首页展开流程中心后，经侧栏链接进入流程模板、流程设计、流程绑定和流程管理，均可读取和刷新；模板页还验证既有流程实例标签切换。无 Console/失败请求或业务写入。流程统计页因侧栏动画遮挡定位器而未完成，保留证据但不将自动化定位失败计为产品缺陷；此前流程统计 UI 已按 `BUG-FQA-036` 单独留证。

## B3 独立 Playwright 设备与 IPAM 只读复核

从首页资源管理入口进入设备和 IPAM。设备列表、无结果搜索、既有设备详情及刷新正常，未查看凭据明文；IPAM 列表与无结果搜索正常，当前无地址池，未将空数据当作详情通过。不存在设备与地址池动态路由均使 GET 返回 400、页面永久停留“加载中…”并产生 Console error，登记 P2 `BUG-FQA-043`。CMDB 预取 `ERR_ABORTED` 为路由预取取消，未影响设备详情最终读取；没有任何业务写入。

## B1 首页响应式与主题入口复核

在 1440×1000、1024×768、390×844 三个视口从登录页进入首页，均无水平溢出、可见关键控件越出视口或 Console/请求错误；移动端按设计收起为图标侧栏并纵向排布内容。首页未发现可直接标识的主题切换控件；为避免变更 `superadmin` 的持久主题偏好，未执行 HOME-008 跨页主题持久化子链，保持 NOT_RUN。

## B3 独立 Playwright CMDB 告警、变更与统计只读复核

从首页展开 CMDB 后进入告警中心、变更记录和变更统计。告警级别/状态、变更模型/动作筛选与清除均为 GET；变更统计经页面真实链接进入、刷新并返回正常。43 条 API 响应均为 200，无 Console/失败请求或业务写入；未确认告警、未修改实例或变更数据。

## B5 流程统计真实导航复核

独立 Playwright 从 `/login` 登录，首页点击“报表分析”再点击“流程统计”，最终进入 `/workflow/stats`。`GET /api/workflow/stats` 返回两条完整 snake_case 记录和 HTTP 200，但两张统计卡仍显示空指标及 `NaN 小时`；全程无 Console error 或失败请求，也没有业务写入。因此 `FLOW-013` 继续 FAIL 并稳定归入 `BUG-FQA-036`，明确排除此前侧栏定位器和路由预取影响。

## B2/B3 最小权限账号允许与拒绝矩阵

通过产品 API 创建 runId 临时功能角色和用户，加入管理组并建立 group scope assignment；首次登录按 required action 完成临时账号改密后，以新会话验证 `device:read`、`ip_pool:read`、`cmdb_instance:read` 三个读取入口均为 200。对结构合法的地址池创建请求返回 403“无权限”，确认未创建对象。随后严格按 assignment → membership → user → role 逆序通过产品 API 清理，用户和角色回读均不存在；未修改 `superadmin`，未持久化凭据。

## B2/B5 组织与运维最小权限矩阵

另建隔离 runId 临时角色和用户，完成 primary membership、group scope assignment 与首次 setup。新会话下 `group:read` 和 `ops_calendar:read` 读取均为 200；结构合法的组创建和运维任务创建均被 403“无权限”拒绝，未产生组或任务。夹具随后按 assignment → membership → user → role 产品 API 逆序清理，用户和角色回读均为零。

## B7 通知零权限 guard 复核

新建无角色、无 membership、无 role assignment 的临时账号，完成首次 setup 后重新登录，effective permissions 仍为空。该会话的 `GET /api/notifications` 与 `GET /api/notifications/unread-count` 均返回 200，而通知 Controller 四个端点的实际 guard 均为 `isAuthenticated()`；这再次确认与 `notification:read` 合同的漂移，归入既有 P1 `BUG-FQA-008`。夹具通过产品用户删除 API 删除，回读得到业务 not-found，未修改 `superadmin`，无活动测试对象或持久化凭据。

## B7 AI 与备份专属权限运行时矩阵

创建隔离的管理组范围角色，仅授予 `ai_config:read` 与 `backup:read`，完成首次 setup 并以新会话复核有效权限。AI provider 与备份列表 API 都返回 200；审计日志和系统配置读取返回 403，确认相邻功能仍被拒绝。真实登录首页不显示“系统管理”，但直接访问 `/admin/ai`、`/admin/backup` 都能完整渲染且读取数据，稳定复现 `BUG-FQA-035` 的首页入口缺失。两个页面初始化还各产生 403 Console error，属于低权限页面未收敛无权请求的额外错误噪声；本批未触发任何 AI 测试、provider 保存、备份创建、下载或恢复。夹具已按 assignment → membership → user → role 逆序清理，回读用户 400、角色匹配数 0、活动对象 0。

## B1/B2 认证、会话与账号资料子链

runId 临时零权限账号完成首次登录改密、双会话、单会话登出、管理员撤销会话、禁用与重新启用；所有预期会话状态均正确，账号已删除。资料和密码子链覆盖邮箱、手机号、头像、确认密码、复杂度、密码历史和改密后旧密码失效。手机号提交空串时接口返回成功却保留旧值，且资料完成状态不回落，登记 `BUG-FQA-044`；夹具已删除且未持久化密码。

## B4 Wiki backlink、评论与不存在资源补充

runId 夹具完成已知链接、别名、backlink、评论创建/分页、作者删除及非作者拒绝。未知 Wiki 链接会把内部 `<sup>` 提示标记作为原始文本显示，登记 `BUG-FQA-046`。不存在空间/页面/编辑路由及附件、backlink、评论 API 的错误态问题保持 `BUG-FQA-045`。所有评论、页面、空间、assignment、membership、用户和角色均按依赖逆序清理，manifest 回读为零活动对象。

## B7 notification:manage-only 反向矩阵

仅含 `notification:manage` 的 group scope 账号可读取系统配置和通知，但 AI、备份、审计 API 均为 403。首页却显示 AI/审计入口，直达 AI 被静默重定向首页并产生无权指标请求，继续归入 `BUG-FQA-035`。夹具已按 assignment → membership → user → role 清理并回读无残留。

## 页面差额只读批次

补齐 31 条动态/二级路由，其中 30 条稳定渲染且无错误；`/daily/1` 是已删除日报，仅显示“日报不存在”并产生 400，未结算为有效详情页 PASS。`/cmdb/impact/24` 的 POST 为影响分析的既有只读产品合同，不计为业务写入。

## B3 CMDB JSON/NDJSON 导入边界与更新

以 runId 模型执行 JSON 导入：非法 JSON 被 400 拒绝；两行 NDJSON 预览为 2 create、执行成功创建 2 个实例；随后 JSON 数组按唯一键预览为 1 update 并执行成功。所有实例、模型、模型组均按实例 → 模型 → 模型组逆序删除，`activeFixtureObjects=0`。列表响应的 `total=0` 与 records 包含两条刚导入数据不一致，作为现有分页/总数合同疑点保留，未在本次单独定性为新缺陷。

## B8 统一 ACL 乐观锁与输入拒绝

创建 runId 共享文件夹后，统一 ACL GET 返回初始 `2770`/version 0；PUT 更新为 `0770` 且 version 递增至 1；使用旧 version 再次 PUT 明确返回 409；无效 ACL 主体返回 400。临时文件夹已删除，资源回读为不存在，`activeFixtureObjects=0`。此前只读 ACL 合同补充确认匿名请求 403；完整 owner/named-user/group/others、祖先 traverse 与 default 继承矩阵仍待后续专用夹具覆盖。

## B7 备份创建、下载与删除闭环

创建 runId 备份后立即写入 manifest；列表可见 1,580,145 bytes 文件，下载返回 `application/octet-stream`、附件文件名和非空内容。随后通过产品 API 删除，并在列表回读确认不存在。首次执行尝试产生的备份记录亦已登记并清理；未执行实际 restore 或 upload。manifest `activeObjects=[]`。

## B5 排班边界复核

排班正常范围和反向范围均返回 200 空集，不存在排班更新正确返回 400；远期回读没有 runId 对象。反向日期结果与既有 `BUG-FQA-037` 一致，未重复登记。空 conflict 请求与缺手机号用户均返回空 warnings，作为当前冲突检测输入合同差额保留，尚不足以在没有明确产品必填/提示合同的情况下单独定性新缺陷。

## B6 变更文档状态前置条件与清理

runId 草稿创建与更新成功；在 draft 状态直接审批被 409 拒绝，无模板提交亦被 409 拒绝，刷新后仍为 draft。文档随后删除，读取返回业务不存在，`activeFixtureObjects=0`。该子链验证前置状态拒绝和草稿编辑，不替代带模板的提交、补方案、审批和导出完整状态机。

## B3 CMDB 模型元数据、复制与边界

使用 runId 模型组、模型、属性分组和枚举属性完成模型组编辑、模型标识非法/重复拒绝、属性分组编辑及含属性删除约束、模型复制（属性及属性分组完整保留）、模型重命名显示、跨组移动、颜色与 2D 开关更新/刷新，以及含模型分类删除拒绝。所有成功创建对象均在创建后立即登记 manifest，并按模型（级联属性/分组）→模型组逆序清理，`activeFixtureObjects=0`。模型颜色提交非法值应由 DTO 校验返回 400，却实际返回未处理 HTTP 500，登记 `BUG-FQA-047`；该问题不影响其余闭环证据。

## B6 Playwright 变更文档与模板首页路径复核

独立 Playwright 从 `/login` 登录 `superadmin` 后，经首页真实点击带计数的“文档列表”和“模板管理”入口。变更文档列表的状态筛选、刷新、既有详情与返回均正常；已通过文档的“导出方案 Word”下载为 `CHG-20260628-001_方案.docx`（12,445 bytes），临时下载文件已删除。模板列表筛选、刷新、既有模板详情和返回均正常。无 Console error、无应用 API 写请求；记录到的 Next RSC `ERR_ABORTED` 仅为未选中模板详情链接的预取取消，最终目标页面/API 读取成功，不定性为产品缺陷。该批补强 `CHANGE-001`、`CHANGE-013`、`CHANGE-014` 的 UI 只读/下载证据，不替代模板写入或完整审批状态机。

## B6 续跑：模板字段输入合同与生命周期缺口

对既有模板执行无副作用字段配置反向检查：重复 fieldKey 的 `PUT /api/admin/change-doc-templates/{id}/fields` 返回 400，前后字段数组完全一致，证明拒绝路径不写入。独立 Playwright 从首页进入模板列表和配置页，确认当前只提供创建、元数据更新、上传/解析、字段保存/删除与启停；没有模板复制或模板删除 API/UI。为遵守测试数据精确清理约束，未创建不能通过产品回收的新模板，因此 `CHANGE-014` 的创建/复制/删除闭环和 `CHANGE-015/016` 的完整可写字段矩阵不能结算通过。配置器当前只提供 text、textarea、date、datetime、readonly、ci_selector、table，缺少 catalog 要求的数字、枚举和预览能力；另无明确排序控制。已登记 `BUG-FQA-048`。所有检查均无新测试对象。

## B5 续跑：Workflow 模板实例清理门禁

认证态读取 3 个内置流程模板、0 个模板实例及 2 个流程定义。模板实例 Controller 只提供 GET/POST，无 DELETE；删除流程定义只删除 Flowable deployment，并不删除 `workflow_template_instance`，而 `bindNow` 还会留下业务绑定。因此在“所有 runId 对象必须精确清理”的约束下没有创建模板实例。该缺口使 `FLOW-005` 的模板生成/部署/启停/删除闭环无法安全执行，登记 `BUG-FQA-049`；不存在 DELETE 路由直接探测还返回 500。无业务写入、无夹具残留。

## B3 续跑：CMDB 端点连接与 managed 镜像边

以 runId 模型组、模型、connect 定义和两个实例创建 net endpoint link：连接创建 200；同一源端点重复创建 400；源、目的实例的连接列表均可见同一 link。relation API 的 `kind` 参数实际按关联 `defId`（而非 kind code）筛选；使用 runId defId 查询后，返回一条包含目的实例的 managed connect 镜像边。删除 link 后端点连接与 managed 镜像边均归零；两个实例、关联定义、模型和模型组均依赖逆序产品 API 删除，active fixture=0。先前使用 `kind=connect` 的空结果已判定为测试查询误用，不登记产品缺陷。

## B3 续跑：CMDB 关联扩展属性生命周期

在内置 `connect` 关联类型上执行独立 runId enum 属性闭环：缺少 enumOptions 被 400 拒绝；合法属性创建 200；同 kind 重复 fieldKey 被 400 拒绝；更新 name、required、枚举值、default 和排序后列表刷新一致。随后通过产品 DELETE 删除并回读确认不存在，active fixture=0。该用例覆盖关联属性定义的输入、创建、编辑、刷新和删除闭环。

## B3 续跑：CMDB 反向关联创建与删除

创建 runId 源/目标模型、`depend` 关联定义和两个实例。目标实例的 `reverse-defs` 正确包含该定义；不存在 def 的反向创建返回 400；按目标实例路径建立反向边后，源/目标两端 relation list 均可见同一 relation。通过目标实例路径删除后回读为空，再按 relation→实例→定义→模型→模型组逆序产品 API 清理，active fixture=0。

## B3 续跑：CMDB 实例克隆与批量更新

创建 runId 模型和两个实例。克隆源实例成功，副本名称自动追加“副本”且保留动态 marker；空 ids/fields 批量请求返回 400。对源、第二实例和副本执行同一批量更新，返回 total=3/succeeded=3/failed=0，三条详情均刷新为预期 status、owner 和 marker。按副本→第二实例→源实例→模型→模型组逆序产品 API 删除，active fixture=0。

## B3 续跑：CMDB 1:1 关联基数与方向边界

创建 runId 源/目标模型、`depend` 1:1 定义和四个实例。首条源→目标关联创建 200；复用同源到另一目标、复用同目标由另一源创建，均返回 400；将目标模型作为源反向提交同一 def 亦返回 400 并说明模型方向不匹配。刷新仅包含一条成功关联；随后按 relation→实例→定义→模型→模型组逆序产品 API 清理，active fixture=0。

## B3 续跑：CMDB 关联 metadata schema、更新与权限拒绝

以 runId 模型、`depend` 定义、required enum 关联属性和两个实例验证 metadata：缺少必填属性、JSON 枚举值域外分别返回 400；合法创建后更新枚举值和说明，列表刷新正确显示 merged metadata；删除关联后回读为空，全部 fixture 逆序清理。独立仅含 `cmdb_relation:read`、group scope 的账号能读取关联定义，但对有效关联创建返回精确 403/code 403；管理员前后关系集合均为空。该权限夹具及其资源、assignment、membership、用户、角色均已产品 API 清理。

## B8 命名 ACL、默认 ACL 与祖先 traverse

使用独立 runId 角色、账号、主组 membership 和 group scope assignment，且仅授予 `shared_file:read`。创建 runId 父/子文件夹后，在父目录配置命名用户 `--x` access ACL 与 `r-x` default ACL；子目录创建时继承命名用户 `r-x` access ACL。测试账号读取子目录成功（200）；随后将父目录命名用户权限改为 `---`，同一读取稳定拒绝（403），证明祖先 traverse 仍参与裁决。所有文件夹、assignment、membership、用户和角色已按依赖逆序通过产品 API 删除，manifest 无活动对象。

## B8 匹配组 ACL、others 与 scope 分层

创建独立 runId 角色和三名测试账号，均仅有 `shared_file:read`。在管理组归属的文件夹上，管理组 group ACL `r-x` 的组 scope 账号读取成功（200）；tenant scope、不同主组账号在 mode `0705` 下通过 others `r-x` 读取成功（200）；同权限但 group scope 指向数据库组的账号被拒绝（403），证明 scope 覆盖先于 others ACL 放行。最后改为 `0700`，tenant scope 账号被拒绝（403）。所有 folder、assignment、membership、账号和角色已依赖逆序删除，无活动 runId 对象。

## B8 授权迁移安全反向状态边

在 Enforced、epoch 1、预检 eligible、无 pending/open exception 的冻结状态下，覆盖资源回填非法 module/缺 system owner、异常状态/说明校验、不存在异常、cleanup/convert 的错误确认词和不存在对象，以及 Enforce/Rollback 的错误确认词。11 个请求均返回明确 HTTP 400；前后 cutover、epoch、预检、pending 用户、open/resolved exception 总数和 authorization 审计计数完全一致。未执行 account/resource backfill、异常实际处理、Enforce/Rollback、restore 或 break-glass，原因是这些操作会改变全租户历史授权或运行状态，仍遵守明确授权前置。

## B8 功能读取与 ACL 管理权限分离

以仅有 `shared_file:read`、管理组 scope 的 runId 账号读取同组 runId 文件夹成功（200），但统一 ACL `GET /api/access/shared_folder/{id}` 与 `PUT` 均返回 403。管理员前后读取的 ACL 内容和 accessVersion 均为 0，证明被拒绝的编辑未产生资源权限写入。文件夹、assignment、membership、账号与角色已依赖逆序清理。

## B8 setgid 属组继承

创建管理组归属的 runId 父目录，将其统一 ACL mode 设置为 `2770`。创建子目录时故意请求数据库组 ownerGroupId，创建成功后的子目录仍为管理组 ownerGroupId、mode `2770`，证明 setgid 强制沿父目录继承属组而非接受调用方请求。父子目录均已通过产品 API 删除。

## B8 Wiki 统一 ACL 管理拒绝与试验夹具恢复

并行独立夹具验证 `wiki:read` group-scope 账号可读取 runId space/page，但统一 ACL GET/PUT 均为 403，管理员 ACL/accessVersion 0 前后无变化；该正式夹具已完整逆序清理。主线早期重复试验曾在先删角色后删 Wiki space 的错误顺序下遗留一个 runId 空间和账号；未用 SQL，改由产品用户更新入口临时授予创建者最小 `wiki:delete`，删除其 own runId space 后删除用户与 recovery role。最终数据库核验 `fqa_wiki_acl_*` 用户、`fqa_wiki_recovery_*` 角色及 `FQA Wiki ACL*` space 均为零，manifest 无 active object。此恢复仅清理本批数据，不影响正式用例结算。

## B8 Wiki default ACL 与 setgid 创建继承

创建仅含 `wiki:read/create/delete/manage_acl` 的管理组 scope runId 账号。该账号创建 runId space、以统一 ACL 将 space 设为 `2770` 并加入命名用户 `r-x` default ACL；随后创建 page。page ownerGroup 继承 space 的管理组，page access entries 精确复制命名 default ACL；page 自身固定 mode 为 `0670`，符合 page 非容器资源不保留 setgid 的合同。page→space→assignment→membership→user→role 全部通过产品 API 逆序清理，数据库回读无残留。

## B8 Wiki 功能读取与 ACL 管理权限分离

以独立 runId `wiki:read`、group scope 的账号读取同组 runId Wiki space tree 与其页面均成功（200），但统一 ACL `GET/PUT /api/access/wiki_space/{id}` 均返回 403。管理员前后 ACL 快照完全一致，`accessVersion=0` 未变化，证明拒绝的编辑没有写入资源权限。页面、空间、assignment、membership、用户和角色已按依赖逆序通过产品 API 删除；manifest 无活动对象。

## B3 续跑：CMDB 拓扑与影响分析隔离图谱

以三个 runId 专用模型、两个 `depend` 定义与 root → middle → leaf 关系链验证拓扑和影响分析。`GET /api/cmdb/topology/{root}?depth=1/2/0` 均返回 3 个节点和 2 条边，证明拓扑递归与最小深度钳制可用；删除两条关系后，拓扑回读仅 root、0 边。相同图谱的 `POST /api/cmdb/instances/{id}/impact` 对 downstream（depth 1/2）、upstream（depth 2）和 bidirectional（depth 2）均返回 HTTP 200，但只有 root layer、`truncated=true`、0 edge，未返回任何可达节点，登记 `BUG-FQA-050`。所有关系、实例、定义、模型和模型组均按依赖逆序通过产品 API 删除，`activeFixtureObjects=0`。

## B3 续跑：CMDB 告警、变更历史与统计合同

当前租户没有告警记录；告警列表和 critical/warning、firing/resolved 筛选均返回一致空集。不存在告警确认不会写入列表或审计，但 HTTP 200 envelope 内含业务 `code=500`，正向确认与 leader/member 反向无法在没有公开告警创建/删除生命周期的前提下安全执行。变更历史 action/operator/date 筛选正确；`keyword` 参数并未被 Controller 接收，指定不匹配关键字仍返回未筛选的 107 行，登记 `BUG-FQA-051`。`size=1` 返回 107 行且 `total=0`，复现既有 `BUG-FQA-023`。统计结构可读取，但未来 `from/to` 虽清空 daily/top10，却仍返回当前 today/week/month 汇总，登记 `BUG-FQA-052`；Top10 为空继续归入既有 `BUG-FQA-026`。无夹具、无业务数据写入，manifest 无活动对象。

## B5 续跑：运维任务状态机清理门禁

审计任务 Controller 和 Service 后确认手工任务支持创建、编辑、确认、开始、完成、异常关闭和取消，但没有删除、归档或 purge 产品端点；取消只将任务置为 `cancelled`，并保留任务、时间线和审计。因此未创建任意 runId 状态机任务，以免留下无法精确回收的业务记录。`OPS-008` / `ST-OPS-001..014` 记为受产品清理合同阻塞，解除条件为提供可审计删除/归档路径，或明确批准保留这些测试历史；无夹具残留。

## B3 续跑：设备凭据加密、查看权限与审计

以 runId device/credential 及两个 group scope 最小权限账号执行闭环。空用户名/密码创建返回 400；设备详情仅显示凭据用户名、不含提交的运行时明文。含 `device:read + device:view_password` 的账号连续两次 API reveal 均成功匹配运行时 secret，并写入两条对应 `view_password` 审计；仅含 `device:read` 的账号精确 403，且没有其拒绝查看审计。独立 Playwright 从登录首页进入设备详情，查看/复制控件可见、加密信封 reveal 请求成功且切回隐藏；浏览器本地解密后的可见明文未稳定出现，因此仅结算已验证的控件和加密请求合同，不作为缺陷。所有 credential、device、assignment、membership、账号和角色均通过产品 DELETE 成功清理，`activeFixtureObjects=0`。

## B5 续跑：日报生命周期清理门禁

日报接口只有创建、编辑、提交，审批走 workflow；没有日报删除、归档或 purge API。提交还会新增流程实例、业务历史、通知和审计，不能通过现有产品能力精确回收。故未创建 runId 日报或审批链路，`DAILY-002/006` 与 `ST-DAILY-001..004` 记为受清理合同阻塞；解除条件为提供可审计清理路径或明确授权保留该批业务/流程历史。无夹具残留。

## B5 续跑：工作流读取与 configure 权限分离

以仅含 `workflow:read` 的 group scope runId 账号验证：`GET /api/workflow/stats` 返回 200；流程定义列表与创建均精确 403。管理员在拒绝写入前后读取 definitions，ID 集合和数量均保持 2，证明无未经授权的部署。assignment、membership、账号和角色均已通过产品 API 逆序删除，`activeFixtureObjects=0`。

## B4 续跑：Wiki 附件生命周期清理门禁

附件接口仅提供上传和读取，没有独立删除；页面删除仅软删除 `wiki_page`，没有删除其 `shared_file` 附件记录或 MinIO 对象。为避免留下无法精确回收的文件与对象，未上传 runId 附件；`WIKI-011` 记为受产品清理合同阻塞，需提供附件删除级联回收，或明确授权保留附件测试工件。无夹具残留。

## B4 续跑：共享文件 MinIO 删除合同复核

既有 runId 文件上传、下载、预览和 DELETE API 证据完整，但复核 `SharedFileService.deleteFileUnchecked` 后确认删除只执行 `fileMapper.deleteById` 与审计写入，未调用对象存储删除。产品 API 随后拒绝读取仅能证明数据库资源不可达，不能证明 MinIO 对象已回收；登记 `BUG-FQA-053`。本次不新建文件，以免扩大潜在对象存储残留。

## B7 续跑：AI Provider 生命周期安全门禁

AI API 只支持既有 seed provider 的读取、PUT 更新与连接测试，没有创建/删除接口；列表刻意只返回 `configured` 而不返回 API Key。非空 key 更新会覆盖不可经产品 API 回读的旧密钥，无法精确恢复，因此未改变任何 Provider 配置。`AI-001..003` 的写入/连接部分记为受恢复合同阻塞；读取与无权限路径保留既有证据。

## B7 续跑：通知已读状态清理门禁

通知 API 仅提供单条/全部标记已读，既没有恢复未读，也没有可创建/删除专用通知的产品接口。既有 UI 证据确认点击通知会改变已读状态，因此未点击或调用 read/read-all，避免永久修改现有通知。通知读取/权限证据保持有效；已读生命周期部分记为受清理合同阻塞，无夹具残留。

## B7 续跑：审计筛选合同差额

审计 API 仅接受 module、operatorId、日期和分页参数，前端也仅提供模块/日期控件；catalog 要求的 action 和 keyword 筛选没有 Controller 参数或 UI 控件。现有读取还复现 records 非空、`total=0` 的既有分页缺陷。登记 `BUG-FQA-054`，无业务写入。

## B3 续跑：CMDB 导入权限分离

以仅含 `cmdb_instance:read` 的 group scope runId 账号验证：既有模型 CSV 模板下载返回 200；导入 preview 与 execute 均精确 403。管理员前后实例 ID 集合及数量（9）一致，证明拒绝请求没有创建 batch 或实例。assignment、membership、账号和角色均通过产品 API 逆序删除，`activeFixtureObjects=0`。

## B3 续跑：CMDB impact 与 IPAM 最小读权限矩阵

以仅含 `cmdb_instance:read` 和 `ip_pool:read` 的 group scope runId 账号验证 CMDB 实例列表为 200、`POST /api/cmdb/instances/{id}/impact` 因缺少 impact action 精确 403。环境没有可复用地址池，管理员仅创建一个 `FQA` `/29` 地址池作为可清理目标；该账号的 IPAM 列表、详情、利用率均为 200，创建、更新、删除、指定分配、释放五个写端点均精确 403。管理员前后实例集合（9）与地址池集合均一致；地址池、assignment、membership、用户、角色均按依赖逆序通过产品 API 删除，`activeFixtureObjects=0`。

## B2 续跑：用户、角色和权限管理拒绝路径

以仅含 `cmdb_instance:read` 的 group scope runId 账号验证用户管理五个读写请求、角色/权限/资源与角色权限八个读写请求均精确返回 403；管理员前后用户集合（16）与角色集合（7）不变。真实首页侧栏隐藏用户、角色与权限入口，直接访问 `/users`、`/rbac/roles`、`/rbac/permissions` 都回退首页。该低权限首页仍会请求无权的仪表盘聚合 API 并产生预期 403 Console 项，作为已有导航/权限合同线索记录，不影响本用例的拒绝裁决。assignment、membership、用户、角色均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B3 续跑：CMDB 模型管理权限矩阵

以 `cmdb_model:read` group scope runId 账号验证模型与分类列表为 200，而模型 create/update/delete、模型分类 manage、属性组 manage 和属性 update 均精确 403；全权限 runId 管理账号对分类、模型、属性分组和属性的创建/编辑均为 200。首页登录后直达 `/cmdb/admin`，全权限账号显示“新建分类/模型”控件，只读账号均隐藏。管理员前后元数据集合保持一致；两套角色、用户、membership、assignment 及模型/分类/属性夹具均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B2 续跑：无权限写 API 重放

以仅含 `cmdb_instance:read` 的 group scope runId 账号，使用字段合法的请求重放用户创建、角色创建、CI 更新、CI 关联创建、IP 地址池创建、Wiki 空间创建与变更文档创建；七个端点均精确返回 403。管理员前后用户、角色集合与目标 CI 名称均不变。静态/动态低权限路由覆盖继续引用既有 `RBAC-005-012-PERMISSION-DENY`、`PAGE-DELTA-READONLY` 和 `DETAIL-ROUTES-READONLY` 的独立浏览器证据；本次新增结算 `RBAC-017` 写入重放。assignment、membership、用户、角色均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B7 续跑：备份与系统配置权限拒绝

以仅含 `backup:read` 的 group scope runId 账号验证备份列表与既有备份下载均为 200，创建、上传、删除、restore 均精确 403；管理员前后备份集合均为 3 条，不触发真实备份或恢复。以仅含 `notification:read` 的另一 group scope runId 账号验证系统配置读取、流程绑定通用写入、SMTP、通知与水印写入均精确 403；管理员 15 项配置快照完全不变。两组 role、user、membership 与 assignment 均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B4/B6 续跑：Wiki 空间与变更模板写入拒绝

以仅含 `wiki:read` 与 `change_doc_template:read` 的 group scope runId 账号验证空间列表和模板列表均为 200，而 Wiki 空间创建/删除、模板创建、模板元数据更新、模板字段保存均精确 403。管理员前后 Wiki space 与模板集合完全一致。assignment、membership、用户、角色均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B4/B5 续跑：共享文件与 Workflow 最小权限分离

以仅含 `shared_file:read` 的 group scope runId 账号读取目录树和空搜索均为 200，目录创建、文件上传、文件删除均精确 403；管理员前后目录树不变。以仅含 `workflow:read` 的另一 group scope runId 账号读取统一待办（我的/组）及旧版个人任务均为 200，而旧版组待办和审批提交（缺少 `daily_report:approve`）均精确 403，未执行任何任务状态变更。两组 assignment、membership、用户、角色均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B5 续跑：运维日历管理权限拒绝

以仅含 `ops_calendar:read` 的 group scope runId 账号按 Controller 合同读取 2026-07 任务及节假日均为 200；模板与规则管理读取、模板创建、节假日创建和规则创建均精确 403。管理员前后任务与节假日快照均不变。初始错误使用 `from/to` 参数得到 500 后未结算，已改用接口实际要求的 `startDate/endDate` 复测通过；该参数错误不作为产品缺陷。assignment、membership、用户、角色均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B3 续跑：CMDB 拓扑时间点比较只读合同

以既有 CI `id=32` 执行 `depth=2` 当前拓扑及 compare 读取。相同 `fromTime/toTime` 返回 added/removed/modified/unchanged/edges 的完整数组结构且前三类为空；前向时间范围同样返回完整结构。反向时间范围当前也返回 200，未声明为输入校验合同；不存在实例返回 400。比较前后当前拓扑快照字节等价，未创建实例、关系或审计业务对象。`CMDB-030` 的当前可观测时间点比较合同通过；没有历史边变化，因此不把 added/removed/modified 的非空表现误记为已覆盖。

## B2 续跑：组级角色委派边界

以含 `role:assign + cmdb_instance:read` 的 group scope runId 操作人，向同组 runId 目标用户委派仅含 `cmdb_instance:read` 的角色成功（200）。尝试委派含操作者不具备 `wiki:read` 的角色、或将允许角色授予 group 2，均返回 400。目标用户 assignment 前为 0、后仅有一条已允许的 group 1 assignment，拒绝请求未创建任何额外 assignment。目标 assignment、操作人 assignment、两个 membership、两个用户和三个角色均通过产品 API 依赖逆序清理，`activeFixtureObjects=0`。

## B2 续跑：删除用户/角色后的身份与权限失效

创建仅含 `cmdb_instance:read` 的 runId 角色、用户和 group assignment，完成首次 setup 后读取实例为 200。撤销 assignment/membership 并通过产品 API 删除用户后，旧 token 请求为 401、相同账号重新登录为 401、管理员读取已删用户为 400，证明身份与会话失效正确。随后删除 role 虽返回 200，但 `GET /api/rbac/roles/{deletedRoleId}/permissions` 仍返回 200 且泄露原 `cmdb_instance:read` 映射，登记 `BUG-FQA-055`；故 `RBAC-018` 结算 FAIL。assignment、membership、用户和角色均已产品 API 清理，`activeFixtureObjects=0`。

## B2 续跑：角色权限保存与越权委派拒绝

以含 `role:create/update/read`、`resource:assign` 与 `cmdb_instance:read` 的 group scope runId 操作人创建候选角色，保存/刷新/更新均成功，刷新后精确保留 `cmdb_instance:read`，角色列表刷新仍包含该角色。尝试将候选角色权限改为操作者不拥有的 `wiki:read` 返回 400，管理员前后读取的 permission 集保持 `cmdb_instance:read` 不变。候选角色、操作人 assignment、membership、用户和操作人角色均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B2 续跑：多角色权限并集

以同一 group scope runId 账号分别分配仅含 `cmdb_instance:read` 和仅含 `wiki:read` 的两个角色。完成 setup 后登录响应有效权限集恰含两项权限（count=2），CMDB 实例与 Wiki 空间读取均为 200；未分配的共享文件和变更文档读取均精确 403。两个 assignment、membership、用户和两个角色均通过产品 API 逆序清理，`activeFixtureObjects=0`。

## B2 续跑：侧栏与有效权限矩阵

归档三个已完成隔离账号的运行时证据：仅有 `audit:read` 的账号可读取审计 API，却无法从首页发现系统管理入口；仅有 `ai_config:read + backup:read` 的账号可读取 AI 与备份 API、直达页面也可渲染，却同样没有首页入口；反向地，只有 `notification:manage` 的账号在首页被展示 AI 与审计入口，而相应 API 精确 403。该结果违反“侧栏只显示且完整显示有效能力”的合同，`RBAC-015` 判 `FAIL`，复用 P1 `BUG-FQA-035`，无新写入、无活动夹具。

## B7 续跑：AUDIT-003 无 `audit:read` 拒绝

以仅含 `cmdb_instance:read` 的 group scope runId 账号完成首次 setup 后，登录响应有效权限集仅有该一项，明确不含 `audit:read`。`GET /api/audit-logs?page=1&size=20` 精确返回 `403`（业务码 `403`、`无权限`）；首页隐藏审计入口，直接访问 `/admin/audit` 回退首页。匿名同端点当前也返回 `403`，仅记录为部署合同观察，不作为已认证权限拒绝判据。role、user、membership、assignment 均经产品 API 逆序删除，`activeFixtureObjects=0`。

## B7 续跑：AI-004 无 `ai_config:read` 拒绝

以仅含 `cmdb_instance:read` 的 group scope runId 账号完成首次 setup 后，登录有效权限仅为该一项且不含 `ai_config:read`。`GET /api/admin/ai/providers` 精确返回 `403`；首页隐藏 AI 菜单、直接访问 `/admin/ai` 回退首页。管理员前后 Provider 数量均为 3、快照等价。role、user、membership、assignment 均通过产品 API 逆序清理，`activeFixtureObjects=0`。至此此前“未结算”的 `CONFIG-006`、`AUDIT-003`、`AI-004` 均已有运行时证据；`BACKUP-003` 仍需专门验证“无 backup:read”的 API/UI 拒绝（既有备份夹具验证的是 read allow 与写拒绝，不能替代该场景）。

## B7 续跑：BACKUP-003 无 `backup:read` 拒绝

以仅含 `cmdb_instance:read` 的 group scope runId 账号完成首次 setup 后，登录有效权限仅有该一项，明确不含 `backup:read`。`GET /api/backups?page=1&size=100` 精确返回 `403`（业务码 `403`、`无权限`）；独立 Playwright 从 `/login` 登录后，首页不显示备份入口，直达 `/admin/backup` 回退首页。管理员拒绝前后备份列表快照等价，记录数均为 3，未触发创建、上传、删除或恢复。role、user、membership、assignment 均经产品 API 按 assignment → membership → user → role 逆序删除，`activeFixtureObjects=0`；低权限首页的无关指标请求 `403` Console 噪声由既有 `BUG-FQA-035` 覆盖。

## B2 续跑：AUTHZ-002 group scope 迁移工作台拒绝

## B2 续跑：AUTHZ-012 非 platform 会话 break-glass 拒绝

通过产品管理员 API 创建仅含 `cmdb_instance:read` 的临时自定义角色，以及仅有主组 `1`、group scope assignment 的 runId 用户；完成首次登录 setup 后重新登录。登录响应的有效权限精确为 `cmdb_instance:read`，`groupScope=group`。该已认证非 platform 会话调用 `POST /api/rbac/break-glass`（合法理由）与 `DELETE /api/rbac/break-glass` 均返回 `403` / `无权限`。

运行前后以 Redis 精确前缀 `authorization:break-glass:<fixtureUserId>:` 扫描，均为零 key；`audit_log` 中 `module=authorization AND action LIKE break_glass_%` 的计数保持 `0 -> 0`，因此拒绝未激活、未停用、未绕过，也未产生授权 break-glass 审计。独立 Playwright 从 `/login` 登录至首页，未发现 break-glass 导航或可交互控件（`0`），截图已保存；首页的其他无权限模块请求 `403` 为既有低权限首页行为，未作为本用例失败。

夹具严格按 role assignment、membership、user、role 顺序经产品 DELETE API 回收，四步均为 `200`；manifest 无活动对象，superadmin 未改动，凭据未写入证据。完整请求、Redis/审计前后计数、UI 与清理证据见 `test-results/FQA_20260712_0329_lintfix/AUTHZ-012-BREAK-GLASS-NONPLATFORM-DENY/result.json`。

## B1 续跑：AUTH-008 跨标签页登出同步

通过独立 Playwright Chromium 在同一浏览器上下文中登录一个零权限 runId 临时账号，并打开两个首页标签页。第一个标签页从头像菜单执行产品登出后，两个标签页均落到 `/login`；第二个标签页的 `cwgsyw_token` 已清除，证明 BroadcastChannel 的登出同步实际生效。临时账号通过产品用户 DELETE API 删除（200），manifest 无活动对象，superadmin 未改动，凭据未写入证据。`AUTH-008` 通过；完整证据见 `test-results/FQA_20260712_0329_lintfix/AUTH-008-CROSS-TAB-LOGOUT/result.json`。

以仅含 `cmdb_instance:read` 的 group scope（`group:1`、无 expiry）runId 账号完成首次 setup 后，登录响应有效权限精确只有该一项。独立 Playwright 从 `/login` 登录并进入首页，侧栏不显示迁移异常入口；直接访问 `/rbac/migration-exceptions` 被路由守卫回退首页。迁移只读端点 `GET /api/rbac/migration/cutover`、`/preflight`、`/pending-users` 与 `/exceptions?status=open&page=1&size=20` 均精确返回已认证 `403`（业务码 `403`、`无权限`）。全程未调用任何 migration/cutover 写端点；管理员前后 cutover 均为 `enforced`、epoch `1`，开放异常均为 `0`。assignment、membership、用户和角色均通过产品 API 按 assignment → membership → user → role 逆序删除，`activeFixtureObjects=0`。低权限首页的无关聚合请求 `403` Console 噪声由既有 `BUG-FQA-035` 覆盖。

## B1 续跑：AUTH-008 跨标签页登出同步

独立 Playwright 同一浏览器上下文中打开两个标签页，以 runId 临时用户分别完成登录；两页均落在首页且持有认证 token。第一标签通过产品退出入口登出后，第二标签接收 BroadcastChannel 通知并自动跳转 `/login`，认证 token 同步清除。临时用户随后经产品 DELETE API 删除，`activeFixtureObjects=0`；没有改动 superadmin 或业务数据。

## B8 续跑：COMMON-006 至 COMMON-009 公共只读交互

隔离 Playwright 以 superadmin 从 `/login` 登录首页后，通过“身份与权限”真实侧栏进入 `/users`。用户搜索依次输入空串、空白、特殊字符和不存在关键字，网络中的用户列表请求均为 `GET 200`、无 5xx 或页面错误文本；清空后列表恢复为 15 行。未触发应用写请求。

同一用户页仅打开“新建用户”Dialog，不输入字段、不点击保存；Escape、遮罩、右上角 X、取消四种关闭方式均关闭对话框，未产生保存、创建、更新或删除请求。CMDB 真实侧栏进入 `/cmdb/changes` 后，实际可用的每页条数 Select 逐项选择 20、50、100 并恢复 20，显示标签与请求状态保持一致；当前模型/动作选项运行时为空，未伪造选项。变更历史当前仅一页（`1 / 1`），首页/末页均稳定，禁用的下一页越界操作不改变页码或总数。全程 `applicationWriteRequests=[]`、Console error 和 failed request 均为空。

`COMMON-006`、`COMMON-007`、`COMMON-008`、`COMMON-009` 均为 PASS；无测试数据创建，无清理项。完整运行证据见 `test-results/FQA_20260712_0329_lintfix/COMMON-006-009-READONLY/result.json`。

## B2 续跑：RBAC-003 / RBAC-008 多组 membership 矩阵

使用两个独立 runId 临时用户，通过公开用户 membership API 完成验证。`RBAC-003` 通过：两个业务组 membership 可并存，首组为 primary member、次组为 non-primary leader；重复向次组写入 member 不新增行而是更新同一 membership，随后可恢复 leader。将 primary 切换至次组再切回首组时，membership 列表始终仅一条 primary，且用户详情 `groupId` 精确随 primary 变化（3 -> 2）。

`RBAC-008` 失败：未分配组正确拒绝 non-primary member（400）及 leader（400），并允许无业务组用户作为 primary member 加入；但该用户随后仍可被添加为业务组 non-primary member（200），留下“未分配组 primary + 业务组 member”的混合关系，违反未分配组必须无业务组的状态不变量，登记 `BUG-FQA-056`。两个用户的全部 membership 均先通过产品 API 删除、回读为空，再通过产品用户 DELETE API 删除；`activeFixtureObjects=0`，未改动 superadmin 或既有账号。完整证据见 `test-results/FQA_20260712_0329_lintfix/RBAC-003-008-MEMBERSHIP-MATRIX/result.json`。

## B1 续跑：HOME-003 可见侧栏入口逐项导航

独立 Playwright 以 superadmin 从登录页进入首页并展开侧栏组。32 个当时可见的 `nav a[href]` 入口均使用真实 DOM 点击到达其预期路由（或对应子路由），没有路由守卫误重定向、应用写请求或 Console error。`/ops-calendar`、`/wiki` 与首页链接在逐次导航回首页后的 DOM 中处于隐藏折叠状态，未把未可见元素视为点击失败；它们已有独立首页路径证据。路由切换时观察到若干 Next RSC `ERR_ABORTED` 预取取消，均为离开前一页导致，未伴随目标页面/API 失败，不定性为产品异常。

## B1 续跑：HOME-005 通知铃铛只读路径

从首页页头通知铃铛进入通知中心，列表 API 返回 `200`、31 条 records 和未读数 `0`，页面刷新保持通知中心、浏览器返回回到首页；全程未点击通知条目，以免改变历史通知已读状态。通知 UI 当前没有筛选或可用分页控件，且响应仍错误声明 `total=0`，继续归入既有 `BUG-FQA-024`。无 Console/失败请求、无通知或业务写入；本用例结算铃铛、未读数和“查看全部”只读路径，已读 mutation 仍受清理门禁 BLOCKED。

## B8 续跑：COMMON-010 命令面板关闭后的防抖请求

隔离 Playwright 以 superadmin 从 `/login` 进入首页，通过真实 `⌘K` 打开命令面板，先输入“服务器”、等待首个 300ms 防抖搜索请求发出，再迅速改为“网络”、按 Escape 关闭，并从首页点击进入 CMDB。首个 `/api/search` 请求被人为延迟到关闭与路由切换后才放行，随后返回 `200`；命令面板未重新打开、CMDB 页面无旧搜索结果或空态覆盖、无 React/unmount Console error、无 API 5xx，且没有应用业务写请求。CMDB 路由预取的 `ERR_ABORTED` 是路由离开后的 RSC 预取取消，已按 HOME-003 同类证据解释。`COMMON-010` 为 PASS；无测试数据创建或清理项。完整证据见 `test-results/FQA_20260712_0329_lintfix/COMMON-010-COMMAND-PALETTE-UNMOUNT/result.json`。

## B1 续跑：HOME-004 全局搜索命令面板

隔离 Playwright 以 superadmin 从 `/login` 进入首页，以真实快捷键打开命令面板。精确不存在关键词显示“未找到匹配结果”，Escape 正确关闭面板；随后检索当前数据，观察到 Wiki、用户和变更文档三类结果。键盘选择变更文档结果后精确进入 `/change-docs/1`，命令面板关闭。全程无业务写请求、Console error 或失败请求。`HOME-004` 为 PASS；无测试数据创建或清理项。完整证据见 `test-results/FQA_20260712_0329_lintfix/COMMAND-PALETTE-MULTITYPE/result.json`。

## B1 续跑：HOME-006 刷新与浏览器历史

隔离 Playwright 以 superadmin 从 `/login` 进入首页，通过真实侧栏进入 `/cmdb`。刷新后 URL 与 CMDB 面包屑保持；再从侧栏回到首页，浏览器后退精确回到 `/cmdb` 并保留面包屑，前进后回到首页。没有业务写请求或 Console error。过程中观察到 Next RSC 预取 `ERR_ABORTED`，均发生在后退/前进路由切换时且目标路由渲染成功，按 HOME-003/COMMON-010 的既有解释处理。`HOME-006` 为 PASS；无测试数据创建或清理项。完整证据见 `test-results/FQA_20260712_0329_lintfix/HOME-006-REFRESH-HISTORY/result.json`。

## B1 续跑：HOME-002、HOME-007、HOME-008 工作台可用性

隔离 Playwright 以 superadmin 从首页真实点击 11 个当前可见的指标卡、日历、快捷和头部入口；全部抵达预期路由并显示主内容，`HOME-002` 为 PASS。1440×1000、1024×768 和 390×844 三档视口下，页面无横向溢出或可见元素越界，侧栏/CMDB、命令面板和首页主操作均可达，`HOME-007` 为 PASS。`HOME-008` 复核维持 FAIL：首页未渲染主题切换入口，用户菜单只有资料、改密和退出；文档中也不存在主题属性或持久化状态，因而无法验证主题切换、持久化和暗色可读性，复核既有 `BUG-FQA-027`，不重复登记缺陷或重复计数。三项均无业务写请求、Console error 或未解释失败请求；路由切换中的 RSC 预取取消已单独解释。证据见 `HOME-002-DASHBOARD-CARDS`、`HOME-007-RESPONSIVE` 和 `HOME-008-THEME-READONLY` 目录。

## B4 续跑：WIKI-016 版本历史和页面导出只读子范围

隔离 Playwright 以 superadmin 从 `/login` 进入首页，真实点击知识库、Release Notes 和树中既有页面 `87`。版本历史显示 `v1`，`GET /api/wiki/pages/87/versions` 返回 200；点击页面导出后得到 `wiki-page-87.md`，导出 API 返回 200 与 Markdown MIME。全程零业务写、Console error、失败请求和 API 5xx。版本回退会修改既有页面且不存在可精确清理的独立页面夹具，本轮未执行；因此该证据只补强 `WIKI-016` 的版本列表/导出子范围，不能将主用例计为 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-016-READONLY-VERSION-EXPORT/result.json`。

## B4 续跑：WIKI-010 Mermaid 正常与错误语法子范围

以 superadmin 通过产品 API 创建 runId Wiki 空间和页面，保存正常 Mermaid 后从首页真实进入知识库、空间和页面树节点，阅读页渲染 SVG 且没有错误提示。将同一可删除夹具改为错误 Mermaid 源码后，阅读页稳定显示“Mermaid 图表渲染失败”和源代码，未产生 Console error；路由切换中的两条 RSC `ERR_ABORTED` 为预取取消。页面和空间均依次通过产品 DELETE API 删除并回收，活动夹具为零。多图与主题切换尚未完整覆盖，其中主题依赖现有 `BUG-FQA-027` 的主题入口缺失；因此 `WIKI-010` 主用例保持未完整结算。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-010-MERMAID-LIFECYCLE/result.json`。

同一安全夹具策略补充两张 Mermaid：从首页真实进入知识库后，动态页面路由读取 runId 页面，两张图均渲染并各有全屏控件；首图打开全屏后 Escape 正确关闭覆盖层。全程无业务写请求或 Console error；一个 RSC `ERR_ABORTED` 发生在空间预取取消，未影响目标页面读取。页面和空间均经产品 DELETE API 删除，活动夹具为零。主题切换仍因既有 `BUG-FQA-027` 不可执行，故 `WIKI-010` 主用例继续保持未完整结算。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-010-MULTI-MERMAID/result.json`。

## B4 续跑：WIKI-009 Markdown 阅读渲染子范围

以 superadmin 创建 runId Wiki 空间和页面，保存标题、表格、JavaScript 代码块、已完成/未完成任务列表与引用。登录后从首页真实进入知识库，再补充动态页面路由读取夹具；阅读页语义 DOM 精确包含两个标题、表格及单元格、代码块、两个 checkbox（一个 checked）和引用。无 Console error 或业务写请求；一个 RSC `ERR_ABORTED` 为空间预取取消。页面和空间均按页面→空间顺序经产品 DELETE API 删除，活动夹具为零。编辑预览的实时渲染仍为单独子场景，故 `WIKI-009` 主用例未提前结算。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-009-MARKDOWN-LIFECYCLE/result.json`。

以独立 runId 页面补齐编辑器：从首页进入知识库后打开页面编辑，输入 Markdown 并在 live preview 中确认标题、表格、任务列表和引用；保存后刷新编辑器，内容逐字保留，返回阅读页后渲染与预览一致。唯一应用写请求是对该 runId 页面执行一次 PUT 保存；页面和空间随后按页面→空间经产品 DELETE API 删除，活动夹具为零。所有规格要求的合法 Markdown 阅读与预览一致性均已证明，`WIKI-009` 正式结算 PASS。RSC `ERR_ABORTED` 均为路由预取取消，不影响页面成功加载。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-009-EDITOR-PREVIEW/result.json`。

## B4 续跑：WIKI-008 页面标题边界

以 superadmin 创建 runId 空间，分别尝试空标题、仅空白、304 字符超长与同级重复标题。空与空白标题均错误返回 200 并创建页面；超长标题返回未处理 500；首个重复页返回 200，第二个同级重复页同样返回 200。空间树确认四个错误接受的页面存在。所有页面和空间均按页面→空间经产品 DELETE API 删除，活动夹具为零。该输入合同不符合“非法拒绝且无残留”的要求，`WIKI-008` 结算 FAIL，登记 `BUG-FQA-057`。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-008-TITLE-BOUNDARY/result.json`。

## B4 续跑：WIKI-006 根/子页面创建

以 superadmin 创建 runId 空间和根页面，根页面返回 200 且空间树正常可读。使用同一平台会话、同一页面所有者、相同空间，以根页面 ID 作为 `parentId` 创建子页面却精确返回 403/“无权限”；因此无法继续验证子树位置、移动排序和后续树结构。根页面与空间均按页面→空间经产品 DELETE API 删除，活动夹具为零。`WIKI-006` 结算 FAIL，登记 `BUG-FQA-058`；`WIKI-007` 与 `ST-WIKI-001` 未被此失败替代，仍保持未运行。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-006/result.json`。

## B4 续跑：WIKI-007 根页编辑、版本与根级移动

以 superadmin 创建 runId 空间和根页，保存标题与 Markdown 后刷新精确保留两者，版本列表为两条，根级 `move(parentId=null, sortOrder=0)` 返回 200，空间树仍包含该页。页面和空间均按页面→空间通过产品 API 删除，活动夹具为零。`WIKI-007` 结算 PASS；子树移动与排序仍受 `BUG-FQA-058` 阻断，未以根页行为替代。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-007-ROOT-EDIT-MOVE/result.json`。

## B5 续跑：OPS-016 排班清理门禁

排班 API 仅提供读取、创建、编辑和冲突检查，没有 DELETE、archive 或 purge 生命周期；创建 runId 排班会留下无法以产品能力精确清理的记录及审计。因此未写入夹具，`OPS-016` 结算 BLOCKED，解除条件为提供可审计的产品删除/归档接口或明确保留夹具授权。完整证据见 `test-results/FQA_20260712_0329_lintfix/OPS-016-CLEANUP-GATE/result.json`。

## B6 续跑：CHANGE-005 模板必填字段边界

以 superadmin 从首页真实进入变更文档新建页并选择默认模板。Step 2 未渲染该模板的四个必填字段，未填写任何字段仍创建草稿；创建响应对象又被直接作为路由 ID，触发 `/api/change-docs/[object Object]` 与其 CI 链接端点两处 500。两条意外 runId 草稿均立即登记，并通过产品 DELETE API 删除、GET 回读为 400，活动夹具为零。`CHANGE-005` 结算 FAIL，登记 `BUG-FQA-059`。完整证据见 `test-results/FQA_20260712_0329_lintfix/CHANGE-005/result.json`。

## B5 续跑：DAILY-003 / DAILY-004 无效输入边界

以 superadmin 调用日报创建 API，仅提交空对象、空白必填字段和非法日期/负工时三类请求；2037-01 的日报列表在前后均为空，确认没有创建报告或流程历史。前两类返回 400 Bean Validation；非法日期/负工时返回未处理 500，而非明确 400 输入错误。`DAILY-003` 和 `DAILY-004` 结算 FAIL，登记 `BUG-FQA-060`；不替代需要可清理有效日报夹具的 `DAILY-002/006`。完整证据见 `test-results/FQA_20260712_0329_lintfix/DAILY-003-004-API-INVALID/result.json`。

## B5 续跑：OPS-019 export 权限反向矩阵

保留既有管理员正向 XLSX 下载证据后，另建仅含 `ops_calendar:read` 的 group scope runId 账号。任务与节假日读取均为 200；统计、素材归集和素材 XLSX 下载均精确返回 403，管理员前后指定日期任务集合不变。role assignment、membership、账号和角色均按依赖逆序通过产品 API 清理。`OPS-019` 正式结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/OPS-019-EXPORT-PERMISSION-DENY/result.json`。

## B4 续跑：WIKI-019 文档管理员权限边界

创建仅含 `wiki:read/create/update/delete/publish/manage_acl` 的 group scope runId 文档管理员。首次设置后有效权限精确包含六项；该账号创建独立空间和根页面、保存 Markdown、发布、读取空间 ACL、删除页面并删除空间均为 200，详情回读为 `published`。空间、页面、assignment、membership、账号和角色均按依赖逆序经产品 API 清理，活动夹具为零。`WIKI-019` 正式结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-019-FULL-PERMISSION-LIFECYCLE/result.json`。

## B4 续跑：WIKI-020 多角色权限并集

为同一 group scope runId 账号分别分配 author（`wiki:read/create/update`）和 publisher（`wiki:delete/publish`）两个自定义角色。复登后有效权限集精确包含五项并集；该账号创建空间和根页面、更新、发布、回读 published、删除页面和空间均为 200。两个 assignment、membership、账号、两个角色及 Wiki 对象均按依赖逆序经产品 API 清理，活动夹具为零。`WIKI-020` 正式结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-020-MULTIROLE-UNION/result.json`。

## B4 续跑：WIKI-026 ACL 乐观并发控制

以具 `wiki:manage_acl` 的 group scope runId 所有者创建独立空间，读取 ACL version 0 后首次保存 mode `0770` 成功并升至 version 1；使用过期 version 0 的第二次保存返回 409“资源权限已被其他用户修改，请刷新后重试”，刷新后仍保留首次保存的 mode/version。初次清理因 `0770` 限制 owner group 写入而拒绝删除空间；恢复任务先建立最小恢复权限、将 owner mode 恢复为 `2770`，随后删除空间、回收恢复关系和原夹具。`WIKI-026` 正式结算 PASS，活动夹具为零。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-026-ACL-VERSION-CONFLICT/result.json` 与 `recovery.json`。

## B4 续跑：WIKI-025 Enforced 统一资源权限编辑器

Enforced 运行模式 API 返回 `enforced=true`、`useUnifiedEditor=true`。以 superadmin 从首页真实进入知识库，独立 runId 空间列表 API 标记 `canManageAcl=true`；点击该卡片“授权管理”后打开统一 `ResourceAccessDialog`，加载属主/属组、基础 mode `2770`、访问 ACL/default ACL 与高级模式入口。全程未点击保存或修改 ACL；空间随后经产品 API 删除，活动夹具为零。`WIKI-025` 正式结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-025-UNIFIED-EDITOR-UI/result.json`。

## B3 续跑：CMDB-040 引用删除保护

以 superadmin 通过产品 API 创建 runId 模型、两个 CI、`onDelete=restrict` 关联和指向源 CI 的设备；删除前 `/devices` 关联读取精确包含该设备。删除源 CI 却返回 200，源 CI 随即为 400、关系被静默删除，设备仍返回 200 且保留已删除 `ciInstanceId`，违反 `restrict` 保护并产生孤儿引用。随后删除设备、目标 CI、定义、模型和模型组；源 CI 与关系已被错误删除，manifest 均明确记录为该失败操作所致且最终活动对象为零。`CMDB-040` 结算 FAIL，登记 `BUG-FQA-061`。完整证据见 `test-results/FQA_20260712_0329_lintfix/CMDB-040-REFERENCE-DELETE-PROTECTION/result.json`。

## B4 续跑：FILE-002 / FILE-003 文件夹 CRUD 与命名边界

以 superadmin 创建独立 runId 根/子文件夹，树回读精确保持父子路径；删除非空父目录返回 409，先删除子目录再删除父目录均为 200，刷新树后两者均不存在，证明创建、路径、非空保护和删除闭环有效。`FILE-002` 仍结算 FAIL：当前前端只实现创建/删除，服务端仅有 `POST /api/files/folders` 与 `DELETE /api/files/folders/{id}`；试探性 PUT 和 `/move` 均 500，产品没有可用的重命名或移动操作，登记 `BUG-FQA-062`。

同一独立夹具尝试空串、仅空白、同级重复、348 字符超长和路径样式名称。空串、空白、重复与路径样式均错误返回 200 并创建目录；超长名称返回未处理 500。路径样式未产生层级，但未被拒绝也没有明确安全显示合同。所有六个被接受的 runId 文件夹均立即登记，随后按子→父、其余根目录的逆序经产品 DELETE API 清理；manifest 活动对象为零。`FILE-003` 结算 FAIL，登记 `BUG-FQA-063`。完整证据见 `test-results/FQA_20260712_0329_lintfix/FILE-002-003-FOLDER-CRUD-NAMING/result.json`。

## B4 续跑：WIKI-021 跨组空间/页面 ACL 权限分离

以资源 ownerGroup=2、命名 ACL group=3 的 runId 空间和页面，构造主组为 3 且同时具 group:2 membership 前置条件的三名账号；其 role assignment 均为 group:2。空间 ACL `group:3=rwx`、页面 ACL `group:3=rw-`，且基础 mode 分别为 `0700`、`0600`。reader 的 tree/page 为 200、update/ACL GET 为 403；writer 的 tree/update 为 200、ACL GET 为 403；manager 的 tree/ACL GET/PUT 为 200、update 为 403。首次无 scope membership 的错误夹具已恢复删除，正式资源、页面、三个 assignment、六个 membership、三个账号与三个角色均按依赖逆序产品 API 回收，manifest 活动对象为零。`WIKI-021` 结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-021-CROSS-GROUP-ACL-SPLIT/result.json` 与 `recovery.json`。

## B4 续跑：WIKI-023 named-user 与 group ACL 优先级

创建带 `wiki:read/update` group scope 的 runId 账号和独立空间/页面。空间 group ACL 设置为 `r-x`，确保祖先 traverse；页面同时设置同组 `rw-` 与该账号 named-user `r--`。该账号 tree/page 读取均为 200，页面更新为 403，证明 named-user 条目覆盖匹配组的写权限；移除 named-user 条目后，同一账号更新立即返回 200。页面、空间、assignment、membership、账号和角色均按依赖逆序产品 API 删除，活动夹具为零。`WIKI-023` 结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-023-ACL-PRECEDENCE/result.json`。

## B4 续跑：WIKI-024 祖先 traverse 门禁

为祖先 `x` 拒绝创建独立空间、根页及具有 `wiki:read` 的 group scope 账号；但以 superadmin 创建子页仍精确返回 403/“无权限”，无法获得子页来构造“子页允许、祖先无 x”的判定链。该失败复现并依赖既有 `BUG-FQA-058`，不能用根页或空树代替子页祖先链覆盖，`WIKI-024` 结算 FAIL（不重复新增缺陷）。根页、空间、assignment、membership、账号和角色已按逆序产品 API 删除，活动夹具为零。完整证据见 `test-results/FQA_20260712_0329_lintfix/WIKI-024-ANCESTOR-TRAVERSE-GATE/result.json`。

## B3 续跑：DEVICE-008 删除取消/确认、凭据与权限边界

以现有 CI 创建独立 runId 设备和凭据。凭据详情不含明文；先经产品 API 删除凭据并核对 200，再进入父设备删除路径，避免将凭据处理留为推断。另创建两个 group:2 最小角色账号：`device:read,device:delete` 与仅 `device:read`；后者直接 `DELETE /api/devices/{id}` 返回 403，管理员回读设备仍为 200。具 delete 权限账号从登录页经首页“资源管理→设备密码库”进入详情；首次点击删除并取消，未发出 DELETE 请求且设备仍为 200；第二次确认后 UI 回到设备列表，DELETE 返回 200，详情返回 400“设备不存在”。凭据、设备、两条 assignment、membership、用户与角色均按依赖逆序通过产品 API 清理，manifest 活动对象为零。设备页记录的 403 为无关导航预取，RSC `ERR_ABORTED` 均伴随路由切换而非应用请求失败。`DEVICE-008` 结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/DEVICE-008-DELETE-LIFECYCLE/result.json`。

## B4 续跑：FILE-004 / FILE-006 / FILE-007 文本上传、预览与下载

以 superadmin 创建 runId 文件夹并上传含中文文件名的文本文件。上传、按文件夹列表和详情读取均为 200；文本预览返回 `text/plain`、字节非空且内容逐字一致。下载返回 `text/plain`、非空字节、内容一致，并带 RFC 兼容的 `Content-Disposition` 与 UTF-8 `filename*` 建议文件名；download-url/preview-url 合同均返回预期端点。随后先删除文件、再删除文件夹，产品 API 均为 200，manifest 活动对象为零。`FILE-004`、`FILE-006`、`FILE-007` 结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/FILE-004-007-UPLOAD-PREVIEW-DOWNLOAD/result.json`。

## B4 续跑：FILE-009 / FILE-015 统一 ACL 与乐观锁

创建 runId 文件夹和具 `shared_file:read/manage_acl` group scope 的独立账号。统一 ACL 首次保存使 version 从 0 升至 1，`mode=2770`、access user/group 与 default user/group ACL 均刷新保留；受限账号立即可读取 ACL 和文件列表。以初始 version 再次写入精确返回 409；刷新后重试成功至 version 2，且先前 ACL 值保持。文件夹、assignment、membership、账号和角色均通过产品 API 逆序删除，manifest 活动对象为零。`FILE-009`、`FILE-015` 结算 PASS。完整证据见 `test-results/FQA_20260712_0329_lintfix/FILE-009-015-UNIFIED-ACL/result.json`。

## B3 续跑：IPAM-009 group scope 数据范围

创建两条不同业务组意图标记的 runId 地址池和仅含 `ip_pool:read` 的 group:1 assignment 账号。该账号按关键词列表同时返回两条地址池，且对“跨组”地址池详情同样返回 200，而非期望的范围过滤/403；同组详情亦为 200。两条地址池、assignment、membership、账号和角色均按逆序通过产品 API 清理。`IPAM-009` 结算 FAIL，登记 `BUG-FQA-064`。完整证据见 `test-results/FQA_20260712_0329_lintfix/IPAM-009-GROUP-SCOPE-DATA-RANGE/result.json`。

## B4 续跑：FILE-005 零字节上传边界

以 superadmin 创建 runId 文件夹并上传 0 字节 `text/plain` 文件。服务端错误返回 200 并生成文件记录，文件夹列表从 0 条变为 1 条，而非拒绝且无半成品。随后立即通过产品 API 删除该文件和文件夹，均返回 200，manifest 活动对象为零。`FILE-005` 结算 FAIL，登记 `BUG-FQA-065`。完整证据见 `test-results/FQA_20260712_0329_lintfix/FILE-005-EMPTY-UPLOAD-BOUNDARY/result.json`。

## B4 续跑：FILE-008 真实 UI 删除补证

新的隔离 Google Chrome / Playwright 会话从 `/login` 登录，经首页“资源管理 → 共享文档”真实进入文件页。runId 文件夹能被选中，但成功上传的 runId 文件没有在该文件夹列表显示，UI 删除按钮无法到达，取消/确认两个分支均不能用 API 结果替代，`FILE-008` 结算 FAIL，登记 `BUG-FQA-066`。中断重试留下的 2 个活动文件夹经产品 API 精确删除；9 个明确 `FQA_delete_*` MinIO 对象经精确 key 回收后为 0。这再次验证产品删除不回收对象的 `BUG-FQA-053`，而非产品清理通过。证据：`test-results/FQA_20260712_0329_lintfix/FILE-008-DELETE-UI-API/`。

## B4 续跑：WIKI-003 / WIKI-004 / WIKI-005 已有证据结算

`WIKI-003`：仅 `wiki:read` 的 group scope 夹具可读取空间/页面，但创建与删除空间均为 403，管理员空间快照不变，夹具已按 assignment→membership→user→role 回收，结算 PASS。`WIKI-004`：独立 runId 空间的统一 ACL 已覆盖 owner/group/mode、access/default ACL、version 递增与子页面创建继承；页面、空间与 RBAC 夹具均通过产品 API 清理，结算 PASS。`WIKI-005`：具 `wiki:read` 但无 `wiki:manage_acl` 的夹具可读空间/页面，统一 ACL GET/PUT 均 403 且管理员 ACL snapshot/version 不变，结算 PASS。证据分别为 `WIKI-003-CHANGE-017-PERMISSION-DENY/result.json`、`B8-WIKI-DEFAULT-ACL-SETGID/result.json`、`WIKI-ACL-MANAGE-DENY/result.json`。

## B4 续跑：WIKI-002 UI 生命周期自动化未收束

尝试以独立 Chrome/Playwright 从登录首页执行新建空间、取消删除、确认删除；浏览器子进程未在预设超时内收束，已终止。数据库确认没有 `FQA Wiki UI` 活动空间，manifest 也没有活动对象。本条保持 NOT_RUN，后续应在稳定浏览器会话重新执行，不以 API delete 或已存在空间行为替代 UI 生命周期。

## B4 续跑：WIKI-012 链接/backlink 与 WIKI-015 评论生命周期结算

独立 Chrome/Playwright 已从登录首页进入知识库，并用可清理的 runId writer/reader 夹具完成链接、backlink 与评论链路。`WIKI-012`：已知链接、别名链接、目标页 backlink 与返回原页均通过；未知链接将 `<sup title="该页面尚未创建">待创建</sup>` 作为普通文本显示，结算 FAIL，已绑定 `BUG-FQA-046`。`WIKI-015`：评论 UI 创建、空/301 字符拒绝、2 条每页分页（4 条无重复降序）、作者删除与其他用户 403 拒绝、计数一致均通过，结算 PASS。comments→pages→space→assignment→membership→users→roles 已逆序回收，活跃对象为零。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-BACKLINK-COMMENT-RUNTIME/result.json`。

## B4 续跑：WIKI-017 页面与空间导出结算

以 superadmin 的隔离浏览器从登录首页进入知识库完成只读导出。既有页面导出返回 `wiki-page-87.md`、`text/markdown;charset=UTF-8`、HTTP 200；空间导出返回 `Release Notes.zip`、`application/zip`、`Content-Disposition: attachment`、ZIP 签名 `504b0304`，下载均非空且临时文件已删除。无业务写入、Console error 或失败请求，`WIKI-017` 结算 PASS。证据：`WIKI-016-READONLY-VERSION-EXPORT/result.json`、`WIKI-EXPORT-READONLY/result.json`。

## B4 续跑：WIKI-002 首页 UI 创建空间权限失败

以 superadmin 的独立 Google Chrome/Playwright 从 `/login` 登录首页，再经“知识库”真实点击进入 `/wiki`。在“新建空间”对话框填入带 runId 的名称和描述、保留产品默认“使用主组”后提交；`POST /api/wiki/spaces` 精确返回 `403`/`无权限`，页面停留在对话框且 Console 同步记录该 403。空间列表复核无 `FQA Wiki UI` 对象，manifest 亦无活动对象，因此没有绕过 UI 以 API 创建或测试删除分支。空间创建是该用例必要前提，`WIKI-002` 结算 FAIL，登记 `BUG-FQA-067`。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-002-SPACE-UI-LIFECYCLE/result.json`、`after-create.png`。

## B4 续跑：WIKI-018 状态矩阵受子页授权错误阻断

复核 `ST-WIKI-001..004` 的前置条件后，draft→review→published/rejected、拒绝后编辑再提交及只读空间写拒绝都需要可编辑的 runId 子页/祖先链。既有同一拥有者、同一空间、根页 `200` 的精确复现中，创建子页 `POST /api/wiki/pages` 返回 `403`/`无权限`；页面、空间及授权夹具均已按产品 API 清理。根页的更新或只读空间的孤立拒绝都不能替代完整状态/ACL 叠加链，因此 `WIKI-018` 与 `ST-WIKI-001..004` 结算 FAIL，复用 `BUG-FQA-058`，不重复登记缺陷。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-006/result.json`、`test-results/FQA_20260712_0329_lintfix/WIKI-006-007-ST-WIKI-001/result.json`。

## B4 续跑：FILE-012 文件移动消费端缺失

按主用例要求复核文件移动到可见/不可见文件夹的 UI/API 合同。`SharedFileController` 仅暴露文件夹创建、删除与 legacy ACL，以及文件上传、读取、删除；文件页仅有创建/删除 mutation，没有文件或文件夹 rename/move 控件。先前对 `PUT /api/files/folders/{id}` 和 `/move` 的合同探测均落入未映射异常并返回 500，不能把“无按钮”标为 N/A，也不能新建上传对象以测试一个不存在的操作。`FILE-012` 结算 FAIL，复用 `BUG-FQA-062`；此范围与 `FILE-016` 的 `shared_file:update` MISSING_CONSUMER 一并指向同一产品缺口。证据：`test-results/FQA_20260712_0329_lintfix/FILE-002-003-FOLDER-CRUD-NAMING/result.json`；源码：`backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFileController.java`、`frontend/src/app/(dashboard)/files/page.tsx`。

## B4 续跑：FILE-013 上传取消/进度消费端缺失

只读审计文件页的真实上传实现：页面仅以一次 `axios.post('/files/upload', FormData)` 发起请求，上传期间仅禁用按钮并显示“上传中…”。该调用没有 `onUploadProgress`、`AbortController`、取消按钮、关闭确认、断点/刷新恢复或服务端临时对象清理合同；后端也没有 upload-session、cancel 或临时对象端点。由于已确认 `BUG-FQA-053` 中产品删除不回收 MinIO 对象，未上传新文件来伪造“取消”结果。缺少用户可触发的取消路径不得判 N/A，`FILE-013` 结算 FAIL，登记 `BUG-FQA-068`。源码证据：`frontend/src/app/(dashboard)/files/page.tsx`、`backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFileController.java`。

## B4 续跑：FILE-016 shared_file:update 无运行时消费者

以实时 permission 分母和文件模块 Controller/UI 对照：`shared_file:update` 仍可分配，但文件/文件夹只实现 create/read/upload/delete/manage_acl，既无 rename/move/edit endpoint，也没有 UI action；授权切换预检亦显式排除了该 action。该 permission 无法展开 allow/deny，符合 `MISSING_CONSUMER` 而非 N/A，`FILE-016` 结算 FAIL，复用 `BUG-FQA-013`。证据：`test-results/FQA_20260712_0329_lintfix/permission-consumer-classification-20260713.tsv`；源码：`backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFileController.java`、`backend/src/main/java/com/cwgsyw/platform/module/authorization/AuthorizationCutoverService.java`。

## B8 续跑：FILE-018 多级目录祖先 traverse

复用已完成的独立 runId 文件夹/账号夹具：父目录先配置 named-user `r-x`，子目录按 default ACL 继承，最小 `shared_file:read` group scope 账号读取子目录列表返回 200；移除父目录的 traverse `x` 后，同一子目录读取精确返回 403/`无权限`，没有资源内容泄露。子→父目录、assignment、membership、账号和角色均经产品 API 逆序清理，活动夹具为零。`FILE-018` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/B8-ACL-NAMED-GROUP-TRAVERSE/result.json`。

## B8 续跑：FILE-011 无 ACL 管理权限拒绝

复用最小 read-only group scope runId 账号与独立文件夹：文件夹读取为 200；统一资源 ACL 的 GET 与 PUT 均精确返回 403/`无权限`，前后 snapshot 相同且 accessVersion 保持 0。文件夹、assignment、membership、账号和角色均按依赖逆序产品 API 清理，活动夹具为零。该用例要求的“缺功能 permission”拒绝与无副作用已满足，`FILE-011` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/B8-ACL-MANAGE-DENY/result.json`。

## B1 续跑：P-007 首页至节假日历只读路径

独立 Google Chrome/Playwright 从 `/login` 登录后，真实点击首页侧栏“运维日历”，在日历页展开“管理”菜单并点击“节假日历”。页面落到 `/ops-calendar/holidays`，标题可见、表格有 7 行，`GET /api/ops-calendar/holidays` 返回 200；全程零业务写入、零 Console error、零失败请求和零 API 5xx。该页面基础入口/渲染路径结算 PASS；CRUD、导入等仍分别由 OPS 主用例覆盖。证据：`test-results/FQA_20260712_0329_lintfix/P-007-OPS-HOLIDAYS-UI-READONLY/result.json`。

## B2 续跑：RBAC-006 group:delete 缺运行时消费者

实时 98-action 分类仍将 `group:delete` 标为 `MISSING_CONSUMER`。用户组创建、编辑、成员关系和用户清理已有产品闭环，但 `GroupController` 不存在 `DELETE /api/groups/{id}` mapping，故可分配 action 没有 endpoint、间接业务 consumer 或可展开的 allow/deny 路径。按目录规则不可标 N/A，`RBAC-006` 结算 FAIL，复用 `BUG-FQA-013`。证据：`test-results/FQA_20260712_0329_lintfix/permission-consumer-classification-20260713.tsv`、`test-results/FQA_20260712_0329_lintfix/RBAC-ORGOPS-READ-FIXTURE/result.json`。

## B3 续跑：CMDB-022/023 CSV 导入前置与执行结果

`CMDB-022`：从首页真实进入中文模型“应用”的实例列表，打开导入 CSV 并点击“下载 CSV 模板”；UI 把模型参数二次编码为 `%25E5...`，请求返回 400 并产生 Console error，必要下载前置失败，结算 FAIL，复用 `BUG-FQA-039`。`CMDB-023`：runId 模型 CSV 缺少必填列时预检正确返回 400；合法 preview 后 execute 返回 200 却报告 `created=0/failed=1`，同时实例已实际落库，根因为审计 JSON 失败，结果与持久化不一致。夹具均已按实例→属性→模型→模型组逆序清理，`CMDB-023` 结算 FAIL，复用 `BUG-FQA-019`。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-TEMPLATE-DOWNLOAD/result.json`、`CMDB-TEMPLATE-ENCODING/result.json`、`CMDB-CSV-IMPORT/result.json`。

## B7 续跑：REPORT-001/003 输入与统计聚合

`REPORT-001` 的首页 UI 路径、正常/同日范围、历史空报表和 UI 反向日期拦截均已覆盖；但认证态直接请求反向日期导出仍返回 200、XLSX MIME 和非空内容，前后端输入合同可被绕过，故完整用例结算 FAIL，复用 `BUG-FQA-029`。`REPORT-003` 的 Workflow 统计和 CMDB action 汇总均与数据库源表一致，但 30 日内有 17 条变更记录时 `top10Instances=[]`，未满足聚合一致性，结算 FAIL，复用 `BUG-FQA-026`。全程只读，无测试数据。证据：`test-results/FQA_20260712_0329_lintfix/REPORT-001-003/result.json`、`test-results/FQA_20260712_0329_lintfix/REPORT-SERVER-BOUNDARY/result.json`。

## B4 续跑：WIKI-022 不存在资源错误态

认证态补充验证不存在空间、页面、编辑页、附件、backlinks 和 comments。不存在空间被渲染为普通空空间，页面编辑路由仍显示保存控件；后端相关读取统一返回空 body 403 并触发 Console error，不满足友好不存在合同。无数据写入，`WIKI-022` 结算 FAIL，复用 `BUG-FQA-045`。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-022-NOTFOUND/result.json`。

## B3 续跑：P-040 IPAM 不存在动态页

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“资源管理”并点击“IP 地址池”，随后按动态路由补充规则访问不存在 ID。当前页面已能收束并显示“地址池不存在”，不再是旧证据中的永久加载；但 `GET /api/ip-pools/999999999` 返回 400 两次并被浏览器记录为两条 Console error。无业务写入、失败请求或 5xx。页面基础错误态不满足零未解释 Console/明确 not-found HTTP 合同，`P-040` 结算 FAIL，补充 `BUG-FQA-043` 当前版本证据。证据：`test-results/FQA_20260712_0329_lintfix/P-040-IPAM-NOTFOUND-UI/result.json`。

## B1 续跑：P-008 首页至素材归集只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页后，真实点击“运维日历”，展开“管理”菜单并点击“素材归集”。页面落到 `/ops-calendar/materials`，显示“选择周期后点击「归集」。”空态；没有点击归集或导出。全程零业务写、零 Console error、零失败请求和零 API 5xx，`P-008` 页面基础入口/渲染路径结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-008-OPS-MATERIALS-UI-READONLY/result.json`。

## B1 续跑：P-009 首页至排班管理只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页后，真实点击“运维日历”，展开“管理”菜单并点击“排班管理”。页面落到 `/ops-calendar/rosters`，当前月 `GET /api/ops-calendar/rosters` 返回 200 并显示“暂无排班”；用户选择请求也为 200。全程零业务写、零 Console error、零失败请求和零 API 5xx，`P-009` 页面基础入口/渲染路径结算 PASS。排班创建仍被无产品删除/归档生命周期门禁阻断。证据：`test-results/FQA_20260712_0329_lintfix/P-009-OPS-ROSTERS-UI-READONLY/result.json`。

## B1 续跑：P-010 首页至周期规则只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页后，真实点击“运维日历”，展开“管理”菜单并点击“周期规则”。页面落到 `/ops-calendar/rules`，`GET /api/ops-calendar/rules` 返回 200 并渲染 6 条规则。未触发启停、创建、更新或删除；全程零业务写、零 Console error、零失败请求和零 API 5xx，`P-010` 页面基础入口/渲染路径结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-010-OPS-RULES-UI-READONLY/result.json`。

## B1 续跑：P-011 首页至统计复盘只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页后，真实点击“运维日历”，展开“管理”菜单并点击“统计复盘”。页面落到 `/ops-calendar/stats`，默认月范围 `GET /api/ops-calendar/stats` 返回 200，5 个统计空态均稳定渲染。未点击统计或导出；全程零业务写、零 Console error、零失败请求和零 API 5xx，`P-011` 页面基础入口/渲染路径结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-011-OPS-STATS-UI-READONLY/result.json`。

## B1 续跑：P-012 首页至模板管理只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页后，真实点击“运维日历”，展开“管理”菜单并点击“模板管理”。页面落到 `/ops-calendar/templates`，`GET /api/ops-calendar/templates` 返回 200 且“暂无模板”空态稳定渲染。未创建模板；全程零业务写、零 Console error、零失败请求和零 API 5xx，`P-012` 页面基础入口/渲染路径结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-012-OPS-TEMPLATES-UI-READONLY/result.json`。

## B1 续跑：P-014/P-015 CMDB 兼容入口

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”菜单并点击“概览”；随后按兼容路由补充规则访问 `/cmdb/instances` 与 `/cmdb/models`。前者稳定重定向至 `/cmdb`，后者稳定重定向至 `/cmdb/admin`，无循环。全程零业务写、零 Console error、零未解释失败请求和零 API 5xx（导航过程 `_rsc` 预取取消已过滤为已解释浏览器行为），`P-014`、`P-015` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-014-015-CMDB-COMPAT-REDIRECT/result.json`。

## B1/B3 续跑：P-016 CMDB 管理页与 CMDB-014 权限矩阵

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”菜单并点击“模型管理”；模型目录、属性分组和关联定义三个 Tab 均可切换，`models/model-groups/association-defs/association-kinds` 读取均为 200，且无业务写、Console error、失败请求或 5xx，`P-016` 页面基础合同结算 PASS。复核既有独立 group-scope 最小角色矩阵：`cmdb_model:read` 读取允许，缺 create/update/delete/manage 的对应 API 均 403；完整权限夹具允许模型、分组、属性管理；所有 runId 元数据、assignment、membership、用户与角色已逆序清理为零。低权限浏览器中的 403 来自未授权首页预取，且本轮 superadmin 页面读路径为零 Console error；`CMDB-014` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-016-CMDB-ADMIN-UI-READONLY/result.json`、`CMDB-014-METADATA-PERMISSION-MATRIX/result.json`。

## B1 续跑：P-017 CMDB 现有模型详情只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“模型管理”，再按动态路由补充规则打开已有 `host` 模型详情。`/cmdb/admin/models/host` 稳定加载“主机”标题和 64 个“内置”属性标识；`models/host`、`attributes`、`attribute-groups` 读取均为 200。全程除登录/session touch 外零业务写、零 Console error、零失败请求和零 API 5xx，`P-017` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-017-CMDB-MODEL-DETAIL-UI-READONLY/result.json`、`host-model-properties.png`。

## B1/B3 续跑：P-018 至 P-022 CMDB 现有资源动态页只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“概览”，再按动态路由补充规则顺序读取已有 `host` 模型的实例列表、新建实例表单、实例 #24 详情、实例关联列表及新建关联向导。五个路由均保持预期路径和主标题可见；列表、详情、关联定义与选择向导读取均完成。全程除登录/session touch 外零业务写、零 Console error、零失败请求和零 API 5xx，`P-018`、`P-019`、`P-020`、`P-021`、`P-022` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-018-022-CMDB-DYNAMIC-UI-READONLY/result.json`、`P-018.png` 至 `P-022.png`。

## B1/B3 续跑：P-024 至 P-026 CMDB 拓扑与影响分析动态页

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“概览”，再按动态路由补充规则读取已有实例 #24 的拓扑图、拓扑对比页和影响分析页。三个路由均加载预期主内容且无 Console/网络错误或 5xx；影响分析调用的 `POST /api/cmdb/instances/24/impact` 是产品定义的无副作用计算查询，返回 200，已与业务写操作分开记录。全程没有创建、更新、删除或状态转换请求，`P-024`、`P-025`、`P-026` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-024-026-CMDB-GRAPH-UI-READONLY/result.json`、`P-024.png` 至 `P-026.png`。

## B1/B3 续跑：P-023 CMDB 二维实例视图只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“概览”，再按动态路由补充规则读取二维实例视图。`/cmdb/instances/2d-view` 保持目标路由并稳定渲染分组/实例内容；零业务写、零 Console error、零失败请求和零 API 5xx，`P-023` 页面基础合同结算 PASS。同期 `/cmdb/associations` 的兼容重定向断言结果未稳定，未将 `P-027` 计入通过，保留后续复核。证据：`test-results/FQA_20260712_0329_lintfix/P-023-027-CMDB-GLOBAL-UI-READONLY/result.json`、`P-023.png`。

## B1/B3 续跑：P-027 CMDB 全局关联兼容入口

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“模型管理”，再按兼容路由补充规则访问 `/cmdb/associations`。该入口稳定重定向至 `/cmdb/admin` 并显示“关联定义”Tab；零业务写、零 Console error、零失败请求和零 API 5xx，`P-027` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-027-CMDB-ASSOCIATIONS-COMPAT-UI-READONLY/result.json`、`cmdb-associations-redirect.png`。

## B1/B3 续跑：P-028 告警中心与 P-029 CMDB 变更记录

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“概览”，再按动态路由补充规则读取告警中心和变更记录。`P-028` 告警中心稳定渲染，读取 `GET /api/cmdb/alerts?page=1&size=20` 成功，零业务写、Console error、失败请求及 API 5xx，页面基础合同结算 PASS。`P-029` 变更记录同样稳定渲染且无浏览器/网络错误，但当前页实际展示大量变更行，分页摘要却显示“共 0 条、1 / 1”；该分页/总数合同与实际列表矛盾，复现系统性 `BUG-FQA-023`，因此 `P-029` 页面按完整功能范围结算 FAIL，未新建重复缺陷。证据：`test-results/FQA_20260712_0329_lintfix/P-028-029-CMDB-READONLY-UI/result.json`、`P-028.png`、`test-results/FQA_20260712_0329_lintfix/P-029-CMDB-CHANGES-UI-READONLY/result.json`、`cmdb-changes.png`。

## B1/B3 续跑：P-030 CMDB 变更统计合同

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“概览”，再按动态路由补充规则读取 `/cmdb/changes/stats`。页面可稳定加载，零业务写、Console error、失败请求及 API 5xx；但页面没有日期输入/范围触发控件，当前汇总卡维持非零值，且“变更最频繁的实例 (Top 10)”显示“暂无实例变更统计”。运行数据库已有 17 条窗口内变更，既有 `REPORT-003` 已核对源数据与空 Top10；范围参数忽略问题已由 `BUG-FQA-052` 留证。故 `P-030` 按统计/Top 数据/范围完整合同结算 FAIL，复用 `BUG-FQA-026` 和 `BUG-FQA-052`，不重复建缺陷。证据：`test-results/FQA_20260712_0329_lintfix/P-030-CMDB-CHANGE-STATS-UI-READONLY/result.json`、`default-stats.png`、`future-stats.png`。

## B1/B6 续跑：P-031、P-034、P-035 变更文档与模板只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页后，按真实侧栏路径进入“变更文档→文档列表”和“变更文档→模板管理”，再从现有模板列表进入模板 #4 详情。`P-031` 显示 2 条现有文档及 5 个状态筛选；`P-034` 显示 4 个模板及类型/状态；`P-035` 读取既有表格字段配置、列定义和保存控件但不提交。全程除登录/session touch 外无业务写、无 Console error、无 API 5xx；模板列表悬停产生的 `_rsc` `net::ERR_ABORTED` 均是路由预取取消，已单独记录为已解释。`P-031`、`P-034`、`P-035` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-031-034-035-CHANGE-UI-READONLY/result.json`、`02-p031-change-doc-list.png`、`03-p034-template-list.png`、`04-p035-template-detail.png`。

## B1/B3 续跑：P-036 设备密码库列表只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“资源管理”并点击“设备密码库”。`/devices` 标题及现有设备列表稳定渲染；未点击查看、复制、编辑或删除，未调用任何凭据明文读取接口。页面分页摘要没有出现“有记录且总数为 0”的矛盾；全程除登录/session touch 外零业务写、零 Console error、零失败请求和零 API 5xx，`P-036` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-036-DEVICE-LIST-UI-READONLY/result.json`、`device-list.png`。

## B1/B3 续跑：P-037、P-038、P-039 资源页面只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“资源管理”并进入设备密码库；按动态路由补充规则读取设备新建表单和既有设备 #1 详情，随后重新从首页资源管理入口点击“IP 地址池”。`P-037` 表单的 CMDB 关联提示与创建控件正常显示但未提交；`P-038` 显示既有设备的分组/掩码凭据状态，未触发查看、复制、编辑或删除；`P-039` IPAM 列表稳定渲染。全程除登录/session touch 外零业务写、零 Console error、零失败请求和零 API 5xx，三页基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-037-039-RESOURCE-UI-READONLY/result.json`、`P-037.png`、`P-038.png`、`P-039.png`。

## B1/B5 续跑：P-052 至 P-056 流程中心只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“流程中心”并点击“待办中心”，再按动态路由补充规则读取流程任务、实例、模板与设计列表。`P-052`、`P-053`、`P-054`、`P-055`、`P-056` 均保持目标路由、主内容稳定可见；未执行审批、驳回、评论、部署、启停、新建、导入或保存。全程除登录/session touch 外零业务写、零 Console error、零失败请求和零 API 5xx，五页基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-052-056-WORKFLOW-UI-READONLY/result.json`、`P-052.png` 至 `P-056.png`。

## B1/B5 续跑：P-057 至 P-060 流程设计与管理只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“流程中心”并点击“流程设计”，再按动态路由补充规则读取既有 `dailyReportApproval` 设计、流程绑定、流程管理和流程统计页。四页均保持目标路由和主内容稳定可见；未保存 BPMN/属性、未部署、启停、删除定义或新建绑定。全程除登录/session touch 外零业务写、零 Console error、零失败请求和零 API 5xx，`P-057`、`P-058`、`P-059`、`P-060` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-057-060-WORKFLOW-ADMIN-UI-READONLY/result.json`、`P-057.png` 至 `P-060.png`。

## B1/B2/B7 续跑：P-061 至 P-065 报表与身份权限只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页后，真实展开“报表分析”并点击“综合报表”，随后逐页从首页展开“身份与权限”进入用户、用户组、角色、权限配置。五个路由均稳定渲染其主内容；未创建、编辑、重置密码、修改用户状态、调整成员/主组/角色/permission 或保存矩阵。全程除登录/session touch 外零业务写、零 Console error、零失败请求和零 API 5xx，`P-061` 至 `P-065` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-061-065-RBAC-REPORT-UI-READONLY/result.json`、`P-061.png` 至 `P-065.png`。

## B1/B4 续跑：P-043 至 P-048 知识库只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实点击“知识库”，再按动态路由补充规则读取空间列表、全文搜索、既有空间 #6、既有页面 #87、编辑页和空间图谱。编辑页由既有详情的“编辑”入口进入，仅读取预览/控件，未保存或提交；其余页面同样未创建空间/页面、修改 ACL、上传附件或写评论。六页均保持目标路由、所有 API 小于 500，零业务写、零 Console error、零普通失败请求；两条 `_rsc` `net::ERR_ABORTED` 为路由预取取消，已解释。`P-043` 至 `P-048` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-043-048-WIKI-UI-READONLY/result.json`、对应 `P-043.png` 至 `P-048.png` 与 `trace.zip`。

## B1/B7 续跑：P-066 至 P-070 系统管理与通知只读路径

独立 Google Chrome/Playwright 从 `/login` 登录首页，逐次真实展开“系统管理”进入系统配置、AI 配置、审计日志、备份与恢复。`P-066` 至 `P-069` 均保持目标路由、读取接口成功，未修改配置/provider、未创建/恢复/删除备份；零业务写、Console error、失败请求与 API 5xx。通知中心 `P-070` 复用独立首页通知铃铛只读路径：列表 31 条、刷新和返回首页均正常，未点开条目或执行单条/全部已读；分页接口 total=0 的既有 `BUG-FQA-024` 不影响页面基础读取但阻断完整分页功能用例。系统批处理通知侧栏点击超时源于折叠菜单遮挡，非页面产品错误。`P-066` 至 `P-070` 页面基础合同结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/P-066-070-SYSTEM-UI-READONLY/result.json`、`P-066.png` 至 `P-069.png`、`NOTIFICATION-READONLY-RECHECK/result.json`。

## B1/B5 续跑：P-049 至 P-051 日报读路径与不存在资源错误态

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“流程中心”并点击“日报审批”，再按动态路由补充规则读取日报列表、新建表单及不存在 ID。`P-049` 列表与 `P-050` 新建表单稳定渲染，未创建或提交日报，零业务写、Console error、失败请求与 API 5xx，页面基础合同结算 PASS。`P-051` 不存在日报详情可显示“不存在”文案，但 `GET /api/daily-reports/999999` 返回 400，浏览器记录 Console error；错误态 HTTP 合同不成立，按完整页面合同结算 FAIL，复用既有 `BUG-FQA-043` 类错误处理根因，不重复建缺陷。证据：`test-results/FQA_20260712_0329_lintfix/P-049-051-DAILY-UI-READONLY/result.json`、`P-049.png` 至 `P-051.png`。

## B1/B2/B4 续跑：P-041、P-042、P-040、P-071 剩余文件、IPAM 与迁移工作台页面

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“资源管理”进入共享文档，真实展开“身份与权限”进入迁移异常工作台。`P-041` 共享文件列表和 `P-071` 工作台均稳定读取，未上传/下载/改 ACL、未执行预检、回填、迁移、Enforce 或 Rollback；零业务写、Console error、失败请求和 API 5xx，页面基础合同结算 PASS。`P-040` 已由真实首页 IPAM 路径补充不存在地址池：页面显示不存在但 API 返回 400 并产生两条 Console error，按 `BUG-FQA-043` FAIL。`P-042` 已由真实首页共享文档路径补充不存在预览：两个文件 API 均返回 403，页面残留“加载中...”、有四条 Console error，按 `BUG-FQA-009` FAIL。证据：`test-results/FQA_20260712_0329_lintfix/P-041-071-FILES-MIGRATION-UI-READONLY/result.json`、`P-041.png`、`P-071.png`、`P-040-IPAM-NOTFOUND-UI/result.json`、`P042-nonexistent-file/result.json`。

## B1/B3 续跑：P-013 CMDB 概览页面闭合

独立 Google Chrome/Playwright 从 `/login` 登录首页，真实展开“CMDB”并点击“概览”。`/cmdb` 稳定显示 CMDB 主内容和 4 个模型实例浏览链接；未点击创建、导入、批量、编辑或删除。全程除登录/session touch 外零业务写、零 Console error、零失败请求与零 API 5xx，`P-013` 页面基础合同结算 PASS。至此 71 个实时页面均已判定：62 PASS、9 FAIL、NOT_RUN=0；页面覆盖率为 100%，但不代表功能/权限/状态矩阵已关闭。证据：`test-results/FQA_20260712_0329_lintfix/P-013-CMDB-OVERVIEW-UI-READONLY/result.json`、`cmdb-overview.png`。

## B4 续跑：WIKI-012 链接/反向链接与 WIKI-015 评论生命周期结算

复核独立、可清理 runId Wiki 夹具的完整运行记录。`WIKI-012`：已知 wikilink、别名链接、目标页 backlinks 及返回源页均通过，但未知 wikilink 错误地把 `<sup title="该页面尚未创建">待创建</sup>` 当文字渲染，而不是友好的 inline 待创建提示，故主用例结算 FAIL，关联 P2 缺陷线索已保留。`WIKI-015`：评论 UI 创建、空/301 字符边界、分页无重叠降序、owner 删除与其他用户 UI/API 403 拒绝均通过；评论、页面、空间、assignment、membership、用户和角色均逆序产品 API 清理，结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-BACKLINK-COMMENT-RUNTIME/result.json`；活动对象为零。

## B5 状态矩阵续跑：OPS 与 DAILY 18 条不可精确清理状态边

`ST-OPS-001` 至 `ST-OPS-014` 均正式标记 BLOCKED：任务 Controller 支持确认/开始/完成/异常关闭/取消，但没有 DELETE、archive 或 purge；任何新建 runId 任务都无法通过产品能力精确回收，取消只保留 `cancelled` 历史。`ST-DAILY-001` 至 `ST-DAILY-004` 同样正式标记 BLOCKED：日报提交会创建流程实例、待办、通知与审计，产品没有日报/流程历史删除或归档接口。本轮不使用直接 SQL 或伪造数据库状态绕过产品合同；此前历史证据不能替代当前严格清理边界。解除条件为产品提供可审计清理/归档生命周期，或用户明确批准保留该批测试业务/流程历史。至此状态/跨模块矩阵从 74 条 NOT_RUN 降为 56 条 NOT_RUN，18 条 BLOCKED 均有解除条件，无活动夹具残留。

## B2/B8 状态矩阵续跑：ST-AUTHZ-019 无效切换确认拒绝

在 Enforced/epoch=1 前快照下，读取 cutover、strict preflight、pending users 和迁移异常；向 Enforce/Rollback 确认入口提交无效确认词，均返回 HTTP 400、`confirmation must be ENFORCE or ROLLBACK`。后快照仍为 configured/effective `enforced`、cutover status `enforced`、epoch=1，未产生授权切换、rollout 或审计变化，`ST-AUTHZ-019` 结算 PASS。非 platform group-scope 夹具的 break-glass POST/DELETE 均为 403，Redis key 和审计不变，补强不可绕过拒绝；但平台有效 session 的 activate/bypass/deactivate/TTL 正向链仍需明确授权，未因此结算 `ST-AUTHZ-011`。证据：`test-results/FQA_20260712_0329_lintfix/AUTHZ-003-009-019/result.json`、`AUTHZ-012-BREAK-GLASS-NONPLATFORM-DENY/result.json`。

## B2/B8 状态矩阵续跑：ST-AUTHZ-022 schema-only 枚举

`ST-AUTHZ-022` 结算 N/A（已审计而非遗漏）：前端 DTO 类型列出 cutover `frozen`，但当前 `AuthorizationMigrationController` 仅暴露读取、Enforce、Rollback、pending user 主组、account/resource backfill 和 exception 操作；`AuthorizationCutoverService` 仅提供 Enforce/Rollback 可达转换。没有产品 API/Service 路径产生 `frozen`，migration run `approved/rolled_back/failed` 或 rollout `eligible` 状态。本轮不使用 SQL/内部调用伪造这些 enum 值，符合状态矩阵的 schema-only N/A 条款。证据：`frontend/src/app/(dashboard)/rbac/migration-exceptions/page.tsx`、`backend/src/main/java/com/cwgsyw/platform/module/authorization/AuthorizationMigrationController.java`、GitNexus query `authorization cutover frozen rollout eligible migration approved rolled_back failed status`。

## B4/B8 状态矩阵续跑：ST-WIKI-001 至 ST-WIKI-004

`ST-WIKI-001` 至 `ST-WIKI-004` 均结算 FAIL，复用 `BUG-FQA-058`：全部四条状态/ACL 链均要求在可编辑 runId 根页下创建子页，而同一拥有者、同一空间、同一 session 的 `POST /api/wiki/pages` 子页创建稳定返回 403。没有子页就不能构造 draft→review→published/rejected、拒绝后重新提交、published 再编辑的树/图谱/搜索/版本链，也不能构造 readOnly 空间内子页写拒绝的祖先资源语义。空间、根页及 RBAC 夹具均已产品 API 清理；不以根页成功、孤立 403 或静态状态枚举冒充四条状态边。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-006/result.json`、`WIKI-006-007-ST-WIKI-001/result.json`、`WIKI-024-ANCESTOR-TRAVERSE-GATE/result.json`。

## B8 续跑：permission alias 与运维 scope action 运行期闭合

`ops_calendar:read_group` 与 `ops_calendar:read_all`：分别以只含被测 action、group:1 assignment、有效 primary membership 的独立 runId 账号调用任务 default/group/all 读取，全部返回 403。有效 permission、assignment scope/expiry 与 membership 已核验，实际 Controller 却固定要求 `ops_calendar:read`；两 action 结算 `FAIL/GUARD_DRIFT`，登记 `BUG-FQA-069`。当前无可精确清理的跨组任务数据，范围 ID 集仍无法安全构造，但该限制不能覆盖已经观察到的前置 guard 拒绝。夹具均已产品 API 清理。

`cmdb_model:write`：同等 group:1 scope 下，write-only 用户更新 runId 模型返回 403 且模型不变；canonical update-only 用户返回 200 并回读持久化；read-only 对照为 403。可分配 compatibility action 不具实际更新能力，结算 `FAIL/GUARD_DRIFT`，登记 `BUG-FQA-070`。模型、模型组、3 组角色/用户/membership/assignment 均已逆序清理。证据：`test-results/FQA_20260712_0329_lintfix/OPS-PERMISSION-SCOPE-RUNTIME-CLEANUP/result.json`、`test-results/FQA_20260712_0329_lintfix/CMDB-MODEL-WRITE-ALIAS-PARITY/result.json`。

## B3 续跑：CMDB 已存完整证据批量结算

以下主用例满足其完整当前合同并均有 runId 夹具的即时 manifest 登记、产品 API 逆序清理和 `activeFixtureObjects=0` 证据，结算 `PASS`：`CMDB-001`、`CMDB-002`（首页概览、兼容入口、既有详情只读）；`CMDB-003`、`CMDB-007`（模型组/属性组生命周期与约束）；`CMDB-004`、`CMDB-014`（模型元数据 manage 反向权限矩阵）；`CMDB-012`、`CMDB-013`（关联定义与扩展属性）；`CMDB-025`（import 拒绝）；`CMDB-026`、`CMDB-027`（关联 CRUD 和 read-only 拒绝）；`CMDB-033`（当前无告警时每个级别/状态筛选一致空集）；`CMDB-038`（端点连接、镜像边和清理）。

以下为已有首次失败证据，结算 `FAIL`：`CMDB-005`、`CMDB-006` 均因非法模型颜色返回 500（`BUG-FQA-047`；前者虽完成复制、重命名和移动，完整更新合同仍失败）；`CMDB-022` 中文模型 CSV 模板二次编码 400（`BUG-FQA-039`）；`CMDB-023` CSV execute 报失败但实例已持久化（`BUG-FQA-019`）；`CMDB-031`、`CMDB-032` impact 小图谱全部返回 root-only/truncated（`BUG-FQA-050`）；`CMDB-035` keyword 忽略、page size/total 矛盾（`BUG-FQA-023`、`BUG-FQA-051`）；`CMDB-036` 显式未来空范围仍返回当前聚合（`BUG-FQA-052`）；`CMDB-040` `onDelete=restrict` 未阻止删除且留下设备孤儿引用（`BUG-FQA-061`）。`CMDB-034` 维持 `BLOCKED`：真实 ack 只能由 Prometheus 内部同步创建，当前没有已批准且可精确清理的告警 fixture。

未将 `CMDB-008` 至 `CMDB-011`、`CMDB-015` 至 `CMDB-021`、`CMDB-024`、`CMDB-028` 至 `CMDB-030`、`CMDB-037`、`CMDB-039` 计入：已有结果未覆盖每个模型/字段类型、所有编辑字段和 UI 取消/清空、JSON upsert 完整合同、错误组合/拓扑非空筛选、机柜 U 位或完整面包屑返回链。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-READONLY-PARALLEL/result.json`、`CMDB-MODEL-METADATA-BOUNDARY/result.json`、`CMDB-ASSOCIATION-ATTR-LIFECYCLE/result.json`、`CMDB-JSON-IMPORT-BOUNDARY/result.json`、`CMDB-RELATION/result.json`、`CMDB-TOPOLOGY-IMPACT-LIFECYCLE/result.json`、`CMDB-ALERT-CHANGE-CONTRACT/result.json`、`CMDB-ENDPOINT-LINK-LIFECYCLE/result.json`、`CMDB-040-REFERENCE-DELETE-PROTECTION/result.json`。

## B1/B2/B7/B8 续跑：唯一 ID 证据台账第一批重算

为消除历史执行记录把子步骤混入主用例计数的问题，已按 catalog 的完整合同逐项审计认证、账户、首页、RBAC、迁移、报表、通知、系统管理和公共交互共 107 个唯一 ID，不把局部只读或单条子路径扩大为主用例成功。经二次核对，该批结论为 `51 PASS / 20 FAIL / 11 BLOCKED / 25 NOT_RUN`。其中 `AUTH-003/009`、`HOME-008`、`ACCOUNT-003`、`RBAC-001/006/007/008/010/013/015/016/018/026`、`REPORT-001/003`、`NOTICE-001/002`、`AUDIT-001`、`COMMON-012` 为已有明确失败；`AUTHZ-010/011/013/014/015`、`RBAC-027`、`NOTICE-003`、`AI-001..003`、`BACKUP-004` 均保留明确授权或恢复能力的 BLOCKED。`AUTH-007/010`、`HOME-005`、`ACCOUNT-004`、`RBAC-002/009`、`AUTHZ-004..009`、`CONFIG-001..005`、`AUDIT-002`、`BACKUP-002`、`COMMON-001..005/011` 仍为 NOT_RUN。

本批的 PASS 仅包括：`AUTH-001/002/004/005/006/008`、`HOME-001/002/003/004/006/007`、`ACCOUNT-001/002/005/006/007/008/009/010`、`RBAC-003/004/005/011/012/014/017/019/020/021/022/023/024/025/028`、`AUTHZ-001/002/003/012/016`、`REPORT-002`、`CONFIG-006`、`AI-004`、`AUDIT-003`、`BACKUP-001/003`、`COMMON-006..010`。`RBAC-001` 的 CRUD 夹具虽可回收，但边界异常已破坏全合同；`RBAC-002` 未找到完整 username/email 等价类证据，均不计 PASS。证据：`test-results/FQA_20260712_0329_lintfix/ACCOUNT-001-008/result.json`、`AUTH-002-004-005-006/result.json`、`AUTH-008-CROSS-TAB-LOGOUT/result.json`、`RBAC-003-008-MEMBERSHIP-MATRIX/result.json`、`RBAC-011-PERMISSION-SAVE-DELEGATION/result.json`、`RBAC-021-GROUP-DELEGATION/result.json`、`RBAC-022-validuntil/result.json`、`RBAC-023-028-builtin/result.json`、`AUTHZ-003-009-019/result.json`、`AUTHZ-012-BREAK-GLASS-NONPLATFORM-DENY/result.json`、`BACKUP-LIFECYCLE/result.json`、`REPORT-001-003/result.json`。

## B4 续跑：FILE/Wiki 唯一 ID 证据台账

严格按完整合同结算：`FILE-001/009/011/015/018` 与 `WIKI-003/004/005/007/009` 为 PASS；`FILE-002/003/005/008/012/013/016` 与 `WIKI-002/006/008/012` 为 FAIL；`WIKI-011` 为 BLOCKED（附件无独立删除且页面删除不证明 shared_file/MinIO 回收）。其余 FILE/Wiki 主用例仍保留 NOT_RUN：已有文本文件上传/预览/下载、只读空间/树、Mermaid 和 ACL 子证据均不足以替代 catalog 要求的全类型、并发、owner/named-user/group/others 按位优先级或主题等完整链。证据：`test-results/FQA_20260712_0329_lintfix/FILE-002-003-FOLDER-CRUD-NAMING/result.json`、`FILE-005-EMPTY-UPLOAD-BOUNDARY/result.json`、`FILE-009-015-ACL-LIFECYCLE/result.json`、`B8-ACL-NAMED-GROUP-TRAVERSE/result.json`、`WIKI-006/result.json`、`WIKI-007-ROOT-EDIT-MOVE/result.json`、`WIKI-008-TITLE-BOUNDARY/result.json`、`WIKI-009-EDITOR-PREVIEW/result.json`、`WIKI-BACKLINK-COMMENT-RUNTIME/result.json`。

## B4 续跑：Wiki UI 创建空间补测与回收

此前 UI 默认“使用主组”创建空间返回 403。补测时在同一“新建空间”对话框选择 UI 提供的业务归属组，`POST /api/wiki/spaces` 成功创建 runId 空间 #52，证明默认值路径与显式归属组路径存在行为差异。确认删除的前端定位器未在超时内收束，未将该结果升级为 `WIKI-002` PASS；该 runId 空间已通过产品清理路径软删除，数据库核验 `wiki_space.id=52, is_deleted=true`，manifest 无 active object。补测证据目录：`test-results/FQA_20260712_0329_lintfix/WIKI-002-SPACE-UI-LIFECYCLE-RERUN/`（脚本异常前的 API/UI 记录）与本记录的数据库核验；不覆盖既有 `BUG-FQA-067` 默认路径失败结论。

## B5/B6 续跑：运维、日报、Workflow 与变更文档唯一 ID 证据台账

现存完整证据结算 `PASS`：`OPS-001/002/011/012/013/019`、`DAILY-001`、`FLOW-001/003/011`、`CHANGE-001/017`。结算 `FAIL`：`OPS-004/005/015/018`（输入校验或反向日期 UI 合同失败）、`DAILY-003/004`（非法日期/负工时 500）、`FLOW-004/013`（已完成活动历史及统计 DTO 合同）、`CHANGE-005/016`（动态模板字段未渲染/错误路由与字段能力不完整）。结算 `BLOCKED`：`OPS-008`、`OPS-016`、`DAILY-002/006`、`FLOW-005`；前 3 类没有产品删除、归档或 purge 以精确回收 runId 业务历史，Workflow 模板实例也没有可审计清理闭环。

以下保持 NOT_RUN：`OPS-003/006/007/009/010/014/017/020`、`DAILY-005/007/008/009`、`FLOW-002/006/007/008/009/010/012`、`CHANGE-002/003/004/006/007/008/009/010/011/012/013/014/015/018/019/020`，以及 `ST-CHANGE-001..004`。既有草稿/API 拒绝、已通过文档单状态导出或只读页面不能替代所有合法/非法状态边、模板字段类型、审批权限、双模板/方案隔离或完整下载矩阵。证据：`test-results/FQA_20260712_0329_lintfix/OPS-TASK-REJECTION/result.json`、`OPS-TEMPLATE-CRUD/result.json`、`OPS-RULE-LIFECYCLE/result.json`、`OPS-019-EXPORT-PERMISSION-DENY/result.json`、`DAILY-003-004-API-INVALID/result.json`、`WORKFLOW-CONFIGURE-PERMISSION-DENY/result.json`、`PW-WORKFLOW-STATS-RECHECK/result.json`、`CHANGE-005/result.json`、`CHANGE-TEMPLATE-LIFECYCLE-CONTRACT/result.json`。

## B4 续跑：WIKI-027 Enforced 旧 ACL PUT 门禁

以 superadmin 认证态对既有空间 #6 与页面 #87 的 legacy ACL 先后执行 GET、PUT、GET。空间与页面的两次 GET 均为 HTTP 409 “新授权模型已生效，请使用资源权限接口读取 ACL”，PUT 均为 HTTP 409 “请使用资源权限接口维护 ACL”；没有 2xx 写响应，也没有可见旧 ACL 读取变化。该反向门禁不改变资源，`WIKI-027` 从 NOT_RUN 结算 PASS。命令输出仅包含 HTTP/业务响应，不保存凭据。

## B4 续跑：FILE-019 Enforced 旧 ACL PUT 门禁

以同一认证态对既有文件夹 #1 的 legacy ACL 执行 GET、PUT、GET。三次响应依次为 409（读取迁移提示）、409（维护迁移提示）、409（读取迁移提示），没有 2xx 写响应；`FILE-019` 从 NOT_RUN 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/FILE-019-LEGACY-PUT-GATE/result.json`。

## B4 续跑：WIKI-013 搜索 debounce/history 合同

独立 Playwright 从 `/login` 登录并从首页点击“知识库”。Wiki 首页没有可见搜索入口；按动态路由补充打开 `/wiki/search` 后，源码和运行期均确认输入使用 400ms debounce 写 URL，但通过 `router.replace` 覆盖而非形成可回溯关键词状态。连续输入 `a`、`测试` 后的浏览器后退不能恢复前一个关键词，无法满足 catalog 的 URL、前进后退与焦点同步合同。无 Wiki 写请求、无 Console/失败请求；`WIKI-013` 结算 FAIL，登记 `BUG-FQA-071`。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-013-SEARCH-INTERACTION/result.json`、`search-interaction.png`。

## B3 续跑：IPAM CIDR/网络地址/删除约束边界

runId `/30` 夹具验证非法 CIDR 前缀正确 400；但非法 gateway/DNS 被 200 接受，network `.0` 与 broadcast `.3` 也均被分配并使 pool full，登记 `BUG-FQA-072`，`IPAM-004`、`IPAM-006` 结算 FAIL。活跃 allocation 下 delete 返回 400；随后释放 `.0/.3` 后 delete 返回 200、详情回读 400，`IPAM-010` 结算 PASS。所有 runId pool/allocations 均产品 API 逆序清理，manifest active objects=0。`IPAM-003` 仍为 NOT_RUN：/31、/32、重复和重叠矩阵未完整覆盖。证据：`test-results/FQA_20260712_0329_lintfix/IPAM-003-004-006-010-BOUNDARY/result.json`。

## B3 续跑：IPAM-003 CIDR /31、/32、重复与重叠矩阵

产品明确接受 `/31`（total=2）与 `/32`（total=1），可视为当前合同；但同一 `/31` 的重复创建和落于该范围内的 `/32` 重叠创建也都返回 200，缺少 CIDR 区间排他检测，`IPAM-003` 结算 FAIL，登记 `BUG-FQA-073`。四个 runId 地址池均创建即登记，随后逆序 DELETE 返回 200 且详情回读为 400，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/IPAM-003-CIDR-MATRIX/result.json`。

## B3 续跑：IPAM-005 自动/指定分配与计数闭环

以 runId `/29` 地址池先自动分配 `10.254.252.1`，再指定分配 `10.254.252.6`，两次均返回 allocated。详情与 utilization 同步显示 `allocatedCount=2/totalCount=6/utilizationPercent=33.33`，且两条 allocation 的 operator、description 与状态一致；分别 release 后详情显示两条 released 历史、`allocatedCount=0/utilizationPercent=0`。地址池随后 DELETE 200，详情回读 400，`IPAM-005` 结算 PASS。未触发“释放后自动再分配”，该已知缺陷仍仅由 `IPAM-007/BUG-FQA-041` 覆盖。证据：`test-results/FQA_20260712_0329_lintfix/IPAM-005-ALLOCATION-COUNTS/result.json`。

## B3 续跑：IPAM-008 最小 read permission API 子矩阵

重跑 runId `ip_pool:read` group-scope 账号后，列表、详情、utilization 均 200；create/update/delete/allocate/release 均精确 403，管理员前后地址池详情、列表和利用率快照一致。临时 role、user、membership、assignment 和 runId 地址池均已通过产品 API 清理；地址池首次 DELETE 返回 500，重试 DELETE 200 且详情回读 400，未留下对象。该 API 子矩阵不能替代 catalog 要求的最小权限账号“首页 UI”路径：原脚本在清理后无法重用账号，后续 UI 重跑脚本在 shell 解析前未执行。因此 `IPAM-008` 保持 NOT_RUN，不以 API 成功冒充完整主用例通过。证据：`test-results/FQA_20260712_0329_lintfix/IPAM-008-PERMISSION-DENY/result.json`。

## B3 续跑：IPAM-008 首页 UI/API 完整权限矩阵

重新创建 runId `ip_pool:read` group:1 最小账号和 runId 地址池，并在清理前以隔离 Playwright 从登录首页验证 UI。登录后不存在“资源管理”父组，等待真实入口超时；同会话 Console 有 5 个 API 403。静态配置确认父组被固定 `device:read` 门控，而 IPAM 页面本身和 API 的 read guard 都是 `ip_pool:read`。同一账号的列表、详情、utilization API 均 200，create/update/delete/allocate/release 全部 403，管理员前后 runId pool 快照不变。role/user/membership/assignment/pool 通过产品 API 全部清理，`IPAM-008` 结算 FAIL，登记 `BUG-FQA-074`。证据：`test-results/FQA_20260712_0329_lintfix/IPAM-008-UI-API-FULL/result.json`。

## B3 续跑：IPAM-002 首页 UI CRUD 生命周期

以 superadmin 独立 Playwright 从 `/login` 经首页“资源管理→IP 地址池”进入页面，创建 runId `/29` 地址池，响应 200 且列表出现新记录。由列表“详情”进入详情页，执行编辑并刷新确认新名称可见；回到列表后第一次删除点击“取消”，记录仍存在；第二次确认删除返回 200，详情 API 回读 400。期间无 Console error 或失败请求，所有写请求仅针对 runId pool #18；UI 删除已完成，manifest active objects=0，`IPAM-002` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/IPAM-002-UI-LIFECYCLE/result.json`。

## B7 续跑：BACKUP-002 UI 删除取消/确认

以 superadmin 独立 Playwright 从 `/login` 经首页“系统管理→备份与恢复”进入页面，点击“立即备份”创建本批 backup #9（POST 200）。按新备份 fileName 定位专属行：首次点击删除的浏览器原生确认框选择取消，没有 DELETE 请求且列表仍含该记录；第二次确认接受，`DELETE /api/backups/9` 返回 200，列表回读不存在。无 Console error、失败请求或 restore/upload；备份由 UI 删除，manifest active objects=0，`BACKUP-002` 结算 PASS。此前两次定位/按钮名错误均未进入删除分支，产生的 runId backup 已通过产品 API fallback 清理，不计作本次通过证据。证据：`test-results/FQA_20260712_0329_lintfix/BACKUP-002-UI-DELETE-FINAL/result.json`。

## B8 续跑：COMMON-005 / COMMON-011 复用通用交互合同

`COMMON-005` 复用 `BACKUP-002` 的真实 UI：取消浏览器确认框时没有 DELETE 请求且备份仍存在，确认后 DELETE 200、列表回读不存在，完整证明删除取消无数据变化。`COMMON-011` 复用 `BACKUP-001`：下载返回 HTTP 200、`Content-Disposition: attachment; filename=...tar.gz`、`application/octet-stream` 与 1,580,145 非空字节；无需依赖历史业务下载。两项均结算 PASS，证据：`test-results/FQA_20260712_0329_lintfix/BACKUP-002-UI-DELETE-FINAL/result.json`、`BACKUP-LIFECYCLE/result.json`。

## B8 续跑：COMMON-002 新建 Dialog 取消/重开

独立 Playwright 从首页进入 IP 地址池，打开“新建地址池”并填写 runId 名称/CIDR/网关/DNS草稿后点击取消，再重开同一对话框。产品 Dialog 保留隐藏 DOM，不能以 locator count 判断关闭；但重开时五个字段全部为空，浏览器没有 `POST/PUT/DELETE /api/ip-pools`，管理员按 runId keyword 的前后查询均为 0 条，证明取消未产生半成品且重新打开状态正确。无 Console error 或失败请求，`COMMON-002` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/COMMON-002-DIALOG-CLOSE/result.json`、`reopened-empty-v2.png`。

## B8 续跑：COMMON-003 保存即时刷新与单次提交

从首页进入 IPAM 创建 runId 地址池。创建响应 200 后列表立即仅出现一条同名行；浏览器 reload 后该行仍唯一可见，详情 API 回读名称一致。网络记录仅一条 `POST /api/ip-pools`，页面仅一个 toast，未捕获 Console error 或失败请求。随后产品 DELETE 200、详情回读 400，manifest active objects=0，`COMMON-003` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/COMMON-003-SAVE-REFRESH/result.json`、`saved-refreshed.png`。

## B8 续跑：COMMON-004 后退/前进后的重复提交

从首页进入 IPAM 创建 runId 地址池 #20，随后浏览器后退、前进并重新提交完全相同的表单。第二个 POST 仍返回 200，创建 pool #21；runId keyword 列表由 1 条变为 2 条，`COMMON-004` 结算 FAIL，登记 `BUG-FQA-075`。脚本的初始 finally 仅删除 #20；发现 #21 后立即按 runId 名称/CIDR 核验、产品 API DELETE 200、GET 400，manifest 已补登记为 cleaned，active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/COMMON-004-BACK-RESUBMIT/result.json`。

## B8 续跑：COMMON-001 新建双击幂等

从首页进入 IPAM，在同一已填写 runId 表单的“创建”按钮执行快速双击。网络仅记录一条 `POST /api/ip-pools`，响应 200 仅创建 pool #22；keyword 查询同样仅一条/一个唯一 ID。对象随后 DELETE 200、GET 400，manifest active objects=0，`COMMON-001` 结算 PASS。该结果不抵消 `COMMON-004` 的后退/前进重提交缺陷，两者分别覆盖并发点击与浏览器历史重试路径。证据：`test-results/FQA_20260712_0329_lintfix/COMMON-001-DOUBLE-CLICK/result.json`。

## B4/B8 续跑：WIKI-016 版本回退与 COMMON-007 分页重审

在完全 runId 隔离的 Wiki 空间/页面中，先保存两个不同正文版本，再调用产品 `POST /api/wiki/pages/{id}/revert/1`。版本列表含 1、2、3；请求返回 200，但回退响应和随后详情的正文均为空，并未恢复版本 1 的正文。页面和空间均用产品 DELETE 返回 200 清理，manifest active objects=0，`WIKI-016` 结算 FAIL，登记 `BUG-FQA-076`。GitNexus 已定位回退路径为 `WikiController.revert -> WikiPageService.revert -> savePage`，后者接收 `WikiPageVersion.content`。

对 `COMMON-006..011` 的严格合同复核确认 `COMMON-006/008/009/010/011` 保持 PASS；`COMMON-007` 由 PASS 更正为 FAIL：既有 CMDB 变更分页接口 `size=1` 返回大量行却声明 `total=0`，UI 仅显示 `1 / 1`，没有真实首末页或越界路径可验证。该表现复用已登记的 `BUG-FQA-023`，不新增重复缺陷。证据：`test-results/FQA_20260712_0329_lintfix/COMMON-006-009-READONLY/result.json`、`P-029-CMDB-CHANGES-UI-READONLY/result.json`、`WIKI-016-VERSION-REVERT/result.json`。

## B2 续跑：ACCOUNT-004 临时账号头像 URL 与默认 fallback

以 runId 临时账号完成首次 setup（包含 avatar URL）后，在独立 Chrome 中从登录首页进入个人资料。头像 URL 正确预填；清空并保存后 profile API 回读空字符串，再次填写 URL 后刷新回读一致。临时用户已通过产品 API 删除、manifest active objects=0，未改 superadmin。该主流程仍捕获 15 个未处理 403 Console 错误及中止的 RSC/头像请求，违反稳定页面零未解释 Console error 要求；`ACCOUNT-004` 因此结算 FAIL，复用低权限初始数据请求漂移 `BUG-FQA-010`，不新增重复缺陷。证据：`test-results/FQA_20260712_0329_lintfix/ACCOUNT-004-AVATAR-UI/result.json`、`profile-avatar.png`。

## B4 续跑：WIKI-026 双管理员 ACL accessVersion 冲突

两名独立 runId group-scope 管理员 session 同时读取同一 Wiki space 的 ACL version `0`。管理员 A 首写后 version 变为 `1`；管理员 B 以陈旧 version 提交得到精确 HTTP 409 “资源权限已被其他用户修改，请刷新后重试”；最终读取仍为 version `1`。为精确清理，只恢复本 runId space 的原 ACL mode，后续因原 owner 删除 space 返回 403，建立最小 runId recovery role/membership/assignment，恢复 owner 的 read/delete/manage_acl 后删除 space，再撤销全部临时关系、用户和角色。所有恢复对象清理成功，manifest active objects=0；`WIKI-026` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-026-TWO-ADMIN-ACL-CONFLICT/result.json`、`recovery.json`。

## B4 续跑：FILE-010/017 文件 ACL precedence 与 write consumer

以 runId 文件夹及文件构造文件层 default ACL。实际继承 named=`---`、group=`rw-`；owner 读取 200，显式 named deny 返回 403 且不回退到 group，匹配 group 读取 200，tenant assignment 的 others 读取 200，cross-group scope 在 others 之前被 403 拒绝；恢复 named `r--` 后读取恢复 200，`FILE-010` 结算 PASS。对同一文件 write 优先级，实际 `PUT/PATCH /api/files/{id}` 均为 500，系统没有文件本体更新 endpoint，upload 仅评估父文件夹 write，无法消费文件 ACL write bit；`FILE-017` 结算 FAIL，复用 `BUG-FQA-013` 的 `shared_file:update` consumer 缺失根因簇。两个 runId 文件记录、文件夹、role/user/membership/assignment 均产品 API 清理；两个精确 MinIO key 均 `mc rm` 后 `stat` 验证不存在，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/FILE-010-017-FILE-ACL-PRECEDENCE/result.json`。

## B4 续跑：WIKI-001 个人排序与系统手册只读分层

从首页进入 Wiki 后创建两个 runId 团队空间，将 A 上移后刷新；A 仍在 B 前，个人排序持久合同通过。当前运行数据却没有任何系统 manual space，页面的“官方手册”和“系统维护”标识数量均为 0，无法验证只读空间合同；按完整用例 `WIKI-001` 结算 FAIL，登记 `BUG-FQA-078`。两个 runId space 均产品 API 删除，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-001-ORDER-READONLY/result.json`。

## B3 续跑：CMDB-008/011/016/017 动态字段类型矩阵

在 runId 模型中建立 singlechar、longchar、int、float、date、enum、enummulti、bool、objuser、table 十类属性。十类均完成列表、合法创建、更新、刷新回读；每类非法值均返回 400，空 enum options 也返回 400。随后相同 `fieldKey` 的重复属性创建却返回 200，违反同模型字段标识唯一性，登记 `BUG-FQA-079`。此外本轮是动态 API 矩阵，不替代每个实时模型和每个字段的完整 UI 合同，`CMDB-008/011/016/017` 依严格规则均结算 FAIL。runId 实例、模型、属性组和模型组均通过产品 API 清理，属性随模型删除级联，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-008-011-016-017-DYNAMIC-FIELDTYPES/result.json`。

## B3 续跑：DEVICE-002/004 首页 UI 创建与编辑

独立 Chrome 从 superadmin 登录首页经“资源管理→设备密码库→新增设备”进入真实表单，选择既有只读 CI #32，创建 runId device #14。详情确认 CI linkage/name/type 派生显示；通过 UI 编辑 category/description，浏览器刷新后值保持且 CI linkage 不可编辑。通过 UI 删除后详情 GET 返回业务 400 “设备不存在”。所有 device API 写响应均 200，零 Console error；仅有导航造成的 `ERR_ABORTED`，无 API 5xx。`DEVICE-002`、`DEVICE-004` 结算 PASS；device 已 UI 删除，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-002-004-UI-LIFECYCLE/result.json`、`trace.zip` 和截图。

## B2 续跑：RBAC-009 自定义角色 UI 前置导航

独立 Playwright 已完成登录首页，但侧栏“角色”入口的强制 click 后路由未进入 `/rbac/roles`，等待超时发生在任何创建、编辑或删除操作前。无 runId role/user/membership/assignment 创建，cleanup 空，manifest active objects=0；现有证据不足以结算完整角色 CRUD，`RBAC-009` 保持 NOT_RUN。证据：`test-results/FQA_20260712_0329_lintfix/RBAC-009-CUSTOM-ROLE-CRUD/result.json`。

## B5 续跑：DAILY-005 多 CI 链路清理门禁

只读审计确认日报模块仅提供 GET/POST/PUT/submit，没有 delete/archive/purge 产品能力。创建带多 CI 的 runId 日报会同时留下日报、审计与可能的 workflow 历史，无法按本轮约束精确清理或恢复，因此未创建任何夹具；`DAILY-005` 结算 BLOCKED。解除条件是提供产品级 scoped delete/archive/purge，或明确授权保留不可逆历史数据。证据：`test-results/FQA_20260712_0329_lintfix/DAILY-LIFECYCLE-CLEANUP-GATE/result.json`。

## B3 续跑：DEVICE-010 长中文文本边界

从首页进入设备新建表单，选择既有 CI #32 后提交长中文 category/description。`POST /api/devices` 返回 500，页面仍停留 `/devices/new`，Console 记录同一 500；没有设备 ID 返回、没有 cleanup 对象。按完整用例，已发现的输入边界失败足以结算 `DEVICE-010` FAIL，登记 `BUG-FQA-080`；重复/无效 CI 合同尚未执行，`DEVICE-003` 仍保持 NOT_RUN。证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-003-010-NEGATIVE-BOUNDARY/result.json`。

## B5 续跑：FLOW-006/012 脚本中断后的精确恢复

runId BPMN 定义已通过首页“流程中心→流程设计”创建，版本 1 详情和 key 更新为两个部署版本均返回 200；后续 UI 版本弹窗定位器因两个 `v1` 单元格 strict-mode 中断，未开始 suspend/activate 或实例启动断言。finally 首次只删除了一个 deployment，随后立即对该 runId key 的唯一剩余 definition 通过产品 `DELETE /api/workflow/definitions/{id}` 精确删除；versions API 回读 count=0，manifest active objects=0。`FLOW-006`、`FLOW-012` 保持 NOT_RUN，不能以中间成功子步骤结算。证据：`test-results/FQA_20260712_0329_lintfix/FLOW-006-012-DEFINITION-LIFECYCLE/result.json`、`cleanup-retry.mjs`。

## B5 续跑：Workflow 两版本删除合同复核

修正 UI locator 后，runId key 的两个版本均已展开到版本表，但完整 suspend/activate 断言尚未形成可结算记录。清理复核发现声明为“删除所有版本”的 `DELETE /api/workflow/definitions/{v1}` 只删除 v1，v2 仍出现在同 key versions 查询；对唯一残余 v2 再次调用产品 DELETE 后 versions 才返回空数组。两次 runId key 均无残留、manifest active objects=0；`FLOW-006/012` 保持 NOT_RUN，删除合同登记 `BUG-FQA-081`。证据：`test-results/FQA_20260712_0329_lintfix/FLOW-006-012-DEFINITION-LIFECYCLE-RETRY/01-versions-expanded.png`、`trace.zip`。

## B5 续跑：FLOW-006 多版本 deployment 删除结算

复核已保留的 runId 定义证据：从首页“流程中心 → 流程设计”创建 v1，定义详情与 deployment 读取为 200；同 key 更新后 versions API/UI 显示两个版本。随后调用控制器文案声明为“删除流程定义（所有版本）”的 `DELETE /api/workflow/definitions/{v1}` 返回 200，却只删除 v1 deployment，v2 仍可由 versions API 读取；仅第二次对 v2 调用产品 DELETE 后 versions 才为空。该结果直接违反 key/version/deployment 的删除合同，`FLOW-006` 结算 FAIL，复用 `BUG-FQA-081`；所有 runId deployments 已经产品级清理。`FLOW-012` 的 suspend/activate/实例约束仍没有被本结果替代。证据：`test-results/FQA_20260712_0329_lintfix/FLOW-006-012-DEFINITION-LIFECYCLE/result.json`、`FLOW-006-012-DEFINITION-LIFECYCLE-RETRY/01-versions-expanded.png`、`trace.zip`。

## B5 续跑：FLOW-012 定义状态、发起与终止闭环

以 runId BPMN 定义 v1/v2 验证定义状态：版本列表为 2；挂起 v1 后 `suspended=true`，激活 v1 后 v1 为 active、v2 自动为 suspended，版本互斥正确。挂起 v1 的新发起却返回未处理 500，而非合同化拒绝；激活后的新发起返回 200 并可读取活动历史，但 `DELETE /api/workflow/instances/{id}` 终止同一实例又返回 500。两个定义均通过产品 DELETE 删除，versions 回读空；PostgreSQL 复核 runId instance 的 Flowable runtime execution、historic process、runtime task、historic task 均为 0，说明 deployment 级联清理已完成但不抵消终止 API 缺陷。`FLOW-012` 结算 FAIL，登记 `BUG-FQA-099`；证据：`test-results/FQA_20260712_0329_lintfix/FLOW-012-SUSPEND-ACTIVATE-INSTANCE/result.json`、`db-cleanup.json`。

## B4 续跑：FILE-014 同名并发合同审计

复核两账号并发浏览器脚本的中断记录：它在账号首次设置 locator 阶段停止，未发送 upload，不将该中断结果作为功能结论。随后对当前上传实现做最小只读审计：`SharedFileController.upload` 在授权后直接调用 `SharedFileService.uploadFileUnchecked`；该方法以 `shared/<UUID>/<originalName>` 写入对象存储，然后直接插入 `shared_file`，没有按 folderId/originalName 查询、冲突响应或数据库唯一约束。不同 UUID 使并发同名上传天然可并存，无法满足“确定性冲突提示或单一持久化记录”合同。`FILE-014` 结算 FAIL，登记 `BUG-FQA-100`；本次没有创建账号、文件夹、文件或 MinIO 对象，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/FILE-014-SAME-NAME-CONTRACT-AUDIT/result.json`；源码线索：`SharedFileController.java`、`SharedFileService.java:153`。

## B1/B4 续跑：HOME-005 通知入口与 FILE-004/006/007 多格式内容闭环

独立 Chrome 从首页点击 header 的通知铃铛直达通知中心；未读数在进入前后均为 0，列表 31 条，未发生 application write、Console error 或失败请求，`HOME-005` 结算 PASS。共享文件则以 runId folder 上传 PDF、PNG、XLSX、DOCX，四种均 upload/list 200、preview inline 200、download attachment 200；建议文件名、MIME、非空字节和内容逐一一致。每个文件先产品 DELETE 200，再按读取到的 runId MinIO key 精确 `rm` 且 `stat` 证实不存在，文件夹也 DELETE 200；`FILE-004/006/007` 均结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/HOME-005-NOTIFICATION-BELL/result.json`、`FILE-004-006-007-MULTIFORMAT/result.json`。

## B2/B3 续跑：AUTHZ-004..009 全租户写门禁与 DEVICE-005/007 夹具恢复

迁移 backfill API 的只读审计表明 account/resource backfill 都扫描并写入全租户 legacy relationship、rollout 或资源 ACL；pending repair、exception/acceptedLegacy、orphan cleanup 与 blocker gate 均需不可精确恢复的审计或现有授权状态。因此未创建迁移夹具；11 个畸形/不存在请求均返回 400，前后 snapshot 完全相同（ENFORCED/enforced、epoch=1、pending=[]、open exception=0），`AUTHZ-004..009` 保持 NOT_RUN。设备凭据 UI 测试浏览器在有效断言前停滞，但创建的 runId credential #9 与 device #15 已立刻按产品 API DELETE 200 逆序清理，未保存秘密，`DEVICE-005/007` 保持 NOT_RUN。manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/AUTHZ-MIGRATION-SAFE-NEGATIVE/result.json`。

## B5 续跑：OPS-014 Cron 与提前日边界

runId 午夜 Cron 预览跨日正确；但 invalid Cron `not-a-spring-cron` 预览返回 200 空数组且可保存，`generateDaysAhead=-1` 同样可保存。23:59 Cron 的预览 dueAt 为同日 18:00，早于 plannedStartAt。三个规则均产品 DELETE 200，逐个 GET 返回 400 且列表没有 runId 残留；`OPS-014` 结算 FAIL，登记 `BUG-FQA-082`。证据：`test-results/FQA_20260712_0329_lintfix/OPS-014-CRON-ADVANCE-BOUNDARY/result.json`。

## B6 续跑：CHANGE-014/015 模板生命周期与字段配置差额

从首页进入模板管理，当前 4 个模板仅提供新建、上传、配置字段和启用/禁用；无 copy/delete UI。模板 detail 的 Allow 为 PUT/GET/HEAD/OPTIONS，copy route 没有受支持 POST；字段编辑有 required，但没有 sort/default 控件，Grip 图标也无 draggable element。因为没有产品 template delete，不能创建 runId 模板作写入夹具；缺失的是当前 catalog 必需能力而非 N/A，`CHANGE-014/015` 均结算 FAIL，登记 `BUG-FQA-083`。无模板或文档创建，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-014-015-LIFECYCLE-GAP/result.json`。

## B6 续跑：CHANGE-018 引用模板删除语义

复用独立 Playwright 从 `/login` 至首页再点击“变更文档 → 模板管理”的无副作用 UI 证据，并以 GitNexus 查询/上下文和 `ChangeDocTemplateController` 全量端点审计复核。模板控制器只有 list/get/create/update/upload/parse-bookmarks/saveFields/setActive，唯一 DELETE 仅删除字段；UI 同样没有模板删除或确认入口。因此没有模板实体 DELETE、引用中的删除拒绝/级联/快照语义，也没有可执行的 runId 模板精确清理路径。按测试约束未创建不可产品级清理的模板；这不是 N/A，而是缺失必需生命周期，`CHANGE-018` 结算 FAIL，登记 `BUG-FQA-098`。无新夹具，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-018-TEMPLATE-DELETE-SEMANTICS/result.json`、`CHANGE-TEMPLATE-LIFECYCLE-CONTRACT/result.json`。

## B5 续跑：OPS-006/007 任务状态夹具清理门禁

运维任务 API 只有 GET/POST/PUT 与 confirm/start/complete/close-exception/cancel/remind，没有 delete/archive/purge；cancel 仅是状态转换。任务状态操作会留下任务、动态日志、审计及可能的关联记录；删除 runId rule 也不删除已生成任务。因此未创建状态/visibility fixture，`OPS-006/007` 结算 BLOCKED。解除条件是提供产品级 task delete/archive/purge 并清理依赖记录，或明确授权保留不可逆任务历史。证据：`test-results/FQA_20260712_0329_lintfix/OPS-TASK-LIFECYCLE-CLEANUP-GATE/result.json`。

## B5 续跑：FLOW-009 BPMN XML 边界

有效 runId BPMN XML 创建和详情均 200，重复 key 返回 400；malformed XML、无 process BPMN、含空格 key 则均返回 500，而不是输入合同要求的 400。runId definition 产品 DELETE 200，key 的 versions 回读 count=0，manifest active objects=0；`FLOW-009` 结算 FAIL，登记 `BUG-FQA-084`。证据：`test-results/FQA_20260712_0329_lintfix/FLOW-009-XML-BOUNDARY/result.json`。

## B3 续跑：CMDB-037 机柜 U 位冲突夹具恢复

两次 runId rack fixture 都在创建后浏览器 UI 阶段挂起，未形成 U 位 overlap 的端到端请求/响应、页面或状态证据。每次均立即使用产品 DELETE 删除 rack，详情回读 400；manifest active objects=0。静态 GitNexus 查询不能替代运行时用例，`CMDB-037` 保持 NOT_RUN。证据仅保留测试脚本：`test-results/FQA_20260712_0329_lintfix/CMDB-037-RACK-U-COLLISION/run.mjs`。

## B3 续跑：CMDB-037 U 位冲突 API 与首页 UI 可达性

第三次独立 Chrome 运行从 `/login` 登录并经首页真实点击进入 CMDB。创建 runId rack #96（12U）及必填 `sn`/`inner_ip` 的 host #97/#98，再以 `rack_contains_host` 创建关联 #28/#29，`GET /api/cmdb/rack/96/layout` 返回两个设备和唯一 overlap warning：host #98 与已有设备在 U4 重叠，API 合同成立。随后检查同一主页路径：CMDB 概览模型目录仅有 `host`、`san_switch`、`net_switch`、`storage`，未出现 rack；侧栏“拓扑”进入 2D 视图的模型选择器同样不含 rack，因而无法真实 UI 进入 rack 详情的“机柜视图”并展示 warning。此为可复现 UI/API 能力漂移，`CMDB-037` 结算 FAIL（`BUG-FQA-095`），不以 API 成功替代 UI 功能通过。最后按 relation #29/#28 → host #98/#97 → rack #96 调用产品 DELETE，详情回读均为 400、runId 检索为空，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-037-RACK-U-COLLISION/result.json`、`overview-debug.png`。

## B4 续跑：WIKI-010 主题子场景复核

首页 UI 进入 Wiki 后，`html.class` 为空、`data-theme=null`、`localStorage.theme=null`；首页、用户菜单和侧栏都没有主题切换控件。Wiki 默认浅色可读且零 Console/failed request/write；Mermaid 正常、错误和多图子场景已有独立通过证据，但无法执行 light→dark→reload→Wiki 的主题合同。因此 `WIKI-010` 结算 FAIL，复用 `BUG-FQA-027`，不新增重复缺陷。证据：`test-results/FQA_20260712_0329_lintfix/HOME-008-THEME-READONLY/result.json`、`WIKI-010-MERMAID-LIFECYCLE/result.json`、`WIKI-010-MULTI-MERMAID/result.json`。

## B3 续跑：CMDB-029/030 拓扑与比较读取门禁

现有数据只提供 root-only topology，缺少可审计的多节点筛选夹具和历史变更，无法覆盖 compare 的 added/removed/modified/unchanged 四类差异；纯读取重试在发现阶段收到空/非 JSON 响应并在任何断言或写入前停止。动态路由与等时 compare 读取的已有证据不能扩大为完整主用例，`CMDB-029/030` 保持 NOT_RUN，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-029-030-READONLY-RERUN/result.json`、`fatal.png`、`trace.zip`。

## B2 续跑：RBAC-002 用户 identifier/email API 边界

管理员 API 验证空/空白/重复 username 和非法 phone 都返回 400；非法 email `not-an-email` 却返回 200 并创建用户，超长 username 返回 500。有效 runId 用户与意外接受的非法-email 用户均登记后用产品 DELETE 200 清理、GET 回读 400；`RBAC-002` 结算 FAIL，登记 `BUG-FQA-085`，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/RBAC-002-API-BOUNDARY/result.json`。

## B3 续跑：CMDB-024 JSON/NDJSON upsert 合同

runId 模型中先以 JSON preview/execute 创建 alpha；再以 NDJSON 同批 preview/execute 完成 beta create 与 alpha update。详情回读确认 alpha 顶层 name/status 与 fields merge（`extra=keep`）正确，beta 新建正确；`replace_fields` 与 `baseline_replace` 两次 preview/execute 均精确 update 1/0 且回读符合合同。两个 instance、model、属性/组和 model group 均产品 API 删除或随模型级联，manifest active objects=0，`CMDB-024` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-024-UPSERT-CONTRACT/result.json`。

## B3 续跑：CMDB-028 关联自环与错误组合

runId 同模型定义下 self relation 返回 200 并创建 relation #24，图谱/列表确认自环存在；有效控制 relation 成功，重复、未知 definition、错误 target model 都返回 400。所有 relation、3 instances、association definition、2 models 与 group 均产品 API DELETE 200，manifest active objects=0；`CMDB-028` 结算 FAIL，登记 `BUG-FQA-086`。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-028-SELF-ERROR-COMBINATIONS/result.json`。

## B6 续跑：CHANGE-019 双击状态提交前置 UI 阻断

从首页进入变更文档新建页，两个独立 Playwright 尝试均能打开模板卡片但未能渲染第二步的“变更标题”字段，超时发生在任何 POST/create 前。无文件、文档、模板、关系或会话夹具产生，manifest active objects=0；现有证据不足以断言双击提交合同，`CHANGE-019` 保持 NOT_RUN。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-019-DOUBLE-SUBMIT-REJECT/result.json`。

## B3 续跑：CMDB-019 动态字段编辑与刷新

runId 模型、属性组、六种可编辑动态属性和实例均创建成功。登录后首页点击 CMDB、动态详情补充路由均通过；直接更新 API 成功持久化 name/status/owner/description 和 singlechar、longchar、int、enum、bool、date 字段，GET 与页面刷新均显示预期值。但详情页“编辑”按钮数量为 0：前端用 `cmdb_instance:manage` 门控，后端 PUT 使用 `cmdb_instance:update`，构成 UI/API guard drift。全部夹具已经产品 API 逆序删除或级联清理，`activeFixtureObjects=0`、manifest active objects=0；`CMDB-019` 结算 FAIL，登记 `BUG-FQA-087`。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-019-DYNAMIC-FIELD-EDIT-REFRESH/result.json`、截图、`trace.zip`。

## B3 续跑：DEVICE-003 CI 关联输入与重复约束

首页进入设备新建页时，未选择 CI 的提交按钮禁用且 CI 搜索可见。直接 API 无 CI 返回 400 `必须关联 CMDB 实例`，无效 CI 返回 400 `CMDB 实例不存在`；相同有效 CI 的第二次创建却返回 200，产生重复设备。两条 runId device 均立即产品 DELETE 200，并分别 GET 回读 400 `设备不存在`；manifest active objects=0。`DEVICE-003` 结算 FAIL，登记 `BUG-FQA-088`。证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-003-DUPLICATE-INVALID/result.json`、`01-no-ci-ui-rejection.png`、`trace.zip`。

## B4 续跑：WIKI-023 owner、others 与多匹配组 ACL 按位并集

在既有 named-user 覆盖单组 ACL 证据之上，创建三个 runId 账号，均具有 `wiki:read, wiki:update` 的 `group:2` assignment。将 Wiki space/page owner 设为 owner 账号，space 设置 `0701` 与 `group:3=r-x`、`group:4=--x`；page 设置 `0606` 与 `group:3=r--`、`group:4=-w-`。owner tree/update 均 200；同时是 group:3 与 group:4 成员的 union 账号 tree/read/update 均 200，验证两个命名组按位并集为 page 有效 `rw-`。同属 group:2、非 owner 的 other 账号未命中 named/group ACL，本应由 others space `--x` + page `rw-` 放行，却 tree/read/update 均返回 403；完整 catalog 因 others 合同失败而将 `WIKI-023` 结算 FAIL，登记 `BUG-FQA-089`。首次回收因 ACL 将属主换为临时 owner 使管理员 delete 被 403 拒绝；随后仅为 runId owner 建最小 read/delete/manage_acl 恢复角色、membership/assignment，owner 将 runId space 属主转回 superadmin，管理员经产品 DELETE 删除 page/space，再撤销恢复关系、owner、角色。数据库核验 space #57 与 owner #165 均软删除，manifest 本次 WIKI-023 夹具零残留（全局 manifest 尚有其它并行 CMDB 用例的 4 项 active）。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-023-OWNER-OTHERS-MULTIGROUP/result.json`、`recovery.json`。

## B3 续跑：CMDB-009/010 属性完整 payload、编辑与 fieldKey 边界

以 superadmin 创建 runId 模型、属性组和 enum 属性；完整 create payload 的 fieldKey、name、group、required、editable、unique、list、drawer、option、defaultValue 和 sortOrder 全部 200 回读。独立 Chrome 从登录首页点击 CMDB 后补充模型路由，属性编辑 UI 可见且可打开，零 Console error/失败请求。随后 PUT 更新 name、required、editable、list、drawer、option、sortOrder 和 `defaultValue=gamma`；除 defaultValue 外均经 GET 正确回读，但 GET 不再返回 defaultValue，`CMDB-009` 结算 FAIL（`BUG-FQA-090`）。CMDB-010 的空、空白、中文、空格、特殊、大写、数字前缀、保留 key 和重复 key 均 400 且属性列表无副作用；约130字符的合法形状 fieldKey 返回 500，`CMDB-010` 结算 FAIL（`BUG-FQA-091`）。每次成功对象立即登记，最后模型 DELETE 200 并级联属性/分组、model group DELETE 200；manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-009-010-ATTRIBUTE-PAYLOAD-BOUNDARY/result.json`、`attribute-edit-dialog.png`、`trace.zip`。

## B6 续跑：CHANGE-019 双击状态提交复测

首页路径可进入新建变更页，模板选择和文档创建均触发成功，但前端将创建响应对象直接拼接为路由参数，导航至 `/change-docs/[object Object]`；因此未能到达草稿详情或执行双击保存/提交/驳回断言。创建的 runId 文档 #8 已登记并通过产品 DELETE 200 清理，GET 回读 400，manifest active objects=0。该表现复用 `BUG-FQA-059`，`CHANGE-019` 仍保持 NOT_RUN（双击状态合同未获运行证据）。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-019-DOUBLE-SUBMIT-REJECT/result.json`、`fatal.png`、`trace.zip`。

## B3 续跑：DEVICE-005 凭据编辑合同；DEVICE-007 复制/取消断点

独立 Chrome 以 superadmin 从 `/login` 经首页、资源管理、设备密码库进入 runId 设备详情。凭据创建 200、详情响应不含明文，页面也保持掩码；但凭据行没有编辑控件，直接 `PUT/PATCH /api/devices/credentials/{credentialId}` 都返回 500 且请求字段未持久化，说明当前版本没有可用的凭据编辑合同，`DEVICE-005` 结算 FAIL（`BUG-FQA-092`）。复制按钮可点击，点击前后均有截图且页面未渲染明文；隔离浏览器在 clipboard 读回操作中挂起，为防止夹具滞留主动终止，尚未取得添加账号取消/重开断言，所以 `DEVICE-007` 维持 NOT_RUN。先前 #10/#18 与本次 #11/#19 凭据/设备均凭据先于设备经产品 DELETE 200 逆序清理；manifest active objects=0，未落盘密码或修改 superadmin。证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-005-007-CREDENTIAL-BOUNDARY-COPY-CANCEL/result.json`、同目录截图。

## B3 续跑：CMDB-015 全实时模型列表、分页与排序

独立 Chrome 从登录首页点击 CMDB、模型管理后，以动态路由补充遍历运行时全部 18 个模型实例列表。18/18 均返回 API 200，标题、列或空态均成功渲染，零业务写、Console error 与失败请求。仅 host、resource_pool、rack 显示分页文案，所有模型均没有可排序列，且前端请求没有将分页/排序状态纳入查询；未满足“每模型分页、排序”合同，`CMDB-015` 结算 FAIL，归并 `BUG-FQA-023`。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-015-ALL-MODEL-LIST-PAGINATION/result-run3.json`、同目录 18 张截图。

## B5 续跑：FLOW-010 流程绑定回收门禁

只读审计 `WorkflowCenterController`、`ProcessBindingService` 和绑定页面确认产品仅公开 bindings 的 GET/POST：POST 按 tenant/businessType 覆盖当前绑定且记录审计；没有 DELETE、disable 或 unbind，页面也只有“新增绑定”。新建 runId binding 将修改现有租户业务流程选择，无法用产品合同精确恢复，因此未发出任何绑定写请求或创建夹具。`FLOW-010` 结算 BLOCKED；解除条件为提供审计化 unbind/delete/disable（或可精确恢复的版本化 binding lifecycle）并允许验证业务发起版本。证据：`backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowCenterController.java:65`、`backend/src/main/java/com/cwgsyw/platform/module/workflow/binding/ProcessBindingService.java:10`、`frontend/src/app/(dashboard)/workflow/bindings/page.tsx:89`。

## B2 续跑：RBAC-009 自定义功能角色 UI CRUD

从登录首页进入角色管理，UI 创建带 `cmdb_instance:read` 的 runId 角色并回读权限；UI 编辑和删除后列表确认角色消失。删除后直接读取 `/api/rbac/roles/150/permissions` 仍为 200，未收口已删除角色的关联读取，`RBAC-009` 结算 FAIL，登记 `BUG-FQA-093`。本用例 role #149（前次导航超时后的紧急清理）和 #150 均已产品删除/列表确认不存在、manifest active objects=0，无 Console error、failed request 或 superadmin 修改。证据：`test-results/FQA_20260712_0329_lintfix/RBAC-009-CUSTOM-ROLE-CRUD/result-3.json`、截图、`trace-3.zip`。

## B3 续跑：CMDB-020 克隆、删除取消/确认与历史

独立 Chrome 从 `/login` 登录，以首页点击 CMDB 后补充 runId 动态模型列表。UI drawer 的克隆创建副本，名称为源名称加 `-副本`，status、owner、description 和 `fieldsData.marker` 均正确。原生确认框取消后副本 GET 仍为 200；确认删除后副本从列表消失、GET 返回 400，`GET /api/cmdb/instances/{id}/history?action=delete` 返回 delete history。副本经 UI 删除，源实例、模型和模型组均产品 API 逆序清理，manifest active objects=0；`CMDB-020` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-020-CLONE-DELETE-HISTORY/result.json`、截图、`trace.zip`。

## B5 续跑：DAILY-008 export permission 消费审计

实时 permission registry 仍有 `daily_report:export`，但 `DailyReportController` 仅有读取、创建、更新、提交和审批 Mapping；日报列表/详情页面无导出控件、下载请求或间接 consumer。为避免无 delete 生命周期的日报污染，本项只做源码与 GitNexus 消费审计，未创建任何日报或文件。按可分配 action 缺失 consumer 的规则，`DAILY-008` 结算 FAIL，登记 `BUG-FQA-094`，不能标记 N/A。证据：`backend/src/main/java/com/cwgsyw/platform/module/daily/DailyReportController.java`、`frontend/src/app/(dashboard)/daily/page.tsx`、GitNexus query。

## B3 续跑：CMDB-021 批量选择、取消与清空

独立 Chrome 从登录首页进入 CMDB，选择有 6 条实例的 host 模型列表。全选后批量编辑按钮显示 6；打开批量编辑时未填写字段，应用按钮禁用；取消后选择仍保留 6 条；取消 master 选择后批量按钮隐藏，选择数归零。网络记录没有任何 `/api/cmdb/` 非 GET 写请求，零 Console error/failed request，未创建夹具；`CMDB-021` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-021-UI-SELECTION-CLEAR/result.json`、`all-selected-batch-action.png`、`selection-cleared.png`、`trace.zip`。

## B3 续跑：CMDB-018 实例详情全 Tab 只读合同

独立 Chrome 登录首页，经 CMDB 进入既有 host 实例详情。基本信息、关联关系、拓扑图、变更历史、告警和关联资源六个 Tab 都可切换并渲染预期内容；关联/拓扑/历史/告警/资源分别发出读取 API 并全部 200，零 Console error、failed request、API 5xx、业务写入或测试夹具。`CMDB-018` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-018-DETAIL-TABS-READONLY/result.json`、截图与 `trace.zip`。

## B4 续跑：FILE-014 同名并发上传启动恢复

两轮隔离 Chrome 均从 `/login` 尝试经首页进入共享文档；登录跳转中页面/context 被浏览器关闭，未到达上传控件、未发出 `/api/files/upload`，故没有同名竞争响应、冲突提示或持久化记录，不能将该用例结算为 PASS/FAIL。每轮已创建的 runId 空文件夹 #57/#58/#59/#60 均立即通过产品 `DELETE /api/files/folders/{id}` 返回 200；PostgreSQL 复核不存在这些 folderId 的 `shared_file` 记录，也不存在本次 runId same-name 原始文件名，manifest active objects=0。`FILE-014` 保持 NOT_RUN；解除条件为稳定完成双独立 UI 登录与并发上传，且取得确定性冲突/唯一持久化证据。证据：`test-results/FQA_20260712_0329_lintfix/FILE-014-CONCURRENT-SAME-NAME/result.json`、同目录 `run.mjs`。

## B5 续跑：OPS-011 通知模板 CRUD

独立 Chrome 以 superadmin 从 `/login` 登录后，经首页真实点击侧栏“运维日历”、页面“管理”菜单和“模板管理”进入模板页。UI 创建 runId 通知模板 #2/#3，API 列表回读其 `notification` 类型和 `enabled=true`；随后 UI 编辑名称并关闭启用开关，列表回读 `enabled=false`；最后由 UI 删除并确认列表不存在。两次夹具均在创建后立即登记并标为 cleaned，manifest active objects=0；无 Console error、failed request 或 superadmin 资料/授权变更。`OPS-011` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/OPS-011-TEMPLATE-CRUD/01-created.png`、`02-updated-disabled.png`、`03-deleted.png`、`trace.zip`。

## B3 续跑：DEVICE-007 启动中断与紧急清理

复测 runner 在 UI 到达“添加账号”前被并发遗留浏览器会话关闭，未形成取消/重开断言，故 `DEVICE-007` 保持 NOT_RUN。该次已创建的 runId device #20 与 credential #12 按凭据→设备顺序用产品 DELETE 均返回 200，manifest 已同步为 cleaned、active objects=0；不以启动失败替代测试结果。证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-005-007-CREDENTIAL-BOUNDARY-COPY-CANCEL/result.json`。

## B3/B4/B6 续跑：受外部关闭的隔离浏览器回收

`DEVICE-007` 的后续独立 runner 同样在到达“添加”控件前被外部关闭，未产生取消/重开断言；本轮 device #21 与 credential #13 已按凭据→设备通过产品 DELETE 200 回收。`FILE-014` 重建双最小权限账号和同名上传夹具时也在上传请求前被关闭，未发出 upload；assignment、membership、user、folder #61、role #159 均产品 API 回收。`CHANGE-019` 再次复现创建响应对象被拼接为 `/change-docs/[object Object]`，无法测试双击幂等；草稿 #10/#11/#12/#13 全部 DELETE 或已不存在且 GET=400。三项均不以工具中断替代功能结果，维持 NOT_RUN；manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-005-007-CREDENTIAL-BOUNDARY-COPY-CANCEL/result.json`、`FILE-014-CONCURRENT-SAME-NAME/result.json`、`CHANGE-019-DOUBLE-SUBMIT-REJECT/result.json`。

## B7 续跑：AUDIT-002 多模块写入审计完整性

使用已有 runId 夹具的只读审计记录，不创建任何对象。`/api/audit-logs` 可按 module/operator 返回 CMDB、变更文档、Wiki、共享文件、IPAM、运维和用户的 target/action/operator 摘要；PostgreSQL `audit_log` 复核证明 CMDB、Wiki、变更文档 create/update/delete 有对应 before/after snapshot，但共享文件、IPAM、运维规则等记录前后快照均为空。更严重的是 AuditLogVO/API/UI 本身不返回数据库的 beforeJson/afterJson，管理员无法从产品审计查询任何写入 diff。`AUDIT-002` 结算 FAIL，登记 `BUG-FQA-096`；无写请求、夹具或数据污染。证据：`test-results/FQA_20260712_0329_lintfix/AUDIT-002-WRITE-COVERAGE/result.json`。

## B2 续跑：授权迁移工作台只读 UI/API 一致性审计

独立 Google Chrome/Playwright 以 `superadmin` 从 `/login` 登录至首页，真实展开“身份与权限”并点击“迁移异常”进入授权迁移工作台；未直接导航替代主路径。页面卡片与 API 同轮一致：configured/effective mode=`enforced`、cutover=`enforced`、epoch=1；严格预检 `eligible=true`、issues/permissionDiffs 均为空，待处理账户为 0，open exceptions 为 0；resolved/all exception 总数均为 513。页面同时显示“严格 Enforced”“通过”“没有待处理账户”，异常筛选默认 `open`，并可见紧急回退入口但未点击。网络审计确认迁移/cutover 路径仅有五个 GET（exceptions、pending-users、cutover、preflight 及 API 复核读取），没有 migration/cutover POST、PUT 或 DELETE；仅认证登录和既有 session touch 为会话协议请求。本次为 `AUTHZ-001/003` 已有结论补强，不改变 `AUTHZ-004..009` 的不可精确恢复写路径 NOT_RUN 或 `AUTHZ-010` 的授权 BLOCKED；零夹具、manifest active objects=0、未修改 superadmin。证据：`test-results/FQA_20260712_0329_lintfix/AUTHZ-MIGRATION-READONLY-UI-AUDIT/result.json`、`migration-workbench.png`。

## B5 续跑：OPS-020 模板、规则与节假日删除取消/确认

独立 Chrome 以 superadmin 从 `/login` 经首页点击进入运维日历，再经“管理”菜单分别进入模板管理、节假日历和周期规则。两个 runId 模板和两个 runId 节假日均先在浏览器 `confirm` 中取消，API 列表回读仍存在；再确认删除，页面 toast 成功且列表回读均不存在，完成 UI 取消/确认与软删除闭环。周期规则列表中 runId 规则可见，但行操作仅为“编辑、启用/停用”，没有“删除”控件；同一版本后端 `DELETE /api/ops-calendar/rules/{id}` 可用，因此不能用 API 代替缺失的 UI 取消/确认主路径。`OPS-020` 结算 FAIL，登记 `BUG-FQA-097`。两次中断 runner 遗留的 rule #11/#12 均经产品 DELETE 200 清理并列表回读不存在；模板/节假日均已由 UI 确认删除，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/OPS-020-DELETE-CANCEL-CONFIRM/result.json`、截图与 `trace.zip`。

## B5 续跑：OPS-003/009/010/017 任务合同与清理门禁复核

只读复核既有认证 API 拒绝证据：合法时间范围配合前端/调用方枚举 `priority=medium` 返回未处理 500；改为 `normal` 后 `taskType=maintenance` 又违反数据库约束，`OPS-003` 因完整创建合同失败结算 FAIL，复用 `BUG-FQA-014`。`OPS-009` 的低权/非负责人反向矩阵、`OPS-010` 的保存和状态按钮双击/日志唯一性、`OPS-017` 的 group-scope lead_manage 统计/导出 ID 集都要求可操作且跨组的任务夹具；任务当前没有产品 delete/archive/purge 入口，创建后不能按 runId 精确回收。三项均结算 BLOCKED，而非以空数据或 superadmin 读取冒充覆盖。无新写入和夹具；证据：`test-results/FQA_20260712_0329_lintfix/OPS-TASK-REJECTION/result.json`、`OPS-TASK-LIFECYCLE-CLEANUP-GATE/result.json`、`OPS-017-019-RECONCILE-NOAUTH/result.json`。

## B4/B8 续跑：WIKI-025 授权模式编辑器边界

复核已有独立 Chrome/Playwright 从 `/login` 登录、经首页点击知识库后的 Enforced 运行态证据：`GET /api/access/mode/wiki` 返回 `enforced=true`、`useUnifiedEditor=true`；runId 空间可经卡片授权入口打开“资源权限”统一编辑器，并读取基础 mode、主体权限、指定用户/组和默认 ACL；未保存 ACL，空间随后由产品 DELETE 200 精确清理，零 Console error/应用写请求。该证据只覆盖当前 Enforced 分支。目录同时要求 Shadow 与 Legacy 下旧编辑器/一致性合同，而验证它们需要执行全租户 Rollback/Enforce 状态转换；当前没有独占测试窗口或明确授权，禁止绕过批准切换或直接写库。因此 `WIKI-025` 结算 BLOCKED，解除条件为批准独占窗口内完成 `Enforced -> Rollback(Legacy) -> preflight -> Enforce` 且恢复 epoch/审计核对；manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-025-UNIFIED-EDITOR-UI/result.json`。

## B1 续跑：AUTH-007 真实 idle 超时门禁

只读审计会话合同：前端 idle timer 固定为 60 分钟，后端 `AuthSessionService.validate` 以完整分钟执行 `idleMinutes > idleTimeoutMinutes`，因此真实触发至少需要超过 60 分钟的无交互会话。当前没有产品暴露的安全短时 expiry 控件；直接改 Redis/session 记录会绕过产品会话、审计和前端跳转合同，计划内 backend 配置重启又属于独立受限 `AUTH-010`。未将源码、普通会话 200 或静态 UI 代替实际 `SESSION_TIMEOUT`，`AUTH-007` 结算 BLOCKED。解除条件为提供可丢弃测试账号并批准超过 60 分钟真实 idle 窗口，或批准可逆的 backend-only timeout 配置测试；无会话、Redis 或账号状态被修改。证据：`test-results/FQA_20260712_0329_lintfix/AUTH-007-IDLE-TIMEOUT-GATE/result.json`。

## B4 续跑：WIKI-019 文档管理员 Enforced 允许与拒绝边界

使用既有测试账号 `test_docadmin`，前快照为主组管理组、无旧角色、无有效 assignment。仅通过产品管理员接口重置临时密码并将内置 `doc_admin` 作为兼容旧角色授予；系统生成 `doc_admin@group:1` compatibility assignment #202。首次登录的 `CHANGE_PASSWORD/COMPLETE_PROFILE` 均经 `/api/account/setup` 完成；首次使用重置密码被 `PASSWORD_REUSED` 拒绝后使用独立临时密码成功完成，密码不落盘。Enforced session 的有效权限为 `wiki:read/update/publish/delete`，不含 `wiki:create/manage_acl`。在 superadmin 创建的 runId 空间/根页上：文档管理员读、更新、发布、删除均 200；创建空间 403，统一 ACL GET 403；以管理员读取的真实 owner/version/mode 构造合法 ACL PUT 也返回 403，管理员前后 `version=0/mode=2770` 不变。所有 runId 页面/空间均通过产品 DELETE 清理，最后以产品用户更新接口恢复空旧角色并确认 assignment 列表为空。`WIKI-019` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/WIKI-019-DOCADMIN-BOUNDARY/result.json`、`WIKI-019-DOCADMIN-VALID-ACL-DENY/result.json`，以及既有首页路径截图/完整生命周期证据。

## B3 续跑：CMDB-029/030 拓扑与时间点比较夹具

以 superadmin 创建并即时登记 runId 模型组、模型、同模型 n:n 关联定义及 root/peer/added 三个实例；所有对象在退出前按实例、定义、模型、模型组顺序由产品 DELETE 返回 200，manifest active objects=0。当前拓扑 API 在 depth=1/2 都正确返回 root 与 peer。但是从创建前时间点到当前时间点 compare 将 root 与 peer 一并放入 `added`，没有 `modified` 或 `unchanged`，删除 added 后也没有将其还原为 `removed`。这使四类差异与 change history 不一致，`CMDB-030` 结算 FAIL（`BUG-FQA-101`）。独立 Chrome 已从 `/login` 经首页进入拓扑页，截图证明图有两个节点、过滤区及状态；筛选点击因重复文本 strict locator 中断，不能将 UI 深度/筛选/节点跳转合同误记为通过，`CMDB-029` 同样结算 FAIL 并归入该缺陷。证据：`test-results/FQA_20260712_0329_lintfix/CMDB-029-030-TOPOLOGY-LIFECYCLE/result.json`、`fatal.png`、`trace.zip`。

## B3 续跑：DEVICE-007 中断夹具恢复

`DEVICE-007` 的 Chrome runner 在等待“添加账号”控件时 browser/context 被关闭，未形成复制、取消或重开断言。已即时登记的 runId device #22 和 credential #14 首次 finally DELETE 仅返回 400；停止新写入后，以 superadmin 通过同一产品 DELETE 接口重试，凭据→设备依序均返回 200。manifest 均已标记 cleaned，active objects=0；未使用 SQL、hash 或任何非产品清理路径。`DEVICE-007` 仍保持 NOT_RUN，证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-005-007-CREDENTIAL-BOUNDARY-COPY-CANCEL/result.json` 及本次执行日志。

## B6 续跑：CHANGE-006 固定表格字段生命周期

以运行时模板 `#4` 的 `fixedDocxTable` 作为可回收夹具，创建 runId 草稿 `#21` 后先回读两行；更新为删除首行、保留并更新第二行、再新增第三行，GET 顺序和 checkbox 布尔值均一致。草稿空行数组保存和回读成功（当前合同将 required/minRows 校验留给提交阶段）；8,192 字符文本无截断。提交 6 行（maxRows=5）返回 400“新字段最多允许 5 行”，随后 GET 仍为此前长文本行，确认拒绝无写入。未测试导出一致性：模板没有 DOCX，程序化 fallback 不渲染表格行，不能将其当作该合同证据。草稿通过产品 DELETE 清理，GET 返回 400，manifest active objects=0；`CHANGE-006` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-006-FIXED-TABLE-LIFECYCLE/result.json`。

## B8 续跑：XL-EXPORT-005 运维材料导出内容核验

以 superadmin 只读下载既有季度范围材料 XLSX。HTTP 200、XLSX MIME 和非空字节成立，但响应没有 `Content-Disposition`；解压 `sheet1.xml` 也未发现“统计周期”“统计概览”“状态汇总”“任务明细”标题，因此不能证明范围、数量与状态汇总合同。无业务写入或测试对象，`XL-EXPORT-005` 结算 FAIL。证据：`test-results/FQA_20260712_0329_lintfix/XL-EXPORT-005-MATERIAL-CONTENT/result.json`。

## B5 续跑：FLOW-008 moddle 属性部署

以 runId XML 直接验证 UserTask assignee、candidateGroups 与两条条件流的保存合同。`POST /api/workflow/definitions` 返回 500，Flowable 日志明确为 `bpmn:tFormalExpression` 类型无法解析；事务未创建 definition，manifest active objects=0。`FLOW-008` 结算 FAIL，登记 `BUG-FQA-105`；证据：`test-results/FQA_20260712_0329_lintfix/FLOW-008-MODDLE-PERSISTENCE/result.json` 与 backend logs。

## B6 续跑：CHANGE-007 草稿继续编辑主链

复核首页真实 UI 创建的首次失败证据：合法双模板草稿 POST 200 且后端 readback 正常，但新建页将 `res.data.data`（`ChangeDocVO`）整体传给路由，实际进入 `/change-docs/[object Object]` 并产生 500/Console error。因此无法到达详情页执行保存、刷新和继续编辑；不得以 API update/read 成功替代目录要求的 UI 主路径。`CHANGE-007` 结算 FAIL，复用 `BUG-FQA-102`；首次草稿 #14 已产品 DELETE，GET 400，manifest active objects=0。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-002-CREATE-ROUTE-DRIFT/result.json`。

## B6 续跑：CHANGE-019/020 安全回收门禁

只读确认：`CHANGE-019` 的正向 submit/approve 令文档脱离可 DELETE 的 draft，并在 approval 归档时生成 SharedFile/MinIO；现有删除不精确回收原 MinIO 对象。`CHANGE-020` 的 CI-draft 子链可清理，但完整跨模块验证需要现有 change_doc workflow binding，而产品仅有 GET/POST bind、无 unbind/delete/disable，写入会覆盖租户业务配置且无法精确恢复。两项均不创建不可回收夹具，结算 BLOCKED；解除条件分别为批准不可精确数据处理，或提供审计化可逆 binding 生命周期。证据：`backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocService.java`、`backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowCenterController.java`。

## B6 续跑：CHANGE-002/003/007 runner 运行态门禁

变更文档 dual-template 草稿 runner 两次均在登录首页后的导航阶段无夹具、无业务 POST 前挂起；第二次进程超过页面 locator timeout 后仍未退出。为避免并发浏览器/测试数据污染，已终止挂起 runner。manifest active objects 始终为 0，没有变更文档、CI link、模板或 workflow 写入；本项保留 NOT_RUN，待隔离 Chrome 运行态稳定后从 `/login` 重试。旧 `result.json` 未被作为本次结论或证据覆盖。

## B6 续跑：CHANGE-002 双模板 draft 创建与导航合同

清除孤立 Playwright Chrome 后，独立 Chrome 从 `/login` 经首页、侧栏“变更文档→文档列表→新建变更”进入真实模板选择。运行态 API 与 UI 均存在 application #1“默认变更文档模板”和 plan #2“主机变更文档”；两者选择并填入合法内容后，POST 实际创建 runId 草稿 #14（status=draft，两个 templateId 均正确），但前端将 `R<ChangeDocVO>.data` 对象强制当作 number，导航成 `/change-docs/[object Object]`，返回 HTTP 500 和 Console error。经产品 DELETE #14 返回 200，后续 GET 返回 400；manifest active objects=0。`CHANGE-002` 结算 FAIL，登记 `BUG-FQA-102`；因主链无法落到详情页，`CHANGE-003/004/006/007` 保持 NOT_RUN。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-002-003-007-DRAFT-LIFECYCLE/result.json`、`template-selection-debug.png`、trace/failure 日志。

## B3 续跑：DEVICE-007 凭据复制与取消重开

独立 Chrome 从 `/login` 经首页“资源管理→设备密码库”进入 runId device 详情。凭据行可见复制和查看控制；点击复制后实际调用 reveal 200，但页面未渲染明文，符合不泄露要求，却没有“密码已复制到剪贴板”或等价成功反馈。添加账号对话框取消后关闭，重开 username 为空，API 回读没有取消项，零 Console error。凭据→设备均经产品 DELETE 200 清理，manifest active objects=0。操作反馈合同未满足，`DEVICE-007` 结算 FAIL，登记 `BUG-FQA-103`。证据：`test-results/FQA_20260712_0329_lintfix/DEVICE-005-007-CREDENTIAL-BOUNDARY-COPY-CANCEL/result.json`、`01-before-copy-masked.png`、`02-after-copy-still-masked.png`。

## B5 续跑：FLOW-007 BPMN 画布保存与重载

独立 Chrome 从 `/login` 经首页流程中心进入流程设计，runId 流程在 BPMN editor 载入后保存并部署；定义 API list/detail 均 200，XML 正确包含 runId process key。编辑页的 BPMN editor 也可渲染，但已保存 name 被回读为“新流程”、category 被回读成 `http://bpmn.io/schema/bpmn`，并且 XML 不含 endEvent，未满足可重新载入与元数据保持合同。runId definition deployment 通过产品 DELETE 200 删除，随后 detail GET 400，manifest active objects=0。`FLOW-007` 结算 FAIL，登记 `BUG-FQA-104`。证据：`test-results/FQA_20260712_0329_lintfix/FLOW-007-DESIGN-SAVE-RELOAD/result.json`、`01-editor-loaded.png`、`fatal.png`、`trace.zip`。

## B6 续跑：CHANGE-003 模板组合 API 合同

在 `CHANGE-002` 已确定 UI 创建后详情导航失效的前提下，不以 API 结果替代该 UI 主链；本项独立覆盖后端组合合同。以 superadmin 创建无模板、仅 application #1、仅 plan #2、双模板四个 runId draft，均 POST/GET=200、status=draft，templateId 组合回读精确匹配。#15–#18 均按逆序产品 DELETE=200，GET=400，manifest active objects=0。`CHANGE-003` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-003-TEMPLATE-COMBINATIONS/result.json`。

## B6 续跑：CHANGE-004 实时模板字段类型

实时模板枚举的顶层字段分母为 `text`、`textarea`、`table`；table #4 的 columns 同时覆盖 `text` 与 `checkbox`。runId application draft #19 覆盖 text/textarea 创建、PUT 编辑和 GET 回读；runId table draft #20 覆盖两行固定表格创建、编辑首行 text、添加第三行及 checkbox true/false 回读。两份文档均产品 DELETE=200 且 GET=400，manifest active objects=0。`CHANGE-004` 结算 PASS。证据：`test-results/FQA_20260712_0329_lintfix/CHANGE-004-RUNTIME-FIELDTYPES/result.json`。
