# Process Exception: Visual Audit Waived

- Authorizer: user, in-thread
- Date: 2026-08-14
- Missing or bypassed gate: visual audit / Light-Dark x 1440/1024/390 screenshot scoring
- Business reason: user explicitly authorized skipping visual audit
- Risk and blast radius: dashboard chart/layout defects may ship undetected until a later authorized visual pass
- Temporary controls: isolated Neutral tokens; charts use Neutral greyscale
- Follow-up task and expiry: later authorized visual pass; expires when the user re-enables visual audit
- Scope: this Goal from 2026-08-14 onward, including YAN-51 and later slices, until revoked
