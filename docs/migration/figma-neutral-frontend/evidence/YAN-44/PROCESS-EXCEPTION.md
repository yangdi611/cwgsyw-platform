# Process Exception: Visual Audit Waived

- Authorizer: user, in-thread
- Date: 2026-08-14
- Missing or bypassed gate: visual audit / Light-Dark x 1440/1024/390 screenshot scoring in `VISUAL-VALIDATION-RUNBOOK.md`
- Business reason: user explicitly authorized skipping visual audit for subsequent Goal work after screenshot capture was blocked from being inspected in-session
- Risk and blast radius: layout, contrast, overflow, and composition defects may ship undetected until a later authorized visual pass; M0 tokens can still fail closed on Collection 1 / remote / illegal syntax
- Temporary controls: keep generated fixture and six captured PNGs on disk; do not score them PASS; do not import new tokens into old pages
- Follow-up task and expiry: a later authorized visual pass on the current fixture or first real consumer; expires when the user re-enables visual audit
- Scope: this Goal from 2026-08-14 onward, including YAN-11 remainder and later slices, until revoked
