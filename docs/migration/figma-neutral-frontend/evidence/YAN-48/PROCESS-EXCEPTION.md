# Process Exception: Visual Audit Waived

- Authorizer: user, in-thread
- Date: 2026-08-14
- Missing or bypassed gate: visual audit / Light-Dark x 1440/1024/390 screenshot scoring in `VISUAL-VALIDATION-RUNBOOK.md`
- Business reason: user explicitly authorized skipping visual audit for subsequent Goal work
- Risk and blast radius: layout, contrast, overflow, and composition defects may ship undetected until a later authorized visual pass
- Temporary controls: keep implementation isolated to Neutral; fail-closed token tests still run
- Follow-up task and expiry: a later authorized visual pass; expires when the user re-enables visual audit
- Scope: this Goal from 2026-08-14 onward, including YAN-48 and later slices, until revoked
