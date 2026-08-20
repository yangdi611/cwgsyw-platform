# Process Exception: Visual Audit Waived

- Authorizer: user, in-thread
- Date: 2026-08-14
- Missing or bypassed gate: visual audit
- Business reason: user explicitly authorized skipping visual audit going forward
- Scope: YAN-71 and subsequent Neutral implementation slices until revoked
- GitNexus: MCP tools were not available in this session. `NewWorkflowDesignPage` is a route default export with no shared symbol dependents. Change is visual shell only. Risk: LOW.

## Approved Scope Extension: Shared Dialog Migration

- Authorizer: user, in-thread
- Date: 2026-08-16
- Missing or bypassed gate: Linear YAN-71 remains scoped to `/workflow/design` and does not yet record the all-site Dialog / AlertDialog migration or its acceptance criteria.
- Business reason: user explicitly approved replacing the shared Dialog implementation after the shadcn.io and GitNexus assessment.
- Scope: replace the internals of `NeutralDialog` and `NeutralAlertDialog` with Radix / shadcn primitives while preserving the existing consumer API; retain the shared blurred overlay and add bidirectional motion and focus return. Drawer, Popover, Menu, and the Wiki Mermaid fullscreen viewer are excluded.
- Risk and blast radius: CRITICAL. GitNexus reports 59 affected execution flows and 20 modules; static inventory covers 40 `NeutralDialog` and 37 `NeutralAlertDialog` instances in 51 files.
- Temporary controls: no consumer-by-consumer rewrite; separate Dialog and AlertDialog semantics; preserve controlled confirmation behavior; run typecheck, full frontend tests, production build, focused lint, GitNexus change detection, and real-browser checks for normal and destructive dialogs.
- Follow-up and expiry: before commit, push, or PR, the human owner must update YAN-71 or authorize creation of a dedicated Linear issue containing this scope and evidence. This exception expires at that delivery gate.

## Approved Scope Extension: Existing React Hooks Lint Errors

- Authorizer: user, in-thread
- Date: 2026-08-17
- Missing or bypassed gate: the three existing lint errors are outside the recorded YAN-71 product scope, and the GitNexus MCP `impact()` tool is unavailable in this session.
- Business reason: user explicitly approved repairing the three baseline `react-hooks/set-state-in-effect` errors in the YAN-71 worktree after the migration commit exposed them in the full lint gate.
- Scope: remove synchronous effect-driven state initialization from the system configuration page, RBAC permissions page, and group member dialog without changing their API contracts, permissions, routes, or visible workflows.
- Risk and blast radius: LOW–MEDIUM. Static inventory identifies two isolated route entries and one `MemberDialog` consumer on the groups page; live GitNexus symbol impact could not be executed.
- Temporary controls: preserve query keys and API payloads; use keyed child components for server-backed initialization; run focused and full ESLint, typecheck, relevant frontend tests, and production build before commit.
- Follow-up and expiry: this exception covers only these three lint errors and expires after their local validation and commit. Push, PR, Linear updates, and deployment remain unauthorized.

## Approved Continuation: Accumulated Worktree Impact And Recoverable Blockers

- Authorizer: user, via the active Goal objective
- Date: 2026-08-17
- Missing or bypassed gate: the night Goal previously stopped when whole-worktree `detect-changes --scope unstaged` reached HIGH, and stopped the queue on design conflict, destructive-choice requirements, missing permissions/data, or scope expansion.
- Business reason: the user explicitly revised the active Goal so these conditions are recorded in repository evidence and the remaining eligible CMDB pages continue without interruption.
- Scope: accept the cumulative unstaged HIGH caused by the existing YAN-71 batch while continuing one CMDB page at a time. For design conflicts, destructive choices, permission/data gaps, or scope expansion, record the limitation and defer the unsafe or unverifiable state, then continue to the next eligible page.
- Risk and blast radius: current whole-worktree GitNexus result is HIGH at 17 files, 29 symbols, and 8 processes. Each new symbol still requires its own upstream impact analysis. A direct symbol HIGH/CRITICAL is not silently ignored: do not edit that symbol unless the current user authorization specifically covers it; record and choose a safe page-local or deferred path.
- Temporary controls: preserve API/query-key/RBAC/database/route semantics; never fabricate data or permissions; do not execute destructive confirmations merely for testing; run page-level tests, proportional regression, browser checks, and whole-worktree change detection; record every deferred state.
- Follow-up and expiry: this exception lasts for the current CMDB night Goal. Commit, push, PR, merge, deploy, Linear, and Notion mutations remain unauthorized unless separately approved.

