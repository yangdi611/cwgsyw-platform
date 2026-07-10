# Defects

## BUG-FQA-001 — 无 `workflow:configure` 权限仍可直接进入流程设计与流程管理 UI

| Field | Evidence |
|---|---|
| Severity | P2 |
| Affected cases | FLOW-011, RBAC-016, RBAC-017 |
| Account | `lead_manage`, `group_leader`, group 1 |
| Impact | 无配置权限用户可通过直接 URL 看到 BPMN 编辑画布或流程管理页面；后端拒绝数据/API 请求，但 UI 没有明确无权限反馈，造成误导与无效操作入口。 |
| Reproduction | Login as `lead_manage` -> direct visit `/workflow/design` and `/workflow/admin`. The design page renders editable canvas; admin page renders empty state. |
| Expected | Route redirect or explicit access-denied UI before loading configuration controls. |
| Actual | `/workflow/design` renders an editable form/canvas; `/workflow/admin` renders empty state. Network `GET /api/workflow/definitions?page=1&size=20` returns 403. |
| Evidence | Browser response capture in execution session; source: `frontend/src/app/(dashboard)/workflow/design/page.tsx`, `frontend/src/app/(dashboard)/workflow/admin/page.tsx`; backend `WorkflowController` protects definition endpoints with `hasPermission('workflow','configure')`. |
| Data impact | No mutation was submitted; database unchanged. |
| Root-cause hypothesis | Missing page-level `usePermission` route guard and error-state handling for 403. |
| Likely fix scope | Workflow design/admin/templates/bindings pages and a shared permission-gate pattern; regression: direct route, sidebar visibility, API 403 for `lead_manage`. |

**Resolution:** FIXED and regressed on 2026-07-11 Asia/Shanghai. `DashboardLayout` now applies a centralized route-permission contract before protected page children mount. `/workflow/design`, `/workflow/admin`, `/workflow/templates`, and `/workflow/bindings` require `workflow:configure`; denied routes redirect to `/` without issuing the protected workflow API requests. Superadmin allow-path checks kept all four original routes and rendered their content. `lead_manage` deny-path checks redirected all four routes to `/` with zero matching protected requests, while direct `GET /api/workflow/definitions` still returned 403.

## BUG-FQA-002 — 无用户/组/角色权限的直接路由显示“暂无数据”而非拒绝

| Field | Evidence |
|---|---|
| Severity | P2 |
| Affected cases | RBAC-005, RBAC-012, RBAC-016, RBAC-017 |
| Account | `lead_manage`, `group_leader`, group 1 |
| Impact | 管理页面直接 URL 将权限拒绝伪装成空数据，用户无法区分真实空态、网络错误与无权限。 |
| Reproduction | Login as `lead_manage` -> direct visit `/users`, `/groups`, `/rbac/roles`, `/rbac/permissions`. |
| Expected | Redirect or explicit access-denied UI; unauthorized API remains 403. |
| Actual | `/users`, `/groups`, `/rbac/roles` render empty-state content; `/rbac/permissions` prompts to select a role. Corresponding APIs `/api/users`, `/api/groups`, `/api/rbac/roles` return 403. |
| Evidence | Browser response capture; source module APIs are backend-protected. |
| Data impact | No mutation was submitted; database unchanged. |
| Root-cause hypothesis | Missing page-level RBAC gates and generic query error paths that collapse a 403 into an empty collection. |
| Likely fix scope | `users`, `groups`, `rbac/roles`, `rbac/permissions` pages plus consistent unauthorized-state component; regression: direct route/API matrix. |

**Resolution:** FIXED and regressed on 2026-07-11 Asia/Shanghai. The centralized route gate now requires `user:read`, `group:read`, `role:read`, or the permission editor's complete `resource:read` + `resource:assign` + `role:read` contract before mounting each management page. The permission navigation entry was corrected from the non-backend `role:assign` check to `resource:assign`. Superadmin allow paths rendered normally. `lead_manage` direct visits to `/users`, `/groups`, `/rbac/roles`, and `/rbac/permissions?roleId=1` all redirected to `/` with zero protected API requests; direct backend calls remained 403. The test account password/profile flow was refreshed through the existing administrator reset and required-actions UI only; no direct credential or database write was used.

