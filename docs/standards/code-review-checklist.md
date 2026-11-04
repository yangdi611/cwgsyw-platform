# Code Review Checklist

Use this checklist for feature work, bug fixes, refactors, and remediation work.

## Scope

- Is the change limited to the requested module or plan?
- Are unrelated cleanup and feature changes separated?
- Are generated, log, or temporary files excluded?
- If the change touches a high-risk module, is there a plan or explicit scope note?

## Behavior

- Are existing routes, query keys, permissions, API contracts, and database behavior preserved?
- Are empty, loading, error, and permission-denied states still handled?
- Are tenant, soft-delete, audit-log, and ownership boundaries preserved?
- For UI refactors, does the visible workflow remain the same?

## Frontend

- No new lint errors.
- `npx tsc --noEmit` passes, or failures are documented as pre-existing.
- New API responses and form data are typed.
- New `any` is avoided or localized at a third-party boundary.
- React hooks dependencies, state updates, and effects are reviewed.
- Large page files do not receive major new behavior without a split plan.

## Backend

- Impact analysis is run when editing core services, controllers, workflow/auth/permission code, or migrations.
- DTOs are used for stable request contracts.
- Dynamic `Map<String,Object>` usage is validated at service boundaries.
- Database migrations are named clearly and do not mix unrelated schema changes.
- Exceptions and validation failures return consistent messages.

## Tests And Checks

Choose checks by changed surface, using current package scripts and CI configuration:

- Documentation/instructions only: diff/whitespace, local references, and relevant
  instruction/skill structure. No application build or runtime tests by default.
- Frontend code: targeted lint and relevant tests; typecheck for TypeScript changes.
  Verify affected interactions through routes/roles/states when behavior changes;
  build when framework/configuration impact or release scope requires it.
- Backend code: affected unit/integration tests under the CI-supported Java version;
  compile when relevant. Core contracts or cross-module impact need broader checks.
- Security, migrations, and releases: add their required representative-environment
  checks and approvals. Never assume local data is disposable.

Use repository commands such as `cd frontend && npm run lint`,
`cd frontend && npm run typecheck`, and `cd backend && mvn test` only when applicable.
Required CI gates still apply. Record actual results; historical baseline failures
are not current evidence or automatic waivers. Once relevant checks pass, rerun or
broaden only after a new edit, failure, or unresolved risk.

## Review Output

For review findings, use:

- `P0`: likely breakage, data loss, security, permission leak, failed build/test gate.
- `P1`: correctness, maintainability, or regression risk that should be fixed before merge.
- `P2`: cleanup, consistency, naming, or follow-up improvement.

Each finding should include file, line, risk, and suggested fix.
