# Impact

GitNexus MCP was not available as a session tool. Local CLI `impact TaskTemplateDetail --direction upstream --repo cwgsyw-platform`:

- Function `TaskTemplateDetail` in `frontend/src/components/task-template/TaskTemplateDetail.tsx`: LOW, 1 direct caller (`/tasks/templates/[templateId]`).
- Interface `TaskTemplateDetail` in `frontend/src/lib/task-template-api.ts` was not edited (HIGH candidate ignored).
- `getTaskTemplate` / `createTaskTemplateDraft` payload and queryKey `['task-template', templateId]` unchanged.