### Observed cumulative escalation during the 2D view slice

- Date: 2026-08-17
- Whole-worktree evidence: `detect-changes --scope unstaged` now reports CRITICAL at 31 files, 77 symbols, and 16 affected flows after the spatial index slice. This is an accumulated batch result, not the direct risk of the current page.
- Current-page evidence: `TwoDViewPage` is LOW with 0 upstream symbols and 0 affected flows; `statusMeta` is LOW with one direct consumer. The current slice adds only `TwoDViewPage → PageShell` to the affected process list.
- Temporary control: continue only page-local work whose target symbols independently pass impact analysis; do not treat the cumulative CRITICAL result as authorization to edit any direct HIGH/CRITICAL symbol. Commit, push, PR, merge, deploy, and tracker mutations remain blocked pending a human delivery decision.

### Observed cumulative scope during the published spatial room slice

- Date: 2026-08-17
- Whole-worktree evidence: `detect-changes --scope unstaged` reports CRITICAL at 34 files, 90 symbols, and 16 affected flows after `/cmdb/spatial/rooms/332`; the flow count remains unchanged from the preceding spatial index slice.
- Current-page evidence: `SpatialRoomPage` is LOW with 0 upstream symbols and 0 affected flows; `SpatialRoomViewer` is LOW with one direct consumer; `SpatialViewerCanvas` is LOW with one direct consumer and two upstream symbols across two depths. Neither viewer symbol participates in an indexed execution flow.
- Temporary control: changes remain confined to the room route, its two viewer components, scoped Neutral CSS, the room fixture, and evidence documents. API, query keys, RBAC, data, canvas algorithms, and route semantics remain unchanged. Commit, push, PR, merge, deploy, and tracker mutations remain unauthorized.

### Observed cumulative scope during the spatial editor slice

- Date: 2026-08-17
- Whole-worktree evidence: `detect-changes --scope unstaged` reports CRITICAL at 36 files, 98 symbols, and 16 affected flows after `/cmdb/spatial/rooms/332/edit`; the affected-flow count remains unchanged.
- Current-page evidence: `SpatialEditPage` is LOW with 0 upstream symbols and 0 affected flows; `SpatialEditor` is LOW with one direct consumer; `SpatialEditorSession` is LOW with one direct consumer and two upstream symbols across two depths. None participates in an indexed execution flow.
- Temporary control: changes are limited to route/query feedback and behavior-preserving editor composition. The editor canvas algorithm, document transformations, API/query keys, permission checks, persistence revision contract, validation, publish behavior, and route semantics are unchanged. Browser checks used zoom, fit, and selection only; save, validate, import, upload, and publish were not triggered. Commit, push, PR, merge, deploy, and tracker mutations remain unauthorized.

### Observed cumulative scope during the spatial version-history slice

- Date: 2026-08-17
- Whole-worktree evidence: `detect-changes --scope unstaged` reports CRITICAL at 38 files, 103 symbols, and 16 affected flows after `/cmdb/spatial/rooms/332/versions`; the affected-flow count remains unchanged.
- Current-page evidence: `SpatialVersionsPage` is LOW with 0 upstream symbols and 0 affected flows; `SpatialVersionHistory` is LOW with one direct consumer and 0 affected flows.
- Temporary control: changes are confined to query/permission feedback, local table/card composition, truthful published-state display, and equivalent client navigation. The version list API, query keys, publish permission, restore endpoint and payload, data model, and route semantics remain unchanged. The restore AlertDialog was opened and cancelled only; restore confirmation was not executed. Commit, push, PR, merge, deploy, and tracker mutations remain unauthorized.

