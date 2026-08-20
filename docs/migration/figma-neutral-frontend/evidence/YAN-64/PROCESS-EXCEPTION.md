# Process Exception: Visual Audit Waived

- Authorizer: user, in-thread
- Date: 2026-08-14
- Missing or bypassed gate: visual audit
- Business reason: user explicitly authorized skipping visual audit going forward
- Scope: this Goal from 2026-08-14 onward until revoked

## User-directed continuation in the YAN-71 worktree

- Authorizer: user, in the active visual-review conversation.
- Date: 2026-08-18.
- Exception: deliver the YAN-64 `/change-docs/:id` convergence inside the user-pinned `/Users/byron/AI/worktrees/YAN-71` worktree rather than a separate YAN-64 worktree.
- Controls: page-local composition and CSS, symbol impact before edits, no API/query/RBAC/route/write changes, focused tests, real-data read-only browser review, and GitNexus change detection.
- Remaining boundary: no commit, push, PR, merge, deployment, or Linear/Notion mutation without separate authorization.
