# Codex Task Execution Prompt

Use this prompt after a real Linear task passes the project Definition of Ready.

```text
Execute Linear issue <ISSUE-ID> for cwgsyw-platform.

First read the global workflow under ~/.codex/workflows/software-delivery/, the repository AGENTS.md files, and docs/process/. Retrieve or ask me for the real issue content and linked Notion/Figma documents; do not invent missing identifiers or requirements.

Before editing:
1. Check the Definition of Ready and state READY, NOT READY, or READY WITH APPROVED EXCEPTION.
2. Inspect the current branch and worktree without disturbing unrelated user changes.
3. Use one task-specific branch/worktree based on origin/development when needed.
4. Refresh GitNexus if stale and perform required upstream impact analysis.
5. State scope, non-goals, affected areas, plan, validation commands, risks, and rollback boundary.

Then implement the smallest reviewable change, add or update tests, run impact-based local checks, and run GitNexus change detection when available. Distinguish PASS, FAIL, BLOCKED, DEFERRED, and NOT RUN truthfully.

Before the delivery report, produce a `Documentation Impact Assessment` with exactly these items:

1. PRD or feature requirement: Update / Create / Not applicable / Follow-up task; reason; authoritative link or path.
2. ADR: Update / Create / Not applicable / Follow-up task; reason; authoritative link or path.
3. API, data model, migration, security, or operational documentation: Update / Create / Not applicable / Follow-up task; reason; authoritative link or path.
4. Current System Baseline: Update / Not applicable / Follow-up task; reason; authoritative link or path.
5. Follow-up documentation task: Linear ID, or `None` with reason.

Do not mark a task `Done` without the assessment. You may draft pages, updates, and follow-up tasks, but must obtain explicit current-task authorization before mutating Notion or Linear.

Finish with a delivery report matching the global template and prepare the GitHub PR evidence. Do not commit, push, create or merge a PR, update Linear/Notion, or deploy unless I have explicitly authorized that external action.
```
