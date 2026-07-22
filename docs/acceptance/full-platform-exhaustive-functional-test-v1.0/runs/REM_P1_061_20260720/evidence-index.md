# REM-P1-061 Evidence Index

| Evidence | Result | Location |
|---|---|---|
| Java notification contract | PASS, 4/4 | `ChangeDocApprovalNotificationTest` |
| Affected Changedoc/Workflow regression | PASS, 42/42 | Java 21 Maven container |
| Production backend | PASS | Docker build; `/api/health`=UP |
| Direct approval notification runtime | PASS, 1/1 in 6.6s | `test/l4-change-approval-scope-comments-current-run.spec.js`; `/tmp/rem-p1-061-l3-r1` |
| Cleanup | PASS | `test-data-manifest.json`; `objects=[]`, `cleanupFailures=0` |