## BLOCKED-RBAC-001 — 平台不提供创建自定义最小权限角色的产品入口

| Field | Evidence |
|---|---|
| Blocked cases | RBAC-009, RBAC-010, RBAC-013 and the complete 97-action viewer deny matrix |
| Required fixture | `fqa_no_write_FQA_20260710_2118_lintfix` and `fqa_viewer_FQA_20260710_2118_lintfix` |
| Attempts | `test_admin` opened `/rbac/roles`; page exposes only five built-in roles and permission configuration. Source/API review found `RoleController` offers `GET /roles`, reads, and `PUT /roles/{roleId}/permissions`, but no role create/update/delete endpoint. |
| Constraint | Test protocol forbids direct SQL insertion because it bypasses product audit and permission contracts. |
| Unblock condition | Add a product-managed custom-role lifecycle endpoint/UI with audited create/delete, or provide a pre-approved existing test viewer account. |

## BUG-FQA-003 — 工作台在 390px 手机视口产生水平溢出

| Field | Evidence |
|---|---|
| Severity | P2 |
| Affected case | HOME-007 / NP-009 |
| Account | `test_admin` |
| Reproduction | Login -> homepage at `390x844`. |
| Expected | No horizontal overflow; header and dashboard actions remain within viewport. |
| Actual | Document `scrollWidth=549`, `clientWidth=390`. Header's fixed action/account group extends to x=549; dashboard action rows also extend beyond viewport. |
| Evidence | `test-results/FQA_20260710_2118_lintfix/HOME-007/phone.png`; `test-results/FQA_20260710_2118_lintfix/HOME-007/phone-overflow.png`. |
| Root-cause hypothesis | Desktop header/dashboard flex groups use `shrink-0` / `whitespace-nowrap` without a phone breakpoint or overflow strategy. |
| Likely fix scope | Dashboard header action layout and homepage action rows; regression at 390x844, 1024x768, 1440x1000. |

**Resolution:** FIXED and regressed on 2026-07-11 Asia/Shanghai. At phone widths the sidebar now presents its existing 76px icon navigation, group flyouts support click/tap in addition to hover, the global header hides the desktop-only create shortcut and allows breadcrumb content to shrink, and the homepage action group stacks above the small breakpoint. At 390x844 both document and body reported `scrollWidth=clientWidth=390`; sidebar/header/main occupied 76/314/314px without crossing the viewport. Mouse and touch checks opened the identity flyout and navigated to `/users` with overflow remaining 0. Evidence: `test-results/FQA_20260710_2118_lintfix/HOME-007/phone-fixed.png`.

## BUG-FQA-004 — 私有未指定负责人的临时运维任务创建后不可检索、不可操作、不可清理

**Remediation status (2026-07-10): FIXED and regression verified.** `createManual` now defaults an omitted planned start to the current time, registers the creator as an operable collaborator when no assignee is selected, and rejects a due time earlier than the effective planned start. Unit regression: 4/4 pass on JDK 21. UI/API regression: the creator found the task under `我的`, confirmed it, then cancelled it; all three API calls returned 200. The regression object was soft-deleted and no active row remains.

| Field | Evidence |
|---|---|
| Severity | P1 |
| Affected cases | OPS-003, ST-OPS-001-ST-OPS-004, COMMON-003, cleanup contract |
| Account | `lead_manage`, `group_leader`, group 1 |
| Test object | `ops_schedule_task:3`, `FQA_20260710_2118_lintfix_OPS_TASK` |
| Reproduction | Create a temporary task through `/ops-calendar` with title only and default private visibility / unassigned owner. Switch to list then `我的` / `本组`; attempt lifecycle API calls as creator. |
| Expected | Form rejects incomplete scheduling/ownership fields, or creator can list and perform the permitted lifecycle/cleanup actions. |
| Actual | Create returns success with `planned_start_at=NULL`, `due_at=NULL`, `assignee_id=NULL`, `status=pending_confirm`; task appears in neither default nor group list. Creator receives 400 `无权操作该任务` from confirm, start and complete, and 400 `当前状态不可取消` from cancel. |
| Data impact | RunId task remains active and cannot be cleaned through product UI/API. No other data was modified. |
| Evidence | Database: `ops_schedule_task.id=3`; API response captures; `OpsCalendarTaskService.createManual`, `loadOwned` / `requireOperate`; initial cancel response retained in execution log. |
| Root-cause hypothesis | Manual task form/API accepts absent schedule and assignee while private visibility/access checks do not preserve the creator as an allowed operator. |
| Likely fix scope | `TaskCreateRequest` validation, `createManual` default ownership/schedule handling, list visibility and lifecycle authorization; regress creation, list, all state edges and cleanup. |

