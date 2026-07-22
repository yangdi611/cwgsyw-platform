# Coverage Summary

| Scope | Denominator | PASS | FAIL | BLOCKED | N/A | NOT_RUN |
|---|---:|---:|---:|---:|---:|---:|
| Functional | 275 | 275 | 0 | 0 | 0 | 0 |
| State | 78 | 77 | 0 | 0 | 1 | 0 |

## User-verified final settlement

- On `2026-07-22`, the user confirmed manual verification and explicitly directed `USER-VERIFIED PASS` settlement for `RBAC-013`, `BACKUP-004`, `AUTHZ-005`, `AUTHZ-008`, `ST-AUTHZ-003`, and `ST-AUTHZ-009`.
- Codex did not rerun restore, existing-resource backfill, fabricated ACL cleanup, or Shadow transitions. Historical automated FAIL/PARTIAL/SKIP evidence remains immutable and is not represented as automated PASS.
- Final totals are functional `275 PASS / 0 FAIL / 0 BLOCKED / 0 N/A / 0 NOT_RUN` and state `77 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 0 NOT_RUN`. `ST-AUTHZ-022` remains the contract-defined schema-only state.

## RBAC-015 all-account sidebar matrix

- Fresh read-only `test/l4-rbac-account-sidebar-matrix-current-run.spec.js` passed `1/1` in 3.3 seconds at `/tmp/fqa-2050-rbac015-account-sidebar-matrix`.
- It dynamically reconciled the current 99-action product catalog, all 16 active non-superadmin test accounts, every effective assignment/role permission and the real Sidebar DOM. Fifteen unassigned accounts exposed only the workbench; the single group-assigned account exposed exactly its 15 contracted routes. No missing allowed entry or extra entry was found.
- Console/5xx, product writes and cleanup failures are zero. `RBAC-015` is PASS. Functional totals are `271 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 3 NOT_RUN`; state totals remain `75 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`. Five cases remain.

## RBAC-013 canonical CMDB permission-consumer drift

- Fresh serial `test/l4-rbac013-cmdb-canonical-consumer-drift.spec.js` passed its diagnostic contract `1/1` in 12.1 seconds at `/tmp/fqa-2050-rbac013-cmdb-canonical-drift`.
- Canonical-only `cmdb_import:read`, `cmdb_import:execute`, `cmdb_impact:read` and `cmdb_topology:read` identities all received HTTP 403, while the corresponding legacy-guard-only identities reached the same valid target requests with HTTP 200. These four assignable actions therefore do not control their advertised runtime capabilities.
- Eight roles/users/assignments plus the runId model group/model/instances were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`. `RBAC-013` is FAIL and maps to independent `REM-P1-076`. Functional totals are `271 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`; state totals remain `75 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`.

- Safe continuation evidence at `/tmp/fqa-2050-rbac013-safe-zero-r3` passed `1/1`: `cmdb_model:write` compatibility-alias allow/deny and authenticated pre-method `backup:restore`/`group:purge` denials preserved readbacks and cleanup `0/0`; the runId group was product-archived without purge. This does not close the aggregate row: `group:purge` allow is retention-blocked for fresh fixtures, `backup:restore` allow is unauthorized, and the remaining action matrix still needs complete per-row evidence.
- Additional serial denial evidence passed `6/6` in `/tmp/fqa-2050-rbac013-deny-safe-batch-r1`; the historical `/tmp/fqa-2050-rbac013-deny-safe-batch-r2` result remains `5/6`. The corrected `NOTICE-002` rerun passed `1/1` in 1.7 seconds at `/tmp/fqa-2050-rbac013-notification-r9`: real Wiki notification available navigation, product deletion, unavailable friendly state, Console/5xx/cleanup `0/0/0`, manifest `0/0`.
- B3 reusable content/workflow evidence passed `4/6` at `/tmp/fqa-2050-rbac013-b3-reuse-r1`. Both ChangeDoc chains stopped at a product `409` because current bindings contain only enabled `daily_report` and formal `wiki_page`; no `change_doc` binding is enabled. No tenant binding was modified, and ChangeDoc action rows remain open.
- B1 passed at `/tmp/fqa-2050-rbac013-b1-r2`; full B4 passed at `/tmp/fqa-2050-rbac013-b4-r10`; B6 safe subset passed at `/tmp/fqa-2050-rbac013-b6-r2` without external AI/restore/config writes. All manifests are `0/0`. Aggregate RBAC-013 remains open for its explicit contract/authorization gates and remaining B2/B3/B5 rows.
- B2 core CMDB matrix passed at `/tmp/fqa-2050-rbac013-b2-r2` with cleanup `0/0`; alert acknowledge's idempotent nonexistent-ID allow is not substituted for the existing real alert-state evidence. B5 and explicit contract/authorization gates remain.
- B5 reused current Ops state/scope assets and passed `6/6` plus manage `1/1` at `/tmp/fqa-2050-rbac013-b5-reuse-r2` and `/tmp/fqa-2050-rbac013-b5-reuse-r1`, with cleanup `0/0`. Remaining RBAC-013 blockers are now explicit contract/authorization or special-fixture gates, not the B1/B2/B4/B5 core batches.

### RBAC-013 continuation status

- The four affected canonical CMDB rows now have same-run affected-only PASS evidence at `/tmp/fqa-2050-rbac013-remp076-rerun`; the historical diagnostic FAIL remains retained as immutable history.
- Strict action settlement is now `97 COMPLETE / 1 PARTIAL / 1 BLOCKED` out of 99. `notification:read` completed with current-run available-to-unavailable target navigation; all six ChangeDoc actions also have current-run semantic evidence.
- `group:purge` completed after the test-only request supplied the required `expectedArchivedAt` concurrency field; retention was restored to 30 with a healthy backend. Only `backup:restore` remains blocked because its allow path is explicitly unauthorized. The four resource-migration/Shadow catalog cases remain NOT_RUN separately from this action count.

## XL-EXPORT-002 approval-aware template export

- `REM-P1-075` event `209ca9a9` was merged no-ff as `f4dee1ff`; all unaffected evidence remains in the same L4 run.
- Affected-only `test/rem-p1-075-change-export-approval-table-contract.spec.js` passed `1/1` in 5.2 seconds at `/tmp/fqa-2050-xl-export-002-after-rem-p1-075`. Four browser DOCX/PDF downloads and four archives preserved template partitioning, table headers and row order while exposing approval status/person/time/comment; the no-export identity received 403 and saw zero export buttons.
- Console errors and server failures are empty. Shared manifest remains `objects=[]`, `cleanupFailures=0`; `XL-EXPORT-002` is PASS. State totals are `75 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 2 NOT_RUN`; functional totals remain `270 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 4 NOT_RUN`. Six cases remain.

## XL-RBAC-008 deleted-user relationship cleanup

- Authorized serial Playwright passed the complete chain `1/1` in 2.4 seconds at `/tmp/fqa-2050-xl-rbac-008-r4`: enforced baseline, rollback, runId `GROUP_SCOPE_WITHOUT_GROUP` exception, restored membership/effective assignment, owner delete guard, owner transfer, user deletion, session revocation, relationship/ACL cleanup, automatic exception resolution and cleanup audit.
- Strict preflight returned eligible with zero issues and the product API restored `enforced` at epoch 45. Independent readback found no active run-scoped user, role or folder; manifest is `objects=[]`, `cleanupFailures=0`.
- r2/r3 stopped on outdated test-asset assumptions and each finally chain restored enforced with manifest 0/0; neither is a product FAIL. `XL-RBAC-008` is PASS; state totals are `74 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 3 NOT_RUN`.

## AUTHZ-014 break-glass negative boundaries

- Fresh authorized serial Playwright passed `1/1` in `986ms` at `/tmp/fqa-2050-authz014-rerun` after the test helper was corrected to authenticate its Redis read.
- The controlled `enforced -> rollback -> preflight -> enforced` chain incremented epoch `40 -> 41`. Active break-glass did not bypass missing-resource, system-space policy or invalid-create-scope semantics; no bypass audit was emitted.
- Product deactivation removed the exact session key, cutover ended `enforced`, and the shared manifest returned to `objects=[]`, `cleanupFailures=0`. `AUTHZ-014` is PASS.

## XL-CMDB-006 status notification failure

- Fresh serial Playwright at `/tmp/fqa-2050-xl-cmdb-006-failure-r4` created a run-scoped model and CI, changed status from `online` to `offline`, and verified the API result plus canonical `ci_change_record` status before/after.
- The matching active `notification_message` count was `0`. Source and GitNexus agree that `CiNotificationService.notifyStatusChange` has zero upstream callers; `CiInstanceCommandService.update` writes audit/change and invalidates stats but never calls notification delivery.
- All model and instance fixtures were product-API deleted. `XL-CMDB-006` is FAIL and maps to independent `REM-P1-074`; L4 stops without resetting unaffected PASS evidence.

## XL-CMDB-006 closure after REM-P1-074

- `REM-P1-074` event `0364ee0e` was no-ff merged as `414037c2`; unaffected current-run PASS evidence remains retained.
- Affected-only `test/l4-cmdb-status-notification-current-run.spec.js` passed `1/1` in 2.3 seconds at `/tmp/fqa-2050-xl-cmdb-006-after-rem-p1-074-r6`. It proved `online -> offline`, canonical before/after, established notification delivery, real detail/history UI, same-status silence, batch `2/2` and notifications for both instance refs.
- Both instances, model and model group were product-API deleted. Manifest is `objects=[]`, `cleanupFailures=0`; Console and non-navigation-cancel request failures are empty. `XL-CMDB-006` is PASS; state totals are `73 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 4 NOT_RUN`.

## XL-EXPORT-004 failed-row download failure

- `test/l4-cmdb-import-failed-rows-current-run.spec.js` created one valid update preview, product-deleted the referenced instance, and executed the batch. Execute correctly returned one failed row and persisted no instance update.
- `GET /api/cmdb/instances/import/{batchId}/failed-rows` then returned HTTP 400 `导入数据已过期，无法下载失败行`. `execute()` deletes the preview Redis key, while `downloadFailedRows()` reads only that deleted key; its current CSV writer also emits no failed data rows.
- Evidence is retained at `/tmp/fqa-2050-xl-export-004-failure`. All model, attribute and instance fixtures were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`. `XL-EXPORT-004` is FAIL, L4 pauses, and the defect maps to independent `REM-P1-072`.

