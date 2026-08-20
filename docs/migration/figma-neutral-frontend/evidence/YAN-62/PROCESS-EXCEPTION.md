# Process Exception: Visual Audit Waived

- Authorizer: user, in-thread
- Date: 2026-08-14
- Missing or bypassed gate: visual audit
- Business reason: user explicitly authorized skipping visual audit going forward
- Scope: this Goal from 2026-08-14 onward until revoked

## User-directed continuation in the YAN-71 worktree

- Authorizer: user, in the active visual-review conversation.
- Date: 2026-08-17.
- Exception: continue the YAN-62 `/change-docs` visual convergence slice inside the user-pinned `/Users/byron/AI/worktrees/YAN-71` worktree instead of creating a separate YAN-62 branch/worktree.
- Scope: page-local composition, scoped Neutral CSS, focused tests, browser review, and evidence updates for `/change-docs` only. `/change-docs/new` and `/change-docs/:id` remain subsequent slices under YAN-63 and YAN-64.
- Controls: preserve API, query key, RBAC, pagination, route, data, and write behavior; run symbol impact before edits, focused and proportional tests, responsive browser review, `git diff --check`, and GitNexus change detection.
- Remaining boundary: no commit, push, PR, merge, deployment, or Linear/Notion mutation without separate authorization.