## Deferred Internal Spike Route Boundary

- Date: 2026-08-17
- Applicability evidence: `/cmdb/spatial/spike` is explicitly marked `spike only internal` in `PAGE-MIGRATION-MATRIX.md`, renders 500 fixed synthetic nodes, has no API, RBAC, persistence, publish, or production-data contract, and has no Sidebar or business-page entry. GitNexus reports the route as LOW with no upstream symbols or flows, and the component as LOW with only the route consumer.
- Decision: exclude the route from production CMDB page-by-page visual acceptance. This does not authorize deletion or imply that the route is inaccessible.
- Residual risk: an authenticated user can still open the internal diagnostic route directly, and it has no dedicated permission check. Removing it, environment-gating it, or adding authorization would expand product/security scope and requires a follow-up task and explicit authorization. No Linear task was created because tracker mutation is unauthorized.

## Deferred Shared Topology Graph Refinement

- Authorizer: no direct-symbol HIGH authorization; deferred under the active Goal's safe-continuation rule.
- Date: 2026-08-17
- Missing or bypassed gate: none bypassed. GitNexus reports `CiTopologyGraph` as HIGH with 3 direct consumers, 5 upstream symbols, and affected flows in instance detail, topology compare, and topology page.
- Business reason: `/cmdb/topology/24` still needed a safe page-local migration, while changing the shared graph would exceed the current direct-symbol authorization.
- Scope: do not modify `frontend/src/components/cmdb/CiTopologyGraph.tsx`. Complete only the LOW-risk `TopologyPage` composition and record the graph node/hover Tooltip typography cleanup as DEFERRED.
- Risk and blast radius: the retained graph contains legacy compact typography and bold utility classes. It remains visible in three consumers, but its layout algorithm, interaction, colors, and public props stay unchanged in this slice.
- Temporary controls: adapt the snake_case DTO only at the current page boundary; validate the current page at 1440/1024/390; run the topology fixture, full Neutral suite, typecheck, lint, build, browser interactions, and whole-worktree change detection.
- Follow-up and expiry: revisit the shared graph only after explicit authorization for the `CiTopologyGraph` HIGH blast radius, with regression coverage for the topology page, compare page, and instance-detail topology tab. Commit, push, PR, merge, deploy, and tracker mutations remain unauthorized.

### Observed cumulative scope during the CMDB changes slice

- Date: 2026-08-17
- Whole-worktree evidence: `detect-changes --scope unstaged` reports CRITICAL at 40 files, 106 symbols, and 17 affected flows after `/cmdb/changes`.
- Current-page evidence: `CmdbChangesPage` is LOW with 0 upstream symbols and 0 affected flows before editing; `actionTone` and `toIso` are LOW with one direct consumer each. The completed slice maps only to `CmdbChangesPage → PageShell`.
- Temporary control: changes are confined to the route composition, scoped Neutral CSS, the page fixture, and evidence documents. API endpoints, query-key prefixes, filter parameters, RBAC checks, pagination numbering, data contracts, and route semantics remain unchanged. No business data was written. Commit, push, PR, merge, deploy, and tracker mutations remain unauthorized.
- Deferred browser states: the first two real result pages contain no `beforeJson` or `afterJson`, so the change-diff expansion cannot be exercised without fabricating or mutating data. Forced request errors and a no-permission identity were not introduced into the signed-in browser; their branches are covered by source and the focused fixture.
- Process documentation gap: root instructions reference `docs/standards/code-review-checklist.md`, but that file is absent in this worktree. The slice used the repository DoD and the stricter night-Goal validation ladder instead. Restoring the checklist or correcting the reference requires a follow-up documentation task; creating that Linear task remains unauthorized.

