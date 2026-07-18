# L4 Execution Record

## Reset

- New L4 run from `lint-fix@f513e96a`, after the independent `REM-P2-020` regression fix merged.
- All 275 functional and 78 state/cross-module catalog cases are reset to `NOT_RUN`; no prior L4 PASS is inherited.
- B1 begins only after this branch's backend and frontend containers are rebuilt and environment baseline is recorded.
- User-owned historical evidence deletions remain outside this run and are not staged or restored.

## B1: rebuilt environment and initial read-only navigation batch

- After the branch rebuild and health checks recorded in `environment-baseline.md`, the following fresh command passed with `33 passed (28.8s)`:

  `set -a; source .env; set +a; FQA_SUPERADMIN_PASSWORD="$FQA_SUPERADMIN_PASSWORD" npx playwright test test/l4-auth-invalid-login.spec.js test/l4-home-readonly-ui.spec.js test/l4-sidebar-navigation.spec.js test/l4-readonly-content-navigation.spec.js --workers=1 --reporter=line`

- Counted functional cases: `AUTH-001`, `AUTH-003`, `HOME-001`, `HOME-003`, `HOME-004` through `HOME-008`, `FILE-001`, and `WIKI-022`. The 23 individual superadmin sidebar clicks substantiate the single catalog case `HOME-003`; they are not counted as additional catalog cases.
- The batch performs only authentication/navigation/read error-path checks. It created no run-scoped business objects and had no cleanup action. `case-ledger.json` and `checkpoint.json` now record exactly 11 functional PASS, 264 functional NOT_RUN, and 0 state PASS; no result is inherited from the invalidated prior L4 run.

## B1: second read-only batch

- Fresh single-worker Playwright execution passed all 17 checks: `ACCOUNT-010`, `CMDB-001`, `CMDB-002`, `CMDB-033`, `CMDB-035`, `CHANGE-001`, `DEVICE-001`, `IPAM-001`, `WIKI-013`, `WIKI-016`, `WIKI-017`, `FLOW-001`, `FLOW-004`, `REPORT-002`, `REPORT-003`, `NOTICE-002`, and `AUDIT-001`.
- The test command covered the corresponding `test/l4-*.spec.js` files. The runner reported a passing last-run result; `FLOW-001` was independently rerun after the combined batch and passed in 1.9s.
- These tests use existing data only (filter/search/navigation, export downloads, read APIs, and presentation checks). They created no L4 fixture objects and require no cleanup. `REPORT-003` includes the fixed historical workflow definition's per-key/full-aggregation equality assertion.
- Totals after this batch: 28 functional PASS, 247 functional NOT_RUN; state/cross-module remains 0 PASS, 78 NOT_RUN.

## B1: serialized authentication fixture batch

- Fresh single-worker Playwright execution passed `AUTH-004`, `AUTH-005`, `AUTH-006`, `AUTH-008`, and `AUTH-009`. Each case created a timestamped `FQA_20260718_1507_remp2020_*` temporary user through the product API, registered it immediately in this run's manifest, then deleted it through the product API and confirmed that its direct read returned the product's absent response.
- `AUTH-004` verified disabled-login denial and restored-login success. `AUTH-005` verified a user logout revokes only the current session. `AUTH-006` verified administrator revocation invalidates both target sessions. `AUTH-008` verified product logout propagates to a second browser tab. `AUTH-009` verified unknown route and business-ID no-leakage states.
- The same command also passed `test/l4-auth-invalid-session.spec.js`, but that is evidence only for invalid-token rejection. The catalog's `AUTH-007` requires a genuine idle/expiry path and remains `NOT_RUN` pending an authorized reversible timeout configuration or a real >60-minute idle observation.
- Manifest after batch: `objects=[]`, `cleanupFailures=0`. Totals: 33 functional PASS, 242 functional NOT_RUN; 0 state PASS, 78 state NOT_RUN.

## Authorized authorization cutover

- Under the user's previously explicit all-tenant rollback-to-enforced authorization, fresh L4 test `test/l4-authorization-cutover.spec.js` passed through only product APIs: initial `enforced` -> `ROLLBACK` produced `rollback` / effective `legacy` without changing epoch -> strict preflight returned `eligible=true` with no issues -> `ENFORCE` restored `enforced` and advanced epoch by exactly one.
- This is the new-run evidence for functional `AUTHZ-010` and the directly exercised reachable state edges `ST-AUTHZ-007` and `ST-AUTHZ-008`. No break-glass, backup restore, volume/session purge, external-service write, or SQL action was used.
- The temporary cutover manifest entry was removed only after the final enforced response was asserted. Manifest again has zero active objects and zero cleanup failures. Totals: 34 functional PASS / 241 NOT_RUN; 2 state PASS / 76 NOT_RUN.

## B1: minimal group-read authorization fixture

