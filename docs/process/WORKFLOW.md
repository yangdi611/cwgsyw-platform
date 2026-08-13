# cwgsyw-platform AI Software Delivery Workflow

## 1. Adoption Model

`cwgsyw-platform` is an existing product. The current `development` branch and deployed development environment are the system baseline. Do not recreate historical lifecycle artifacts merely to satisfy this workflow.

Apply the workflow prospectively to every new feature, bug, security fix, refactor, infrastructure change, documentation change, and release.

## 2. Sources of Truth

| Concern | Source of truth |
|---|---|
| Scope, priority, dependencies, acceptance, state | Linear |
| PRD, ADR, architecture, operational decisions, retrospective | Notion or repository documents |
| UI design, interaction, visual acceptance | Figma |
| Code, review, CI, release evidence | GitHub |
| Analysis, implementation, tests, delivery report | Codex |
| Risk acceptance, merge, deployment, exceptions | Human project owner |

Use the same Linear identifier in branch names, commits, pull requests, design links, and delivery reports.

## 3. Project Structure in Linear

- One Linear Project represents a product release or a bounded initiative.
- Seven lifecycle phases may be represented as milestones: requirements, design, readiness, development, quality, release, operations.
- Epics represent modules or independently valuable deliverables.
- Issues represent independently verifiable work.
- Sub-issues represent frontend, backend, testing, documentation, migration, or deployment work only when separate tracking adds value.

Recommended workflow states:

```text
Backlog → Discovery → Design Review → Ready → In Progress
→ In Review → QA → UAT → Released → Done
```

The 21 lifecycle steps are governance activities and deliverables, not 21 Linear states.

## 4. Task Intake

Choose the matching template under `docs/templates/linear/`:

- `FEATURE.md`
- `BUG.md`
- `SECURITY.md`
- `TECHNICAL-DEBT.md`
- `RELEASE.md`

The task remains before `Ready` until `DEFINITION-OF-READY.md` passes. Codex may investigate read-only and list missing information but must not begin substantive implementation.

## 5. Branch and Worktree Policy

The integration branch is `development`; `master` is the stable branch. New work targets `development` unless the project owner explicitly authorizes another base.

Use one task per branch:

```text
feat/PLAT-123-short-description
fix/PLAT-124-short-description
security/PLAT-125-short-description
chore/PLAT-126-short-description
release/PLAT-127-version
```

Use an isolated worktree when parallel work exists, the main checkout is dirty, or the task is risky:

```bash
git fetch origin
git worktree add ../worktrees/PLAT-123 -b feat/PLAT-123-short-description origin/development
```

Never move, discard, include, or clean unrelated user changes. If target files overlap with existing work, stop and report the conflict.

## 6. Codex Execution Loop

1. Read global workflow files, root `AGENTS.md`, nested instructions, and this directory.
2. Verify the task is real and passes the project DoR.
3. Inspect worktree status and confirm branch, base, scope, non-goals, validation, and rollback.
4. Refresh GitNexus when stale, then perform required impact analysis before symbol edits.
5. Create or update a written plan for large or high-risk changes.
6. Implement the smallest reviewable change without unrelated cleanup.
7. Run impact-based checks from `docs/standards/code-review-checklist.md`.
8. Run GitNexus change detection when available and explain the affected scope.
9. Produce a delivery report and prepare a pull request using `.github/pull_request_template.md`.
10. Wait for explicit authorization before commit, push, external state updates, merge, or deployment when not already authorized.

## 7. Quality Gates

Required GitHub checks currently include:

- Frontend audit, typecheck, lint, tests, and production build.
- Backend Maven tests on Java 21.
- Dependency review for pull requests.
- CodeQL for Actions, Java/Kotlin, and JavaScript/TypeScript.
- Resolution of review conversations.

Run the smallest relevant local checks first. Historical failures must be distinguished from new failures with reproducible evidence; they are not automatically waived.

High-risk protection applies to authentication, authorization, RBAC, workflow, CMDB models, database migrations, import/export, backup/restore, secrets, deployment, and large refactors.

## 8. Environment Flow

```text
Local / Worktree → Pull Request CI → Development → QA / Test
→ UAT → Release Approval → Production → Monitoring
```

The current GitHub workflow deploys updates to `development` automatically after changes reach that branch. Treat merge and deploy as externally consequential actions. Codex must not perform them without explicit authorization.

Until GitHub Environment approval is added, the human approver must verify the deployment checklist before authorizing a merge that triggers deployment.

## 9. Bug and Security Feedback

- Link a defect to the originating issue, pull request, or release when possible.
- Record reproduction and environment before the fix.
- Add regression coverage when practical.
- Re-run the normal PR, CI, QA, and release gates.
- During closure, decide whether to update tests, monitoring, documentation, prompts, Skills, `AGENTS.md`, or CI.
- Keep sensitive security details in restricted channels and expose only necessary remediation information.

## 10. Completion and Improvement

An issue reaches `Done` only when `DEFINITION-OF-DONE.md` passes. A merge or successful deployment alone is insufficient.

Retrospectives should convert repeated failures into a concrete change to intake, design, implementation rules, tests, CI, monitoring, or approval ownership. Trial material process changes before promoting them to `~/.codex/workflows/software-delivery/`.
