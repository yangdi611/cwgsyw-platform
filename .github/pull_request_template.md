## Task and Sources

- Linear issue: <!-- required, e.g. PLAT-123 -->
- Notion / repository specification:
- Figma / visual reference:
- Target branch: `development` / `master` / other:

## Outcome

### Requested

<!-- What outcome and acceptance criteria does this PR address? -->

### Delivered

<!-- Summarize observable behavior, not only files changed. -->

### Not Changed

<!-- State non-goals and protected behavior. -->

## Scope and Impact

- Affected modules, routes, APIs, data, permissions, or infrastructure:
- GitNexus upstream impact summary:
- GitNexus change-detection summary:
- Compatibility or migration impact:

## Project Invariants

- [ ] RBAC resources, actions, `@PreAuthorize`, frontend guards, and role assignments are correct when affected
- [ ] Write operations preserve required `audit_log` behavior
- [ ] Tenant, ownership, soft-delete, API camelCase, query keys, routes, and database contracts are preserved
- [ ] No new unbounded frontend `any` or unjustified dynamic backend contract was added
- [ ] Unrelated user work, cleanup, generated files, logs, and secrets are excluded

## Verification Evidence

| Check | Command or method | Result | Notes |
|---|---|---|---|
| Frontend typecheck | `cd frontend && npm run typecheck` | PASS / FAIL / NOT RUN | |
| Frontend lint | `cd frontend && npm run lint` | PASS / FAIL / NOT RUN | |
| Frontend tests | `cd frontend && npm test` | PASS / FAIL / NOT RUN | |
| Frontend build | `cd frontend && npm run build` | PASS / FAIL / NOT RUN | |
| Backend tests | `cd backend && mvn test` | PASS / FAIL / NOT RUN | |
| Runtime / Playwright / manual | | PASS / FAIL / BLOCKED / NOT RUN | |

## Acceptance and Delivery

- [ ] Linear acceptance criteria are mapped to evidence
- [ ] Relevant loading, empty, error, permission, role, and viewport states were checked
- [ ] CI, CodeQL, dependency review, and conversations are resolved
- [ ] Required QA / UAT / security / human approvals are linked
- [ ] Documentation and user-facing release notes are updated when needed

## Risk, Rollback, and Follow-up

- Residual risks:
- Rollback boundary and steps:
- Post-deployment health checks:
- Deferred work and Linear issue IDs:

## Authorization

- [ ] This PR is ready for human review
- [ ] Merge and deployment remain separate human-authorized actions
