# REM-P1-075 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | `mvn -q -f backend/pom.xml -Dtest=ExportServiceTest,ChangeDocSubmitIdempotencySqlTest,ChangeDocApprovalNotificationTest test` | PASS |
| L2 | `ExportServiceTest,ChangeDocTemplateServiceWordTest,TableFieldSupportTest,ChangeDocApprovalNotificationTest,ChangeDocSubmitIdempotencySqlTest,ChangeDocWorkflowOrchestratorTest`；Java 21 | PASS |
| L3 build/runtime | `mvn -q -f backend/pom.xml -DskipTests package`; `docker compose -f docker-compose.dev.yml up -d --build --no-deps backend`; health `UP` | PASS |
| L3 Playwright | `test/rem-p1-075-change-export-approval-table-contract.spec.js`，`--workers=1`，真实流程审批、4 下载、4 归档、双模板隔离、403/UI 隐藏 | PASS |
| 数据安全 | `REM_P1_075_20260722` manifest：`objects=[]`，`cleanupFailures=0` | PASS |

证据：[`evidence/l3-final/result.json`](./evidence/l3-final/result.json)（XL-EXPORT-002 PASS；browserDownloads=4；archiveFiles=4；noExportApiStatus=403；noExportUiButtons=0；Console/5xx=0）。
