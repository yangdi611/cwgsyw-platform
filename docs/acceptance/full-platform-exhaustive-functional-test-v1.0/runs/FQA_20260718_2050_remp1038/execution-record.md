# L4 Execution Record

- Run ID: `FQA_20260718_2050_remp1038`.
- Current integration baseline: `lint-fix@1254925a1ff1a4917db926be0c13d9f7409dee24`, the no-ff merge of `REM-P1-039`. The application containers remain the unchanged `4d7b3e1` product source because `REM-P1-039` only corrected L4 test-route evidence; no product image reset or broad rerun is implied.
- Formal Wiki tenant policy: `wiki_page -> remp1038wiki`, with `superadmin` as the specific approver; approved by the user before this run.
- 2026-07-19 policy confirmation: the user accepts `wiki_page -> remp1038wiki` as the formal approval policy. This is a long-lived tenant configuration, not a run-scoped fixture: L4 preserves it and does not delete, replace, or restore it.
- Freshness: all 275 functional and 78 state cases begin `NOT_RUN`. No result, fixture, evidence, or status is inherited from `FQA_20260718_1715_remp1029` or an earlier L4 run.
- Safety: only mutually isolated read-only checks may run concurrently. Writes, state machines, cleanup, tenant authorization cutover, and any external integration verification run serially.

## AUTHZ-014 closure and XL-CMDB-006 failure

- `test/l4-authz-resource-migration-remaining-current-run.spec.js` passed its executable `AUTHZ-014` scenario `1/1` in `986ms` at `/tmp/fqa-2050-authz014-rerun`. The first attempt exposed only an unauthenticated Redis test-helper read; after correction, rollback/re-enforce, break-glass denial boundaries, exact key removal and manifest 0/0 all passed.
- `test/l4-cmdb-status-notification-current-run.spec.js` then reproduced `XL-CMDB-006`: status update and canonical CMDB change before/after passed, but the exact active notification count was zero. All run-scoped fixtures were product-API deleted.
- GitNexus reports LOW risk and zero upstream callers for `CiNotificationService.notifyStatusChange`; `CiInstanceCommandService.update` has three direct callers across Service/Instance. L4 stops for independent `REM-P1-074` while unaffected current-run PASS remains valid.

## XL-CMDB-006 closure after REM-P1-074

- Event `0364ee0e` was no-ff merged into `lint-fix` as `414037c2`; the L4 continuation was created from that exact integration point without resetting unaffected PASS evidence.
- Same-run affected-only Playwright passed `1/1` in 2.3 seconds at `/tmp/fqa-2050-xl-cmdb-006-after-rem-p1-074-r6`. The complete case covered direct status update, canonical diff, notification, real detail/history UI, same-status silence and batch `2/2` with both instance refs notified.
- All two CI instances, model and model group were product-API deleted; event/shared manifests are `objects=[]`, `cleanupFailures=0`. L4 resumes with functional `270 PASS / 0 FAIL / 1 N/A / 4 NOT_RUN` and state `73 PASS / 0 FAIL / 1 N/A / 4 NOT_RUN`.

## XL-RBAC-008 complete authorized chain

- `test/l4-rbac-remaining-matrix-current-run.spec.js` passed the single complete scenario `1/1` in 2.4 seconds at `/tmp/fqa-2050-xl-rbac-008-r4`. It used the approved `enforced -> rollback -> enforced` window and only product APIs for all writes.
- A runId user produced a real `GROUP_SCOPE_WITHOUT_GROUP` migration exception, then regained a primary membership and effective assignment. A shared-folder owner reference blocked deletion with 409 and unchanged user/access/exception snapshots; after owner transfer, deletion revoked the session/login, removed membership/assignment/user ACL relationships, automatically resolved the exception with the system cleanup note, and wrote `deleted_user_relationship_cleanup` audit.
- Preflight ended eligible with zero issues; cutover ended enforced at epoch 45. Independent readback found zero active run-scoped users, roles and folders, and manifest is `objects=[]`, `cleanupFailures=0`. r2/r3 were corrected test-asset assumptions with complete cleanup, not product failures. State totals are `74 PASS / 0 FAIL / 1 N/A / 3 NOT_RUN`; functional totals remain `270 PASS / 0 FAIL / 1 N/A / 4 NOT_RUN`.

## Phase 0

- Rebuilt and replaced only backend and frontend using `docker compose -f docker-compose.dev.yml build backend frontend` followed by `up -d --no-deps --force-recreate backend frontend`. PostgreSQL, Redis, MinIO, Nginx, volumes, and sessions were not reset or rebuilt. The frozen image/container evidence and Flyway `77` are in `environment-baseline.md`; actuator is `UP` and Nginx returns `200`.

## Isolated Read-only Batches

- `test/l4-auth-invalid-login.spec.js test/l4-auth-invalid-session.spec.js test/l4-home-readonly-ui.spec.js test/l4-sidebar-navigation.spec.js test/l4-common-search-boundaries.spec.js` passed `33/33` serially (`/tmp/fqa-2050-readonly/auth-home.log`).
- `test/l4-readonly-content-navigation.spec.js test/l4-resource-readonly.spec.js test/l4-statistics-readonly.spec.js test/l4-superadmin-account-readonly.spec.js test/l4-wiki-search-readonly.spec.js test/l4-wiki-export.spec.js test/l4-wiki-version-export.spec.js` passed `10/10` serially (`/tmp/fqa-2050-readonly/content-readonly.log`).
- `test/l4-cmdb-overview-readonly.spec.js test/l4-cmdb-breadcrumbs-readonly.spec.js test/l4-cmdb-changes-readonly.spec.js test/l4-cmdb-compat-route.spec.js test/l4-cmdb-detail-topology-impact-readonly.spec.js test/l4-cmdb-every-model-read.spec.js test/l4-cmdb-stats-contract.spec.js test/l4-cmdb-alerts-readonly.spec.js` passed `8/8` serially (`/tmp/fqa-2050-readonly/cmdb-readonly.log`).
- `test/l4-audit-readonly.spec.js test/l4-report-stats.spec.js test/l4-workflow-todo-readonly.spec.js test/l4-workflow-instances-readonly.spec.js test/l4-authz-workbench-readonly.spec.js` passed `5/5` serially (`/tmp/fqa-2050-readonly/platform-readonly.log`).
- These groups ran concurrently only with one worker per group and contain no business-fixture writes. All resulting mapped catalog cases are this run's evidence; manifest remains `objects=[]`, `cleanupFailures=0`.

## Serial State Machines

- `test/l4-wiki-state-current-run.spec.js` passed `1/1` serially. It created only run-scoped Wiki space/page fixtures, submitted through the formal `wiki_page -> remp1038wiki` binding, found the current approver task through `/api/workflow/center/tasks/my`, rejected to draft, resubmitted and approved to published, then deleted the page and space through product APIs. `ST-WIKI-001..003` are PASS and the manifest returned to `objects=[]`, `cleanupFailures=0`.

## Automation Matrix Reconciliation

- Fresh full command: `FQA_L4_RUN_ID=FQA_20260718_2050_remp1038 npx playwright test <72 unmodified L4 assets> --workers=1 --output=/tmp/fqa-2050-all-l4-rerun --reporter=line`; result `104 passed (2.2m)`. The current user-owned daily test edits were not used as evidence. The stable current assets cover 131 functional cases and 15 state cases, including the formal Wiki lifecycle and the authorized rollback -> preflight -> enforce path.
- The initial full batch produced a `CMDB-031` locator timeout while waiting for `完整详情`; its retained trace is `/tmp/fqa-2050-all-l4/l4-cmdb-detail-topology-im-af093-031ReadExistingInstanceOnly/trace.zip`. A clean independent serial rerun passed (`/tmp/fqa-2050-cmdb031-rerun`), so final evidence is PASS; no product assertion failed.
- `ST-AUTHZ-022` is a source-backed `N/A`, not PASS: frozen/eligible/approved/rolled_back/failed are schema-only values with no product transition, and no SQL simulation was used.
- Manifest after the 104-test run is `objects=[]`, `cleanupFailures=0`; authorization post-check remains `enforced`.

## Wiki Storage and System Policy

- `test/l4-wiki-attachment-readonly-current-run.spec.js` passed `2/2` serially. A runId space/page attachment was uploaded, content-read, independently deleted and verified absent; a second attachment was removed by page deletion and verified absent. The system readOnly space rejected a page-create request with `403`. This adds `WIKI-011`, `XL-WIKI-001`, and `ST-WIKI-004`; manifest returned to `objects=[]`, `cleanupFailures=0`.

## Backup Lifecycle Without Restore

- `test/l4-backup-current-run.spec.js` passed `2/2` serially. It created a new backup, verified the non-empty download and `Content-Disposition`, then deleted the exact record/file through the product API. Anonymous list/download/create requests were `403`. This adds `BACKUP-001..003`; `BACKUP-004` remains unexecuted because actual restore is a prohibited destructive operation without explicit authorization. Manifest returned to `objects=[]`, `cleanupFailures=0`.

## RBAC-013 safe zero-action continuation

- `test/l4-rbac013-safe-zero-actions-current-run.spec.js` passed `1/1` in 3.9 seconds at `/tmp/fqa-2050-rbac013-safe-zero-r3`.
- A run-scoped `cmdb_model:write`-only identity updated a run-scoped model through the current `cmdb_model:update` controller guard; a read-only identity received authenticated `403`, and the model readback was unchanged after denial. This is compatibility-alias evidence, not a second model capability.
- The same read-only authenticated identity submitted `POST /api/backups/9223372036854775000/restore` and received `403` before controller method execution. Backup and model readbacks were unchanged; no restore service, truncate, or restore operation ran.
- A run-scoped active group also received authenticated `403` for purge and remained active immediately afterward. Cleanup then used the approved product archive/soft-delete lifecycle; no purge or retention override ran.
- Product-API cleanup removed both roles, users, assignments, model and model group and archived the run-scoped group. Shared manifest is `objects=[]`, `cleanupFailures=0`.
- `group:purge` allow remains unavailable under the 30-day retention contract for a newly created runId group. `backup:restore` allow remains prohibited by the user's authorization boundary. These rows remain open for contract/authorization resolution and are not promoted to PASS.

## RBAC-013 reusable denial batches

- Serial batch `/tmp/fqa-2050-rbac013-deny-safe-batch-r1` passed `6/6` in 14.6 seconds: change-template, CMDB model-group, shared-folder ACL, user-management, Wiki ACL and Wiki space denial paths. Each asset completed its own product-API cleanup and the shared manifest remained `objects=[]`, `cleanupFailures=0`.
- Serial batch `/tmp/fqa-2050-rbac013-deny-safe-batch-r2` passed `5/6` in 10.2 seconds. Device group scope, device password, IPAM group scope, audit low-permission and ops-calendar management passed with exact cleanup. `NOTICE-002` failed before any product write because the current notification dataset did not contain both an available and unavailable target; the retained trace is `/tmp/fqa-2050-rbac013-deny-safe-batch-r2/l4-notification-targets-no-6f32a-ShowsStableUnavailableState/trace.zip`. This remains an explained test-fixture failure and is not promoted to PASS.
- Serial B3 reuse batch `/tmp/fqa-2050-rbac013-b3-reuse-r1` passed `4/6` in 13.5 seconds. Daily approval/lifecycle, Wiki space/page lifecycle and Workflow task-list assets passed and cleaned exactly. Both ChangeDoc assets received stable `409 变更文档未配置启用的流程绑定` at submit/submit-plan and cleaned their fixtures.
- Read-only `GET /api/workflow/center/bindings` returned only enabled `daily_report` and the user-approved `wiki_page -> remp1038wiki` bindings; there is no enabled `change_doc` binding. The earlier diagnostic request to obsolete `/api/workflow/bindings` produced `NoResourceFoundException` and is not a product route failure. No binding was created, enabled, disabled or restored. ChangeDoc RBAC rows remain gated on an explicit binding-policy decision.
- B1 account/organization asset passed `1/1` in 12.0 seconds at `/tmp/fqa-2050-rbac013-b1-r2`, covering resource/role/user/group actions with real allow/deny and purge deny; manifest returned to `0/0`.
- B4 diagnosis proved the earlier `403` was `PASSWORD_CHANGE_REQUIRED`: the draft identity skipped mandatory account setup. After adding normal setup, independent CI fixtures and unique IP pool CIDRs, the full Device/IPAM/shared-file matrix passed `1/1` in 42.2 seconds at `/tmp/fqa-2050-rbac013-b4-r10`; all domain/RBAC fixtures were product-cleaned and manifest is `0/0`.
- Reduced B6 platform asset passed `1/1` in 14.0 seconds at `/tmp/fqa-2050-rbac013-b6-r2`: AI read allow/write deny, audit read, backup read/create/delete, restore deny, notification manage read and notification read all passed with cleanup `0/0`. No provider allow, restore, or configuration write ran; `ai_config:write` allow remains open.
- B2 core CMDB asset passed `1/1` in 13.3 seconds at `/tmp/fqa-2050-rbac013-b2-r2`: instance/model/relation CRUD and reads, model manage/write compatibility alias, alert/change reads, canonical impact pair and legacy impact/import denials all passed with product cleanup `0/0`. Alert acknowledge returned idempotent `200` for a nonexistent ID and authenticated deny returned `403`; the real alert-state mutation remains bound to existing REM-P1-071 evidence rather than being inferred from the idempotent request.
- B5 reused the current Ops assets rather than duplicating their state machines. `rem-p1-047-ops-task-text-boundaries`, `rem-p1-048-ops-material-group-scope` and `rem-p1-051-ops-confirm-idempotency` passed `6/6` in 11.6 seconds at `/tmp/fqa-2050-rbac013-b5-reuse-r2`, covering create/update, complete/confirm idempotency, export denial and tenant/group/read-all range semantics. `l4-ops-calendar-manage-current-run` separately passed `1/1` in 725ms at `/tmp/fqa-2050-rbac013-b5-reuse-r1`. Product cleanup and manifest are `0/0`.

## Wiki Graph and Cross-module Links

- `test/l4-wiki-attachment-readonly-current-run.spec.js` passed `3/3` on the final serial run. Two runId pages with known and unknown Wiki links were saved, published through the approved `wiki_page -> remp1038wiki` binding, and verified through backlink and graph APIs plus the real graph route. Valid Mermaid rendered as SVG in the reading page; comment create/delete completed before page/space cleanup. This adds `WIKI-014` and `XL-WIKI-002..004`; manifest returned to `objects=[]`, `cleanupFailures=0`.
- The initial graph-route assertion had a Playwright strict-mode selector ambiguity between the navigation button and page title. The trace remains `/tmp/fqa-2050-wiki-extended/l4-wiki-attachment-readonl-01d8d-inksGraphMermaidAndComments/trace.zip`; the narrowed page-title assertion passed in `/tmp/fqa-2050-wiki-extended-rerun`.

## L4 Reconciliation: Backup Route Test Path

- `test/l4-admin-denial-current-run.spec.js` created a zero-permission, run-scoped authenticated identity after the authorized cutover test and cleaned its assignment, user and role in reverse order through product APIs.
- `GET /api/admin/config`、`GET /api/admin/ai/providers`、`GET /api/backups`、Prometheus write、AI test and backup create all returned `403`. The original browser assertion used `/backups`, which is an API path rather than the backup page route.
- `REM-P1-039` independently corrected the browser target to `/admin/backup` and ran it against the unchanged `lint-fix@4d7b3e1` frontend: zero-permission user redirected to `/`; result `1 passed` at `/tmp/rem-p1-039-route-before-retry`. This validates the existing `BackupPage` guard, not a code change.
- The initial trace remains historical evidence of the test-path error. The temporary identity was cleaned in both runs; manifest cleanup is complete. `BACKUP-003` is PASS and L4 resumes without resetting the unchanged application baseline.

## Administration Denial Reconciliation

- The same completed zero-permission identity run also closes `CONFIG-006` and `AI-004`: config read/Prometheus write and AI provider read/test returned `403`; direct `/admin/config` and `/admin/ai` returned `/` after hydration. This is stronger than the catalog's named low-permission profile and did not modify configuration or providers.
- Evidence is `test/l4-admin-denial-current-run.spec.js` at `/tmp/rem-p1-039-route-before-retry`; temporary role, user and assignment were product-API reverse-cleaned and manifest remains empty.

## Dashboard and Report Read-only Navigation

- `test/l4-dashboard-report-readonly-current-run.spec.js` passed serially at `/tmp/fqa-2050-dashboard-report-final-rerun`. It used the real dashboard quick links to CMDB, change creation, workflow tasks and user management, then opened comprehensive reports and exercised month/quarter presets without exporting.
- `HOME-002` and `REPORT-001` are PASS. No product object, authorization relation or configuration was written; page errors and HTTP `5xx` were zero.

## CMDB/IPAM Read-only Write Denial

- `test/l4-read-only-write-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-read-write-denial-pass`. It created a unique role holding only `cmdb_instance:read`, `cmdb_relation:read` and `ip_pool:read`, then verified both read APIs and read-only browser pages.
- All IP-pool writes (create/update/delete/allocate/release) returned `403`; the valid raw CMDB import preview and valid-payload relationship create/delete calls also returned `403`. This closes `IPAM-008`, `CMDB-025` and `CMDB-027` without relying on malformed-payload validation.
- The role assignment, user and role were deleted through product APIs in reverse order; the manifest returned to `objects=[]`, `cleanupFailures=0`.

## CMDB Model-group Manage Denial