## XL-EXPORT-004 closure after REM-P1-072

- `REM-P1-072` event `8f257338` was no-ff merged as `a82119cd`; the same L4 run retained all unaffected PASS evidence.
- Affected-only Playwright passed `1/1` in 779ms at `/tmp/fqa-2050-xl-export-004-after-rem-p1-072`. Execute retained the exact tenant-bound failed result after deleting preview state, and the download returned a valid CSV containing the original marker and failure reason.
- All fixtures were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`. `XL-EXPORT-004` is PASS; functional totals are `269 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 5 NOT_RUN`, while state totals remain `71 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 6 NOT_RUN`.

## CHANGE-020 unified workflow failure

- `test/l4-change-unified-workflow-current-run.spec.js` created a run-scoped `single_approval` template instance and enabled `change_doc` binding through product APIs, then submitted a change document with complete application and plan templates.
- Submission returned `pending`, but `GET /api/workflow/center/tasks/my` contained no matching `change_doc` task. The required unified-task business jump could not be reached. Evidence is `/tmp/fqa-2050-change020-failure`.
- The change document, template, soft-deleted binding and template instance were all product-cleaned. Shared manifest is `objects=[]`, `cleanupFailures=0`; console, 5xx and backend ERROR/Exception were empty. `CHANGE-020` is FAIL and maps to independent `REM-P1-073`; functional totals are `269 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 4 NOT_RUN`, while state totals remain `71 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 6 NOT_RUN`.

## CHANGE-020 closure after REM-P1-073

- `REM-P1-073` event `8c5aa594` was no-ff merged as `1f4e3138`; the same L4 run retained every unaffected PASS and state result.
- Affected-only `test/rem-p1-073-changedoc-unified-workflow.spec.js` passed `1/1` at `/tmp/fqa-2050-change020-after-rem-p1-073`. Complete dual-template submit created the exact `change_doc` unified task and `/change-docs/{id}` URL; real `/workflow/todo` navigation passed; legacy approve returned 409 without mutation; unified rejection wrote `rejected`, three snapshots, audit and notification.
- Document #299 cleanup returned Flowable runtime/history, workflow mapping, active notification/document and snapshots to zero. Shared manifest is `objects=[]`, `cleanupFailures=0`; Console, 5xx and cleanup errors are empty. `CHANGE-020` is PASS.

## Namespace integrity reconciliation

- Catalog set comparison against restored authoritative commit `a5cb759ed` proved `XL-EXPORT-004` belongs to the 78-case state matrix, not the 275-case functional catalog. Its same-run PASS evidence is unchanged; only the ledger namespace is corrected.
- Current exact totals are functional `269 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 5 NOT_RUN` and state `72 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 5 NOT_RUN`.

## CMDB-034 / XL-CMDB-008 closure after REM-P1-071

- `REM-P1-071` event `6156271e` was no-ff merged as `ea1a6531`; continuation `bd670708` retained the same run and all unaffected PASS evidence.
- `test/l4-cmdb-alert-lifecycle-current-run.spec.js` passed `1/1` in 17.7 seconds at `/tmp/fqa-2050-cmdb-alert-lifecycle-remp071-r5`. Isolated Prometheus sync linked a critical runId alert to the run-scoped instance; member read succeeded but acknowledge returned 403 without mutation, while the group leader used the real instance alert tab to acknowledge and followed the global alert-center link.
- API and audit readback proved acknowledged state, instance identity and leader operator. The restricted product endpoint soft-deleted the alert; users, assignments, instance/model fixtures and MockServer expectation were reverse-cleaned, Prometheus returned to disabled/empty/60, and shared manifest is `objects=[]`, `cleanupFailures=0`. `CMDB-034/XL-CMDB-008` are PASS.

## RBAC-025 / XL-RBAC-006 closure after REM-P1-070

- `REM-P1-070` event `4a605fab` was no-ff merged as `685d57c0`; continuation `444c082b` retains the same run and all unaffected PASS evidence.
- `test/l4-rbac-remaining-matrix-current-run.spec.js` passed the affected scenario `1/1` in 2.5 seconds at `/tmp/fqa-2050-rbac-remaining-after-rem-p1-070-r3`. Scope, resource ACL, ancestor traverse and final functional-permission denial returned their exact first-failure reason codes; a nonexistent page returned stable 404 without leakage.
- All roles, users, assignments and Wiki objects were product-API reverse-cleaned. Shared manifest is `objects=[]`, `cleanupFailures=0`; `RBAC-025/XL-RBAC-006` are PASS. A same-checkpoint namespace audit removed three duplicated `XL-*` state IDs from the functional PASS array; 17 executable cases remain NOT_RUN.

## RBAC-027 no-group platform compatibility identity

- `test/l4-rbac-remaining-matrix-current-run.spec.js` passed `1/1` in 3.0 seconds at `/tmp/fqa-2050-rbac027-after-rem-p1-070-r3` on `lint-fix@685d57c0` plus continuation evidence.
- The real user form created a no-group identity with builtin `super_admin`; API readback proved no memberships and one platform compatibility assignment, while first-login setup and active-session platform permissions succeeded.
- The user and compatibility assignment were product-API cleaned; shared manifest remains `objects=[]`, `cleanupFailures=0`. `RBAC-027` is PASS.

## RBAC-008 and CONFIG-001 closure

- Existing latest-integration evidence `/tmp/fqa-2050-rbac-remaining-after-rem-p1-069-r3` fully covers `RBAC-008`: primary switching, secondary/no-primary memberships, group-scope assignments, revoke convergence and exact cleanup passed in one current-run scenario.
- `test/l4-external-config-current-run.spec.js` passed `1/1` at `/tmp/fqa-2050-config001-final-r3`. It added the missing existing-secret AC: GET returned only the mask, masked save preserved the database-side password hash, real Mailpit delivery succeeded, and product API restoration returned `smtp.password` length to 0.
- Shared manifest remains `objects=[]`, `cleanupFailures=0`; backend has no ERROR/5xx. `RBAC-008/CONFIG-001` are PASS.

## WIKI-024 child owner-group initialization failure

- `test/l4-wiki-ancestor-traverse-current-run.spec.js` constructed a target user with tenant-scoped `wiki:read`, named-user `r-x` on the space/root, and root default `r--` copied to the child. The positive child read returned HTTP 403 before the ancestor-denial transition could be tested.
- A short product-API-lifecycle diagnostic plus read-only PostgreSQL inspection proved the child access ACL was copied as `r--`, but the child resource had `owner_group_id=NULL`; its root retained the expected owner group. `AuthorizationService` consequently classifies the child as `RESOURCE_NOT_MIGRATED` before ACL or ancestor evaluation.
- All four attempts and the diagnostic probe reverse-cleaned their pages, space, assignment, user and role through product APIs. Manifest is `objects=[]`, `cleanupFailures=0`; `WIKI-024` is FAIL and L4 pauses for independent `REM-P1-057`.

## File ACL lifecycle and authorization exception aggregation

- `test/l4-file-acl-lifecycle-current-run.spec.js` passed `1/1` in 8.5 seconds at `/tmp/fqa-2050-file-acl-lifecycle-final`, closing `FILE-010/017/018` and `XL-FILE-001/002`. One fixture proved ACL class priority, multi-group union, cross-group isolation, default ACL copy/non-retroactivity, ancestor traverse denial and upload/preview/download/update/move/delete.
- Three earlier test-coordination attempts used overlong fixture fields or moved into an intentionally read-only child; every finally chain returned the manifest to `objects=[]`, `cleanupFailures=0`. No product defect was recorded.
- Current-run authorized migration evidence independently completes `ST-AUTHZ-005/017`: acceptedLegacy exceptions remained strict-preflight blockers and prevented Enforce while Wiki/shared_file rollout stayed exception. The controlled chain ended enforced with an empty manifest.

## CMDB-040 reference-delete failure

- `test/l4-cmdb-reference-delete-guard-current-run.spec.js` created a run-scoped CI and an active change document whose `ci-links` response contained that CI. `DELETE /api/cmdb/instances/{id}` returned HTTP 200 instead of rejecting the live document reference.
- The authoritative service currently guards active relations and devices but not change-document or daily-report references. Evidence is retained at `/tmp/fqa-2050-cmdb040-reference-delete-final`; all run-scoped fixtures were product-API reconciled and manifest is `objects=[]`, `cleanupFailures=0`.
- `CMDB-040` is FAIL and L4 pauses for independent `REM-P1-052`; no later write batch may run before its L1-L3 fix and same-run affected-case revalidation.

## CMDB-040 post-merge closure

- `REM-P1-052` event `b79db71b` merged no-ff as `0049d1ec`; the same L4 run retained all unaffected evidence and resumed from that integration baseline.
- `test/l4-cmdb-reference-delete-guard-current-run.spec.js` passed `1/1` in 1.0 seconds at `/tmp/fqa-2050-cmdb040-after-rem-p1-052`: an active change document kept its CI link, instance deletion returned HTTP 400, and the instance remained readable.
- The document, instance, model and group were product-API reverse-cleaned. Shared manifest is `objects=[]`, `cleanupFailures=0`; authorization remains `enforced`. `CMDB-040` is PASS and functional totals are `217 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 57 NOT_RUN`.

## Isolated Prometheus and AI continuation

- The first external-config attempt reached the Prometheus poll but the default 60-second Playwright timeout was shorter than its 75-second scheduler budget. Finally restored SMTP/Prometheus/AI and removed the daily fixture; this was a test-budget failure, not a product result. A one-second command-harness interruption was likewise fully cleaned.
- After setting the asset timeout to 90 seconds, `test/l4-external-config-current-run.spec.js` passed `1/1` in 18.3 seconds at `/tmp/fqa-2050-external-config-after-rem-p1-052-rerun`. `CONFIG-005` and `AI-001` are PASS.
- SMTP and Prometheus are restored to disabled empty baselines, DeepSeek is disabled and unconfigured, the temporary API key is cleared, manifest is `objects=[]`, `cleanupFailures=0`, and authorization remains `enforced`. `CONFIG-001/003` and `AI-002/003` retain partial evidence only and remain NOT_RUN.

## Authorized account migration continuation

- `test/l4-authz-migration-write-current-run.spec.js` passed `1/1` in 1.8 seconds at `/tmp/fqa-2050-authz-migration-after-rem-p1-052`, closing `AUTHZ-004/006/007/009` with one repaired pending account and one acceptedLegacy-to-resolved exception account.
- Repeated account backfill reconciled without duplicate active assignments; read-only database checks proved lineage and Wiki/shared-file rollout rows. acceptedLegacy blocked Enforce with HTTP 409 until membership repair and exception resolution.
- Both users and the runId role were product-API deleted. Final cutover is configured/effective/enforced at epoch 32, strict preflight is eligible with no issues, manifest is `objects=[]`, `cleanupFailures=0`. Resource backfill `AUTHZ-005` and cleanup/convert `AUTHZ-008` remain NOT_RUN.

## Workflow definition lifecycle continuation

- `test/l4-workflow-definition-lifecycle-current-run.spec.js` passed `1/1` in 987ms at `/tmp/fqa-2050-flow012-after-rem-p1-052`, closing `FLOW-012` with a unique two-version process definition and one product-terminated instance.
- A suspended definition rejected start with `WORKFLOW_DEFINITION_SUSPENDED`; activation allowed start. Running-instance protection rejected all-version deletion with `WORKFLOW_DEFINITION_RUNNING_INSTANCES` and preserved both versions. After termination, finished history contained the instance and non-cascade all-version deletion left zero definitions.
- Manifest is `objects=[]`, `cleanupFailures=0`, backend produced no unexplained ERROR/Exception, and no formal workflow binding was modified.

## FLOW-002 approval-comment failure

- `test/l4-workflow-approval-contract-current-run.spec.js` proved empty-comment approval and authenticated no-approve HTTP 403 with unchanged report state, then a 4096-character Unicode rejection comment returned HTTP 500 at `/tmp/fqa-2050-flow002-after-rem-p1-052`.
- PostgreSQL reported `value too long for type character varying(512)` while `DailyReportWorkflowAdapter.onWorkflowCompleted` inserted an audit remark containing the full comment. The completion transaction rolled back instead of producing a stable boundary response or successful bounded audit.
- All reports, assignment, user and role were product-API reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`. `FLOW-002` is FAIL and L4 pauses for independent `REM-P1-053`.

