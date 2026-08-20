# Impact

`ChangeDocDetailPage` is page-local. GitNexus upstream impact: 0 callers, risk LOW.
`DocActionBar` and `PlanTemplatePicker` are local to this page.
`CiLinkSelector` remains the existing CMDB widget; APIs and permissions are unchanged.
The action bar and picker each have one direct caller (`ChangeDocDetailPage`) and LOW upstream risk. All save/submit/approve/export/template/CI contracts remain unchanged.