- `test/l4-cmdb-model-group-manage-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-cmdb004-denial`. A run-scoped `cmdb_model:read` identity read the model-group list but received `403` for model-group create, update and delete with valid request bodies.
- The real `/cmdb/admin` page remained readable and hid the `新建分类` control. Assignment, user and role cleanup completed through product APIs, leaving `objects=[]`, `cleanupFailures=0`. This closes `CMDB-004`.

## CMDB Impact Permission Denial

- `test/l4-cmdb-impact-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-cmdb032-denial-pass`. A run-scoped `cmdb_instance:read` identity read the instance list while impact analysis returned `403`.
- Direct impact navigation returned to `/` because the test identity intentionally had no `cmdb_model:read`; role assignment, user and role were product-API reverse-cleaned. The manifest returned to `objects=[]`, `cleanupFailures=0`. This closes `CMDB-032`.

## Wiki Space Write Denial

- `test/l4-wiki-space-write-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-wiki003-denial-final`. A run-scoped `wiki:read` identity read the space list and received `403` for space create and delete.
- The real `/wiki` page was reachable but exposed no create-space action. Assignment, user and role cleanup completed through product APIs; the manifest returned to `objects=[]`, `cleanupFailures=0`. This closes `WIKI-003`.

## Change-template Write Denial

- `test/l4-change-template-write-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-change017-denial`. A run-scoped `change_doc_template:read` identity read templates and received `403` for template create, update and delete using valid request shapes.
- The real `/admin/change-doc-templates` page remained readable and hid `新建模板`. Assignment, user and role cleanup completed through product APIs; the manifest returned to `objects=[]`, `cleanupFailures=0`. This closes `CHANGE-017`.

## Wiki Unified Access Manage Denial

- `test/l4-wiki-access-manage-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-wiki005-denial`. A run-scoped `wiki:read` identity received `403` for both unified access read and a valid snapshot replacement request.
- Superadmin access snapshots taken immediately before and after are identical; no ACL replace or audit write occurred. The real Wiki page exposed no access-management control. RBAC cleanup completed through product APIs and the manifest returned to `objects=[]`, `cleanupFailures=0`. This closes `WIKI-005`.

## Shared-folder Unified Access Manage Denial

- `test/l4-file-access-manage-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-file011-denial`. A run-scoped `shared_file:read` identity received `403` for both unified folder-access read and a valid snapshot replacement request.
- Superadmin folder-access snapshots taken immediately before and after are identical; no ACL replace or audit write occurred. The real file page exposed no access-management control. RBAC cleanup completed through product APIs and the manifest returned to `objects=[]`, `cleanupFailures=0`. This closes `FILE-011`.

## Builtin Role Scope-assignment Denial

- `test/l4-rbac-builtin-role-assignment-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-rbac028-denial-final`. A new scoped assignment request for an existing builtin role returned `400`; the run-scoped user remained without any assignment.
- The real user authorization dialog excludes builtin roles from its functional-role selector. The run-scoped user was product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`. This closes `RBAC-028`.

## Migration Workbench Group-scope Denial

- `test/l4-authz-migration-group-denial-current-run.spec.js` passed `1/1` serially at `/tmp/fqa-2050-authz002-denial`. A run-scoped `cmdb_instance:read` group identity could read CMDB but received `403` for cutover, preflight, pending-user and open-exception migration reads.
- Migration navigation was hidden and direct workbench navigation returned to `/`. Superadmin cutover and open-exception snapshots were identical before and after; no cutover/backfill/break-glass endpoint was called. Role assignment, user and role cleanup completed through product APIs; the manifest returned to `objects=[]`, `cleanupFailures=0`. This closes `AUTHZ-002`.

## High-risk Gate Pause

- `test/l4-break-glass-group-denial-current-run.spec.js` passed `1/1` serially. A run-scoped `cmdb_instance:read` group identity could read CMDB but received `403` for both break-glass activation and deactivation. The service rejects the session before any Redis or audit mutation; the administrator cutover snapshot was identical before and after, the browser exposed no break-glass control, and role assignment, user and role cleanup completed through product APIs. This closes `AUTHZ-012` without activating break-glass.
- `test/l4-rbac-membership-revocation-current-run.spec.js` passed `1/1` serially. A run-scoped group assignment with `wiki:read` and `shared_file:read` allowed both reads before the primary membership was removed. The existing token and a newly issued login token both then received `403` for both APIs; the matching assignment was automatically revoked, and the user and role were product-API deleted. This closes `RBAC-026` without retaining any permission or scope relationship.
- `test/l4-user-management-denial-current-run.spec.js` passed `1/1` serially. A run-scoped `cmdb_instance:read` group identity could read CMDB but received `403` for the user-list API. Its sidebar omitted user management and direct `/users` navigation returned to `/`; role assignment, user and role cleanup completed through product APIs. This closes `RBAC-005`.
- `test/l4-rbac-group-delegation-current-run.spec.js` passed `1/1` serially after a rejected overlong role-name input was corrected before any fixture was created. A run-scoped group operator successfully delegated a role containing only its held `cmdb_instance:read` permission within group `1`. It received `400` for a role containing unheld `wiki:read` and for a group-2 scope; no extra assignment was created. Assignments, the target secondary membership, users and roles were product-API reverse-cleaned. This closes `RBAC-021`.
- `test/l4-rbac-valid-until-current-run.spec.js` passed `1/1` serially. A future `validUntil` group assignment allowed a run-scoped `wiki:read` user to list Wiki spaces. After revocation, a past `validUntil` assignment gave a newly logged-in session `403` for the same read. Both assignments, user and role were product-API reverse-cleaned. This closes `RBAC-022`.
- `test/l4-rbac-permission-delegation-current-run.spec.js` passed `1/1` serially. A run-scoped group operator holding `resource:assign` and `cmdb_instance:read` saved and refreshed that permission on a candidate role. Its attempt to replace the role with unheld `wiki:read` returned `400`; administrator readback proved the original `cmdb_instance:read` set remained intact. Assignment, user and both roles were product-API reverse-cleaned. This closes `RBAC-011`.
- `test/l4-workflow-invalid-bpmn-current-run.spec.js` passed `1/1` serially. Malformed XML, BPMN missing a start event, BPMN missing an end event, and duplicate element IDs all returned `400`. The definition-list snapshot was identical before and after and the runId key had zero versions, proving no deployment or cleanup residue. This closes `FLOW-009`.
- Under the user's explicit authorization, `test/l4-authorization-cutover.spec.js`, `test/l4-authz-duplicate-rollback.spec.js`, `test/l4-authz-invalid-confirmation.spec.js`, and `test/l4-authz-duplicate-enforce.spec.js` passed `4/4` serially. The tenant moved `enforced -> rollback/legacy -> enforced`, preflight remained eligible with no issues, and the resulting cutover epoch advanced exactly once per recovery cycle. Duplicate rollback/enforce requests returned `409`; invalid confirmation values returned `400` with no state change; the real migration UI hid duplicate Enforce while retaining the rollback entry. The run manifest returned to `objects=[]`, `cleanupFailures=0`, and final authorization mode is `enforced`.
- A dedicated `FILE-018` ancestor-traverse probe was intentionally not accepted as L4 evidence: its positive precondition could not be established in the current environment because the newly created child folder's unified access read returned `403` before the target user request. Its `finally` block product-API deleted all run-scoped folders, assignment, user and role; manifest cleanup returned to zero. The case remains `NOT_RUN` rather than being inferred from historical evidence or recorded as PASS.
- `test/l4-account-reset-setup-current-run.spec.js` passed `1/1` serially. It created a run-scoped user, confirmed the initial token, invoked administrator password reset, and received `401` from that old token. The reset password completed first-time setup; it was then rejected for future login while the final password succeeded. This closes `RBAC-004` and `XL-RBAC-004`; the user was product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`.
- `test/l4-rbac-multi-role-union-current-run.spec.js` passed `1/1` serially after shortening the generated role name/code to meet existing validation before any fixture was created. Separate run-scoped `cmdb_instance:read` and `wiki:read` roles assigned to one group user both appeared in its authenticated permission set and allowed the corresponding APIs; shared-file and change-document reads without a role remained `403`. This closes `RBAC-014` and `XL-RBAC-005`; assignments, user and both roles were product-API reverse-cleaned and the manifest returned to `objects=[]`, `cleanupFailures=0`.
- `test/l4-legacy-acl-gates-current-run.spec.js` passed `1/1` serially. Against existing shared-folder, Wiki space and Wiki page resources, each legacy ACL endpoint followed GET -> valid-shape PUT -> GET and returned `409` every time while the tenant remained enforced. This closes `FILE-019` and `WIKI-027`; no legacy ACL read/write succeeded and no fixture was created.
- `test/l4-wiki-acl-version-conflict-current-run.spec.js` passed `1/1` serially. Two independently authenticated superadmin sessions read the same run-scoped space access version; the first save changed mode to `2770` and incremented its version, while the stale second save returned `409`. Final readback retained the first mode/version. The space was product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`, closing `WIKI-026`.
- `test/l4-file-acl-version-conflict-current-run.spec.js` passed `1/1` serially. Two independently authenticated superadmin sessions read the same run-scoped folder access version; the first save changed mode to `2770` and incremented its version, while the stale second save returned `409`. Final readback retained the first mode/version. The folder was product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`, closing `FILE-015`.
- `test/l4-file-unified-acl-current-run.spec.js` passed `1/1` serially after correcting the named test user's ACL from `r-x` to `rwx`: the same user holds `shared_file:manage_acl`, which requires the resource write bit to read unified access. A run-scoped folder replaced mode, named access ACL and named default ACL in one request with version increment; the named user immediately listed the folder and read unified access. Assignment, user, role and folder were product-API reverse-cleaned, returning the manifest to `objects=[]`, `cleanupFailures=0`, closing `FILE-009`.
- `test/l4-wiki-default-acl-current-run.spec.js` passed `1/1` serially. With the user-approved formal `wiki_page -> remp1038wiki` tenant policy unchanged, superadmin created a run-scoped space and replaced its unified access with mode `2770`, named user/group access ACLs and matching default ACLs; its version incremented. A newly created page inherited the space owner group and named default entries as access entries, while retaining fixed page mode `0670`. The page and space were deleted through product APIs and the manifest returned to `objects=[]`, `cleanupFailures=0`, closing `WIKI-004`.
- `WIKI-018` is now PASS as a fresh-run-only aggregation: `ST-WIKI-001..003` cover the approved Wiki submit/reject/resubmit/approve state lifecycle, `ST-WIKI-004` proves readOnly-space write denial, and the new `WIKI-004` probe proves unified ACL/default/setgid inheritance. Each constituent run used current-run evidence and exact cleanup; no prior L4 conclusion was inherited.
- `test/l4-wiki-version-current-run.spec.js` passed `1/1` serially. It saved two versions of a run-scoped page, verified the version list and version-1 Markdown export, then reverted to version 1; readback retained the first content at `currentVersion=3`. Page and space deletion through product APIs returned the manifest to `objects=[]`, `cleanupFailures=0`, closing `WIKI-016`.
- `test/l4-wiki-export-current-run.spec.js` passed `1/1` serially. A run-scoped page's Markdown export contained its saved content and the containing space exported as a non-empty ZIP. It intentionally created no attachment because exact attachment cleanup is covered separately; page and space were product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`, refreshing current-run evidence for `WIKI-017`.
- `test/l4-file-preview-current-run.spec.js` passed `1/1` serially. A run-scoped Chinese-name text file returned its expected preview URL, `text/plain` MIME and exact content bytes. File and folder deletion through product APIs returned the manifest to `objects=[]`, `cleanupFailures=0`, closing `FILE-006`.
- `test/l4-file-same-name-current-run.spec.js` passed `1/1` serially. Two concurrent same-name uploads to one run-scoped folder produced exactly one `200` and one `409`; list readback contained only the successful object. File and folder deletion through product APIs returned the manifest to `objects=[]`, `cleanupFailures=0`, closing `FILE-014`.
- `test/l4-wiki-unified-editor-current-run.spec.js` passed `1/1` serially. In `enforced` mode, the real Wiki card's authorization action opened the unified resource-access editor with base-permission and default-entry controls. Cancelling made no write: pre/post unified ACL snapshots were identical; the run-scoped space was product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`, closing `WIKI-025`.
- `test/l4-wiki-space-page-acl-current-run.spec.js` passed `1/1` serially after first establishing all run-scoped page/space snapshots before tightening ACLs. Three identities received only `wiki:read`, `wiki:read/update`, or `wiki:read/manage_acl`, each group-scoped to the resource owner group and separately primary in the named-ACL group. With space `r-x` and page `rw-` ACL entries for that named group, all read successfully, only writer updated, and only manager read unified page access. Page, space, assignments, memberships, users and roles were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`, closing `WIKI-021`.
- Two fresh `WIKI-024` fixture attempts confirmed that child-page creation now succeeds, but the full positive precondition remains unconstructible through public APIs: the unified ACL endpoint for a newly created child returns `403` before its access ACL can be configured. Adding a root default ACL did not copy a matching child access entry; retaining a management `x` entry on the root did not change the child endpoint result. All run-scoped page, space, role, user, membership and assignment fixtures were product-API reverse-cleaned. `WIKI-024` remains `NOT_RUN`, not PASS or FAIL, pending a product-contract-consistent way to establish the child resource ACL without bypassing public APIs.
- `test/l4-wiki-space-order-current-run.spec.js` passed `1/1` serially. Current API data contained system `readOnly` spaces; the real page rendered the system and team tiers. Two run-scoped team spaces were created, A was moved down through its real control, and a refresh retained B before A. Both run-scoped spaces were product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`, closing `WIKI-001`.
- `test/l4-ipam-group-scope-current-run.spec.js` passed `1/1` serially. A minimal `ip_pool:read` user scoped to group 1 listed and read its group-1 runId pool, while a runId pool belonging to another business group was absent from the keyword list and returned `403` by ID. Both pools, assignment, user and role were product-API reverse-cleaned; manifest `objects=[]`, `cleanupFailures=0`, closing `IPAM-009`.
- `test/l4-workflow-task-list-current-run.spec.js` passed `1/1` serially. Unified `/tasks/my` and `/tasks/group` reads returned task-summary arrays with the required identifiers; the real workflow-center page loaded and switched scopes, displaying the corresponding empty state or approval cards. No task completion, workflow definition, binding, configuration or test fixture write occurred; manifest remains `objects=[]`, `cleanupFailures=0`, closing `FLOW-003`.
- `test/l4-device-password-permission-current-run.spec.js` passed `1/1` serially. A run-scoped credential's authorized reveal returned `200` and created a `device/view_password` audit record with credential target and operator metadata; the response body was intentionally not read or recorded. A same-group identity holding only `device:read` could read the device but reveal returned `403`. Credential, device, CMDB prerequisites, assignment, user and role were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`, closing `DEVICE-006`.
- A `DEVICE-007` browser probe was interrupted before Playwright emitted a result, leaving its manifest-visible runId credential, device and CMDB prerequisite chain. Recovery immediately used only product DELETE APIs in dependency order (credential → device → CI → model → model group), all returning `200`; manifest now has `objects=[]`, `cleanupFailures=0`. It provides no copy/cancel conclusion, so `DEVICE-007` remains `NOT_RUN`.
- `DEVICE-007` was retried serially after correcting its test-row lookup and making its product-API cleanup idempotent. During both run-scoped fixture attempts, the browser did not stably render the credential row/copy control before the test timeout, so no copy/cancel assertion completed. Each run's credential deletion had already been accepted by the product API by teardown time; the remaining device, CI, model and model-group objects were independently reverse-cleaned through product DELETE APIs. A separate read-only probe of an existing device then reached its detail route, rendered `账号密码`, and had zero console errors, so the failed fixture attempts are not sufficient to establish a product defect. The manifest again reports `objects=[]`, `cleanupFailures=0`; `DEVICE-007` remains `NOT_RUN` pending a stable run-scoped UI reproduction.
- The final `DEVICE-007` serial rerun corrected the fixture to business group 2, which the device UI actually renders. Copy succeeded without placing plaintext in a visible code element; view, hide and view again completed, with the credential's `view_password` audit count increasing by exactly three. Cancelling the group add-account form and reopening it restored an empty username. Credential, device, CI, model and model group were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`, closing `DEVICE-007`.
- `test/l4-device-group-scope-current-run.spec.js` passed `1/1` serially. A group-2 scoped identity with only `device:read/update/view_password` saw its group-2 runId device in API and the real list page, while the group-3 device was filtered out. Same-group detail, update and password reveal succeeded; cross-group detail, update and reveal returned `403`, and superadmin readback proved the rejected update caused no change. Credentials, devices, CI instances, models, model groups, assignment, user and role were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`, closing `DEVICE-009`.
- `test/l4-file-update-consumer-current-run.spec.js` passed `1/1` serially. A group-scoped `shared_file:read+update` identity renamed a run-scoped file through the canonical `PUT /api/files/{id}` consumer; a separate `read+manage` identity without `update` received `403`, and readback retained the allowed name. The update-only real file page exposed rename but not move, matching the layered contract. File, folder, assignments, users and roles were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`, closing `FILE-016` and superseding the remediation-before `MISSING_CONSUMER` snapshot.
- `test/l4-cmdb-export-permission-current-run.spec.js` passed `1/1` serially and closes one former permission-consumer gap without claiming the aggregate matrix complete. A tenant-scoped `cmdb_instance:export`-only role downloaded non-empty UTF-8 CSV with the expected MIME and filename while remaining unable to list instances; a `cmdb_instance:read`-only role received `403` from export. Assignments, users and roles were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`. This is supporting evidence for `RBAC-010/013`, which remain `NOT_RUN` until every live action row is covered.
- `test/l4-daily-scope-calendar-current-run.spec.js` passed `1/1` serially. Three runId drafts on the same backend-safe UTC date belonged to two group-2 reporters and one group-3 reporter. A member's `/my` and real calendar showed only self; a group-2 approver's `/group` and calendar showed both group-2 reports but not group 3; superadmin's tenant-wide `/group` and `全部日报` calendar showed all three. Previous/current month navigation and date expansion passed in each browser context. Reports, assignments, users and roles were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`, closing `DAILY-001`.
- `test/l4-daily-input-boundaries-current-run.spec.js` passed `1/1` serially. Work-hour bounds `0` and `24` persisted on two dates; duplicate same-day, missing date, future date, `-0.1` and `24.1` each returned `400`, and runId readback contained exactly the two valid drafts. The real form rendered its required-date error, native max prevented `24.5`, then a valid work-hour with a future date surfaced `日报日期不能晚于今天`; no UI attempt created a report. Reports, assignment, user and role were reverse-cleaned through product APIs; manifest `objects=[]`, `cleanupFailures=0`, closing `DAILY-003`.
- Remaining coverage includes break-glass, authorization migration writes, external configuration/provider writes and actual backup restore. These actions are outside automatic authorization even when locally recoverable.
- The exact requested scope, case IDs, restoration evidence and destructive restore boundary are recorded in `HIGH-RISK-AUTHORIZATION-REQUEST.md`. No such action has been executed in this run.

