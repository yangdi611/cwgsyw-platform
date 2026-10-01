# Codex Task Execution Prompt

Use after a real Linear task passes the project Definition of Ready.

```text
Execute Linear issue <ISSUE-ID> for cwgsyw-platform through local implementation
and relevant verification. Use its actual acceptance criteria and linked sources;
never invent missing identifiers or requirements.

Follow AGENTS.md and the applicable docs/process/ gates. State readiness, scope,
non-goals, impact, validation, and rollback briefly; use a written plan for
large/high-risk work. Read only task-relevant references and preserve unrelated
user changes. Continue authorized work without pausing for routine local steps.

Validate the changed behavior and required checks. Once these pass, broaden or
repeat only for new edits, failures, or unresolved risk. Report actual results and
the five-item Documentation Impact Assessment from DEFINITION-OF-DONE.md.
Distinguish local delivery from CI, review, release, and tracker Done.

Do not commit, push, create/merge a PR, update Linear/Notion, deploy, or perform
other externally consequential actions without explicit current-task authorization.
```