## BUG-FQA-005 — 共享文件预览页无法消费下载 URL，且预签名 URL 使用浏览器不可达的 MinIO 内部地址

**Resolution:** FIXED and regressed on 2026-07-11 Asia/Shanghai. Preview and download now use authenticated same-origin content endpoints instead of exposing the Docker-internal MinIO hostname. The backend returns `inline` / `attachment` content disposition, inferred MIME, UTF-8 filename and the current MinIO object length; this last value prevents truncation when an older database row points to an object later overwritten at the same key. Frontend preview/download consume authenticated Blob responses and preserve `originalName`.

**Regression evidence:** From the logged-in homepage, navigated through `共享文档` -> `变更文档` -> `2026-06` -> file ID 2. `GET /api/files/2/preview` returned 200, DOCX MIME, inline UTF-8 filename and 12,713 bytes; the page rendered a `.docx-wrapper` with visible document content and no loading/error state. Clicking `下载` produced a browser download event; `GET /api/files/2/download` returned 200 with attachment UTF-8 filename, the suggested filename was `CHG-20260623-001_方案.docx`, and the 12,713-byte OOXML archive passed `unzip -t`. Evidence: `test-results/FQA_20260710_2118_lintfix/BUG-FQA-005/preview-fixed-final.png` and `test-results/FQA_20260710_2118_lintfix/BUG-FQA-005/final-CHG-20260623-001_方案.docx`.

| Field | Evidence |
|---|---|
| Severity | P1 |
| Affected cases | FILE-006, FILE-007, NP-004, COMMON-011 |
| Account | `test_admin` |
| Reproduction | Open `/files/preview/2` -> click `下载`. |
| Expected | Browser receives a downloadable, externally reachable URL and saves non-empty content. |
| Actual | `GET /api/files/2/download-url` returns 200 with `data` as a string URL rooted at `http://minio:9000/...`; no browser download occurs and preview remains loading. The preview page only reads `res.data.data.url` / `res.data.url`, while the list page correctly accepts string `res.data.data`. |
| Evidence | Browser response capture (response status 200, download event timeout); `frontend/src/app/(dashboard)/files/preview/[id]/page.tsx`; `frontend/src/app/(dashboard)/files/page.tsx`; `SharedFileController.getDownloadUrl`. |
| Data impact | Read-only test; none. |
| Root-cause hypothesis | DTO-shape drift in preview page and MinIO public endpoint misconfiguration for browser-issued presigned URLs. |
| Likely fix scope | File preview downloader, shared download response contract, MinIO external endpoint configuration; regress preview/download by UI and verify filename, MIME and bytes. |

## BLOCKED-CLEANUP-001 — Active runId ops task cannot be product-cleaned

| Field | Evidence |
|---|---|
| Object | `ops_schedule_task:3`, title `FQA_20260710_2118_lintfix_OPS_TASK` |
| Attempts | UI list/default and `本组` scope: not visible. Authenticated product API: cancel, confirm, start, complete all rejected as described in BUG-FQA-004. |
| Constraint | Test contract prohibits direct database cleanup unless product lacks cleanup and residual data affects further execution; this residual now blocks the required clean-data invariant. |
| Required authorization | Approve a narrowly scoped database-assisted cleanup for exactly `ops_schedule_task.id=3` and its runId-linked dependent rows, or authorize a pre-production database restore from the existing pretest dump. |

**Resolution:** User authorized the narrowly scoped cleanup. At 2026-07-10 22:37 Asia/Shanghai, `ops_schedule_task.id=3` was soft-deleted after dependency enumeration. Post-check: `active_runid_tasks=0`, linked/participant rows=0. Task logs were intentionally retained as audit evidence.