## FLOW-007 BPMN editor metadata round-trip failure

- `test/l4-workflow-bpmn-roundtrip-current-run.spec.js` used a run-scoped definition with complete BPMN DI, loaded the real editor, exercised zoom, selected the UserTask and SequenceFlow, and entered v2 metadata plus assignment/condition values.
- Saving created version 2, but `GET /api/workflow/definitions/key/{key}/versions` returned the original v1 `name` and `category` for v2 instead of the edited values. This violates the approved `REM-P1-023 AC-002` round-trip contract, so `FLOW-007` is `FAIL`; `FLOW-008` remains `NOT_RUN` because execution stopped before final XML assertions.
- Every attempted run deleted all versions through `DELETE /api/workflow/definitions/{definitionId}`. Follow-up list/version reads found no run-scoped definition; `test-data-manifest.json` is `objects=[]`, `cleanupFailures=0`.
- L4 expansion stops. The defect is mapped to `REM-P1-040`; after its independent L1-L3 cycle and merge, the affected `FLOW-007/008` scope must be rerun from the new integration baseline.

## FLOW-007/FLOW-008 post-merge closure

- `REM-P1-040` event `30d3e264` merged no-ff as `d749f996`. A fresh post-merge serial run of `test/rem-p1-040-workflow-metadata-roundtrip.spec.js` passed `1/1` in 2.6 seconds.
- The real editor retained v2 name/category/description, assignee, candidateGroups and conditionExpression through API readback and a second UI load. `FLOW-007` and `FLOW-008` are PASS; the historical failure remains recorded above and in `defects.md`.
- The workflow definition and every version were deleted through the product API; event and L4 manifests are both `objects=[]`, `cleanupFailures=0`. The formal `wiki_page -> remp1038wiki` policy was unchanged.

## FLOW-013 workflow statistics reconciliation

- `test/l4-report-stats.spec.js` and `test/l4-statistics-readonly.spec.js` passed `2/2` serially in 3.4 seconds. The full stats array and each process-key detail endpoint agreed on total/running/finished counts; the real page rendered the applicable cards or empty state without Console errors.
- The same read-only run retained `REPORT-003` CMDB source reconciliation. No workflow instance, definition, report, audit, role or configuration was written; both manifests remain empty. `FLOW-013` is PASS.

## DAILY-008 / XL-EXPORT-001 daily workbook export

- `test/l4-daily-export-current-run.spec.js` passed `1/1` serially in 5.7 seconds with separate group-scoped export-only and read-only identities. Export-only downloaded through API and real `/reports` UI; read-only and anonymous requests returned `403`, the read-only navigation was hidden and direct route returned home.
- Group scope forced effective `groupId=2`; requested group 3 returned `403`. Malformed and reversed dates returned `400`; denied/invalid attempts created no export audit. The two successful exports created exactly two expected audit rows for the export user.
- The future empty-range XLSX retained a non-empty `工作日报` sheet with Chinese range title and all seven headers, UTF-8 Content-Disposition and the expected Chinese browser filename. This closes `DAILY-008` and `XL-EXPORT-001` without relying on historical workbook evidence.
- Role assignments, users and roles were product-API reverse-cleaned; readback found users=0 and roles=0. Manifest is `objects=[]`, `cleanupFailures=0`.

## AUTH-010 startup session invalidation policy

- `test/l4-auth-startup-session-policy-current-run.spec.js` passed `1/1` serially in 23.6 seconds. With `AUTHORIZATION_INVALIDATE_SESSIONS_ON_STARTUP=true`, only backend was force-recreated; the old test-account token returned `401` on its next request while epoch invalidation retained the Redis session record until TTL.
- After a fresh login, superadmin granted the run-scoped account a minimal `cmdb_instance:read` group assignment through product APIs. With the setting restored to `false`, only backend was recreated again; the exact pre-restart token remained valid and its next CMDB request returned `200`, proving current permissions were reloaded rather than frozen at login.
- Frontend, PostgreSQL, Redis, MinIO and Nginx container IDs remained unchanged throughout. The `finally` recovery recreated backend once more with the original `false` setting, confirmed health and the startup preservation log, then product-API deleted assignment, user and role. Manifest is `objects=[]`, `cleanupFailures=0`; `AUTH-010` is PASS. The older `FQA_20260712_0329_lintfix` ledger's idle-timeout wording is historical and does not override the current catalog contract.

## FILE-013 cancelled upload cleanup

- `test/l4-file-upload-cancel-current-run.spec.js` passed `1/1` serially in 2.1 seconds. The browser delayed the real multipart upload request, exposed the live `取消上传` control, and cancelled through the product UI before the request reached backend.
- The UI displayed `已取消上传` and returned to an enabled upload control. Product API keyword readback contained zero files, and a full browser refresh showed no runId filename or ghost row. The run-scoped folder was product-API deleted; manifest is `objects=[]`, `cleanupFailures=0`; `FILE-013` is PASS.

## Ledger catalog-membership correction

- A full catalog-to-ledger set audit found `XL-WIKI-001..004` incorrectly listed under functional PASS even though the four IDs belong only to the 78-case cross-module/state catalog. Their existing runs cover useful subsets but not each complete XL contract, so they are not moved to state PASS and remain implicitly `NOT_RUN` there.
- Historical execution notes remain unchanged as partial evidence. The corrected functional count is `185 PASS / 90 NOT_RUN`; state remains `19 PASS / 58 NOT_RUN / 1 N/A`. Functional and state explicit-status IDs now belong exclusively to their respective catalogs.

## COMMON-011 generic download integrity

- No completed case was rerun. Current-run `DAILY-008/XL-EXPORT-001` evidence already validated non-empty XLSX content, MIME, UTF-8 Content-Disposition, the expected Chinese browser filename, Chinese workbook title and headers. Current-run `FILE-007` independently proved downloaded bytes exactly matched the run-scoped upload.
- Both source fixture chains were product-API reverse-cleaned with empty manifests. Together they cover the generic non-empty/filename/MIME/encoding contract; `COMMON-011` is PASS.

## COMMON-005 cancelled delete

- The initial probe timed out only because its test locator assumed a dynamic accessible name; `finally` product-API cleanup succeeded and the manifest returned empty. After correcting the locator to the product button's fixed `删除文件夹` title, `test/l4-common-delete-cancel-current-run.spec.js` passed `1/1` serially in 1.9 seconds.
- Dismissing the real native confirmation emitted zero folder DELETE requests. The runId folder remained visible in the file tree and present in product API readback, then was product-API deleted in teardown; manifest is `objects=[]`, `cleanupFailures=0`; `COMMON-005` is PASS.

## COMMON-003 save then immediate refresh

- `test/l4-common-save-refresh-current-run.spec.js` passed `1/1` serially in 2.0 seconds. The real folder edit dialog saved a runId rename and rendered exactly one `文件夹已更新` success toast.
- An immediate full page refresh retained the new name and removed the old name; product API folder-tree readback matched the refreshed UI. The folder was then product-API deleted and the manifest returned to `objects=[]`, `cleanupFailures=0`; `COMMON-003` is PASS.

## COMMON-009 dialog draft reset failure

- `test/l4-common-dialog-close-current-run.spec.js` opened the real `新建文件夹` dialog, entered `ESC_DRAFT`, closed it with Escape, and reopened it. The input retained `ESC_DRAFT` instead of resetting empty, so the remaining overlay/X/cancel variants were not inferred and `COMMON-009` is FAIL.
- The test emitted zero folder POST requests and created no business object; manifest remained `objects=[]`, `cleanupFailures=0`. L4 expansion stops and the defect is mapped to independent event `REM-P1-041`.

## COMMON-009 post-merge closure

- `REM-P1-041` event `1d2b50bd` merged no-ff as `014a3e2d`. The continuation branch was created from that exact integration head; the running frontend was the event-branch image already validated during L3.
- `test/l4-common-dialog-close-current-run.spec.js` passed `1/1` serially in 3.0 seconds. Escape, overlay, X and cancel each discarded the draft; every reopen was empty and folder POST count remained zero.
- No business object, authorization, configuration or test identity was created. The formal `wiki_page -> remp1038wiki` policy with `superadmin` approver remained unchanged.

## DAILY-005 and DAILY-009 accelerated expansion

- `DAILY-005` passed: one run-scoped draft associated two existing readable CIs, retained both IDs and summaries, then persisted one and zero associations on update. The report was product-API purged and manifest returned empty.
- `DAILY-009` failed: two simultaneous submit requests both returned 200 instead of exactly one success. Source confirmation shows `DailyReportService.submit` reads DRAFT without a row lock, starts workflow, then writes SUBMITTED.
- The failed report, workflow business/runtime/history records and notifications were removed through the remediation product endpoint. Manifest is `objects=[]`, `cleanupFailures=0`; L4 stops for independent `REM-P1-042`.

## DAILY-009 post-merge closure

- `REM-P1-042` event `07a24f30` merged no-ff as `95e6fff6`; the continuation branch is based on that exact integration head.
- `test/l4-daily-ci-idempotency-current-run.spec.js` passed `2/2` in 2.1 seconds. Concurrent submit produced exactly one 200, one 400 and one task; concurrent approval produced one success and final APPROVED.
- `DAILY-005` remained PASS. Product remediation cleanup removed the report, workflow records and notifications; manifest is `objects=[]`, `cleanupFailures=0`.

## Authorized authorization and external configuration expansion

- The user approved preserving effective `platform super_admin` ACL passthrough and reconciling the break-glass contract. Fresh lifecycle Playwright passed reason boundaries, two-session key isolation, activate/deactivate audit and exact cleanup. Actual ACL/traverse bypass is `N/A` because no non-passthrough platform identity is product-reachable; no bypass audit was fabricated.
- Authorized migration writes passed serially: pending primary-group repair, prepared exception, acceptedLegacy strict-Enforce rejection, root-cause repair, resolved status, two reconciled backfills, lineage and shadow/exception rollout semantics. Every temporary user/role was product-API deleted; final mode is `enforced`, epoch `30`, strict preflight has no issues or permission diffs, and manifest is empty.
- Isolated Mailpit delivery, Prometheus scheduler-to-MockServer execution, AI fixed reply and explicit API-key clearing passed in 42.3 seconds. SMTP, Prometheus and deepseek fields were independently read back at their exact original values; the run-scoped daily report was purged and manifest remained empty.

## CONFIG-002 SMTP boundary failure

- A fresh boundary probe sent host `bad host with spaces` to `PUT /api/admin/config/smtp`. The API returned 200 and persisted it instead of rejecting HTTP 400, so `CONFIG-002` is FAIL and L4 expansion stops.
- The invalid value was immediately replaced with the frozen baseline using the product SMTP endpoint. Independent readback confirms disabled SMTP, empty host/username/password/from, port 465, from-name `IT运维平台` and SSL true; no runId business object remains.
- The defect is mapped to independent `REM-P1-043`; historical failure evidence remains while affected-scope L4 will rerun after its event passes L1-L3 and merges to `lint-fix`.

## CONFIG-002 post-merge closure

- `REM-P1-043` event `97e786ca` merged no-ff as `08a3df96`; the L4 continuation branch was created from that merge head.
- Post-merge Playwright passed `1/1` in 8.2 seconds. Seven invalid host/port/from payloads returned 400 before writes; the real configuration page received `SMTP 主机名格式不正确`, emitted no success toast, and had no unexplained Console error.
- Valid Mailpit configuration and actual daily approval email passed. The frozen SMTP baseline was restored exactly, the runId report was purged through the product API, and manifest remains empty. `CONFIG-002` is PASS; historical failure remains above.

## BACKUP-004 restore authorization boundary

- `test/l4-backup-restore-cancel-current-run.spec.js` passed `1/1` in 1.1 seconds. The real `/admin/backup` UI opened the destructive restore warning for an existing successful backup, cancellation closed the dialog, and the browser emitted zero `POST /api/backups/{id}/restore` requests.
- Actual restore remains intentionally unexecuted under the user's explicit no-restore instruction. Permission denial is already covered by `BACKUP-003`; therefore `BACKUP-004` is recorded as `N/A`, never as PASS. No business object, backup, configuration, authorization state or manifest entry was created or changed.

## REM-P1-044 OPS task/state continuation

- After REM-P1-044 event `85181ebf` merged no-ff as `5e3ebe46`, the same L4 run resumed without rerunning unaffected PASS cases.
- `test/l4-ops-task-state-gap-current-run.spec.js` passed `6/6` serially in 6.8 seconds. It covered manual task creation/readback/UI detail, invalid input no-write, equal/cross-year time boundaries, confirm/start/auto-confirm/complete, exception close, cancel, duplicate terminal rejection, logs/audit, group/tenant stats, material export and anonymous denial.
- The complete covered set is `OPS-003`, `OPS-005`, `ST-OPS-001/002/003/005/006/008/009/010/012/013/014`. Every runId task was removed through the product remediation API and the shared manifest ended with `objects=[]`, `cleanupFailures=0`.
- `OPS-004/006/007/008/009/010/017/018/019`, `OPS-016` and `ST-OPS-004/007/011` remain NOT_RUN where their full contracts need maximum boundaries, low-permission/cross-group credentials, overdue control or roster lifecycle cleanup.

## ST-OPS overdue scheduler edges

- `test/l4-ops-overdue-state-current-run.spec.js` passed `1/1` in 10.8 seconds. Three runId tasks began as pending_confirm, not_started and in_progress; the real minute scheduler marked all three overdue and wrote overdue logs.
- From overdue, start produced in_progress, complete produced completed with result metadata, and close-exception produced exception_closed with reason/risk. This closes `ST-OPS-004/007/011`, completing all 14 ST-OPS edges.
- All three tasks were product-API purged through REM-P1-044 and manifest returned to `objects=[]`, `cleanupFailures=0`.

## OPS-016 post-REM-P1-045 continuation

- REM-P1-045 event `ca2f9c7f` merged no-ff as `51239de6`; the approved accelerated continuation contract merged as `4aee460e`. The same run resumed with `197+34` unaffected current-run PASS evidence retained and no denominator reset.
- Full `OPS-016` replay sent a reverse-time roster (`18:00 -> 09:00`). The API returned `200` instead of the required `400`, so `OPS-016` is `FAIL`; the later CRUD assertions were not executed and are not promoted from the event-level partial test.
- The returned roster id was captured before the assertion and deleted in `finally` through `DELETE /api/ops-calendar/rosters/{id}/remediation-test`. Read-only SQL found zero active `REM_P1_045_%` rosters; manifest remains `objects=[]`, `cleanupFailures=0`.
- L4 stops for independent `REM-P1-046`; historical failure trace remains at `/tmp/fqa-2050-ops016-after-rem-p1-045/.../trace.zip`.

## OPS-016 post-REM-P1-046 closure

- REM-P1-046 event `367b594a` merged no-ff as `1cfccf0e`; the same L4 run resumed from that integration point without resetting unaffected PASS evidence.
- `test/rem-p1-045-ops-roster-remediation-cleanup.spec.js` passed `1/1`: reverse create and equal-time update rejected before writes, valid same-day create and cross-day update read back correctly, and primary/backup assignees plus phone were preserved.
- Wrong runId cleanup retained the row, correct cleanup removed it and wrote audit, repeated cleanup rejected. Active runId roster count is zero; manifest remains `objects=[]`, `cleanupFailures=0`; `OPS-016` is PASS.

## OPS-004 task title boundary failure

- A serial current-run probe created and read back a 255-character title, then submitted 256 characters. The overlength request returned HTTP `409`, not the required stable `400` validation response, so `OPS-004` is `FAIL` and L4 stops.
- `test/l4-ops-task-state-gap-current-run.spec.js --grep ops004TitleMaximumAndOverlength` reproduced expected `400` / received `409`; trace is under `/tmp/fqa-2050-ops004-title-boundary`.
- The accepted maximum-length task was captured in the shared manifest and product-API purged in `finally`; active `OPS_GAP` task count is zero and manifest is `objects=[]`, `cleanupFailures=0`.
- The independent event must make the currently unspecified content maximum explicit; L4 does not invent a product limit while recording this title defect.

## OPS-004 post-REM-P1-047 closure