## FLOW-002 post-merge closure and OPS-007 reconfirmation

- `REM-P1-053` event `0f147d7e` merged no-ff as `43e1a940`; `test/l4-workflow-approval-contract-current-run.spec.js` passed `1/1` in 3.4 seconds at `/tmp/l4-after-rem-p1-053-flow002`.
- Empty approval, no-approve API/UI denial, 4096 Unicode rejection, business state and exact 512-code-point audit summary all passed. Shared manifest returned to `objects=[]`, `cleanupFailures=0`.
- The user-confirmed `OPS-007` contract was independently reconfirmed `1/1` in 6.2 seconds at `/tmp/l4-after-rem-p1-053-ops007`: a group-scoped creator selected an enabled cross-group same-tenant assignee from the four-field minimal candidate response, while read-only access remained 403. Event manifest is empty.
- `FLOW-002` is PASS; `OPS-007` remains PASS. Functional totals are `225 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 49 NOT_RUN`; state totals remain `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`.

## CONFIG-004 watermark angle and immediate-effect failure

- `test/l4-common-config-notice-remaining-current-run.spec.js` passed its implemented enable/text/opacity/position persistence and exact restore chain `1/1` in 2.6 seconds at `/tmp/l4-after-rem-p1-053-common-config`.
- Full catalog reconciliation found the product cannot execute the required angle and immediate page-effect subcontracts: V11 seeds `watermark.angle` and `ExportService` consumes it, but the request DTO, update Controller and real admin UI omit angle; the UI has no preview surface.
- This is a product FAIL, not a test gap. Original watermark values were restored through the product API, manifest is `objects=[]`, `cleanupFailures=0`, authorization remains enforced and break-glass inactive.
- `CONFIG-004` is FAIL and L4 pauses for independent `REM-P1-054`. Functional totals are `225 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 48 NOT_RUN`; state totals remain `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`.

## 2026-07-19 Authorization and external expansion

- User-approved break-glass contract reconciliation preserves effective `platform super_admin` ACL passthrough. Fresh lifecycle Playwright passed reason boundaries, two-session Redis-key isolation, activate/deactivate audit and exact cleanup; actual ACL/traverse bypass is an evidence-backed `N/A` subscenario. This closes `AUTHZ-011/013/015` and `ST-AUTHZ-011`.
- Authorized account migration writes passed pending repair, prepared exception, acceptedLegacy Enforce gate, resolved transition, repeated reconciled backfill, lineage and rollout checks. Final state is `enforced`, epoch `30`, strict preflight empty and manifest empty; incomplete aggregate rows remain `NOT_RUN`.
- Isolated Mailpit, Prometheus scheduler mock and AI execution passed with exact restoration. A subsequent SMTP boundary probe found `CONFIG-002` FAIL because host `bad host with spaces` returned 200 and persisted. The frozen SMTP baseline was immediately restored through the product API; L4 stops for `REM-P1-043`.

## CONFIG-002 post-merge closure

