# Impact

`TemplateFieldsPage` is page-local. GitNexus upstream impact: 0 callers, risk LOW.
`TableConfigEditor` is only consumed by this page (the task-template editor has a different local function of the same name). Risk LOW.
APIs GET/PUT `/admin/change-doc-templates/:id`, PUT `/:id/fields`, DELETE `/:id/fields/:fieldId` are unchanged.
