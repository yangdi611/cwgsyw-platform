# cwgsyw-platform Definition of Ready

This checklist extends the global Definition of Ready. Every applicable item must pass before implementation begins.

## Common Gate

- [ ] A real Linear identifier, owner, type, priority, and target milestone exist.
- [ ] The problem, desired outcome, scope, and non-goals are explicit.
- [ ] Acceptance criteria are observable and testable.
- [ ] Dependencies, blockers, assumptions, risks, and affected modules are recorded.
- [ ] Notion, repository specification, ADR, and Figma links are attached when applicable.
- [ ] Required environment and test level are identified.
- [ ] Rollout, rollback, compatibility, and documentation expectations are stated.

## Frontend Changes

- [ ] Target routes, user roles, viewport expectations, and loading/empty/error/permission states are defined.
- [ ] Figma or an approved existing UI reference is linked for visual changes.
- [ ] API contracts, query keys, form behavior, and accessibility expectations are identified.
- [ ] Large touched files have a split or containment plan when required by `AGENTS.md`.

## Backend and API Changes

- [ ] Request and response contracts, validation, errors, and compatibility are defined.
- [ ] RBAC resource/actions and `@PreAuthorize` requirements are identified.
- [ ] Audit-log, tenant, ownership, and soft-delete behavior are specified.
- [ ] Dynamic CMDB or workflow data has a validation boundary.

## Database Changes

- [ ] Migration scope, naming, ordering, compatibility, backup, and rollback are documented.
- [ ] Data backfill or repair behavior is explicit and bounded.
- [ ] API field naming remains camelCase; user-defined JSONB attribute keys are handled separately.

## High-Risk Changes

- [ ] A written plan under `docs/plan/` defines scope, non-goals, validation, and rollback.
- [ ] GitNexus index is current or its limitation is recorded.
- [ ] Upstream impact analysis and expected blast radius are understood.
- [ ] Human approvals required before implementation, migration, merge, or deployment are named.

## AI Decision

Codex must state `READY`, `NOT READY`, or `READY WITH APPROVED EXCEPTION`. When not ready, it may continue safe investigation but must list the missing inputs and stop before substantive edits.