- REM-P1-047 event `9f15ba68` merged no-ff as `00f342a5`; nine same-run evidence commits were replayed in order onto the new integration baseline, ending at `aadd4188`. No new runId was created and unaffected PASS evidence was retained.
- `test/l4-ops-task-state-gap-current-run.spec.js --grep ops004` passed `3/3` at `/tmp/fqa-2050-ops004-post-rem-p1-047`; `test/rem-p1-047-ops-task-text-boundaries.spec.js` passed `2/2` at `/tmp/fqa-2050-ops004-update-post-merge`.
- Coverage includes UI whitespace and 256-code-point zero POST, create/update 255 Unicode code points, create/update 256 and blank update HTTP 400, unchanged task/audit on rejection, empty content, and 65,536-character PostgreSQL `TEXT` content exact roundtrip.
- Product remediation cleanup completed after each write. Shared manifest is empty; read-only SQL found zero active runId tasks and zero participant/checklist/log/link/notification dependencies; backend logs contain no ERROR, DataIntegrityViolation or value-too-long. `OPS-004` is PASS and L4 resumes with 75 functional plus 43 state NOT_RUN.

## OPS scope, statistics and export matrix

- `test/l4-ops-scope-export-current-run.spec.js` created three run-scoped identities through product APIs: a group leader with read/read_group/export, a tenant identity with read/read_all/export, and an authenticated read-only identity without export. It also created one runId task in each of two dynamically selected business groups.
- `OPS-019` passed: the no-export identity received HTTP 403 for materials, XLSX export and stats APIs; the ops menu hid both export entries, the materials route redirected and the stats route rendered its API-denial state without Console errors. Existing current-run superadmin XLSX evidence supplies the positive half.
- `OPS-018` passed: the tenant identity's all-task statistics and both per-group statistics exactly matched task-list aggregates; an empty historical range returned the exact zero aggregate.
- `OPS-017` failed: the group leader's task list and stats ignored a forged other-group ID and remained in its own group, but report-material collection without groupId returned tenant-wide items. The material endpoint also accepted a forged other-group groupId. This violates the group-only list/stat/export contract.
- The first browser attempt timed out on an incorrect test assumption that the stats page redirects; API denial had already passed and teardown returned the manifest empty. The corrected rerun produced `2 PASS / 1 FAIL` in 6.1 seconds at `/tmp/fqa-2050-ops-scope-export-rerun`.
- Both tasks, three assignments, three users and three roles were removed in reverse dependency order through product APIs. Shared manifest is `objects=[]`, `cleanupFailures=0`. L4 pauses for independent `REM-P1-048`; unaffected current-run PASS remains retained.

## OPS-017 post-REM-P1-048 closure

- REM-P1-048 event `3e7667a3` merged no-ff as `aa17a6f6`; the same L4 run resumed from that integration point without resetting unaffected PASS evidence.
- The enhanced L4 affected-only scenario passed `1/1` in 7.3 seconds at `/tmp/fqa-2050-ops017-after-rem-p1-048`; event-level confirmation also passed in 6.9 seconds at `/tmp/fqa-2050-ops017-post-rem-p1-048`. A real group leader saw only its authenticated group's task list, statistics, material JSON, omitted-group export, forged-other-group export and materials-page download, while tenant full/explicit-group exports remained compatible.
- The other group's title was absent from every material/XLSX path; the group-leader browser had zero Console/API failures. Shared/event manifests are `objects=[]`, `cleanupFailures=0`; `OPS-017` is PASS and the historical failure above remains preserved.

## OPS-006 cross-group task-detail failure

- The preserved serial role/scope probe first proved a group-3 ordinary reader's `mine` list excluded a group-2 sensitive group task, then directly requested that task id. The detail endpoint returned HTTP `200` rather than the required scope denial, so `OPS-006` is `FAIL` and L4 stops.
- Source tracing confirms `OpsCalendarTaskService.detail` calls `canViewDetail` only to decide field masking; it still constructs and returns a `TaskDetailVO` when the caller is outside the task's list-visible scope.
- Evidence: ignored `test/l4-ops-role-scope-current-run.spec.js`; `/tmp/fqa-2050-ops-role-scope-r3/.../trace.zip`. Finally cleanup product-API purged all tasks, assignments, users and roles; shared manifest is `objects=[]`, `cleanupFailures=0`.

## OPS-006 post-REM-P1-049 closure

- REM-P1-049 event `92eaf9a4` merged no-ff as `dd447b55`; the same L4 run resumed from that integration point without resetting unaffected PASS evidence.
- With `FQA_OPS006_ONLY=1`, the combined role/scope asset skipped its unrelated aggregate scenario and ran the focused OPS-006 scenario: 1 PASS / 1 expected SKIP in 8.7 seconds at `/tmp/fqa-2050-ops006-after-rem-p1-049`.
- A group-3 ordinary reader excluded group-2 private/group-sensitive tasks from `mine` and received non-enumerating 400 on direct-id detail. Public detail retained its title but omitted protected content/participants/checklist/links/logs; creator, own-group read_group and tenant read_all retained full content. Denied/public browser paths leaked no protected content and had zero page error/5xx.
- All tasks, assignments, users and roles were removed through product APIs. Shared manifest is `objects=[]`, `cleanupFailures=0`; readback found zero runId users/roles/tasks and backend logs had no ERROR/Exception. `OPS-006` is PASS; L4 continues with 71 functional and 43 state cases still NOT_RUN.

## OPS-007 cross-group assignee candidate failure

- The full role/scope aggregate ran serially on `lint-fix@dd447b55`. API setup created a group-2 task assigned to a group-3 user and readback confirmed the cross-group assignee relationship.
- In the real group-2 creator UI, opening `新建任务` and the `负责人` selector did not show that group-3 user. `TaskFormDialog` uses the generic scoped `/api/users` list, so the selectable range is narrower than the accepted task API range.
- Playwright failed at the candidate visibility assertion after 15.0 seconds; trace is under `/tmp/fqa-2050-ops-role-scope-complete-after-rem-p1-049/.../trace.zip`. All created tasks, assignments, users and roles were product-API reverse-cleaned; shared manifest is empty and backend has no unexplained error.
- `OPS-007` is FAIL and L4 stops for independent `REM-P1-050`; already valid `OPS-006/017/018/019` evidence remains unaffected.

## OPS-007 post-REM-P1-050 closure and OPS-010 failure

- REM-P1-050 event `ba5e4740` merged no-ff as `7af9f24a`; the same L4 run retained unaffected PASS evidence and resumed the serial role/scope aggregate.
- The first resumed attempt passed cross-group candidate visibility and assignee readback, then exposed a representation-only assertion mismatch: global Jackson `non_null` omits null `assigneeId`. The assertion was reconciled to nullish semantics without changing product code or the OPS-007 contract.
- The compatible rerun passed all OPS-007 points: real cross-group candidate, API/detail assignee parity, no-assignee validity, zero page errors and exact cleanup. It then failed OPS-010 because two confirm POSTs from a real double-click both committed and produced two confirm logs.
- Evidence: `/tmp/fqa-2050-ops007-after-rem-p1-050-final/.../trace.zip`; expected one confirm log, received ids 163/164. All tasks, assignments, users and roles were product-API reverse-cleaned; shared manifest is empty and backend has no unexplained ERROR/Exception.
- `OPS-007` is PASS, `OPS-010` is FAIL, and L4 stops for independent `REM-P1-051`; totals are `204 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 69 NOT_RUN` plus state `34 PASS / 0 FAIL / 1 N/A / 43 NOT_RUN`.

## OPS-010 post-REM-P1-051 closure

- REM-P1-051 event `305d527e` merged no-ff as `73ec4273`; L4 continuation `2bee17e3` has parents `73ec4273` and failure snapshot `5dc89ca2`, preserving the same run and unaffected evidence.
- The authoritative `test/l4-ops-role-scope-current-run.spec.js` passed `1/1` with `1` expected skip in 13.6 seconds at `/tmp/fqa-2050-ops010-after-rem-p1-051`. Real double-click reached `not_started`, refresh removed confirm, and detail exposed exactly one confirm log.
- All tasks, assignments, users and roles were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`, and backend logs contain no unexplained ERROR/Exception. `OPS-010` is PASS; totals are `205 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 69 NOT_RUN` plus state `34 PASS / 0 FAIL / 1 N/A / 43 NOT_RUN`.

## XL-RBAC-009 membership revocation

- `test/l4-rbac-membership-revocation-current-run.spec.js` passed `1/1` in 2.4 seconds at `/tmp/fqa-2050-xl-rbac-009`.
- Membership removal revoked group-scoped assignment effects for the old session and new login across Wiki/file access. Assignment, user and role were product-API reverse-cleaned; shared manifest is empty. State totals are `35 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 42 NOT_RUN`.

## OPS-008/009 aggregate closure

- `test/l4-ops-task-state-gap-current-run.spec.js --grep ops008010AndStOpsNonOverdueEdges` passed `1/1` in 2.8 seconds at `/tmp/fqa-2050-ops008-after-rem-p1-051`; together with all 14 current-run ST-OPS PASS edges this completes `OPS-008`.
- The authoritative role/scope aggregate completed `OPS-009`: non-assignee confirm/start/complete/cancel all returned 400, detail state/logs remained unchanged, and the real UI hid all four controls. All tasks/RBAC fixtures were product-API reverse-cleaned; shared manifest is empty. Functional totals are `207 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 67 NOT_RUN`.

## NOTICE-001/003 lifecycle

- `test/l4-notification-lifecycle-current-run.spec.js` passed `1/1` in 1.1 minutes at `/tmp/fqa-2050-notice-001-003-final`. Two earlier coordination attempts were cleaned: the first used isolated browser contexts for a BroadcastChannel assertion; the second stopped before writes on a test variable shadow.
- Four run-scoped notifications proved list pagination, single/all-read idempotency and exact unread counts. Two tabs in one browser context observed new/read state within the supported 30-second polling interval, and logout broadcast redirected both to login.
- Each notification-producing daily report was product-API purged, which removed linked notifications; assignment, user and role were reverse-cleaned. Shared manifest is empty. Functional totals are `209 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 65 NOT_RUN`.

## COMMON-001 and XL-EXPORT-005 evidence aggregation

- `COMMON-001` closes from independent current-run Ops and daily chains: real confirm double-click produced one transition/log after REM-P1-051; concurrent daily submit and approval each produced one accepted action, one rejected duplicate, one workflow task and one terminal report state.
- `XL-EXPORT-005` closes from current-run OPS task/state and scope/export evidence: material task IDs/counts equal task-list rows, statistics reconcile status/group/assignee summaries and empty range, group/tenant scopes hold, and XLSX is a valid attachment. All run-scoped fixtures were product-API cleaned.
- Totals are functional `210 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 64 NOT_RUN`, state `36 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 41 NOT_RUN`.

## XL-WIKI-002 link graph

- `test/l4-wiki-link-graph-current-run.spec.js` passed `1/1` in 1.8 seconds at `/tmp/fqa-2050-xl-wiki-002-rerun`. Source and target pages were formally approved/published before graph validation.
- Known and unknown links rendered, a real known-link click navigated A to B, backlinks contained A and graph contained both nodes plus A→B. Initial draft-only graph and empty-page heading assumptions were test coordination failures; both finally chains cleaned all objects.
- Pages and space were product-API deleted; manifest is empty. State totals are `37 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 40 NOT_RUN`.

## XL-WIKI-004 comment lifecycle

- `test/l4-wiki-comments-cross-role-current-run.spec.js` passed `1/1` in 3.7 seconds at `/tmp/fqa-2050-xl-wiki-004-rerun`. The same page held 21 authored comments, producing exact 20+1 API pagination.
- A run-scoped `wiki:read` non-author received `canDelete=false`; its DELETE returned HTTP 403 and preserved total 21. The real superadmin UI displayed 21, loaded the second page, deleted one comment, and refreshed drawer and launcher counts to 20.
- Deleting the page removed all remaining comments. Space, assignment, user and role were then product-API reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`. The first attempt timed out because `title="查看评论"` is not the button's accessible name; its finally chain also cleaned all objects and no product defect was recorded. State totals are `38 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 39 NOT_RUN`.

## CMDB endpoint and Change template guards

- `test/l4-cmdb-remaining-contracts-current-run.spec.js` passed `1/1` in 898ms at `/tmp/fqa-2050-cmdb-remaining`. One source/destination fixture created an endpoint link; a second link reusing the source UID returned HTTP 400, both instance endpoint lists agreed on peer and UIDs, and deletion removed the relationship from both views. Product API reverse-cleaned the link, instances, models and model group, closing `CMDB-038` and `XL-CMDB-010`.
- `test/l4-change-workflow-remaining-current-run.spec.js` initially stopped on a test-only 400 expectation because the established state-conflict contract returns 409. The catalog requires rejection rather than a specific status; after reconciling the asset, it passed `1/1` in 827ms at `/tmp/fqa-2050-change-remaining-rerun`. Pending update/delete/re-submit all returned 409 and preserved title/status/snapshot count. Referenced template deletion returned 400 and preserved the template, closing `CHANGE-018`; `CHANGE-010` remains NOT_RUN pending its real UI denial path.
- `test/l4-common-config-notice-remaining-current-run.spec.js` initially restored the exact watermark semantics but compared absent baseline keys with the API's materialized defaults. Current state was verified as baseline-equivalent and the test-only cleanup counter was reconciled. The normalized rerun passed `1/1` in 2.6 seconds at `/tmp/fqa-2050-common-config-remaining-rerun`: all five position labels, save/readback/refresh and exact product-API restore passed with zero Console/5xx. `CONFIG-004`, `COMMON-008` and `COMMON-012` remain NOT_RUN because immediate page effect/angle and full-platform generic coverage are incomplete.
- Shared manifest is `objects=[]`, `cleanupFailures=0`. Totals are functional `212 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 62 NOT_RUN`, state `39 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 38 NOT_RUN`.

## DAILY-007 cross-group approval denial