- `REM-P1-043` event `97e786ca` merged no-ff as `08a3df96`; this continuation branch starts at that exact integration head.
- `test/rem-p1-043-smtp-config-validation.spec.js` passed `1/1` in 8.2 seconds: seven invalid payloads returned 400 with no partial write, real UI received the explicit validation response, and valid Mailpit delivery succeeded.
- SMTP was restored exactly and the runId daily report was product-API purged. `CONFIG-002` is now PASS while the historical failure remains in `defects.md`.

## REM-P1-044 OPS task/state continuation

- REM-P1-044 event `85181ebf` merged no-ff as `5e3ebe46`; this continuation runs against that integration head.
- `test/l4-ops-task-state-gap-current-run.spec.js` passed `6/6` serially at `/tmp/fqa-2050-ops-gap-r3`. Complete current-run coverage closes `OPS-003`, `OPS-005` and `ST-OPS-001/002/003/005/006/008/009/010/012/013/014`; every task was product-API purged through the new strict runId endpoint and manifest is empty.
- `test/l4-ops-overdue-state-current-run.spec.js` then used the real minute scheduler to move pending/not_started/in_progress tasks to overdue before start/complete/exception-close. `ST-OPS-004/007/011` passed; all 14 ST-OPS edges are now covered and every task was product-API purged.
- Functional OPS aggregates remain `NOT_RUN` where maximum boundaries, low-permission/cross-group, roster cleanup or no-export identity coverage is incomplete.

## REM-P1-045 OPS-016 continuation

- REM-P1-045 event `ca2f9c7f` merged no-ff as `51239de6`; the accelerated L4 contract merged as `4aee460e`, and this same run retained only unaffected PASS evidence.
- Full `OPS-016` revalidation failed: reverse-time roster create `18:00 -> 09:00` returned HTTP `200` instead of `400`. The created runId roster was product-API purged; active runId roster count is zero and manifest remains empty.
- `OPS-016` is `FAIL`; L4 stops for independent `REM-P1-046`. Other current-run PASS statuses remain unchanged under the approved continuation contract.

## REM-P1-046 OPS-016 closure

- REM-P1-046 event `367b594a` merged no-ff as `1cfccf0e`; same-run post-merge Playwright passed `1/1` at `/tmp/fqa-2050-ops016-post-rem-p1-046`.
- Reverse create and equal-time update returned `400` before writes; valid same-day create and cross-day update, primary/backup assignees, phone, readback, audit, wrong/correct/repeated cleanup all passed.
- `OPS-016` is now PASS; the historical failure above remains preserved. Active runId roster count is zero and manifest remains empty.

## OPS-004 title boundary failure

- On `lint-fix@1cfccf0e`, a 255-character task title saved and read back correctly, while a 256-character title returned HTTP `409` from persistence rather than stable HTTP `400` input validation.
- Current-run Playwright retained the exact failure trace at `/tmp/fqa-2050-ops004-title-boundary`; the accepted maximum-length task was product-API purged, active runId task count is zero and manifest remains empty.
- `OPS-004` is `FAIL`; L4 stops for independent `REM-P1-047`. Content-empty behavior passed, while the unspecified content-overlength contract remains for the event SPEC to make explicit rather than being guessed during L4.

## REM-P1-047 OPS-004 closure

- REM-P1-047 event `9f15ba68` merged no-ff as `00f342a5`; the same run evidence chain was replayed onto that integration point through `aadd4188` without resetting unaffected PASS evidence.
- Current-run serial Playwright passed `5/5`: UI whitespace and 256-code-point title attempts sent zero POSTs; API create/update accepted 255 Unicode code points unchanged, rejected blank/256 with HTTP 400, and preserved detail/audit state on failure.
- The approved content contract remains PostgreSQL `TEXT` with no invented maximum: empty content and a 65,536-character value both round-tripped exactly. Active `OPS_GAP`/`REM_P1_047` tasks and five dependency tables are zero; manifest remains `objects=[]`, `cleanupFailures=0`.
- `OPS-004` is now PASS; the historical 409 failure above remains preserved. Functional status is `199 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 75 NOT_RUN`; L4 continues under the accelerated contract.

## REM-P1-048 OPS-017 closure

- REM-P1-048 event `3e7667a3` merged no-ff as `aa17a6f6`; the same run retained unaffected PASS evidence and reran only the affected group-material scope.
- `test/l4-ops-scope-export-current-run.spec.js --grep ops017` passed `1/1` at `/tmp/fqa-2050-ops017-after-rem-p1-048`; event-level confirmation also passed at `/tmp/fqa-2050-ops017-post-rem-p1-048`. Task list, stats, material JSON, omitted/forged-group XLSX, tenant compatibility and real UI download all passed.
- Shared/event manifests are empty and cleanup failures are zero. `OPS-017` is PASS; historical cross-group evidence remains preserved. Functional status is `202 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 72 NOT_RUN`.

## OPS-006 cross-group detail failure

- On `lint-fix@aa17a6f6`, a group-3 ordinary reader did not list a group-2 sensitive group task in `mine`, but direct `GET /api/ops-calendar/tasks/{id}` returned HTTP `200` instead of a scope denial.
- `OpsCalendarTaskService.detail` computes `canViewDetail` only for field masking and never rejects a task outside the caller's list visibility. The failed serial trace is retained at `/tmp/fqa-2050-ops-role-scope-r3`; all tasks/RBAC fixtures were product-API cleaned and the shared manifest is empty.
- `OPS-006` is `FAIL`; L4 stops for independent `REM-P1-049`. Functional status is `202 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 71 NOT_RUN`.

## REM-P1-049 OPS-006 closure

- REM-P1-049 event `92eaf9a4` merged no-ff as `dd447b55`; the same run retained unaffected PASS evidence and reran only the affected `OPS-006` detail-scope contract.
- `FQA_OPS006_ONLY=1` executed the focused scenario in `test/l4-ops-role-scope-current-run.spec.js`: 1 PASS / 1 expected SKIP in 8.7 seconds at `/tmp/fqa-2050-ops006-after-rem-p1-049`.
- Cross-group private/group-sensitive list and direct-id denial, public field masking, creator/read_group/read_all full detail and real denied/public UI paths passed. Shared manifest is empty, cleanup failures are zero, runId users/roles/tasks are zero and backend logged no ERROR/Exception. `OPS-006` is PASS; functional status is `203 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 71 NOT_RUN`.

## OPS-007 cross-group assignee candidate failure

- On `lint-fix@dd447b55`, the task API accepted a group-3 assignee for a group-2 creator and returned the relationship correctly, but the real create dialog omitted the same user from its assignee selector.
- `TaskFormDialog` loads `/api/users?page=1&size=200`; that generic endpoint applies the creator's scoped user visibility, while task creation currently accepts the cross-group assignee id. UI selectable range and API data range therefore disagree with the explicit `OPS-007` cross-group contract.
- The serial trace is retained at `/tmp/fqa-2050-ops-role-scope-complete-after-rem-p1-049/.../trace.zip`. Finally cleanup removed all tasks, assignments, users and roles through product APIs; shared manifest is empty and cleanup failures are zero. `OPS-007` is FAIL; functional status is `203 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 70 NOT_RUN`.

## REM-P1-050 OPS-007 closure and OPS-010 failure