### Observed cumulative scope during the CMDB change-statistics slice

- Date: 2026-08-17
- Whole-worktree evidence: final `detect-changes --scope unstaged` reports CRITICAL at 42 files, 109 symbols, and 18 affected flows after `/cmdb/changes/stats`.
- Current-page evidence: `CmdbChangesStatsPage` is LOW with 0 upstream symbols and 0 directly affected flows; `DailyBarChart` is LOW with one direct consumer and participates only in `CmdbChangesStatsPage → PageShell`. The other edited page-local and test helper symbols were also LOW before editing.
- Temporary control: the slice is confined to the statistics route, scoped Neutral CSS, its focused fixture, and evidence documents. The GET endpoint, query-key tuple, permission resource/action, date parameter contract, DTOs, and route semantics remain unchanged. No SVG was added or replaced, so the Figma icon protocol is Not applicable for this page.
- Browser limitation: the Browser driver's `fill` and `type` operations do not dispatch a React `change` event for native `input[type=date]` in this environment. Real range filtering, clearing, and inverted-date interaction are therefore DEFERRED rather than represented as passing; source branches and the focused fixture cover their structure. Forced query failure and a no-permission browser identity are also DEFERRED. No page state, request data, or permissions were fabricated through evaluation.
- Process documentation gap: `docs/standards/code-review-checklist.md` remains absent while repository instructions reference it. The repository DoD and stricter night-Goal ladder were used; restoring the file or correcting the reference remains a follow-up documentation task, and Linear mutation is unauthorized.
- Authorization boundary: commit, push, PR, merge, deploy, Linear, and Notion mutations remain unauthorized.

## Approved Resolution: Shared CMDB React Flow Visual Refinement

- Authorizer: user, during visual review.
- Date: 2026-08-17.
- Prior deferred boundary: `CiTopologyGraph` had been intentionally left unchanged because its exact GitNexus impact is HIGH: 3 direct consumers, 5 upstream symbols, and 3 affected process families.
- Explicit scope: apply the same React Flow visual correction to every `CiTopologyGraph` consumer: topology page, topology compare, and the instance-detail topology tab.
- Implementation boundary: Token-driven gray dotted canvas, compact CI nodes, system `cwgsyw-popover` hover details, compact controls, and compact minimap. Public props, layout graph, collapse/click behavior, edge construction, API/query keys, RBAC, DTOs, and routes remain unchanged.
- Second visual-review refinement: the user-provided real screenshot showed that React Flow `fitView` still enlarged a lone node to nearly 2x. The shared fix caps initial fit-view zoom at 1, keeps manual zoom up to 1.5, reduces node width to 96–132px, removes the root-only outer ring, renders model text without a box, and retains only a subtle diff-state background.
- Third visual-review refinement: the node frame now follows the repository Neutral Card recipe instead of using a full status-colored card. It uses surface background, subtle 1px border, 6px radius, and no resting shadow; the real diff/status color is limited to a 2px left accent and compact diff label. Hover uses the standard surface-hover and elevation-sm feedback.
- Fourth visual-review refinement: the user-provided screenshot showed that the node detail surface was still scaled with the graph and that the four compare legend badges were oversized. Hover details now render through React Flow `NodeToolbar`, remain screen-sized at 184px wide and 200px maximum height, and use the compact system Popover typography/elevation. Only the compare legend is scoped to 18px-high, 11px badges; the shared Badge recipe is unchanged.
- Fifth visual-review refinement: the fixed 200px height created a scrollbar, while leaving the CI node immediately closed the toolbar. The bounded detail content now expands to its natural height, long names and values wrap instead of truncating, the toolbar accepts pointer interaction, and a 150ms leave delay bridges the node-to-toolbar gap. Hovering the toolbar cancels closure; `nodrag`, `nopan`, and `nowheel` isolate the readable surface from canvas gestures.
- Sixth visual-review refinement: the topology side-panel filters inherited the formal `label-sm` semibold recipe and the shared 20px/40px Checkbox density, conflicting with the approved CMDB rule that ordinary filter copy stays regular. A topology-scoped override now uses 12px/16px/400 group and option text, 16×16px Checkbox inputs, 8px label gap, and 28px rows. Shared Checkbox and typography recipes remain unchanged.
- Seventh visual-review refinement: the instance-detail topology tab used `preview=true`, which disabled node hover details together with canvas interaction. After user review, the tab now uses the same full `CiTopologyGraph` mode as topology compare: drag, wheel/pinch zoom, Controls, MiniMap, node collapse, and natural-height pointer-stable `NodeToolbar` details are enabled. Initial `fitView` remains compact at padding `0.35` and maximum zoom `1`; no separate preview-detail API is retained.
- Eighth visual-review refinement: the instance topology query passed the backend payload directly while topology and compare normalize snake_case DTO fields. This caused `model_name`, `model_id`, `model_color`, `is_root`, and `key_attrs` to render as missing in the shared hover card. `InstanceTopologyTab` now applies the same camelCase/snake_case normalization before rendering. Compare still differs only by its explicit diff status; base node details are aligned.
- Verification: focused three-consumer suite 9/9 PASS; Neutral suite 283/283 PASS; typecheck PASS; full lint 0 errors/26 existing warnings; production build PASS; `git diff --check` PASS. Browser visual verification is DEFERRED because the controllable localhost and LAN tabs remain on `/login`.
- Cumulative GitNexus: the latest unstaged result after the Neutral Card refinement is CRITICAL at 45 files, 127 symbols, and 19 affected flows. This cumulative result remains inside the active YAN-71 exception; no commit, push, PR, merge, deploy, Linear, or Notion mutation is authorized.