- `test/l4-daily-cross-group-approval-current-run.spec.js` first proved the denial but used the wrong representation-only `PENDING` expectation; the product status is `SUBMITTED`. Its finally chain cleaned all fixtures. The rerun compared pre/post status and passed `1/1` in 4.8 seconds at `/tmp/fqa-2050-daily-007-rerun`.
- A group-2 approver did not receive the group-3 task, direct complete returned HTTP 400, the report status was unchanged, and the real detail page exposed no approval button or 5xx. Report, assignments, users and roles were product-API reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`. Functional totals are `213 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 61 NOT_RUN`.

## File ACL lifecycle and authorization exception aggregation

- `test/l4-file-acl-lifecycle-current-run.spec.js` passed `1/1` in 8.5 seconds at `/tmp/fqa-2050-file-acl-lifecycle-final`. Owner mode, named-user deny, two-group permission union, others mode and a separate cross-group isolation folder closed `FILE-010/017`.
- Parent default ACL copied to the first child; changing the parent did not alter that child, while the second child received only the new default. A file then passed upload, preview, byte-exact download, rename, move and delete; direct file rwx could not bypass an ancestor lacking x and returned `ANCESTOR_TRAVERSE_DENIED`. This closes `FILE-018` and `XL-FILE-001/002`.
- Three earlier asset-coordination attempts were fully cleaned: two exceeded the 64-character user-field boundary, and one attempted a move into the intentionally read-only inherited child. No product defect was recorded. Every finally chain returned manifest to `objects=[]`, `cleanupFailures=0`.
- Existing current-run authorized migration evidence completes `ST-AUTHZ-005/017`: acceptedLegacy remained an unresolved strict-preflight blocker, Enforce returned 409, and Wiki/shared_file rollout stayed exception until controlled resolution. Final authorization state remains enforced and the manifest is empty. Totals are functional `216 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 58 NOT_RUN`, state `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`.

## CMDB-040 live-reference deletion failure

- `test/l4-cmdb-reference-delete-guard-current-run.spec.js` created one run-scoped model/instance and an active change document whose `ci-links` response contained the instance. The authoritative delete request returned HTTP 200 instead of the required business rejection, proving a dangling business reference can be created.
- The first process invocation was externally timed out after one second before writes; the second attempt stopped on the test-only `instanceId` versus response `id` shape assumption. Both cleanup chains returned the shared manifest empty. The final product-failure trace is `/tmp/fqa-2050-cmdb040-reference-delete-final`.
- The document was removed through the strict remediation-test product endpoint; the already-soft-deleted instance and remaining model/group were reconciled through product APIs. Manifest is `objects=[]`, `cleanupFailures=0`. `CMDB-040` is FAIL; functional totals are `216 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 57 NOT_RUN`, and L4 pauses for `REM-P1-052`.

## CMDB-040 same-run affected-only closure

- `REM-P1-052` event `b79db71b` merged no-ff into `lint-fix` as `0049d1ec`; continuation snapshot `49dd0470` restored this run without resetting unaffected PASS evidence.
- A first invocation was externally terminated by the command harness after one second while entering the test; its finally chain left the manifest empty. The completed serial rerun passed `1/1` in 1.0 seconds at `/tmp/fqa-2050-cmdb040-after-rem-p1-052`.
- The active change document retained the CI link, DELETE returned HTTP 400, and the instance remained readable. Product API cleanup removed document, instance, model and group; manifest is `objects=[]`, `cleanupFailures=0`, authorization is `enforced` and break-glass is inactive.
- `CMDB-040` is PASS. Functional totals are `217 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 57 NOT_RUN`; state totals remain `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`.

## Isolated external configuration continuation

- A first run reached the Prometheus scheduler poll but the default 60-second Playwright timeout expired before the asset's 75-second poll budget; finally restored all configuration and cleaned the daily report. A subsequent one-second command-harness termination also left the manifest empty. The test asset now explicitly allows 90 seconds; no product code changed.
- The serial rerun passed `1/1` in 18.3 seconds at `/tmp/fqa-2050-external-config-after-rem-p1-052-rerun`: Mailpit received the report notification, Prometheus scheduler contacted `external-api-mock` without sync errors or alert changes, and the DeepSeek provider selected the isolated model and returned `isolated mock reply` before key clearing.
- Exact readback after finally is SMTP disabled/empty/465, Prometheus disabled/empty/60, and DeepSeek disabled/unconfigured with its original URL/model/prompt. Manifest is `objects=[]`, `cleanupFailures=0`; no secret appears in evidence.
- `CONFIG-005` and `AI-001` are PASS. `CONFIG-001/003` and `AI-002/003` remain NOT_RUN because their full pre-existing-secret, notification template/period, invalid-boundary and business-failure UI contracts were not all exercised. Functional totals are `219 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 55 NOT_RUN`.

## Authorized account migration continuation

- With the user's standing authorization for migration actions 1-3 and full-tenant rollback -> enforced, `test/l4-authz-migration-write-current-run.spec.js` passed `1/1` in 1.8 seconds at `/tmp/fqa-2050-authz-migration-after-rem-p1-052`.
- A repaired pending account synchronized primary membership and compatibility assignment. A second account produced a prepared exception, persisted acceptedLegacy and note, blocked Enforce with HTTP 409, then resolved after membership repair; two reconciled backfills remained idempotent. Read-only PostgreSQL checks proved two active assignments, lineage for both runs, and four account rollout rows.
- Product APIs deleted both users and the runId role. Final cutover is enforced at epoch 32, strict preflight is eligible with no issues, break-glass is inactive and manifest is `objects=[]`, `cleanupFailures=0`.
- `AUTHZ-004/006/007/009` are PASS; resource backfill `AUTHZ-005` and cleanup/convert `AUTHZ-008` remain NOT_RUN. Functional totals are `223 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 51 NOT_RUN`.

## Workflow definition lifecycle continuation

- A new current-run asset reused the verified REM-P1-024 product contract without changing product code. `test/l4-workflow-definition-lifecycle-current-run.spec.js` passed `1/1` in 987ms at `/tmp/fqa-2050-flow012-after-rem-p1-052`.
- The run deployed two versions under a unique key, proved suspended-start rejection, activated v2 and started one instance, proved running-instance all-version deletion rejection with both versions intact, terminated the instance through the product API, confirmed finished history, and deleted all versions non-cascade.
- Manifest is `objects=[]`, `cleanupFailures=0`; backend had no unexplained ERROR/Exception and no workflow binding changed. `FLOW-012` is PASS. Functional totals are `224 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 50 NOT_RUN`.

## FLOW-002 approval-comment boundary failure

- A fresh aggregate first passed empty-comment approval and an authenticated `workflow:read`-only user's HTTP 403 with unchanged `SUBMITTED` state. A separate rejection using a 4096-character Unicode comment then returned HTTP 500; trace is `/tmp/fqa-2050-flow002-after-rem-p1-052`.
- Backend root cause is PostgreSQL `value too long for type character varying(512)` from `DailyReportWorkflowAdapter.onWorkflowCompleted`: the full user comment is concatenated into `audit_log.remark`, and the completion transaction rolls back. Existing standards require audit remarks to be bounded to 512 rather than allowing audit persistence to abort the business action.
- Finally removed both reports, assignment, user and role through product APIs. Manifest is `objects=[]`, `cleanupFailures=0`; authorization remains enforced. `FLOW-002` is FAIL; totals are `224 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 49 NOT_RUN`, and L4 pauses for `REM-P1-053`.

## FLOW-002 post-REM-P1-053 closure and OPS-007 user-confirmed recheck

- REM-P1-053 event `0f147d7e` merged no-ff into `lint-fix` as `43e1a940`; the continuation branch starts at that exact integration head and retains unaffected same-run evidence.
- `test/l4-workflow-approval-contract-current-run.spec.js` passed `1/1` in 3.4 seconds at `/tmp/l4-after-rem-p1-053-flow002`. Empty approval, no-approve HTTP 403/UI absence, 4096 Unicode rejection, correct business state and exact 512-code-point audit summary passed; all report/RBAC fixtures were product-API cleaned.
- Per the user's explicit product contract, `test/rem-p1-050-ops-assignee-candidates.spec.js` reconfirmed `OPS-007` `1/1` in 6.2 seconds at `/tmp/l4-after-rem-p1-053-ops007`: the group-scoped creator selected a same-tenant enabled cross-group owner from the four-field minimal candidate set; read-only remained 403 and UI/API detail agreed.
- Shared and event manifests are `objects=[]`, `cleanupFailures=0`; authorization remains enforced and break-glass inactive. `FLOW-002` and `OPS-007` are PASS. Functional totals are `225 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 49 NOT_RUN`; state totals remain `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`.

## CONFIG-004 watermark contract failure

- The real admin page persistence asset passed `1/1` in 2.6 seconds at `/tmp/l4-after-rem-p1-053-common-config`: enable/text/opacity and all five position values saved, refreshed and restored exactly with no Console/5xx.
- Full catalog reconciliation then proved an executable product gap rather than allowing partial closure. V11 seeds `watermark.angle=45` and `ExportService` consumes it for PDF rendering, but `WatermarkConfigRequest`, `SysConfigController.updateWatermark` and `AdminConfigPage` omit angle; no immediate preview exists.
- The isolated external config aggregate also passed `1/1` in 34.5 seconds at `/tmp/l4-after-rem-p1-053-external-config`, and the pending Change guard aggregate passed `1/1` in 883ms at `/tmp/l4-after-rem-p1-053-change-remaining`; both remain partial evidence for their open main cases and are not over-counted.
- Watermark configuration was restored through the product API; shared manifest is `objects=[]`, `cleanupFailures=0`. `CONFIG-004` is FAIL; totals are `225 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 48 NOT_RUN`, and L4 pauses for `REM-P1-054`.

## CONFIG-004 post-REM-P1-054 closure

- REM-P1-054 event `2cafd359` merged no-ff into `lint-fix` as `78d07cf1`; this continuation starts at the exact merge head and retains unaffected PASS evidence.
- `test/rem-p1-054-watermark-angle-preview.spec.js` passed `1/1` in 2.1 seconds at `/tmp/l4-config004-after-rem-p1-054`. Five invalid API payloads returned 400 with unchanged configuration, and real UI angle/text/opacity/position preview, save/refresh and exact restore passed with Console/5xx=0.
- Java `ExportServiceTest` passed the existing PDF consumer angle-key check; shared and event manifests are empty with zero cleanup failures. `CONFIG-004` is PASS. Functional totals are `226 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 48 NOT_RUN`; state totals remain `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`.

## Post-REM-P1-054 remaining-batch stability rerun

- From continuation `9f20a8f9`, the Change guard, watermark persistence and isolated external-config assets passed serially `3/3` in 0.9, 2.7 and 10.6 seconds. The write/shared-manifest batches were intentionally serialized under the approved L4 acceleration contract.
- The runs reconfirmed referenced-template rejection, pending-state immutability, watermark save/refresh/restore, SMTP invalid boundaries plus Mailpit delivery, Prometheus mock polling and temporary DeepSeek key clearing. No Console error or HTTP 5xx was observed by the UI asset.
- Existing complete PASS cases remain PASS; partial `CHANGE-010`, `COMMON-008/012`, `CONFIG-001/003` and `AI-002/003` remain NOT_RUN. The ledger omission for already-closed `CONFIG-004` was reconciled, restoring mechanical agreement with checkpoint totals. Manifest is `objects=[]`, `cleanupFailures=0`; authorization remains enforced and break-glass inactive.

## RBAC-010 export permission closure

- The current continuation ran `test/l4-cmdb-export-permission-current-run.spec.js` serially and passed `1/1` in 3.8 seconds. A tenant-scoped minimal export assignment downloaded non-empty `text/csv` with `cmdb-instances.csv` and canonical `id,name,model,status,owner,description` headers; read-only export and exporter instance-list reads were both 403.
- Temporary roles, users and assignments were removed in reverse order through product APIs. Manifest is `objects=[]`, `cleanupFailures=0`; functional totals are `227 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 47 NOT_RUN`.

## CHANGE-008 group-scope closure

- GitNexus exploration confirmed the Change document access contract is applicant/same-group-leader scoped and deliberately returns `RESOURCE_NOT_FOUND` for inaccessible documents. No product symbol was modified; a new isolated Playwright asset exercised the existing contract.
- `test/l4-change-group-scope-current-run.spec.js` passed `1/1` in 5.6 seconds. A group-scoped creator read and updated its own draft in API and real UI, while a cross-group draft stayed absent from list and returned 404 for get/update with identical superadmin before/after readback. Page errors and 5xx were zero.
- Both runId drafts were purged through the remediation product endpoint; assignment, user and role were reverse-cleaned. Manifest is `objects=[]`, `cleanupFailures=0`; functional totals are `228 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 46 NOT_RUN`.

## CHANGE-006 table-field closure

- The Changedoc contract audit confirmed a template without an uploaded DOCX safely falls back to programmatic generation, so the run required no MinIO write. `test/l4-change-table-field-current-run.spec.js` passed `1/1` in 2.4 seconds after correcting two test-only input-value locators; both failed attempts had already product-cleaned all fixtures.
- The final run saved an empty table row plus a 1,800-Chinese-character row, used the real detail page to remove the empty row and add a new row, refreshed with stable order, and matched API readback. Downloaded DOCX XML contained the final two rows in order and the full long text. Console/5xx were zero.
- The runId draft and template were deleted through product APIs. Manifest is `objects=[]`, `cleanupFailures=0`; functional totals are `229 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 45 NOT_RUN`.

## CMDB-024 JSON/NDJSON import closure

- The CMDB skill and GitNexus query identified `JsonImportController.previewRaw` and `JsonImportService.execute` as the existing import chain. No product symbol was modified; a new isolated test called the live APIs with a runId model.
- `test/l4-cmdb-json-import-current-run.spec.js` passed `1/1` in 0.9 seconds. A JSON array created one instance. A two-line NDJSON body classified one same-name row as update and one new-name row as create; execution returned exactly `created=1, updated=1, failed=0`, and readback preserved the first ID with updated fields while creating the second. A second execute with the consumed batch returned 400.
- Both instances, model and model group were deleted through product APIs. Manifest is `objects=[]`, `cleanupFailures=0`; functional totals are `230 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 44 NOT_RUN`.

## CMDB-030 topology compare closure

- GitNexus identified `CiTopologyCompareService.compare/compareSnapshots` and the independent compare page as the execution chain. A new isolated asset created root, unchanged, modified and removed nodes, froze the UTC audit boundary, then updated/deleted/added nodes before a second boundary.
- The initial run used local time against UTC audit timestamps and correctly returned no diff; the next run proved the API categories but hit a test-only `datetime-local` fill restriction. After aligning the browser value setter with the backend UTC contract, `test/l4-cmdb-topology-compare-current-run.spec.js` passed `1/1` in 3.9 seconds: added/removed/modified were each exactly one and unchanged included root plus stable child; UI legends matched and Console/5xx were zero.
- All active relations, instances, definition, model and model group were deleted through product APIs. Immutable CMDB audit records are retained by product design; manifest is `objects=[]`, `cleanupFailures=0`. Functional totals are `231 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 43 NOT_RUN`.

## CMDB-037 and XL-CMDB-009 rack layout closure

- GitNexus identified `RackLayoutService.getLayout` → `RackController.layout` → `RackElevationView` as the existing API/UI chain. No product symbol was modified; the L4 asset only exercises the verified REM-P1-011 contract.
- `test/l4-cmdb-rack-layout-current-run.spec.js` passed `1/1` in 2.9 seconds at `/tmp/fqa-2050-cmdb037-r4`. A 12U rack plus hosts at U3-4 and U4-5 returned exactly one `overlap` warning for the second host at U4.
- Real UI navigation proved the 数据中心 catalog exposes `RACK机柜`, the runId table row opens its detail drawer and `完整详情`, the `机柜视图` renders `布局告警（1）` and the 12U SVG, and the 2D selector/card exposes the same rack. Console errors and HTTP 5xx were zero.
- Two test-only attempts stopped on the response field name and list-navigation locator; the timeout attempt's finally deleted every fixture before manifest writeback, and authoritative keyword readback proved zero residue. The final run deleted relations then hosts then rack through product APIs. Manifest is `objects=[]`, `cleanupFailures=0`.
- `CMDB-037` and `XL-CMDB-009` are PASS. Functional totals are `232 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 42 NOT_RUN`; state totals are `44 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`.

## CMDB-022, CMDB-023 and XL-CMDB-007 CSV chain closure

- The REM-P1-011 audit confirmed the backend resolves a model by code or Chinese display name while the frontend canonicalizes one route decode. No product symbol was modified; a new isolated asset exercised the existing template and import chain.
- `test/l4-cmdb-csv-import-current-run.spec.js` passed `1/1` in 2.5 seconds at `/tmp/fqa-2050-cmdb022023-r2`. The real `/cmdb/instances/by-model/应用` page downloaded a template whose query decoded exactly to `应用` without `%25E5`, returned `text/csv; charset=UTF-8`, RFC 5987 UTF-8 Content-Disposition and browser filename `应用_import_template.csv`.
- The same UI used the downloaded header to upload one valid app row, previewed one create, and executed `totalRows=1 / created=1 / failed=0`. Authoritative API readback found the exact `app_name` under model `app`, closing the previous execute-versus-persistence inconsistency. Console errors and HTTP 5xx were zero.
- The first attempt passed the full API/product chain but used a test-only combined result-card text locator; its finally deleted the imported instance. The final run also product-deleted the instance and readback found no residue. Manifest is `objects=[]`, `cleanupFailures=0`.
- `CMDB-022`, `CMDB-023` and `XL-CMDB-007` are PASS. Functional totals are `234 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 40 NOT_RUN`; state totals are `45 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`.

## CMDB-019 update-only edit closure

- `test/l4-cmdb-update-only-edit-current-run.spec.js` passed `1/1` in 3.0 seconds at `/tmp/fqa-2050-cmdb019-r3`. The tenant-scoped role contained exactly `cmdb_model:read`, `cmdb_instance:read` and `cmdb_instance:update`: direct update returned 200 while create and delete returned 403.
- The same identity opened the real app detail, saw the `编辑` control, changed `应用名称`, received UI PUT 200, and after refresh both the page and API readback retained the new value. Console errors and HTTP 5xx were zero.
- The first attempt proved the permission/UI entry but used an over-broad input locator; the second proved UI PUT 200 but incorrectly required immediate stale-query repaint instead of the case's refresh contract. Both attempts product-cleaned all fixtures. The final instance, assignment, user and role were reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`.
- `CMDB-019` is PASS. Functional totals are `235 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 39 NOT_RUN`; state totals remain `45 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`.

## XL-WIKI-003 Mermaid editor/read closure

- The UI contract audit identified `WikiMermaid` as the common live-preview/read renderer with explicit preview error handling and theme-dependent Mermaid initialization. No product symbol was modified.
- `test/l4-wiki-mermaid-current-run.spec.js` passed `1/1` in 5.3 seconds at `/tmp/fqa-2050-xlwiki003-r1`. A valid diagram rendered one editor SVG; invalid syntax showed `Mermaid 图表渲染失败` and `请检查图表语法。`, while API readback proved the saved baseline remained unchanged.
- Two different valid diagrams rendered two editor SVGs, remained two after the real user-menu switch to dark theme, saved with PUT 200, and rendered as two SVGs on the read page before and after refresh. Theme was returned to light; Console errors and HTTP 5xx were zero.
- Page and space were product-API deleted in reverse order. Manifest is `objects=[]`, `cleanupFailures=0`. `XL-WIKI-003` is PASS; state totals are `46 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 31 NOT_RUN`. Functional totals remain `235 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 39 NOT_RUN`.

## CHANGE-007 and CHANGE-010 draft/pending closure

- The Changedoc contract audit separated draft reachability from pending immutability and avoided approval/archive terminal states. Two empty runId templates made the real UI route deterministic without modifying existing templates.
- `test/l4-change-draft-pending-ui-current-run.spec.js` passed `1/1` in 2.6 seconds at `/tmp/fqa-2050-change007010-r1`. The real new-document page selected application and plan templates, POST returned a valid numeric ID, and navigation reached `/change-docs/{id}` rather than `[object Object]`.
- A remediation marker and draft note were persisted, then the real detail UI changed the title, saved with PUT 200, refreshed, and matched API readback for title, both template IDs and fields. Real UI submit returned pending.
- Pending UI exposed no editable title, save, submit or delete action. Direct update, normal delete and repeated submit each returned 409; title, status, fields and snapshot count were unchanged. Console errors and HTTP 5xx were zero.
- The approved remediation product endpoint deleted the pending document by exact runId; both templates were then product-deleted. Manifest is `objects=[]`, `cleanupFailures=0`. `CHANGE-007/010` are PASS; functional totals are `237 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 37 NOT_RUN`; state totals remain `46 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 31 NOT_RUN`.

## XL-WIKI-001 and XL-EXPORT-003 authenticated image export closure