- REM-P1-050 event `ba5e4740` merged no-ff as `7af9f24a`; same-run role/scope Playwright proved the real group-2 create dialog now lists the group-3 enabled candidate and task detail preserves that assignee. No-assignee creation remained valid under the platform's non-null JSON serialization contract.
- The same serial aggregate then exposed `OPS-010`: a real double-click sent two confirm requests and both committed, producing two `confirm` logs for one pending task instead of one idempotent transition. Trace: `/tmp/fqa-2050-ops007-after-rem-p1-050-final/.../trace.zip`.
- All tasks, assignments, users and roles were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`, and backend logged no unexplained ERROR/Exception. `OPS-007` is PASS and `OPS-010` is FAIL; totals are `204 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 69 NOT_RUN`.

## REM-P1-051 OPS-010 closure

- REM-P1-051 event `305d527e` merged no-ff as `73ec4273`; snapshot `5dc89ca2` was replayed onto the merge head as continuation `2bee17e3` without resetting unaffected PASS evidence.
- The authoritative serial role/scope Playwright passed `1/1` with `1` expected skip in 13.6 seconds at `/tmp/fqa-2050-ops010-after-rem-p1-051`. Real double-click transitioned once to `not_started`, refresh removed confirm, and detail contained exactly one confirm log.
- All tasks, assignments, users and roles were product-API reverse-cleaned; shared manifest is `objects=[]`, `cleanupFailures=0`, and backend logged no unexplained ERROR/Exception. `OPS-010` is PASS; functional status is `205 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 69 NOT_RUN`.

## XL-RBAC-009 membership revocation

- `test/l4-rbac-membership-revocation-current-run.spec.js` passed `1/1` in 2.4 seconds at `/tmp/fqa-2050-xl-rbac-009`.
- Membership removal revoked the group-scoped assignment for the existing session and a fresh login across Wiki/file access. Assignment, user and role were product-API reverse-cleaned; shared manifest is empty. State status is `35 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 42 NOT_RUN`.

## OPS-008/009 aggregate closure

- `OPS-008` closes from the current run's complete `ST-OPS-001..014` PASS set plus a fresh `1/1` non-overdue aggregate rerun in 2.8 seconds at `/tmp/fqa-2050-ops008-after-rem-p1-051`.
- `OPS-009` closes from the authoritative role/scope aggregate: a non-assignee received 400 for confirm/start/complete/cancel, state/logs stayed unchanged, and the real UI exposed no operation buttons. Cleanup returned the shared manifest empty. Functional status is `207 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 67 NOT_RUN`.

## NOTICE-001/003 lifecycle

- `test/l4-notification-lifecycle-current-run.spec.js` passed `1/1` in 1.1 minutes at `/tmp/fqa-2050-notice-001-003-final`.
- Four removable report notifications proved pagination, single/all-read idempotency and unread counts. Two same-context tabs observed new/read state through the supported polling window and both followed logout broadcast. Reports, notifications and RBAC fixtures were product-API cleaned; manifest is empty. Functional status is `209 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 65 NOT_RUN`.

## COMMON-001 and XL-EXPORT-005 evidence aggregation

- `COMMON-001` closes from two independent current-run main-action chains: real Ops confirm double-click after REM-P1-051 and concurrent daily submit/approve. Each produced one transition and one business side effect; duplicate requests were rejected and all fixtures cleaned.
- `XL-EXPORT-005` closes from current-run task/state plus scope/export evidence: material task IDs/counts, statistics status/group/assignee summaries, empty range, group/tenant scope and valid XLSX download all reconcile. Totals are functional `210 PASS / 1 N/A / 64 NOT_RUN`, state `36 PASS / 1 N/A / 41 NOT_RUN`.

## XL-WIKI-002 link graph

- `test/l4-wiki-link-graph-current-run.spec.js` passed `1/1` in 1.8 seconds at `/tmp/fqa-2050-xl-wiki-002-rerun`.
- Formally published A/B pages proved known/unknown rendering, real A→B click, backlink and published graph edge in one fixture. An initial draft-only graph attempt and an empty-page heading assumption were test coordination issues; both cleaned successfully. State status is `37 PASS / 1 N/A / 40 NOT_RUN`.

## XL-WIKI-004 comment lifecycle

- `test/l4-wiki-comments-cross-role-current-run.spec.js` passed `1/1` in 3.7 seconds at `/tmp/fqa-2050-xl-wiki-004-rerun`.
- One 21-comment fixture proved API pagination, read-only non-author `canDelete=false` and HTTP 403 deletion denial, real UI load-more, author/admin deletion count refresh from 21 to 20, and page-delete cascade. An initial title-versus-accessible-name locator timeout was a test coordination issue and cleaned successfully. State status is `38 PASS / 1 N/A / 39 NOT_RUN`.

## CMDB endpoint and Change template guards

- `test/l4-cmdb-remaining-contracts-current-run.spec.js` passed `1/1` in 898ms at `/tmp/fqa-2050-cmdb-remaining`, closing `CMDB-038` and `XL-CMDB-010` with endpoint UID conflict, dual-end visibility, deletion and exact cleanup.
- `test/l4-change-workflow-remaining-current-run.spec.js` passed `1/1` in 827ms at `/tmp/fqa-2050-change-remaining-rerun`, closing `CHANGE-018`: a referenced template resisted deletion and remained readable before reverse cleanup. Its pending write guards are partial `CHANGE-010` evidence because the real UI path remains unexecuted.
- The watermark UI/API save-refresh-restore chain passed `1/1` in 2.6 seconds at `/tmp/fqa-2050-common-config-remaining-rerun`; `CONFIG-004`, `COMMON-008` and `COMMON-012` remain NOT_RUN because their full page-effect/angle and cross-platform contracts exceed this one page. Totals are functional `212 PASS / 1 N/A / 62 NOT_RUN`, state `39 PASS / 1 N/A / 38 NOT_RUN`.

## DAILY-007 cross-group approval denial

- `test/l4-daily-cross-group-approval-current-run.spec.js` passed `1/1` in 4.8 seconds at `/tmp/fqa-2050-daily-007-rerun`. A group-2 approver neither listed nor completed a group-3 report task; direct completion returned 400, status stayed unchanged, and the real detail page had no approval action. Exact cleanup returned the manifest empty. Functional totals are `213 PASS / 1 N/A / 61 NOT_RUN`.

## CONFIG-004 post-REM-P1-054 closure

- REM-P1-054 event `2cafd359` merged no-ff into `lint-fix` as `78d07cf1`; the continuation starts at that exact integration head.
- `test/rem-p1-054-watermark-angle-preview.spec.js` passed `1/1` in 2.1 seconds at `/tmp/l4-config004-after-rem-p1-054`: invalid opacity/angle/position requests returned 400 without partial writes; real UI angle/text/opacity/position preview, save/refresh and exact restore passed.
- Java `ExportServiceTest` confirms the existing PDF export path reads `watermark.angle`; shared/event manifests are empty, cleanup failures zero, authorization remains enforced and break-glass inactive.
- `CONFIG-004` is PASS. Functional totals are `226 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 48 NOT_RUN`; state totals remain `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`.

## Post-REM-P1-054 remaining-batch stability rerun

- `test/l4-change-workflow-remaining-current-run.spec.js`, `test/l4-common-config-notice-remaining-current-run.spec.js` and `test/l4-external-config-current-run.spec.js` passed serially `3/3` in 0.9, 2.7 and 10.6 seconds from the current continuation branch.
- Referenced-template rejection, pending-state guards, watermark UI persistence, SMTP/Prometheus/AI isolated fixtures and exact product-API restoration remained stable. These reruns add evidence but do not promote partial `CHANGE-010`, `COMMON-008/012`, `CONFIG-001/003` or `AI-002/003` contracts.
- The catalog-derived ledger was reconciled to explicitly include the already-closed `CONFIG-004`; effective totals remain functional `226 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 48 NOT_RUN` and state `43 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 34 NOT_RUN`. Shared manifest is empty with zero cleanup failures.

## RBAC-010 export permission closure

- `test/l4-cmdb-export-permission-current-run.spec.js` passed `1/1` in 3.8 seconds. The minimal `cmdb_instance:export` assignment downloaded a non-empty CSV with the canonical headers and filename; the `cmdb_instance:read` identity received 403 for export and the exporter received 403 for instance listing.
- Both users, assignments and roles were product-API reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`. Functional totals are `227 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 47 NOT_RUN`.

## CHANGE-008 group-scope closure

- New isolated asset `test/l4-change-group-scope-current-run.spec.js` passed `1/1` in 5.6 seconds. A group-2 creator with only `change_doc:create/read/update` created, read and updated its own draft through API and the real detail UI.
- A superadmin-created cross-group draft was absent from the scoped list; direct get/update returned the product's non-disclosing 404 contract and admin before/after readback was identical. No Console error or HTTP 5xx occurred.
- Both drafts and all RBAC fixtures were product-API reverse-cleaned. Functional totals are `228 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 46 NOT_RUN`.

## CHANGE-006 table-field closure

- New isolated asset `test/l4-change-table-field-current-run.spec.js` passed `1/1` in 2.4 seconds. It persisted an empty row and a 1,800-Chinese-character textarea row, then used the real detail UI to delete/add rows, save and refresh in stable order.
- Programmatic DOCX fallback was downloaded and its XML proved the final two rows, order and complete long text. No template object was uploaded to MinIO; Console and 5xx were zero.
- The draft and template were product-API deleted. Functional totals are `229 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 45 NOT_RUN`.

## CMDB-024 JSON/NDJSON import closure

- New isolated asset `test/l4-cmdb-json-import-current-run.spec.js` passed `1/1` in 0.9 seconds. JSON preview/execute created one instance; NDJSON preview classified the same name as update and a new name as create, then executed one update plus one create.
- Final readback proved stable identity for the updated instance and exact status/owner/description for both records. Reusing the consumed batch ID returned 400, confirming one-shot preview semantics.
- Both instances, model and model group were product-API deleted. Functional totals are `230 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 44 NOT_RUN`.

