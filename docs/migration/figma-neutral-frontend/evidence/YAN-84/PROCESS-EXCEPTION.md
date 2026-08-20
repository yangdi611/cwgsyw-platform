# Process Exception: Visual Audit Waived

- Authorizer: user, in-thread
- Date: 2026-08-14
- Missing or bypassed gate: visual audit; GitNexus MCP impact
- Business reason: user explicitly authorized skipping visual audit going forward
- Scope: YAN-84 and subsequent Neutral implementation slices until revoked
- GitNexus: MCP tools were not available. `InstanceDetailPage` is a route default export. In-page tabs are only consumed by this route. Risk: LOW.
