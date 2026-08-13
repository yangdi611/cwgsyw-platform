<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **cwgsyw-platform** (14474 symbols, 33363 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> Index stale? Run `node .gitnexus/run.cjs analyze` from the project root — it auto-selects an available runner. No `.gitnexus/run.cjs` yet? `npx gitnexus analyze` (npm 11 crash → `npm i -g gitnexus`; #1939).

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows. For regression review, compare against the default branch: `detect_changes({scope: "compare", base_ref: "master"})`.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `rename` which understands the call graph.
- NEVER commit changes without running `detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/cwgsyw-platform/context` | Codebase overview, check index freshness |
| `gitnexus://repo/cwgsyw-platform/clusters` | All functional areas |
| `gitnexus://repo/cwgsyw-platform/processes` | All execution flows |
| `gitnexus://repo/cwgsyw-platform/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## AI Software Delivery Workflow

- For every task that may change code, configuration, tests, documentation, dependencies, infrastructure, or release state, read the global workflow under `~/.codex/workflows/software-delivery/` and the repository workflow under `docs/process/` before implementation.
- Linear is the source of truth for task identity, scope, priority, dependencies, acceptance criteria, and status. Notion or repository specifications are the requirements and decision source; Figma is the visual-design source; GitHub is the code, CI, and release-evidence source.
- Substantive implementation requires a real Linear issue identifier and a passing `docs/process/DEFINITION-OF-READY.md`. Never invent an issue ID. Before editing, state `READY`, `NOT READY`, or `READY WITH APPROVED EXCEPTION` and explain any missing or waived gate.
- Read-only investigation may proceed without an issue. Emergency or untracked implementation requires explicit user authorization and must record the exception reason, risk, temporary controls, and follow-up issue.
- Use one issue per branch. Base normal work on `origin/development`; use a dedicated worktree when work is parallel, risky, or the current checkout is dirty. Never overwrite, relocate, stage, commit, or clean unrelated user changes.
- Use the Linear identifier consistently, for example `feat/PLAT-123-short-description`, `feat(PLAT-123): short description`, and `[PLAT-123] Short description`.
- Before implementation, record scope, non-goals, affected modules and contracts, validation commands, risk, and rollback boundary. Large or high-risk work requires a plan under `docs/plan/`.
- Follow `docs/standards/code-review-checklist.md`, run the smallest relevant checks first, and distinguish `PASS`, `FAIL`, `BLOCKED`, `DEFERRED`, and `NOT RUN` truthfully.
- Before declaring completion, evaluate `docs/process/DEFINITION-OF-DONE.md` and produce delivery evidence compatible with `~/.codex/workflows/software-delivery/templates/DELIVERY-REPORT.md` and `.github/pull_request_template.md`.
- Do not commit, push, create or merge a pull request, update Linear/Notion, deploy, publish, or perform another external mutation unless the user explicitly authorized that action for the current task. A merge to `development` can trigger deployment and therefore always counts as an external release action.

## Documentation Impact Assessment

- Before moving a task to `Done`, produce a `Documentation Impact Assessment` in the delivery report and Linear issue. Do not report the task complete without this assessment.
- Evaluate every item using one of: `Update`, `Create`, `Not applicable`, or `Follow-up task`. Record the reason and authoritative link or repository path for each decision.
- Required evaluation items:
  - PRD or feature requirement: whether the delivered change alters the product scope, behavior, acceptance criteria, or known constraints.
  - ADR: whether the work introduces or changes a material technical decision, trade-off, compatibility policy, or architectural boundary.
  - API, data model, migration, security, or operational documentation: whether a stable contract or runbook changed.
  - Current System Baseline: whether the current system overview, module boundary, architecture, deployment, monitoring, or workflow baseline must change.
  - Follow-up documentation task: whether incomplete, conflicting, or deferred documentation needs its own Linear issue.
- A `Not applicable` decision must state why. A material documentation update must be completed before `Done`, or be represented by a linked follow-up task with an owner and status.
- Codex may prepare the assessment and proposed content autonomously. Creating or changing Notion pages, Linear issues, or their statuses still requires explicit authorization in the current task.

## Code Quality Baseline

- Treat `docs/audit/code-quality-baseline.md` as the current quality snapshot and `docs/standards/code-quality-baseline-rules.md` as the working rules.
- Historical debt may remain, but new feature, bugfix, refactor, and documentation work must not expand it without an explicit reason, risk, and cleanup plan.
- Keep feature work and cleanup work separated unless the cleanup is required to implement the feature safely.
- New or modified frontend code must not introduce new lint errors. Prefer typed API contracts over `any`; every new `any` must be localized and justified.
- Avoid adding major behavior to frontend files over 600 lines without first proposing a split plan. For files over 900 lines, prefer behavior-preserving extraction before adding more complex behavior.
- Preserve existing query keys, API semantics, permissions, route behavior, and database contracts during refactors unless the user explicitly requests behavior changes.
- Before modifying core backend services, controllers, workflow/auth/permission code, or database migrations, run impact analysis when available and state the blast radius.
- After code changes, run the relevant checks from `docs/standards/code-review-checklist.md` and report any failures clearly.
- For large or risky changes, create or update a plan under `docs/plan/` before implementation, including scope, non-goals, validation commands, and rollback notes.
