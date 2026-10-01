# Code Quality Baseline Rules

This document defines the working quality rules for new development and remediation in this repository. It turns the baseline audit into day-to-day guardrails for humans and agents.

Baseline snapshot: `docs/audit/code-quality-baseline.md`

## Core Rule

Historical debt may remain, but every new feature, fix, refactor, or documentation change must avoid expanding that debt. If expanding debt is unavoidable, state the reason, risk, owner, and cleanup path before proceeding.

## Development Modes

### Normal Feature Mode

Use this when the target area is not listed as high risk in the baseline.

- Keep the change scoped to the requested feature.
- Do not perform unrelated cleanup.
- Do not introduce new lint errors, new broad `any`, new TODO/FIXME without an exit condition, or new temporary files.
- Run relevant checks and report failures.

### Feature Plus Local Cleanup Mode

Use this when the feature touches an already messy area.

- Clean only the code needed to make the feature safe.
- Prefer behavior-preserving extraction over behavior changes.
- Keep cleanup and feature commits separate when possible.
- Document any deferred cleanup.

### High-Risk Protection Mode

Use this for auth, permissions, workflow, CMDB data model, database migrations, import/export, and large refactors.

- Write or update a short plan before implementation.
- Run impact analysis when available.
- Define validation commands and manual acceptance steps.
- Keep changes small enough to review and roll back.

## Frontend Rules

- New or modified frontend code must not introduce new lint errors.
- Prefer explicit types for API responses, forms, permissions, and route params.
- Avoid `any`. If a third-party integration requires it, keep it at the adapter boundary and document why.
- Use `unknown` plus a shared error parser for caught errors instead of `catch (err: any)`.
- Do not add major behavior to files over 600 lines without a split note.
- For files over 900 lines, prefer extracting stable components/hooks before adding complex behavior.
- Preserve React Query keys during behavior-preserving refactors.
- Preserve route paths, tab state, permission checks, toasts, and empty/error states unless a behavior change is explicitly requested.

## Backend Rules

- Before editing core services, controllers, workflow/auth/permission code, or migrations, run impact analysis when available and summarize the blast radius.
- Keep controller request bodies typed with DTOs where the contract is stable.
- `Map<String,Object>` is acceptable for CMDB dynamic fields, metadata, and workflow variables, but validation must sit at the service boundary.
- Do not mix database migrations, API behavior changes, and large refactors in one unplanned change.
- Migrations must be repeatable in intent, clear in naming, and include comments for non-obvious compatibility decisions.
- Preserve tenant, permission, soft-delete, and audit-log boundaries.

## Refactoring Rules

- Refactors should start as behavior-preserving moves or extractions.
- Do not rename symbols with broad find-and-replace.
- Keep public APIs stable unless the user asks for a contract change.
- For large files, split in this order: independent tab/section, child component, constants/types/utils, hooks.
- Validate affected behavior after meaningful changes; reuse passing evidence for unchanged work and repeat only for new edits, failures, or unresolved risk.

## Baseline Metrics To Watch

Track these during reviews:

- Frontend lint status and error count.
- Frontend `any` count in touched files.
- Frontend files over 600 and 900 lines.
- Backend service/controller files over 500 lines.
- Backend `Map<String,Object>` added outside dynamic boundaries.
- Test status for touched modules.
- New TODO/FIXME/temporary files.

## Documentation Rules

- Keep baseline snapshots under `docs/audit/`.
- Keep standing quality rules under `docs/standards/`.
- Keep remediation plans under `docs/plan/code-quality-remediation/`.
- If a doc path is gitignored, use forced add only when explicitly staging or committing.