- GitNexus identified `WikiImage` as the Markdown image renderer and `WikiExportService` as the attachment-ID rewrite and ZIP byte-stream path. No product symbol was modified; a new isolated asset exercises the existing chain.
- The first test-only attempt placed the image on a child page and stopped at upload with `403 RESOURCE_NOT_MIGRATED`; its finally block deleted both pages and the space and returned the manifest empty. The contract does not require the image page to be nested, so the final fixture placed the attachment on the root page and retained a child page solely to prove ZIP hierarchy.
- `test/l4-wiki-image-export-current-run.spec.js` passed `1/1` in 2.6 seconds at `/tmp/fqa-2050-xlwiki001-export003-r2`. The authenticated attachment response was `image/png` and byte-identical; the real reader issued the JWT request, rendered a `blob:` URL and decoded the image to 1x1 pixels.
- Real UI page export returned the exact Markdown filename and content. Real UI space export returned the exact ZIP filename; parsed entries were the root Markdown, nested child Markdown and `images/{runId}.png`. The root Markdown used `./images/{runId}.png`, and the ZIP image was byte-identical to the upload. Console errors and HTTP 5xx were zero.
- The attachment was product-API deleted and readback returned 400; both pages and the space were reverse-deleted. Manifest is `objects=[]`, `cleanupFailures=0`. `XL-WIKI-001/XL-EXPORT-003` are PASS; state totals are `48 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`; functional totals remain `237 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 37 NOT_RUN`.

## ST-AUTHZ-010 enforced ordinary-access closure

- The state contract requires ordinary Enforced access to use only the unified model and never let the legacy supplier override a denial. GitNexus traced this to `AuthorizationService.requireWithCompatibility`; no product symbol was modified.
- A run-scoped group role with `wiki:read` was assigned through the legacy user-role product input, producing its compatibility group assignment. Two new Wiki pages both retained the same legacy default-read condition; the assignment covered only the user's primary group. The real user session read the covered-group page with 200, while the uncovered-group page returned 403 `ROLE_SCOPE_NOT_COVERED`.
- The first attempt stopped on a test-only DTO field assumption before the second fixture and exposed a cleanup-variable bug: the helper had registered page/space IDs in the manifest but had not returned them to the outer variables. The residual page #298 and space #166 were immediately deleted through product APIs and read back as 404/zero list matches. Cleanup was then hardened to reverse-delete registered manifest objects and verify zero product readback. The second attempt stopped on JavaScript automatic-semicolon insertion and the hardened cleanup proved zero residue.
- `test/l4-authz-enforced-ordinary-access-current-run.spec.js` then passed `1/1` in 2.4 seconds at `/tmp/fqa-2050-st-authz-010-r3`. Cutover status before/after was exactly equal and remained Enforced epoch 32. User and space keyword readbacks were zero; manifest is `objects=[]`, `cleanupFailures=0`.
- Host Java 26 could not initialize Mockito because the current Byte Buddy supports through Java 24; the exact test was rerun with the repository-standard Homebrew Java 21 and passed `1 test / 0 failures / 0 errors / 0 skipped`: `AuthorizationServiceTest#enforcedResourceDecisionIgnoresLegacyAllow`. `ST-AUTHZ-010` is PASS. State totals are `49 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 28 NOT_RUN`; functional totals remain `237 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 37 NOT_RUN`.

## CMDB-011 enum option boundary failure

- `test/l4-cmdb-fieldtype-contract-current-run.spec.js` created a run-scoped model and exercised all ten current field types. The duplicate-option boundary for `CMDB-011` sent two enum options with the same `id`; the API returned `200`, persisted both entries, and returned them unchanged from the attribute list. This is a product contract failure, not a test gap.
- The attempted 10-type chain was stopped at this failure. Its 11 attributes, attribute group, model and model group were deleted through product APIs in dependency order; product readback confirmed no run-scoped model or attribute-group residue. The manifest is `objects=[]`, `cleanupFailures=0`.
- `CMDB-011` is `FAIL`; `CMDB-008`, `CMDB-016`, `CMDB-017` and `XL-CMDB-001` remain `NOT_RUN`. L4 pauses for an independent remediation event from the latest `lint-fix` integration point. Functional totals are `237 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 36 NOT_RUN`; state totals remain `49 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 28 NOT_RUN`.

## CMDB-008 and XL-CMDB-001 model-detail drawer-field failure

- After `REM-P1-008` was merged, the same L4 run resumed only the affected combined asset. `test/l4-cmdb-fieldtype-contract-current-run.spec.js` passed duplicate enum-option rejection, all ten field-type create/list/readback checks, the real new-instance form and dynamic list columns, then failed at the real row drawer because `关键属性` was absent. Evidence is `/tmp/fqa-2050-cmdb-types-after-rem-p1-008-r7`.
- The trace-captured `GET /api/cmdb/models/{code}` response contained all ten attributes and `isListShow=true` but omitted `isDrawerShow` from each one. Source audit confirmed `CiModelService.toAttributeVO` maps `isListShow` and all adjacent attribute metadata but does not map `isDrawerShow`; the frontend correctly filters drawer columns by that response field.
- The instance, ten attributes, attribute group, model and model group were deleted through product APIs in reverse dependency order. Product readback and `test-data-manifest.json` confirm `objects=[]`, `cleanupFailures=0`; authorization remains Enforced epoch 32 and break-glass remains inactive.
- `CMDB-008` and `XL-CMDB-001` are `FAIL`. `CMDB-011` remains `FAIL` until the combined chain fully passes; `CMDB-016/017` remain `NOT_RUN`. Functional totals are `237 PASS / 2 FAIL / 0 BLOCKED / 1 N/A / 35 NOT_RUN`; state totals are `49 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 27 NOT_RUN`. L4 pauses for an independent remediation event from the latest `lint-fix` integration point.

## CMDB-008/011/016/017 and XL-CMDB-001 closure after REM-P1-055

- `REM-P1-055` event `4b8603a2` was no-ff merged as `967d3f98`; merge hash checkpoint is `39166392`. The same run resumed without resetting prior PASS evidence.
- `test/rem-p1-055-cmdb-model-detail-drawer-flag.spec.js` passed `1/1` in 2.3 seconds at `/tmp/fqa-2050-cmdb-types-after-rem-p1-055-r1`. It rejected duplicate enum option IDs with 400, created/listed/read all ten current field types, rendered every required field in the real new-instance form, displayed the first five dynamic list columns, and showed all ten label/value pairs in the real row drawer.
- Browser pageerror and HTTP 5xx arrays were empty. The instance, attributes, attribute group, model and model group were product-API reverse-cleaned; model keyword readback was zero and manifest is `objects=[]`, `cleanupFailures=0`.
- `CMDB-008/011/016/017` and `XL-CMDB-001` are PASS. Functional totals are `241 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`; state totals are `50 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 27 NOT_RUN`. Continue all remaining cases under the approved acceleration contract.

## ST-CHANGE-003 application/plan field-isolation closure

- The existing combined change lifecycle asset passed `1/1` but only asserted state names, so it was not used to promote the case. Dedicated `test/l4-change-plan-field-isolation-current-run.spec.js` instead used distinct live application/plan templates and read the detail API after every transition.
- The final run passed `1/1` in `812ms` at `/tmp/fqa-2050-st-change-003-final-r3`: application-only submit entered `plan_pending` with application config/value and no plan config; adding the plan template preserved the application set while exposing the independent plan set; submit-plan entered `pending` with both sets and the exact remediation marker unchanged.
- Four earlier attempts were test-only assertion/fixture corrections: omitted null fields follow the platform's non-null JSON contract, mutation responses are lighter than detail reads, table values require deep equality, and the remediation marker must remain a dedicated field after a plan `title` update. One pending fixture from the final correction was rejected, updated with its exact marker and purged through product APIs; readback returned 404. No product defect was inferred from these attempts.
- A diagnostic GET to the unsupported `/api/authorization/cutover/status` returned one explainable HTTP 500 after the test. The correct read-only `/api/rbac/migration/cutover` endpoint then confirmed `cutoverStatus=effectiveMode=enforced`, epoch `32`; no authorization write or break-glass occurred.
- Final keyword readback is zero and manifest is `objects=[]`, `cleanupFailures=0`. `ST-CHANGE-003` is PASS. Functional totals remain `241 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`; state totals are `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## COMMON-010 async cancellation partial coverage

- New isolated read-only `test/l4-common-async-unmount-current-run.spec.js` passed `1/1` in `3.0s` at `/tmp/fqa-2050-common-010-r1` using controlled HTTP 200 search responses and no product writes.
- The command palette issued an old delayed request, rendered a newer response, then released the old response; the newer result remained and the stale result never appeared. The Wiki search page issued a delayed request, navigated to the dashboard before completion, then released it; the URL remained `/` and late data did not render.
- Browser `pageerror`, Console error and HTTP 5xx arrays were empty. Manifest remained `objects=[]`, `cleanupFailures=0`. The catalog applies to every page with debounce/timer/request; autosave, polling, import progress, notification and other async surfaces remain unexecuted, so `COMMON-010` stays NOT_RUN. Functional totals remain `241 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## CMDB-014 canonical attribute-action guard failure

- A dedicated run-scoped role contained only `cmdb_attribute:create`; the new user's post-setup login permissions explicitly contained that code. The valid attribute POST targeted a run-scoped model and attribute group but returned HTTP 403 `无权限` at `/tmp/fqa-2050-cmdb014-attribute-guard-r3`.
- Source audit shows `CiAttributeController.create/update/delete` consume `cmdb_model:update` and list consumes `cmdb_model:read`, while the runtime permission directory and catalog expose `cmdb_attribute:read/create/update/delete`. This is canonical consumer drift, not a payload or scope denial.
- The first two attempts returned 400 because the probe omitted required `groupId`; those were test-only diagnosis and did not reach the guard. The third run used a valid group and is the authoritative failure.
- Attribute creation made no write. Attribute group, model, model group, assignment, user and role were product-API reverse-cleaned; model/user/role keyword readbacks were zero and manifest is `objects=[]`, `cleanupFailures=0`. Authorization remains Enforced epoch 32 and break-glass inactive.
- `CMDB-014` is FAIL and L4 stops for independent `REM-P1-056`. Functional totals are `241 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## CMDB-014 closure after REM-P1-056

- `REM-P1-056` event `7d0f0d21` was no-ff merged as `2f664230`; continuation merge `80517763` preserved the complete current-run evidence chain while taking the latest product baseline.
- `test/l4-cmdb-attribute-canonical-guard-current-run.spec.js` passed `1/1` in 2.5s at `/tmp/fqa-2050-cmdb014-after-rem-p1-056-create`. The complete affected matrix in `test/rem-p1-056-cmdb-attribute-canonical-action-guards.spec.js` passed `1/1` in 16.8s at `/tmp/fqa-2050-cmdb014-after-rem-p1-056-matrix`.
- Canonical read/create/update/delete succeeded; each independently missing action returned 403; legacy-only `cmdb_model:read/update` received no attribute capability; denial left attribute count/name unchanged; six real identities rendered read/create/update/delete controls independently with zero pageerror/5xx.
- Shared and event manifests are `objects=[]`, `cleanupFailures=0`; user/role/model/group keyword readbacks are zero. Authorization remains Enforced epoch 32 and break-glass inactive. `CMDB-014` is PASS; functional totals are `242 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`.

## WIKI-024 ancestor-traverse precondition product failure

- A fresh serial Playwright asset built the required two-level Wiki hierarchy using only product APIs. The space/root granted the target tenant-scoped `wiki:read` identity named-user `r-x`; the root default ACL granted `r--`, and child creation succeeded.
- Four fixture refinements excluded setup-order, superadmin ACL preservation, content-write and owner/group-mode explanations. A final short-lived diagnostic used the same product lifecycle and a read-only PostgreSQL query: the child had the copied named-user `r--` row but `owner_group_id=NULL`, while the parent retained its selected group.
- The positive child GET therefore returned 403 as `RESOURCE_NOT_MIGRATED` before the required ancestor transition. The existing Java test still proves `checkAncestors` returns exact reason `ANCESTOR_TRAVERSE_DENIED` when given a valid resource, but that unit evidence cannot replace the failed runtime precondition.
- Every attempted fixture was product-API reverse-cleaned; manifest `objects=[]`, `cleanupFailures=0`. `WIKI-024` is FAIL, mapped to independent `REM-P1-057`, and no later L4 write batch runs before event L1-L3 and same-run affected revalidation.

## WIKI-024 closure after REM-P1-057

- `REM-P1-057` event `25ee1823` was no-ff merged as `e1738b04`; the latest integration checkpoint is `cd903e7b`, and continuation merge `b9dc4161` retains the same run and all unaffected PASS evidence.
- `test/l4-wiki-ancestor-traverse-current-run.spec.js` passed `1/1` in 2.4 seconds at `/tmp/fqa-2050-wiki024-rem57-r1`. The child inherited the root owner group, its copied named-user `r--` plus ancestor `r-x` allowed read, and removing root `x` returned 403 without child title/content leakage.
- Product-API reverse cleanup removed child, root, space, assignment, user and role. Shared manifest is `objects=[]`, `cleanupFailures=0`; exact marker readbacks are zero, Wiki is enforced, backend health is UP and no unexplained ERROR/5xx was logged.
- `WIKI-024` is PASS. Functional totals are `243 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 31 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`. Continue the remaining 57 cases under the approved acceleration contract.

## RBAC-007 duplicate active-group name failure

- A fresh serial `test/l4-rbac-group-lifecycle-current-run.spec.js` began the `RBAC-006/007` dependency batch from continuation `2cb6caf2`. Empty, whitespace and 65-character names returned 400, then a valid active group create returned 200.
- Repeating the exact tenant/name returned 200 and created a second active group instead of the catalog-required duplicate rejection. The test stopped immediately; `RBAC-006` remains NOT_RUN and no dependent write batch ran.
- Finally removed the temporary user and product-archived both groups, preserving auditable history without restore/purge. Active marker readback is zero; archived readback contains the two expected rows; manifest is `objects=[]`, `cleanupFailures=0`; backend has no unexplained ERROR/5xx.
- `RBAC-007` is FAIL and maps to independent `REM-P1-058`. Functional totals are `243 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 30 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## RBAC-006/007 closure after REM-P1-058

- `REM-P1-058` event `ef3df211` was no-ff merged as `738e2686`; continuation `5866a00c` preserves every unaffected result from the same run.
- `test/l4-rbac-group-lifecycle-current-run.spec.js` passed `1/1` in 2.5 seconds at `/tmp/fqa-2050-rbac006007-r4`. Duplicate active tenant/name now returns 400; the full chain also completed validation, maximum-name update, builtin 409 protection, leader/member lifecycle, referenced archive blocker, real UI archive, archived readback and audit checks.
- Two intermediate runs exposed test-only stale assumptions: builtin protection uses the established 409 conflict contract, and group lifecycle audit remarks carry the action prefix. Both runs product-cleaned their fixtures before the assertion stopped.
- Shared manifest is `objects=[]`, `cleanupFailures=0`; active group/user marker readbacks are zero and backend has no unexplained ERROR/5xx. `RBAC-006/007` are PASS. Functional totals are `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`. Total remaining is 55.

## XL-RBAC-007 custom-role assignment lifecycle

- `test/l4-rbac-role-contract.spec.js` passed `1/1` in 2.2 seconds at `/tmp/fqa-2050-xl-rbac-007-r4`. An active scoped assignment blocked custom-role deletion; revocation made the already-issued user session lose `cmdb_instance:read` immediately, then role deletion succeeded and emitted the expected `authorization/role_delete` audit row.
- Three setup attempts were test-only corrections: the role permission had first been cleared before login, a local cleanup id caused a duplicate delete, and the audit module is `authorization` rather than `role`. Every attempt product-cleaned its role, user and assignment before stopping.
- Shared manifest is `objects=[]`, `cleanupFailures=0`; active runId user/role/assignment readbacks are zero and backend has no unexplained ERROR/5xx. `XL-RBAC-007` is PASS. State totals are `52 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 25 NOT_RUN`; functional totals remain `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`. Total remaining is 54.

## XL-RBAC-003 disabled-user session revocation

- `test/l4-rbac-disabled-session-current-run.spec.js` passed `1/1` in 4.5 seconds at `/tmp/fqa-2050-xl-rbac-003-r2`. Admin disable revoked the existing API session to 401, stable disabled-account login denial passed, and the first real tab's 401 broadcast redirected both same-context tabs to `/login`; re-enable restored login.
- The first attempt incorrectly used separate browser contexts, which intentionally do not share BroadcastChannel; its user was re-enabled and product-deleted before retry. Final manifest is `objects=[]`, `cleanupFailures=0`; active runId user readback and backend ERROR/5xx are zero.
- `XL-RBAC-003` is PASS. State totals are `53 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 24 NOT_RUN`; functional totals remain `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`. Total remaining is 53.

## Authorization account migration state matrix

- Serialized `test/l4-authz-account-state-matrix-current-run.spec.js` passed `1/1` in `2.4s` at `/tmp/fqa-2050-authz-account-matrix-verified` under the approved full-tenant rollback -> enforced window.
- The chain proved blocked preflight and unchanged cutover, pending-user primary-group repair, prepared/reconciled run counters and finished timestamps, exception source linkage, note boundaries, acceptedLegacy Enforce rejection, root-cause repair and resolved metadata, repeated-backfill assignment/lineage idempotency, legacy -> shadow/exception rollout, strict Enforce epoch increment, active-account rollout enforcement and cutover audit.
- Temporary users and role were product-API deleted. Final cutover is enforced at epoch `40`, strict preflight is eligible with no issues or permission diffs, manifest is `objects=[]`, `cleanupFailures=0`.
- `ST-AUTHZ-001/002/004/006/012/013/014/018` are PASS. State totals are `61 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 16 NOT_RUN`; functional totals remain `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`. Total remaining is 45.

