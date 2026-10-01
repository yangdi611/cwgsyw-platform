# cwgsyw-platform Delivery Governance

This directory adapts the global AI software-delivery workflow under `~/.codex/workflows/software-delivery/` to this repository.

## Entry Points

- `WORKFLOW.md`: project lifecycle, task states, branch strategy, environments, and evidence flow.
- `DEFINITION-OF-READY.md`: project-specific start gate.
- `DEFINITION-OF-DONE.md`: project-specific completion gate.
- `AI-TASK-EXECUTION.md`: reusable instruction for starting a Codex task from a real tracker item.
- `docs/templates/linear/`: templates to create in Linear.
- `.github/pull_request_template.md`: required pull-request evidence.

The repository root `AGENTS.md` defines applicability and points to these gates. Read the relevant sections once per task, not the entire directory before every edit. Existing feature-specific runbooks remain valid inside their own scope; this directory is the repository-wide baseline.
