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