## CMDB-030 topology compare closure

- New isolated asset `test/l4-cmdb-topology-compare-current-run.spec.js` passed `1/1` in 3.9 seconds. A runId root topology produced one added, one removed, one modified and at least two unchanged nodes across UTC audit timestamps.
- API and the real compare page agreed on the four categories; Console and HTTP 5xx were zero. The first attempt exposed only a test time-zone mismatch and the second a browser input-format issue; both attempts product-cleaned all active fixtures.
- Final relations, instances, definition, model and model group were deleted through product APIs; immutable audit history remains as required by the CMDB audit contract. Functional totals are `231 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 43 NOT_RUN`.

## CMDB-037 and XL-CMDB-009 rack layout closure

- New isolated asset `test/l4-cmdb-rack-layout-current-run.spec.js` passed `1/1` in 2.9 seconds. A 12U rack with two overlapping hosts produced the unique U4 warning in API and the real rack elevation view.
- CMDB 数据中心 catalog, rack list drawer/complete detail, `机柜视图`, 2D model selector and rack card all exposed the runId fixture. Console/5xx were zero; relations and instances were product-API reverse-cleaned.
- Functional totals are `232 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 42 NOT_RUN`; state totals are `44 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`.

## CMDB-022, CMDB-023 and XL-CMDB-007 CSV chain closure

- New isolated asset `test/l4-cmdb-csv-import-current-run.spec.js` passed `1/1` in 2.5 seconds. The Chinese `应用` model route downloaded a singly encoded UTF-8 CSV template with the correct filename.
- Real UI preview/execute created exactly one app instance with `failed=0`; API persistence readback matched the result and product deletion removed the fixture. Console/5xx were zero.
- Functional totals are `234 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 40 NOT_RUN`; state totals are `45 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`.

## CMDB-019 update-only edit closure

- New isolated asset `test/l4-cmdb-update-only-edit-current-run.spec.js` passed `1/1` in 3.0 seconds. An update-only role could read/update but not create/delete; the real detail exposed editing and refresh/API readback retained the UI value.
- Instance and RBAC fixtures were product-API reverse-cleaned. Functional totals are `235 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 39 NOT_RUN`; state totals remain `45 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`.

## XL-WIKI-003 Mermaid editor/read closure

- New isolated asset `test/l4-wiki-mermaid-current-run.spec.js` passed `1/1` in 5.3 seconds. It covered valid live preview, controlled invalid syntax without persistence, two diagrams, dark-theme rerender, save and read-page refresh.
- Theme was restored to light; page and space were product-API deleted. State totals are `46 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 31 NOT_RUN`; functional totals remain `235 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 39 NOT_RUN`.

## CHANGE-007 and CHANGE-010 draft/pending closure

- New isolated asset `test/l4-change-draft-pending-ui-current-run.spec.js` passed `1/1` in 2.6 seconds. Real create navigated to the numeric ID; draft save/reload retained title, templates and fields.
- Pending UI hid edit/save/submit/delete, and API update/delete/re-submit each returned 409 with unchanged data/snapshot count. Exact remediation deletion and template cleanup returned the manifest empty.
- Functional totals are `237 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 37 NOT_RUN`; state totals remain `46 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 31 NOT_RUN`.

## XL-WIKI-001 and XL-EXPORT-003 image export closure

- New isolated asset `test/l4-wiki-image-export-current-run.spec.js` passed `1/1` in 2.6 seconds. The real reader authenticated the PNG request, rendered a decoded `blob:` image and retained byte-identical content.
- Real UI downloads returned the exact page Markdown plus a space ZIP with parent/child paths, rewritten image URL and byte-identical attachment. Attachment, pages and space were product-API deleted; manifest is empty.
- State totals are `48 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`; functional totals remain `237 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 37 NOT_RUN`.

## ST-AUTHZ-010 enforced ordinary-access closure

- New isolated asset `test/l4-authz-enforced-ordinary-access-current-run.spec.js` passed `1/1` in 2.4 seconds. The same compatibility role and legacy default-read conditions produced covered-group 200 but uncovered-group 403 `ROLE_SCOPE_NOT_COVERED`, proving Enforced uses only the unified decision.
- Java 21 `AuthorizationServiceTest#enforcedResourceDecisionIgnoresLegacyAllow` passed `1/1`. Cutover remained unchanged at Enforced epoch 32; role, user, pages and spaces were product-cleaned with zero runId readback and an empty manifest.
- State totals are `49 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 28 NOT_RUN`; functional totals remain `237 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 37 NOT_RUN`.

## CMDB-008 and XL-CMDB-001 drawer-field failure after REM-P1-008

- Same-run affected-only `test/l4-cmdb-fieldtype-contract-current-run.spec.js` advanced past duplicate enum-option rejection and all ten field-type API/form/list checks, then failed because the real instance drawer exposed no `关键属性` section.
- Trace response evidence shows `GET /api/cmdb/models/{code}` omitted `isDrawerShow` from every run-scoped attribute although the attribute-list API returned it as `true`. `CiModelService.toAttributeVO` maps `isListShow` but omits `isDrawerShow`.
- All instances, attributes, groups and models were product-API reverse-cleaned. Manifest is `objects=[]`, `cleanupFailures=0`. Functional totals are `237 PASS / 2 FAIL / 0 BLOCKED / 1 N/A / 35 NOT_RUN`; state totals are `49 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 27 NOT_RUN`.

## CMDB-008/011/016/017 and XL-CMDB-001 closure after REM-P1-055

- Latest-integration same-run `test/rem-p1-055-cmdb-model-detail-drawer-flag.spec.js` passed `1/1` in 2.3 seconds at `/tmp/fqa-2050-cmdb-types-after-rem-p1-055-r1`.
- Duplicate enum option IDs returned 400; ten field types passed create/list/detail persistence, the real new-instance form, dynamic list columns and drawer key attributes with exact label/value checks. Page errors and HTTP 5xx were zero.
- All fixtures were product-API reverse-cleaned, model keyword readback was zero and manifest is `objects=[]`, `cleanupFailures=0`. Functional totals are `241 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`; state totals are `50 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 27 NOT_RUN`.

## ST-CHANGE-003 application/plan isolation closure

- Dedicated serial `test/l4-change-plan-field-isolation-current-run.spec.js` passed `1/1` in `812ms` at `/tmp/fqa-2050-st-change-003-final-r3`.
- The application-only document entered `plan_pending` with only its application config/value. Adding the plan template preserved that set and exposed an independent plan config/value set; submit-plan entered `pending` with both sets and the exact cleanup marker unchanged.
- Product purge returned 200, document keyword readback was zero, manifest is empty, authorization remained Enforced epoch 32 and break-glass remained inactive. The separate diagnostic use of an unsupported authorization URL produced one explained 500 and made no state change.
- State totals are `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`; functional totals remain `241 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`.

## COMMON-010 stale-response and unmount partial coverage

- Isolated read-only `test/l4-common-async-unmount-current-run.spec.js` passed `1/1` in `3.0s` at `/tmp/fqa-2050-common-010-r1`.
- A delayed command-palette response could not overwrite a newer result, and a delayed Wiki search response released after page navigation/unmount could not change the destination or render stale data. Controlled responses wrote no product state; pageerror, Console error and HTTP 5xx arrays were empty.
- The full catalog applies to every async page. Autosave, polling, import progress, notification and other debounce/timer/request surfaces remain unexecuted, so `COMMON-010` stays NOT_RUN. Functional totals remain `241 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 33 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## CMDB-014 canonical attribute-action guard failure

- `test/l4-cmdb-attribute-canonical-guard-current-run.spec.js` reproduced a valid canonical-only role failure at `/tmp/fqa-2050-cmdb014-attribute-guard-r3`: the authenticated permission set contained `cmdb_attribute:create`, but a valid run-scoped attribute POST returned 403.
- `CiAttributeController` consumes `cmdb_model:read/update` rather than the cataloged `cmdb_attribute:*` actions. All metadata/RBAC fixtures were product-API cleaned, keyword readbacks were zero, manifest is empty, authorization remains Enforced epoch 32 and break-glass inactive.
- `CMDB-014` is FAIL; L4 stops for `REM-P1-056`. Functional totals are `241 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## CMDB-014 closure after REM-P1-056

