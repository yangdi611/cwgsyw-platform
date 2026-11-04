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

Load applicable global/repository instructions once per task, including nested
instructions for touched files. Consult additional documents when the scope needs
them; an unchanged task does not require re-reading the workflow before each edit.

1. Verify the real issue and applicable DoR, or record an explicit exception.
2. Establish branch/worktree, scope, non-goals, validation, and rollback without
   disturbing user changes. Keep the note proportional; large/high-risk work needs
   a plan under `docs/plan/`.
3. Assess impact before risky contract/core-code changes as defined in `AGENTS.md`.
   Use graph analysis when useful and available; refresh only when staleness blocks
   that analysis. Known local edits can use targeted source/reference inspection.
4. Implement and verify the requested outcome. Add meaningful regression coverage
   when warranted, not automatically for reversible text or mechanical edits.
5. Review the actual diff and, for substantive code changes, use GitNexus change
   detection when available. Required checks passing is a stopping condition unless
   new edits, failures, or unresolved risks justify broader verification.
6. Report applicable DoD evidence and the Documentation Impact Assessment. Prepare
   PR evidence if a PR is in scope; local delivery does not claim CI/release/Done.
7. Perform commit, push, external updates, PR creation/merge, or deployment only
   when explicitly authorized for this task. Continue independent authorized work
   while an external step awaits approval.

## 7. Quality Gates

Required GitHub checks currently include:

- Frontend audit, typecheck, lint, tests, and production build.
- Backend Maven tests on Java 21.
- Dependency review for pull requests.
- CodeQL for Actions, Java/Kotlin, and JavaScript/TypeScript.
- Resolution of review conversations.

Required CI checks remain release gates, not a requirement to run every suite locally for every task. Documentation-only edits use diff, structure, and reference checks. For code, run the smallest checks that cover the changed behavior; expand for cross-module or release risk. Historical failures must be distinguished from new failures with reproducible evidence; they are not automatically waived.

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