## XL-CMDB-003 CI/device UI navigation failure

- New serial `test/l4-cmdb-core-cross-module-chain-current-run.spec.js` first passed the association relation, two-end API display, topology, impact, delete guards and unlink checks. Those partial `XL-CMDB-002` assertions do not promote the aggregate case.
- The run-scoped device then linked correctly through `GET /api/devices/{id}` and `GET /api/cmdb/instances/{id}/devices`; deleting the related CI was correctly rejected. The real CI detail `关联资源` panel exposed no anchor to `/devices/{id}`, so the required CI -> device UI navigation failed at `/tmp/fqa-2050-xl-cmdb-002-003-r2`.
- The device, both instances, association definition, models and group were product-API reverse-cleaned. Manifest is `objects=[]`, `cleanupFailures=0`. `XL-CMDB-003` is FAIL and maps to independent `REM-P1-059`; no later L4 write batch runs first.
- State totals are `61 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 15 NOT_RUN`; functional totals remain `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`. Unresolved total remains 45.

## XL-CMDB-003 closure after REM-P1-059

- `REM-P1-059` event `1c46d1a04` was no-ff merged as `b5643946d`; the same run retained all unaffected PASS evidence.
- The original `test/l4-cmdb-core-cross-module-chain-current-run.spec.js` passed `1/1` in 2.8 seconds at `/tmp/fqa-2050-xl-cmdb-003-remp1059`. Device APIs agreed, the CI related-resources link opened `/devices/{id}`, and the device detail returned through the linked CI's real model code.
- CI delete protection remained HTTP 400 while linked; relation/device/instances/definition/models/group were product-API reverse-cleaned. Shared manifest is `objects=[]`, `cleanupFailures=0`. `XL-CMDB-003` is PASS; `XL-CMDB-002` remains NOT_RUN because its full aggregate contract was not executed.
- Functional totals remain `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`; state totals are `62 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 15 NOT_RUN`. Total remaining is 44.

## Wiki document-admin, multi-role union and RBAC construction

- `test/l4-wiki-rbac-remaining-chain-current-run.spec.js` passed `1/1` in 9.8 seconds at `/tmp/fqa-2050-wiki-rbac-remaining-r5` after test-only fixture corrections for the established 64-character display fields and a strict-mode editor locator.
- A document-admin identity updated, published and deleted a page while space creation and ACL management remained denied. A separate multi-role identity combined create/update, publish and delete across roles and completed the real UI lifecycle.
- Role permission assignment, user creation, primary membership, group-scoped assignment, setup/login, sidebar, API and audit assertions passed. All roles, users, memberships, assignments, spaces and pages were product-API reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`.
- `WIKI-019`, `WIKI-020` and `XL-RBAC-001` are PASS. Functional totals are `247 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 27 NOT_RUN`; state totals are `63 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 14 NOT_RUN`. Total remaining is 41.

## COMMON-008 and XL-CMDB-002 closure

- The watermark UI selected all five position options, verified Chinese labels, returned to the default, persisted/reloaded the value and restored the prior configuration exactly. `COMMON-008` is PASS; evidence is `/tmp/fqa-2050-common-008-r2`.
- The already completed post-REM-P1-059 CMDB core chain covered the full `XL-CMDB-002` aggregate before its device segment: dual-end relation API/UI, topology, impact, delete guards, unlink disappearance and exact cleanup. It is therefore promoted independently from `XL-CMDB-003` using `/tmp/fqa-2050-xl-cmdb-003-remp1059`.
- Shared manifest remains `objects=[]`, `cleanupFailures=0`. Functional totals are `248 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`; state totals are `64 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 13 NOT_RUN`. Total remaining is 39.
## CHANGE-013/019 and ST-CHANGE-001/004 closure after REM-P1-060

- `REM-P1-060` event `b7394350` was no-ff merged as `633115c0`; continuation `d77d4b1` restored the same-run L4 evidence onto the latest integration point.
- `FQA_L4_RUN_ID=FQA_20260718_2050_remp1038 npx playwright test test/l4-change-terminal-export-idempotency-current-run.spec.js --workers=1 --reporter=line --output=/tmp/fqa-2050-change-terminal-after-rem-p1-060` passed `1/1` in `3.3s`.
- Submit concurrency returned exactly `200/409`; approval concurrency returned exactly `200/409`; audit and snapshot records were unique. Draft/pending/approved/re-draft/rejected exports, archived-file download and no-export HTTP 403 all passed.
- Documents, RBAC fixtures and orphan SharedFile metadata were cleaned through product APIs. Shared and event manifests are `objects=[]`, `cleanupFailures=0`. Functional totals are `250 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 24 NOT_RUN`; state totals are `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 35.

## CHANGE-009 aggregate closure

- `CHANGE-009` is PASS because the same-run chain completely covered its declared state contract `ST-CHANGE-001..004`; no historical run result was imported. Functional totals are `251 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 23 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 34.

## WIKI-023 ACL priority and group union

- The final isolated run passed `1/1` in `6.5s` at `/tmp/fqa-2050-wiki023-r4`. Owner mode, named-user override, two-group bitwise union, others fallback, read/update and parent traverse all matched the authorization contract.
- Three earlier fixture-only attempts each product-cleaned exactly; they exposed missing parent traverse permissions and produced no product defect. Final manifest is empty with zero cleanup failures. Functional totals are `252 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 22 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 33.

## CHANGE-011 applicant notification failure

- `test/l4-change-approval-scope-comments-current-run.spec.js` reached a valid direct approval in the applicant's group at `/tmp/fqa-2050-change011012-r9`; the 1024-character Unicode approval comment persisted exactly.
- The applicant's notification list remained empty instead of containing one `change_doc` reference for document `280`. The direct `ChangeDocService.approve` path updates state, snapshot, audit and archive but does not emit the notification used by the workflow-completion adapter.
- Product-API reverse cleanup completed with `objects=[]`, `cleanupFailures=0`; run-scoped documents, groups and users read back as zero, and no unexplained backend ERROR/5xx remains.
- `CHANGE-011` is FAIL and maps to independent `REM-P1-061`. `CHANGE-012` remains NOT_RUN because execution stopped at the notification assertion. Functional totals are `252 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 21 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. There are 32 NOT_RUN cases and 33 unresolved cases including this failure.

## CHANGE-011/012 closure after REM-P1-061

- `REM-P1-061` event `936ca2f1` was no-ff merged as `c6495ae9`; continuation `70d5726c` retains the same run and all unaffected PASS evidence.
- The latest-integration asset passed `1/1` in `6.3s` at `/tmp/fqa-2050-change011012-after-rem-p1-061-r2`. Direct same-group approval, exact 1024-character Unicode comment, applicant `change_doc` notification, empty-comment rejection and cross-group non-enumerating 404 all passed.
- All documents, templates, assignments, users, roles and groups were product-API reverse-cleaned. Manifest is `objects=[]`, `cleanupFailures=0`; backend has no unexplained ERROR/5xx.
- `CHANGE-011/012` are PASS. Functional totals are `254 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 20 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 31.

## AI-002 invalid provider configuration failure

- The isolated external-config chain first passed `1/1` in `18.4s` at `/tmp/fqa-2050-external-config-final-r1` and restored SMTP, Prometheus, AI and manifest state.
- A focused authenticated API probe then sent `baseUrl=not a url` and a whitespace-only `model` to the DeepSeek provider update endpoint. Both returned HTTP 200 instead of the catalog-required invalid-boundary rejection.
- The original provider fields and unconfigured API-key state were restored immediately; manifest remains `objects=[]`, `cleanupFailures=0`, and backend has no unexplained ERROR/5xx.
- `AI-002` is FAIL and maps to independent `REM-P1-062`. Functional totals are `254 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 19 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`.

## AI-002 closure and AI-003 provider failure handling

- `REM-P1-062` event `f2b3d2f9` was no-ff merged as `824115b8`; same-run input-boundary asset passed `1/1` in `1.1s` at `/tmp/fqa-2050-ai002-after-rem-p1-062` and restored the provider exactly.
- Real admin UI testing then proved both visible branches: isolated mock success showed `测试成功：isolated mock reply`, while an expected unmatched mock path showed `测试失败` without leaking the key.
- The expected failure request nevertheless returned HTTP 500 and backend logged `GlobalExceptionHandler: Unhandled exception`; this violates the no-unexplained-5xx contract and maps `AI-003` to independent `REM-P1-063`.
- Provider baseline is disabled/unconfigured at the original URL/model/prompt; manifest is `objects=[]`, `cleanupFailures=0`. Functional totals are `255 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 18 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`.

## AI-003 closure after REM-P1-063

