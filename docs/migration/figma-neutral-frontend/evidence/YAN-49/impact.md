# Impact

Local CLI impact `--direction upstream --repo cwgsyw-platform`:

- `TaskTemplateDesigner`: LOW, 1 direct caller (`TaskTemplateVersionPage`).
- `FieldLibrary` / `FormCanvas` / `FieldPropertyPanel` / `TemplatePreviewDialog`: only consumed by the designer.
- API payloads and queryKeys unchanged.