## User-authorized local commit

- Authorizer: user, in the active YAN-71 conversation.
- Date: 2026-08-17.
- Authorization: review the final CMDB baseline documentation and create one local commit containing the confirmed YAN-71 CMDB convergence batch, its focused regression coverage, official Figma icon assets, process evidence, and the CMDB night-Goal handoff documents.
- Scope control: this authorization supersedes earlier statements that a local commit was unauthorized, but only for this reviewed YAN-71 batch. It does not authorize unrelated cleanup or changes outside the recorded compatibility fixes.
- Remaining boundary: push, pull request creation or merge, deployment, release, and Linear or Notion mutation remain unauthorized.
- Required pre-commit evidence: run the relevant frontend tests, typecheck, lint, production build, `git diff --check`, and GitNexus change detection; stage the ignored CMDB baseline/night-Goal documents explicitly and verify the staged file list before committing.

### Final pre-commit scope evidence

- Full frontend tests: 291/291 PASS.
- TypeScript: `npm run typecheck` PASS.
- ESLint: `npm run lint` PASS with 0 errors and 26 existing warnings.
- Production build: `npm run build` PASS; all 55 static pages generated.
- GitNexus before staging: `detect-changes --scope unstaged` reports cumulative CRITICAL at 58 tracked modified files, 170 symbols, and 21 affected processes.
- GitNexus after explicit documentation and SVG staging: `detect-changes --scope staged` reports cumulative CRITICAL at 101 files, 170 symbols, and 21 affected processes. The larger file count includes the ignored baseline/night-Goal documents and official Figma assets; the code-symbol and process counts are unchanged. This is the final whole-batch result under the approved exception.
- Test-harness note: the full test run logs a React `closeDelay` DOM-prop warning because isolated Base UI test stubs render Trigger props onto a mock element. Base UI's installed Tooltip Trigger type and implementation explicitly support `closeDelay`; production code is unchanged and all tests pass.
- Remaining action before commit: re-run staged whitespace and status checks after recording this final evidence.

## User Review Follow-up: Instance Resource Empty-State Icons