- `REM-P1-056` event `7d0f0d21` was no-ff merged as `2f664230`; the same run retained all 292 unaffected PASS results and resumed from continuation merge `80517763`.
- Current-run create probe passed `1/1` in 2.5s at `/tmp/fqa-2050-cmdb014-after-rem-p1-056-create`. The complete attribute matrix then passed `1/1` in 16.8s at `/tmp/fqa-2050-cmdb014-after-rem-p1-056-matrix`: canonical CRUD allow, each missing action deny, legacy-only deny, no side effects and six real UI permission variants all matched.
- Browser pageerror/HTTP 5xx were zero. Shared/event manifests are `objects=[]`, `cleanupFailures=0`; user/role/model/group keyword readbacks are zero. Authorization remains Enforced epoch 32.
- `CMDB-014` is PASS. Functional totals are `242 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 32 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## WIKI-024 closure after REM-P1-057

- `REM-P1-057` event `25ee1823` was no-ff merged as `e1738b04`; continuation `b9dc4161` preserves every unaffected result from the same run.
- `test/l4-wiki-ancestor-traverse-current-run.spec.js` passed `1/1` in 2.4 seconds at `/tmp/fqa-2050-wiki024-rem57-r1`: the child inherited the parent owner group, own `r--` plus ancestor `r-x` allowed read, and removing root `x` returned 403 without leaking title or content.
- All pages, spaces and RBAC fixtures were product-API reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`; exact user/role/space marker readbacks are zero, Wiki remains enforced, and backend has no unexplained ERROR/5xx.
- `WIKI-024` is PASS. Functional totals are `243 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 31 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`. Total remaining is 57.

## RBAC-007 duplicate active-group name failure

- New serial asset `test/l4-rbac-group-lifecycle-current-run.spec.js` stopped at the first product failure: creating a second active business group with the same tenant/name returned 200 instead of the required 400.
- The temporary user was product-deleted and both created groups were product-archived as auditable history; no restore or purge ran. Active marker readback is zero, archived readback contains exactly the expected two rows, manifest is `objects=[]`, `cleanupFailures=0`, and backend has no unexplained ERROR/5xx.
- `RBAC-007` is FAIL and maps to independent `REM-P1-058`; `RBAC-006` stays NOT_RUN because its remaining lifecycle assertions did not execute. Functional totals are `243 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 30 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`.

## RBAC-006/007 closure after REM-P1-058

- Event `ef3df211` merged no-ff as `738e2686`; same-run continuation `5866a00c` retained all unaffected PASS evidence.
- The affected serial asset passed `1/1` in 2.5 seconds at `/tmp/fqa-2050-rbac006007-r4`, closing duplicate-name validation and the complete create/edit/member/blocker/UI archive/audit chain.
- Manifest and active runId readbacks are zero, cleanup failures are zero, and no unexplained backend ERROR/5xx occurred. Functional totals are `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`; state totals remain `51 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 26 NOT_RUN`. Total remaining is 55.

## XL-RBAC-007 custom-role assignment lifecycle

- The fresh serial asset passed `1/1` in 2.2 seconds at `/tmp/fqa-2050-xl-rbac-007-r4`: active assignment delete protection, immediate old-session permission revocation, role soft-delete and audit metadata all passed.
- Manifest and active runId relationship readbacks are zero. State totals are `52 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 25 NOT_RUN`; functional totals remain `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`. Total remaining is 54.

## XL-RBAC-003 disabled-user session revocation

- The fresh serial asset passed `1/1` in 4.5 seconds at `/tmp/fqa-2050-xl-rbac-003-r2`: API session 401, disabled login denial, two-tab broadcast logout and restored login all passed.
- User cleanup, manifest and backend log checks are clean. State totals are `53 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 24 NOT_RUN`; total remaining is 53.

## Authorization account migration state matrix

- The approved serialized rollback -> enforced matrix passed `1/1` in `2.4s`, covering preflight blockers, repair, prepared/reconciled runs, exception acceptance/resolution, idempotent backfill, rollout transitions, strict Enforce and audit.
- Product cleanup is exact; final mode is enforced, strict preflight is empty and the shared manifest has zero objects/failures. `ST-AUTHZ-001/002/004/006/012/013/014/018` are PASS.
- State totals are `61 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 16 NOT_RUN`; functional totals remain `245 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 29 NOT_RUN`. Total remaining is 45.

## XL-CMDB-003 CI/device UI navigation failure

- The fresh serial cross-module asset passed CI/device API linkage and CI deletion protection but the real CI detail related-resources panel exposed no device-detail link. `XL-CMDB-002` remains NOT_RUN because its full aggregate did not finish; `XL-CMDB-003` is FAIL and maps to `REM-P1-059`.
- Product cleanup removed every run-scoped CMDB/device fixture; manifest is empty. State totals are `61 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 15 NOT_RUN`; unresolved total remains 45.
## Change terminal, export and idempotency closure after REM-P1-060

- `REM-P1-060` event `b7394350` was merged no-ff as `633115c0`; the same L4 run retained all unaffected PASS evidence.
- `test/l4-change-terminal-export-idempotency-current-run.spec.js` passed `1/1` in `3.3s` at `/tmp/fqa-2050-change-terminal-after-rem-p1-060`. Concurrent submit and approval each produced exactly `200/409`, one effective transition, one audit and one snapshot.
- Draft, pending, approved, re-draft and rejected export paths passed; archived-file download passed and an identity without export permission received HTTP 403. Product-API cleanup removed all documents, RBAC fixtures and orphan file metadata.
- Shared/event manifests are `objects=[]`, `cleanupFailures=0`. `CHANGE-013`, `CHANGE-019`, `ST-CHANGE-001` and `ST-CHANGE-004` are PASS. Functional totals are `250 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 24 NOT_RUN`; state totals are `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 35.

## CHANGE-009 aggregate closure

- The same current-run evidence fully covered `ST-CHANGE-001..004`, so `CHANGE-009` is promoted to PASS without re-running or inheriting another run. Functional totals are `251 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 23 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 34.

## WIKI-023 ACL priority and group-union closure

- `test/l4-wiki-acl-priority-union-current-run.spec.js` passed `1/1` in `6.5s` at `/tmp/fqa-2050-wiki023-r4`. It proved owner mode, named-user precedence, two matching group entries combined as `r-- | -w- = rw-`, and others read/write fallback while preserving ancestor traverse.
- Roles, users, memberships, assignments, page and space were product-API reverse-cleaned. Manifest is `objects=[]`, `cleanupFailures=0`; backend has no unexplained ERROR/5xx. Functional totals are `252 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 22 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 33.

## CHANGE-011 applicant notification failure

- Fresh serial Playwright reached same-group direct approval and persisted the exact 1024-character Unicode comment, but the applicant received no notification. Expected one `change_doc` reference for document `280`; received `[]`.
- The fixture and every RBAC object were product-API reverse-cleaned; manifest is `objects=[]`, `cleanupFailures=0`, marker readbacks are zero and backend has no unexplained ERROR/5xx.
- `CHANGE-011` is FAIL and maps to `REM-P1-061`; `CHANGE-012` remains NOT_RUN after the early stop. Functional totals are `252 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 21 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. There are 32 NOT_RUN cases and 33 unresolved cases including this failure.

## CHANGE-011/012 closure after REM-P1-061