- Fresh test `test/l4-minimal-read-fixture.spec.js` created a timestamped custom group-scope role containing only `cmdb_instance:read`, `daily_report:read`, `shared_file:read`, `wiki:read`, and `workflow:read`; created a run-scoped management-group user; created and read back its group assignment; completed normal first-login setup; then verified the five corresponding product read endpoints return 200.
- It reversed the fixture through product APIs in dependency order (assignment -> user -> role), including absent-user readback. The new-run manifest is empty with zero cleanup failures. This is prerequisite evidence for subsequent per-role matrix cases, not a duplicate catalog PASS.

## Serialized daily lifecycle

- Fresh `DAILY-006` / `ST-DAILY-001` test passed: a runId-marked draft was created through the normal Daily UI, its actual main-content calendar cell submitted it to workflow, the detail view approved it, and the product's dedicated remediation delete endpoint removed it. Direct readback returned the documented absent response.
- An initial strict-selector failure was limited to the test: a sidebar badge duplicated the day number. The created draft was immediately recovered with `test/l4-daily-runid-cleanup.spec.js` using the product cleanup endpoint; the final pass uses a `main`-scoped calendar locator. No historical daily report was read, changed, or deleted.
- Manifest remains `objects=[]`, `cleanupFailures=0`. Totals: 35 functional PASS / 240 NOT_RUN; 3 state PASS / 75 NOT_RUN.

## CMDB breadcrumb and return chain

- Fresh current-baseline `CMDB-039` execution passed in 1.4s: an existing host was reached through CMDB overview -> its model list -> its read-only drawer -> full detail; the global breadcrumb rendered at both list and detail levels, and the detail-page `返回` link returned to that model list. The control is correctly a link rather than a button. No product data, configuration, or test fixture was written; no page exception occurred. Totals: 36 functional PASS / 239 NOT_RUN; state remains 3 PASS / 75 NOT_RUN.

## Common search boundaries and file move lifecycle

- Fresh `COMMON-006` execution passed: the device search accepts empty, whitespace, special-character, and unique no-match inputs, returns to the normal list, and emits neither page errors nor HTTP 5xx responses. No business object was created or changed.
- Fresh serialized `FILE-012` execution passed both API and real UI paths. It verified successful movement, duplicate-name conflict atomicity, and the move dialog's success state. Every created source/target folder and file was registered immediately in this L4 run's manifest and deleted through product APIs; final manifest is `objects=[]`, `cleanupFailures=0`.

## CMDB statistics range contract

- Fresh read-only `CMDB-036` passed in 1.7s. It cross-checked the statistics API shape, entered an empty future range in the real statistics page, verified that the selected-range card, no-trend state, and no-Top-10 state rendered, then cleared the range and restored the default summary. No object or configuration was written; no page exception occurred. Totals: 37 functional PASS / 238 NOT_RUN; state remains 3 PASS / 75 NOT_RUN.

## CMDB instance detail tabs

- Fresh read-only `CMDB-018` passed in 1.9s using an existing host selected through overview and model-list UI. Every applicable detail tab (`基本信息`、`关联关系`、`拓扑图`、`变更历史`、`告警`、`关联资源`) rendered and remained navigable; the existing-instance impact-analysis and topology-preview routes also loaded without an exception. No CI, relation, alert, or configuration was changed. The latter two routes are supporting observation only; their broader catalog contracts remain uncounted pending complete coverage. Totals: 38 functional PASS / 237 NOT_RUN; state remains 3 PASS / 75 NOT_RUN.

## Authorization invalid-confirmation state guard

- `ST-AUTHZ-019` passed in 886ms without changing tenant authorization state. For both enforce and rollback endpoints, empty, lower-case, opposite-action, and arbitrary confirmations all returned `400`; after every rejection, a fresh cutover-status read exactly matched the pre-test status, epoch, rollout metadata, and timestamps. No cutover operation, fixture, or external operation occurred. Totals: 38 functional PASS / 237 NOT_RUN; state: 4 PASS / 74 NOT_RUN.

## Required-actions authentication lifecycle

- Fresh `AUTH-002` passed through an isolated run-scoped account: initial browser login redirected to `/account/setup`, the normal UI completed password/profile setup, logout returned to login, and a fresh login with the new password reached the dashboard. The account was registered immediately on creation, deleted by product API, and verified absent by direct readback; manifest ends empty with zero cleanup failures.

## L4 stop: duplicate Enforce regression

- `ST-AUTHZ-020` failed on this baseline. A valid duplicate `POST /api/rbac/migration/cutover/enforce` while already `enforced` returned `200` and advanced the epoch from 6 to 7, contrary to the required rejection/no-side-effect contract. Readback confirmed the tenant remained enforced and preflight eligible; this is nevertheless a real state-machine defect because it rewrote the epoch, timestamp, and audit path.
- Per the L4 stop rule, this run is invalidated and no further L4 case is to be counted. `REM-P0-007-authorization-cutover-idempotency` was opened on an independent branch. Its current-branch runtime evidence verifies the repair rejects duplicate Enforce with `409` and leaves the full cutover status object unchanged; a new full L4 run is required after its no-ff merge.
