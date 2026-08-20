# Impact

GitNexus MCP was not available as a session tool. Local CLI impact on `cwgsyw-platform`:

- `TaskPlanEditor`: LOW, 2 direct callers (`/tasks/plans/new`, `/tasks/plans/[planId]`).
- `CiScopeSelector`: LOW, 1 direct caller (`TaskPlanEditor`).
- queryKeys unchanged.