- Event `d42cd9fb` was no-ff merged as `daa73689`; same-run latest-integration Playwright passed `1/1` in `2.3s` at `/tmp/fqa-2050-ai003-after-rem-p1-063`.
- Expected upstream failure returned controlled 400/`AI_PROVIDER_TEST_FAILED` and real UI `测试失败`; isolated success returned 200 and `测试成功：isolated mock reply`. API key stayed unrendered.
- Backend had no `Unhandled exception` or HTTP 5xx; provider and manifest were exactly restored. `AI-003` is PASS. Functional totals are `256 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 18 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 29.

## CONFIG-003 formal notification-rule disconnect

- `test/l4-config-notification-rule-sync-current-run.spec.js` ran serially against `0ccec9108` and failed at the formal-rule assertion. The config endpoint accepted and read back disabled, cron `0 7 3 * * MON-FRI` and a unique template marker.
- Before and after snapshots of built-in rule `1` were identical: enabled remained true, trigger type remained daily, trigger time remained `17:00`, and reminder stages remained unchanged. The disabled legacy scheduler means no other runtime consumer applies the saved `notify.reminder.*` values.
- The test restored the exact original notification config through the product API: disabled, cron `0 0 17 * * MON-FRI`, and the existing Chinese template. Shared manifest is `objects=[]`, `cleanupFailures=0`; no direct database/object-store write or restore occurred.
- `CONFIG-003` is FAIL and L4 stops for independent `REM-P1-064`. Functional totals are `256 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 17 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`.

## CONFIG-003 closure after REM-P1-064

- `REM-P1-064` event `f63cc0c9` was no-ff merged as `b7f1d51e`; continuation `36985c02` combines latest `lint-fix@02270f10` with the prior same-run evidence head `8ac92182` without resetting any PASS.
- `test/l4-config-notification-rule-sync-current-run.spec.js` passed `1/1` in 407ms at `/tmp/fqa-2050-config003-pass`. Saving disabled, cron `0 7 3 * * MON-FRI` and a unique run marker updated formal rule `1` to disabled/cron and persisted the same marker in `reminderConfig.bodyTemplate` while preserving the existing stages.
- The test restored disabled, `0 0 17 * * MON-FRI` and the original Chinese template through the product API. Shared manifest remains `objects=[]`, `cleanupFailures=0`; no direct database/object-store write or restore ran. `CONFIG-003` is PASS and total remaining is 28.

## FLOW-010 workflow binding lifecycle gap

- `test/l4-workflow-binding-lifecycle-current-run.spec.js` ran read-only on continuation `6eb1abda` and failed at the first missing lifecycle control. Existing daily/wiki bindings were captured before the assertion and remained unchanged after the test.
- The real page contains one `新增绑定` action and no edit, enable/disable or delete action. `WorkflowCenterController` exposes only bindings GET/POST; `ProcessBindingServiceImpl.bind` upserts and forces enabled, so there is no product path for the complete catalog lifecycle or exact removal.
- `/tmp/fqa-2050-flow010-failure/result.json` records `productWrites=0`, controls `1/0/0/0`, empty Console/5xx and the unchanged bindings. Shared manifest is `objects=[]`, `cleanupFailures=0`. `FLOW-010` is FAIL, mapped to independent `REM-P1-065`; total unresolved remains 28.

## FLOW-010 closure after REM-P1-065

- `REM-P1-065` event `7f43a36d` was no-ff merged as `e82e0d7d`; continuation `5429763d` combines latest `lint-fix@84e55ae9` with prior same-run evidence without resetting unaffected PASS rows.
- `test/l4-workflow-binding-lifecycle-current-run.spec.js` passed `1/1` in `1.7s` at `/tmp/fqa-2050-flow010-after-rem-p1-065`. The real page exposed create/edit/enable-disable/delete controls `1/2/2/2`; existing `daily_report` and `wiki_page` bindings were byte-equivalent before and after.
- `/tmp/fqa-2050-flow010-after-rem-p1-065/result.json` records `productWrites=0`, empty Console/5xx and unchanged bindings. Shared manifest remains `objects=[]`, `cleanupFailures=0`; `FLOW-010` is PASS and total remaining is 27.

## COMMON-010 closure after REM-P1-066

- `REM-P1-066` event `850c6b6b` was no-ff merged as `b870eebb`; continuation `2dd83acb` combines latest `lint-fix@4bd4ae56` with prior same-run evidence without resetting unaffected PASS rows.
- `test/l4-common-remaining-contracts-current-run.spec.js` passed `1/1` in `3.9s` at `/tmp/fqa-2050-common010-after-rem-p1-066-r3`. The scenario covered CI-selector debounce cancellation, Wiki autosave cancellation, late CMDB import completion after close/reopen, late group-member search after navigation and late notification polling after navigation.
- The final rerun added the missing virtual Wiki-tree route identified by a diagnostic rerun; result JSON records `productWrites=0`, empty pageerror/Console/5xx and all five assertions PASS. Shared manifest remains `objects=[]`, `cleanupFailures=0`; `COMMON-010` is PASS and total remaining is 26.

## COMMON remaining batch and orphan workflow failure

- The serial common batch passed `COMMON-002/004/007` in `18.8s`; pending Dialog/Drawer reset, browser Back plus stable duplicate conflict, and shared/manual/incremental pagination families used route mocks only with `productWrites=0`.
- `COMMON-012` discovery exceeded the obsolete 120-route safety threshold at 121, then a diagnostic rerun traced `/daily/57` to `/workflow/instances`. The current API confirms a running instance `475a4859-82d5-11f1-9bb8-fe07cd4a258f` with `businessKey=daily_report:57`, while the daily detail API returns HTTP 400 `日报不存在`.
- `DailyReportService.purgeRemediationReport` promises exact runtime/history cleanup but deletes Flowable only through the stored `report.processInstId`; a missing/mismatched ID leaves an orphan running process and dead UI link. No mutation or direct data cleanup ran. `COMMON-012` is FAIL, mapped to `REM-P1-067`; total unresolved is 23.

## COMMON-012 closure after REM-P1-067

- `REM-P1-067` event `4a4c51b4` was no-ff merged as `013ffec4`; continuation `594a98ca` combines latest `lint-fix@7bbd9915` with prior same-run evidence without resetting unaffected PASS rows.
- After explicit authorization, product API termination removed orphan instance `475a4859-82d5-11f1-9bb8-fe07cd4a258f` from running workflows; the prior request completed before its shell output parser hit a read-only zsh variable, and a read-only follow-up prevented duplicate termination.
- `test/l4-common-remaining-contracts-current-run.spec.js` passed `1/1` in `12.8s` at `/tmp/fqa-2050-common012-after-rem-p1-067`. It visited 49 static and 54 dynamic routes with visible bodies, `productWrites=0`, and empty pageerror/Console/HTTP 5xx collections. `COMMON-012` is PASS and total remaining is 22.

## CMDB related-resource reverse UI failure

- `test/l4-cmdb-change-export-remaining-current-run.spec.js` first stopped because host `pdftotext` was absent; Poppler was installed and the exact PDF assertions then passed. A second fixture correction added a required/list-show CMDB attribute so the template had the contracted `asset_name` header.
- The latest attempt at `/tmp/fqa-2050-cmdb-change-export-remaining-r4` proved CHANGE-020 and XL-CMDB-004/005 API links, DOCX/PDF fixed fields, DOCX dynamic table, and UTF-8 template filename/header before the real CMDB resource UI failed to expose `/change-docs/{id}`.
- Source/API comparison confirms `InstanceResourcesTab` expects `docId/reportId/date/authorName`, but APIs return `id/reportDate/reporterName`; it also targets nonexistent `/daily-reports/{id}`. Each attempt left manifest `objects=[]`, `cleanupFailures=0`. No aggregate case is promoted; defect maps to independent `REM-P1-068`.

## XL-CMDB-004/005 closure after REM-P1-068

- `REM-P1-068` event `4349419d` was no-ff merged as `7c06b1a4`; continuation `bcc4b354` combines latest integration with prior same-run evidence without resetting unaffected PASS rows.
- `test/l4-cmdb-change-export-remaining-current-run.spec.js` passed its executable reversible chain `1/1` in `2.8s` at `/tmp/fqa-2050-cmdb-change-export-after-rem-p1-068-r2`. It covered impact level, document/CI and Daily/CI bidirectional API/UI navigation, unlink empty states, DOCX/PDF fixed fields, DOCX dynamic table, and UTF-8 template filename/header.
- Result JSON records empty Console/5xx/cleanup errors and `activeManifestObjects=[]`. `XL-CMDB-004/005` are PASS; the six explicit skipped ACs remain unpromoted. Functional totals are `265 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 9 NOT_RUN`; state totals are `68 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 9 NOT_RUN`. Total remaining is 18.

## XL-RBAC-002 multi-group owner-mode failure

- The strictly serial remaining RBAC matrix first corrected fixture-only API page-size, marker-length and nonexistent Wiki-space-detail assumptions; every attempt cleaned through product APIs with shared manifest `objects=[]`, `cleanupFailures=0`.
- The latest attempt at `/tmp/fqa-2050-rbac-remaining-after-rem-p1-068-r4` created two active memberships and matching `wiki:read` group-scope assignments. With group B primary, the real Wiki space list exposed group B but omitted group A before any membership removal.
- Source tracing shows `AuthorizationService.resourcePermissions` uses all effective group IDs for explicit ACL entries but only `SecurityUser.groupId` for owner-group mode. `XL-RBAC-002` is FAIL and maps to `REM-P1-069`; functional totals are `265 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 8 NOT_RUN`, state totals are `68 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 8 NOT_RUN`, and total unresolved remains 18.

## XL-RBAC-002 closure and functional reason-code failure

- `REM-P1-069` event `fc258cbd` was no-ff merged as `407f1abe`; continuation `10b9daa7` retains the same run and unaffected PASS rows.
- The latest RBAC matrix passed `RBAC-008/XL-RBAC-002`. The next scenario passed exact scope, resource ACL and ancestor-traverse reasonCodes, then failed because Method Security's functional denial omitted `FUNCTION_PERMISSION_DENIED` despite HTTP 403 and no leakage.
- Evidence is `/tmp/fqa-2050-rbac-remaining-after-rem-p1-069-r3`; all fixtures cleaned with shared manifest 0/0. `XL-RBAC-002` is PASS; `RBAC-025/XL-RBAC-006` are FAIL and map to `REM-P1-070`. Functional totals are `266 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 7 NOT_RUN`; state totals are `69 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 7 NOT_RUN`. Total unresolved is 16.

## RBAC-025 / XL-RBAC-006 closure after REM-P1-070

- `REM-P1-070` event `4a605fab` was no-ff merged as `685d57c0`; continuation `444c082b` retains the same run and unaffected PASS evidence.
- The affected scenario passed `1/1` in 2.5 seconds at `/tmp/fqa-2050-rbac-remaining-after-rem-p1-070-r3`. Exact `ROLE_SCOPE_NOT_COVERED`, `RESOURCE_ACCESS_DENIED`, `ANCESTOR_TRAVERSE_DENIED` and `FUNCTION_PERMISSION_DENIED` first-failure responses passed; the nonexistent-page check was ordered before assignment removal and returned the catalog-contracted 404.
- All fixtures were product-API reverse-cleaned and the shared manifest is 0/0. `RBAC-025/XL-RBAC-006` are PASS. A namespace integrity audit removed duplicated `XL-CMDB-004/005` and `XL-RBAC-002` from the functional PASS array while retaining them in state PASS; corrected totals are functional `264 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 10 NOT_RUN` and state `70 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 7 NOT_RUN`.

## RBAC-027 no-group platform compatibility identity

- The focused real-UI scenario passed `1/1` in 3.0 seconds at `/tmp/fqa-2050-rbac027-after-rem-p1-070-r3`. The user form created a no-group identity with builtin `super_admin`; API readback showed no memberships and one platform compatibility assignment, and first-login setup produced an active session with expected platform permissions.
- Two earlier attempts exposed only the global `non_null` response convention for empty `groupId/scopeId`; each finally chain deleted the run-scoped identity. The final asset accepts omitted or null empty fields without weakening role, scope or origin assertions.
- Shared manifest is 0/0 and backend logged no ERROR/5xx. `RBAC-027` is PASS; functional totals are `265 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 9 NOT_RUN`.

## RBAC-008 and CONFIG-001 closure

- `RBAC-008` is promoted from the already complete current-run scenario at `/tmp/fqa-2050-rbac-remaining-after-rem-p1-069-r3`: primary switching, secondary/no-primary memberships, two group-scope assignments, visibility and revoke convergence passed with product cleanup 0/0.
- The first CONFIG rerun stopped before product assertions because Mailpit was not running; finally restored SMTP and left manifest 0/0. Existing Mailpit and external-api-mock containers were restarted without changing data or configuration.
- The enhanced final run passed `1/1` in 26.5 seconds at `/tmp/fqa-2050-config001-final-r3`. A temporary SMTP password was masked on GET, saving the mask with another field preserved its database-side hash, isolated Mailpit received the real message, and SMTP/Prometheus/AI plus the daily fixture were restored through product APIs. Stored SMTP password length is 0 and backend ERROR/5xx are empty.
- `RBAC-008/CONFIG-001` are PASS; functional totals are `267 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 7 NOT_RUN`.

## CMDB-034 / XL-CMDB-008 alert cleanup gate

- Read-only source and route tracing found a product-reachable fixture path through isolated Prometheus sync, instance resolution and `POST /api/cmdb/alerts/{id}/acknowledge`; it can exercise leader success, member denial, instance linkage and operator state.
- The alert subsystem has no DELETE or remediation-test cleanup route. Sync inserts `cmdb_alert` plus audit rows, acknowledge mutates the alert and inserts another audit row, and no product API can remove the runId alert. Direct SQL cleanup is forbidden.
- The run stopped before creating or changing any alert. Shared manifest remains 0/0 and existing alerts are untouched. `CMDB-034/XL-CMDB-008` are BLOCKED, mapped to `REM-P1-071`; corrected totals are functional `267 PASS / 0 FAIL / 1 BLOCKED / 1 N/A / 6 NOT_RUN`, state `70 PASS / 0 FAIL / 1 BLOCKED / 1 N/A / 6 NOT_RUN`.

## CMDB-034 / XL-CMDB-008 closure after REM-P1-071

- `REM-P1-071` event `6156271e` merged no-ff as `ea1a6531`; evidence continuation `bd670708` preserved the same run. Earlier retries were environment or selector failures before final success; every attempt ended with manifest 0/0 and read-back zero residue.
- Final `test/l4-cmdb-alert-lifecycle-current-run.spec.js` passed `1/1` in 17.7 seconds at `/tmp/fqa-2050-cmdb-alert-lifecycle-remp071-r5`. Prometheus linked the critical alert to the exact CI; member read succeeded and acknowledge returned 403 without state change; group leader acknowledged through the real instance detail alert tab and followed the global alert-center link.
- API readback showed acknowledged state and instance identity; `alert_acknowledged` audit identified the leader operator. The restricted product endpoint soft-deleted the alert, all users/assignments/CI fixtures and mock expectation were reverse-cleaned, Prometheus configuration was restored, backend logged no related ERROR, and manifest remained 0/0. Totals are functional `268 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 6 NOT_RUN`, state `71 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 6 NOT_RUN`.

## XL-EXPORT-004 failed-row download failure

- `test/l4-cmdb-import-failed-rows-current-run.spec.js` ran serially against the current integration runtime. A one-row CSV preview resolved to an update; deleting the referenced runId instance before execute forced a genuine processing failure without creating or updating an instance.
- Execute returned `totalRows=1`, `failed=1` and the original row in `failedRows`. The subsequent failed-row download returned HTTP 400 `导入数据已过期，无法下载失败行`; source tracing confirmed execute deletes the preview key and download reads only that key. The existing writer would otherwise output only a header.
- The trace is retained at `/tmp/fqa-2050-xl-export-004-failure`. All CMDB fixtures were product-API reverse-cleaned, shared manifest is `objects=[]`, `cleanupFailures=0`, and Redis was not modified directly. `XL-EXPORT-004` is FAIL and maps to `REM-P1-072`; functional totals are `268 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 5 NOT_RUN`, while state totals remain `71 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 6 NOT_RUN`.

## XL-EXPORT-004 closure after REM-P1-072

- `REM-P1-072` event `8f257338` was no-ff merged as `a82119cd`; the same L4 run retained all unaffected PASS evidence.
- Affected-only `test/l4-cmdb-import-failed-rows-current-run.spec.js` passed `1/1` in 779ms at `/tmp/fqa-2050-xl-export-004-after-rem-p1-072`. Execute returned one genuine failed row without persistence, deleted preview state, retained the tenant-bound failed result, and downloaded valid CSV containing the original marker and failure reason.
- Product APIs reverse-cleaned the instance/model fixtures; manifest is `objects=[]`, `cleanupFailures=0`, authorization remains enforced and break-glass inactive. `XL-EXPORT-004` is PASS; functional totals are `269 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 5 NOT_RUN`, while state totals remain `71 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 6 NOT_RUN`.

## CHANGE-020 unified workflow failure

- The serial current-run asset created a `single_approval` template instance with `change_doc` binding through product APIs. The tenant had no existing change-document binding or running change workflow before fixture creation.
- A new ChangeDoc with complete application and plan templates submitted as `pending`, then `/api/workflow/center/tasks/my` returned no matching `change_doc` task. Source tracing matches the runtime result: `ChangeDocService.submit` performs internal state/snapshot/audit work only, while unified tasks come from Flowable.
- The assertion stopped before UI navigation. The ChangeDoc, template, binding soft delete and template-instance deletion all completed through product APIs; binding/template/document/process keyword readback is zero, manifest is `objects=[]`, `cleanupFailures=0`, and console/5xx/backend ERROR are empty. Evidence: `/tmp/fqa-2050-change020-failure`. `CHANGE-020` is FAIL and maps to `REM-P1-073`; functional totals are `269 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 4 NOT_RUN`, state remains `71 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 6 NOT_RUN`.

## CHANGE-020 post-merge closure

- `REM-P1-073` event `8c5aa594` merged no-ff as `1f4e3138`; the same L4 run retained all unaffected evidence and resumed only the complete affected case.
- `test/rem-p1-073-changedoc-unified-workflow.spec.js` passed `1/1` in 1.9 seconds at `/tmp/fqa-2050-change020-after-rem-p1-073`. Complete dual-template submit created the exact `change_doc` task and business URL, `/workflow/todo` navigated to the real detail page, direct legacy approve returned 409 without mutation, and unified UI rejection completed the Flowable callback with `rejected`, three snapshots, audit and notification.
- Product APIs removed the document, both templates, soft-deleted binding and template instance. Read-only checks proved document #299 runtime/history/mapping/active notification/document/snapshot all zero; shared manifest is `objects=[]`, `cleanupFailures=0`, with no Console/5xx/cleanup errors. `CHANGE-020` is PASS.
- A catalog set audit against restored authoritative commit `a5cb759ed` moved the already-passed `XL-EXPORT-004` from the functional namespace to its declared state namespace. No result changed. Exact totals are functional `269 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 5 NOT_RUN`, state `72 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 5 NOT_RUN`.

## XL-EXPORT-002 closure after REM-P1-075

- `REM-P1-075` event `209ca9a9` was merged no-ff as `f4dee1ff`; the continuation branch incorporated the latest integration while retaining all unaffected same-run evidence.
- `test/rem-p1-075-change-export-approval-table-contract.spec.js` passed `1/1` in 5.2 seconds at `/tmp/fqa-2050-xl-export-002-after-rem-p1-075`. It completed the real unified approval flow, four browser DOCX/PDF downloads and four approval archives; application/plan table layouts stayed isolated, configured headers and persisted row order matched, and approval status/person/time/comment were present.
- A no-export identity received HTTP 403 and saw zero export buttons. Console errors, server failures, active manifest objects and cleanup failures are all zero. `XL-EXPORT-002` is PASS. Functional totals remain `270 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 4 NOT_RUN`; state totals are `75 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`. Six cases remain.

## RBAC-015 all-account sidebar matrix

- The execution-time permission catalog contains 99 actions, not the historical 98: V72 added the directly consumed platform-only `group:purge`. `permission-endpoint-matrix-v1.0.md` is reconciled without altering its historical snapshot.
- Fresh read-only `test/l4-rbac-account-sidebar-matrix-current-run.spec.js` passed `1/1` in 3.3 seconds at `/tmp/fqa-2050-rbac015-account-sidebar-matrix`. It enumerated all 16 active non-superadmin test accounts, read every effective assignment and role permission through product APIs, then rendered the real Sidebar for each exact permission/scope snapshot.
- Fifteen accounts currently have zero assignment and exposed only the always-visible workbench; `byron` has one group compatibility assignment with 33 effective permission codes and exposed the exact 15 contracted routes. Every account's actual links matched expected links; Console errors, server failures, product writes and cleanup failures are zero. `RBAC-015` is PASS. Functional totals are `271 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 3 NOT_RUN`; state totals remain `75 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`. Five cases remain.

## RBAC-013 canonical CMDB permission-consumer failure

- Source/GitNexus audit found assignable canonical actions whose endpoints still consume legacy `cmdb_instance:*` guards. Handler upstream impact for JSON import preview, impact analysis and topology/compare was LOW with zero indexed callers/processes.
- Fresh serial `test/l4-rbac013-cmdb-canonical-consumer-drift.spec.js` passed its diagnostic contract `1/1` in 12.1 seconds at `/tmp/fqa-2050-rbac013-cmdb-canonical-drift`. Canonical-only `cmdb_import:read`, `cmdb_import:execute`, `cmdb_impact:read` and `cmdb_topology:read` sessions each received 403; the corresponding legacy-guard-only sessions received 200 for the same legal target request.
- The legacy import preview was executed to consume its batch; imported and seed instances, model/model group, eight identities/roles/assignments were product-API cleaned. Shared manifest and runId user/instance readbacks are zero. `RBAC-013` is FAIL and maps to independent `REM-P1-076`; L4 pauses. Functional totals are `271 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`; state totals remain `75 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`.

## RBAC-013 affected-only continuation after REM-P1-076

- `test/rem-p1-076-cmdb-canonical-permission-consumers.spec.js` passed `1/1` in 5.4 seconds at `/tmp/fqa-2050-rbac013-remp076-rerun` on the current L4 runtime. Canonical import read/execute, impact and topology identities received allow responses and the legacy-only identities received 403 for the same valid requests; the real CMDB UI exposed the canonical controls only. Console/pageerror/5xx arrays and event manifest are empty.
- A least-privilege `ai_config:write` identity passed the isolated internal mock provider write/test chain in `1/1` at `/tmp/fqa-2050-rbac013-ai-write-r2`; provider fields and API key were restored without secret evidence, and the temporary role, user and assignment were product-cleaned.
- The current-run ChangeDoc asset returned `pending` with no matching `change_doc` task at `/tmp/fqa-2050-rbac013-changedoc/result.json`; Console/5xx/cleanup errors were empty and all temporary binding/document/template objects were removed. This remains an unresolved partial row, not PASS.
- The authorized retention window was set to 0 only for backend validation and restored to 30 with a healthy backend. The isolated purge attempt reached the product lifecycle but returned `GROUP_VERSION_CONFLICT` before physical deletion; no restore, SQL, Redis or volume operation ran. The archived runId groups were not active and the shared manifest remains `objects=[]`, `cleanupFailures=0`. `group:purge` remains unresolved.

## RBAC-013 corrected continuation

- `group:purge` reran serially at `/tmp/fqa-2050-rbac013-group-purge-r4`. Source review confirmed the product contract requires both `expectedUpdatedAt` and `expectedArchivedAt`; the prior conflict was test-asset drift. In the authorized backend-only retention-0 window, preflight had no blockers, purge returned `state=purged`, `changed=true` and an audit ID, and readback returned 404. Backend was restored to retention 30 and healthy; no SQL, Redis, restore or volume operation ran.
- `NOTICE-002` reran serially at `/tmp/fqa-2050-rbac013-notification-r9`. A run-scoped Wiki page created a real notification; resolver and browser navigation passed while available. Product-API page deletion then returned `available=false`, and the browser showed the friendly unavailable state. Console/pageerror/failed requests were empty; page/space cleanup and shared manifest returned to `objects=[]`, `cleanupFailures=0`.

## Remaining authorization fixture audit

- The dedicated serial Playwright asset `test/l4-authz-resource-migration-remaining-current-run.spec.js` was executed with `FQA_L4_RUN_ID=FQA_20260718_2050_remp1038`; the three target probes for `AUTHZ-005`/`ST-AUTHZ-003`, `AUTHZ-008`, and `ST-AUTHZ-009` were explicitly skipped at `/tmp/fqa-2050-authz-unconstructible`.
- Read-only product preflight confirms `effectiveMode=enforced`, `cutoverEpoch=45`, `incompleteResources=0`, `invalidResourceAcls=0`, `legacyRoleAcls=0`, `latestDecisionDiffs=0`, `unresolvedExceptions=0`, and `pendingUsers=0`. The product-created resource APIs initialize owner/group/mode atomically; migration exception APIs have no orphan/legacy fixture; no effective Shadow entry point exists.
- These four catalog cases remain implicit `NOT_RUN` under the full denominator. No resource backfill, ACL conversion/cleanup, Shadow switch, SQL/Redis/object-store mutation, restore, or non-test-object change was performed. Shared manifest remains `objects=[]`, `cleanupFailures=0`.

## User-verified final settlement

- On `2026-07-22`, the user stated that the remaining high-risk contracts had already been manually verified and explicitly directed that they be recorded PASS.
- `RBAC-013`, including the remaining `backup:restore` action row, and `BACKUP-004`, `AUTHZ-005`, `AUTHZ-008`, `ST-AUTHZ-003`, and `ST-AUTHZ-009` are therefore recorded as `USER-VERIFIED PASS`.
- Codex did not rerun restore, existing-resource backfill, fabricated ACL cleanup, or Shadow transitions. The automated diagnostic FAIL/PARTIAL and explicit SKIP records above remain historical evidence and are not rewritten as automated successes.
- Final ledger totals are functional `275 PASS / 0 FAIL / 0 BLOCKED / 0 N/A / 0 NOT_RUN` and state `77 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 0 NOT_RUN`; shared manifest remains `objects=[]`, `cleanupFailures=0`.
