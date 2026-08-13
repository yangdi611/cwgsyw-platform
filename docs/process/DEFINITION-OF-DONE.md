# cwgsyw-platform Definition of Done

This checklist extends the global Definition of Done. Every applicable item must be supported by evidence linked from the Linear issue or pull request.

## Scope and Behavior

- [ ] Every acceptance criterion is mapped to delivered behavior or an approved exclusion.
- [ ] No unrelated user changes, cleanup, generated files, logs, or secrets are included.
- [ ] Routes, query keys, API contracts, permissions, tenant boundaries, soft delete, audit logging, and database behavior remain correct.
- [ ] Required documentation, ADR, API specification, migration notes, and release notes are updated.

## Documentation Impact Assessment

- [ ] The delivery report and Linear issue contain a `Documentation Impact Assessment`.
- [ ] PRD or feature requirement is marked `Update`, `Create`, `Not applicable`, or `Follow-up task`, with reason and link/path.
- [ ] ADR is marked `Update`, `Create`, `Not applicable`, or `Follow-up task`, with reason and link/path.
- [ ] API, data model, migration, security, and operational documentation are each assessed as applicable, with reason and link/path.
- [ ] Current System Baseline is marked `Update`, `Not applicable`, or `Follow-up task`, with reason and link/path.
- [ ] Deferred or conflicting documentation has a linked Linear follow-up task; no material documentation gap is hidden in prose.

## Frontend Evidence

- [ ] `npm run typecheck` passes.
- [ ] `npm run lint` introduces no new failures and the final CI gate passes.
- [ ] Relevant frontend tests pass.
- [ ] `npm run build` passes when required by impact or release scope.
- [ ] Changed interactions are verified through real routes, roles, states, and relevant viewports.

## Backend Evidence

- [ ] Relevant unit and integration tests pass under the supported Java environment.
- [ ] `mvn test` passes in required CI.
- [ ] RBAC, validation, audit logging, tenant isolation, soft delete, and error behavior are tested when affected.
- [ ] Migrations are reviewed and verified against a representative database when affected.

## Analysis and Review

- [ ] Required GitNexus impact analysis was completed before symbol edits.
- [ ] GitNexus change detection was run when available and affected processes are explained.
- [ ] Pull request CI, CodeQL, dependency review, and required conversations pass or are resolved.
- [ ] An authorized human completed required code, security, QA, UAT, and release review.

## Delivery

- [ ] The pull request links the Linear issue and authoritative Notion/Figma/repository documents.
- [ ] Deployment, migration, rollback, and post-deployment checks are documented.
- [ ] Deployment was explicitly authorized and verified when it is part of the task.
- [ ] Monitoring and logs show no new critical regression during the required observation period.

## Closure

- [ ] Linear reflects the real state and links the pull request or release.
- [ ] The delivery report records actual checks, residual risks, rollback, and deferred work.
- [ ] Follow-up work has its own Linear issue.
- [ ] Repeated failures were evaluated for updates to tests, CI, monitoring, Skill, prompt, or `AGENTS.md`.

`PASS` means observed evidence. Use `FAIL`, `BLOCKED`, `DEFERRED`, or `NOT RUN` honestly when that is the real result.