- Event `936ca2f1` merged no-ff as `c6495ae9`; latest-integration Playwright passed `1/1` in `6.3s` at `/tmp/fqa-2050-change011012-after-rem-p1-061-r2`.
- Same-group approval with exact 1024-character Unicode comment created the applicant `change_doc` reference; empty-comment rejection persisted, and the same leader received HTTP 404 for a cross-group pending document without mutation.
- Product cleanup returned manifest `objects=[]`, `cleanupFailures=0`; backend had no unexplained ERROR/5xx. Functional totals are `254 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 20 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 31.

## AI-002 invalid provider configuration failure

- After the isolated external-config asset passed and restored its baseline, a focused current-run API probe proved both `baseUrl=not a url` and whitespace-only `model` updates return HTTP 200.
- Original provider fields and unconfigured key state were restored; manifest is empty and backend has no unexplained ERROR/5xx. `AI-002` is FAIL and maps to `REM-P1-062`; totals are functional `254 PASS / 1 FAIL / 1 N/A / 19 NOT_RUN` and state `66 PASS / 1 N/A / 11 NOT_RUN`.

## AI-002 closure and AI-003 failure

- Post-REM-P1-062 input boundaries passed 1/1 at `/tmp/fqa-2050-ai002-after-rem-p1-062`; `AI-002` is PASS.
- The real AI admin page showed clear failure and success toasts, but the expected provider failure API returned HTTP 500 and produced an `Unhandled exception` backend log. `AI-003` is FAIL and maps to `REM-P1-063`.
- Provider and manifest are exactly restored. Totals are functional `255 PASS / 1 FAIL / 1 N/A / 18 NOT_RUN` and state `66 PASS / 1 N/A / 11 NOT_RUN`.

## AI-003 closure after REM-P1-063

- Latest-integration real UI/API passed 1/1 at `/tmp/fqa-2050-ai003-after-rem-p1-063`: controlled 400/errorCode and failure toast, 200/mock reply and success toast, no rendered key.
- No unhandled 5xx occurred; provider/manifest restored. Functional totals are `256 PASS / 0 FAIL / 1 N/A / 18 NOT_RUN`; state totals remain `66 PASS / 1 N/A / 11 NOT_RUN`. Total remaining is 29.

## CONFIG-003 notification configuration failure

- Current-run authenticated Playwright saved `disabled`, cron `0 7 3 * * MON-FRI` and a unique template marker through `PUT /api/admin/config/notification`; all three values persisted in `sys_config`.
- The formal built-in `daily_report` rule remained enabled with `triggerConfig.time=17:00` and unchanged reminder stages, so the saved switch, period and template do not control actual behavior. The original disabled/17:00/Chinese-template configuration was restored exactly through the product API; manifest remains `objects=[]`, `cleanupFailures=0`.
- `CONFIG-003` is FAIL and maps to `REM-P1-064`. Functional totals are `256 PASS / 1 FAIL / 1 N/A / 17 NOT_RUN`; state totals remain `66 PASS / 1 N/A / 11 NOT_RUN`. Total unresolved remains 29.

## CONFIG-003 closure after REM-P1-064

- Event `f63cc0c9` was merged no-ff as `b7f1d51e`; continuation `36985c02` retains the same run and every unaffected PASS.
- Latest-integration serial Playwright passed `1/1` in 407ms at `/tmp/fqa-2050-config003-pass`: the saved switch, cron and marker template changed the single formal `daily_report` rule to the same enabled state, cron expression and `reminderConfig.bodyTemplate`.
- The exact prior disabled/17:00/Chinese-template configuration was restored through the product API. Shared manifest remains `objects=[]`, `cleanupFailures=0`; `CONFIG-003` is PASS. Functional totals are `257 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 17 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 28.

## FLOW-010 workflow binding lifecycle failure

- Latest-integration authenticated Playwright loaded the real workflow binding page and current daily/wiki bindings, then performed a read-only control inventory. The page exposes one create/overwrite button but zero edit, enable/disable or delete controls.
- The product API likewise exposes only `GET` and `POST /api/workflow/center/bindings`; POST upserts by business type and forces `enabled=true`, so it cannot represent or restore the required complete lifecycle.
- Evidence is `/tmp/fqa-2050-flow010-failure`; `productWrites=0`, Console/5xx are empty, current bindings are unchanged and shared manifest remains `objects=[]`, `cleanupFailures=0`. `FLOW-010` is FAIL and maps to `REM-P1-065`. Functional totals are `257 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 16 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total unresolved remains 28.

## FLOW-010 closure after REM-P1-065

- Event `7f43a36d` was merged no-ff as `e82e0d7d`; continuation `5429763d` retains the same run and every unaffected PASS on latest integration `84e55ae9`.
- Latest-integration authenticated Playwright passed `1/1` in `1.7s` at `/tmp/fqa-2050-flow010-after-rem-p1-065`: the real page exposed create/edit/enable-disable/delete controls `1/2/2/2` and both existing daily/wiki bindings remained unchanged.
- The affected-only run made `productWrites=0`; Console/5xx are empty and shared manifest remains `objects=[]`, `cleanupFailures=0`. `FLOW-010` is PASS. Functional totals are `258 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 16 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 27.

## COMMON-010 closure after REM-P1-066

- `REM-P1-066` event `850c6b6b` was merged no-ff as `b870eebb`; continuation `2dd83acb` retains the same run and every unaffected PASS on latest integration `4bd4ae56`.
- Latest-integration authenticated Playwright passed `1/1` in `3.9s` at `/tmp/fqa-2050-common010-after-rem-p1-066-r3`, covering CI debounce, Wiki autosave, CMDB import close/reopen, group-member search and notification polling cancellation/stale-response handling.
- The affected-only run made `productWrites=0`; pageerror/Console/5xx are empty and shared manifest remains `objects=[]`, `cleanupFailures=0`. `COMMON-010` is PASS. Functional totals are `259 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 15 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 26.

## COMMON remaining batch and COMMON-012 failure

- `COMMON-002/004/007` passed `3/3` in the serial common batch with route-mocked writes only and `productWrites=0`.
- Full route discovery reached `/daily/57` from `/workflow/instances`; the linked running instance retains `businessKey=daily_report:57`, while the business API returns HTTP 400 `日报不存在` and emits a Console error. `COMMON-012` is FAIL and maps to `REM-P1-067`.
- No product mutation or direct data cleanup ran. Functional totals are `262 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total unresolved is 23.

## COMMON-012 closure after REM-P1-067

- `REM-P1-067` event `4a4c51b4` was merged no-ff as `013ffec4`; continuation `594a98ca` retains the same run and every unaffected PASS on latest integration `7bbd9915`.
- With explicit authorization, orphan running instance `475a4859-82d5-11f1-9bb8-fe07cd4a258f` for missing `daily_report:57` was terminated through the product API and disappeared from the running list.
- Latest-integration authenticated Playwright passed `1/1` in `12.8s` at `/tmp/fqa-2050-common012-after-rem-p1-067`: 49 static and 54 live-discoverable dynamic routes rendered visible bodies; `productWrites=0`, pageerror/Console/5xx are empty. Functional totals are `263 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`; state totals remain `66 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 11 NOT_RUN`. Total remaining is 22.

## CMDB related-resource UI contract failure

- The reversible remaining chain proved the API links, DOCX/PDF fixed fields, DOCX dynamic table and UTF-8 CMDB template header after installing Poppler and correcting the run-scoped attribute fixture.
- The real CMDB resource tab then exposed no document/report links. `InstanceResourcesTab` expects `docId/reportId/date/authorName`, while APIs return `id/reportDate/reporterName`; its report URL is also `/daily-reports/{id}` instead of the real `/daily/{id}`.
- Every attempt reverse-cleaned exactly; manifest is `objects=[]`, `cleanupFailures=0`, no HTTP 5xx occurred. Aggregate cases remain NOT_RUN and the defect maps to `REM-P1-068`; total unresolved remains 22.

## XL-CMDB-004/005 closure after REM-P1-068

- Event `4349419d` was merged no-ff as `7c06b1a4`; continuation `bcc4b354` retains the same run and every unaffected PASS on latest integration.
- Latest-integration Playwright passed the reversible executable chain `1/1` in `2.8s` at `/tmp/fqa-2050-cmdb-change-export-after-rem-p1-068-r2`, including complete `XL-CMDB-004/005` API/UI navigation and unlink semantics.
- Console/5xx/cleanup errors and active manifest objects are empty. Six explicitly skipped ACs remain unpromoted. Functional totals are `265 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 9 NOT_RUN`; state totals are `68 PASS / 0 FAIL / 0 BLOCKED / 1 N/A / 9 NOT_RUN`. Total remaining is 18.

## XL-RBAC-002 multi-group owner-mode failure

- After fixture-only corrections, the real serial chain proved that two active memberships and matching group-scope `wiki:read` assignments still expose only the primary group's owner-mode Wiki space.
- `AuthorizationService.resourcePermissions` uses only the primary `SecurityUser.groupId` for owner-group mode, despite already computing the complete effective membership set. Evidence is `/tmp/fqa-2050-rbac-remaining-after-rem-p1-068-r4`; all fixtures were exactly cleaned.
- `XL-RBAC-002` is FAIL and maps to `REM-P1-069`. Functional totals are `265 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 8 NOT_RUN`; state totals are `68 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 8 NOT_RUN`. Total unresolved remains 18.

## XL-RBAC-002 closure and functional reason-code failure

- Post-REM-P1-069 latest-integration RBAC passed `RBAC-008/XL-RBAC-002`; two effective groups were visible and membership removal converged for old/new sessions with exact cleanup.
- `RBAC-025/XL-RBAC-006` then passed three resource-layer reasonCodes but failed because Method Security's functional 403 omitted `FUNCTION_PERMISSION_DENIED`. Evidence is `/tmp/fqa-2050-rbac-remaining-after-rem-p1-069-r3`; manifest 0/0.
- Functional totals are `266 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 7 NOT_RUN`; state totals are `69 PASS / 1 FAIL / 0 BLOCKED / 1 N/A / 7 NOT_RUN`. Total unresolved is 16.