- Authorizer: user, during visual review.
- Date: 2026-08-17.
- Figma source: official Icons collection `6:22411` in file `Z8EC6psFOj7KMfXapAFk24`.
- Candidate decision: device credentials use `key` node `6:27336` instead of the previous `file-key-2`; linked change documents use `file-diff` node `6:25779` instead of the generic EmptyState inbox. Alternatives `file-lock` and `file-clock` were inspected but rejected as less direct.
- Durable assets: `frontend/public/figma-icons/cmdb-resource-key.svg` SHA-256 `38fed185d755b35fc6e18faee8a8f12dc0c900d1dda75639845108c2510ec1f7`; `frontend/public/figma-icons/cmdb-resource-file-diff.svg` SHA-256 `45089b76e5c9cd819b45c4184c8f1dd117f57b06a6e1c09d735137535b76c631`. Both match the exact downloaded Figma bytes.
- GitNexus: `InstanceResourcesTab` LOW with one direct consumer; local `Section` LOW with one direct consumer. Both remain inside the instance-detail route chain.
- Verification: instance-detail/topology focused suite 9/9 PASS; typecheck PASS; focused lint 0 errors. Real browser visual review is DEFERRED because the controllable in-app tabs remain at login; the user-provided screenshots and current page remain the handoff surface.
- Correction after user review: the original “暂无关联” request also referred to the instance-detail Associations tab, which was still rendering the shared inbox. That tab now reuses the already verified Figma `link-2` node `6:27582` asset at its native 22×12 size inside the existing 24×24 empty-icon slot and disables the shared icon. `InstanceAssociationsTab` is LOW impact with one direct consumer and one instance-detail process family.
- Additional instance-detail correction: the Alerts tab was also still rendering the shared inbox. It now reuses the verified Figma `alert-circle` node `6:22984` asset at its native 22×22 size inside the same 24×24 empty-icon slot and disables the shared icon. `InstanceAlertsTab` is LOW impact with one direct consumer and one instance-detail process family.

### Observed cumulative scope during the CMDB alerts slice

- Date: 2026-08-17
- Whole-worktree evidence: final `detect-changes --scope unstaged` reports CRITICAL at 44 files, 114 symbols, and 19 affected flows after `/cmdb/alerts`.
- Current-page evidence: pre-edit `CmdbAlertsPage`, `severityMeta`, `statusMeta`, and focused-test helpers were LOW; each meta helper has only the current page as a direct consumer. The completed slice adds only `CmdbAlertsPage → PageShell` to the affected process list.
- Temporary control: changes are confined to the alerts route, scoped Neutral CSS, the focused fixture, one official Figma SVG, and evidence documents. The alerts GET endpoint, query-key tuple, pagination numbering, acknowledgement mutation and invalidation, RBAC, DTOs, and route semantics remain unchanged.
- Figma evidence: `alert-circle` node `6:22984` was selected from official collection `6:22411`; the original asset is stored at `frontend/public/figma-icons/cmdb-alert-circle.svg`, and its SHA-256 `d0ee4645f1a8e9710b5d0903f7c3bf8f96aebc60122e205b49659a6cd490fd8a` matches the downloaded bytes.
- Browser limitations: the real endpoint currently returns zero alerts. Desktop data rows, 390 data cards, live status badges, pagination, and acknowledgement therefore remain DEFERRED; no alert was fabricated and no acknowledgement mutation was executed. Forced query failure, a no-permission identity, and Dark mode are also DEFERRED. The real empty/filter-empty paths and 1440/1024/390 layout were verified, and the final fresh tab reported zero console errors or warnings.
- Process documentation gap: `docs/standards/code-review-checklist.md` remains absent while repository instructions reference it. The repository DoD and stricter night-Goal ladder were used; restoring the file or correcting the reference remains a follow-up documentation task, and Linear mutation is unauthorized.
- Authorization boundary: commit, push, PR, merge, deploy, Linear, and Notion mutations remain unauthorized.
