# Impact

`NewChangeDocPage` is page-local. GitNexus upstream impact: 0 callers, risk LOW.
`TemplateSelector` and `CiSelectorModal` are local to `/change-docs/new`.
`FieldList` / `TableFieldEditor` are also used by `/change-docs/[id]`. Props and APIs are unchanged; only visual primitives moved to Neutral. Risk LOW.
APIs `['change-doc-templates-active']`, POST `/change-docs`, POST `/change-docs/ai-generate-new`, GET `/cmdb/instances/search` are unchanged.
