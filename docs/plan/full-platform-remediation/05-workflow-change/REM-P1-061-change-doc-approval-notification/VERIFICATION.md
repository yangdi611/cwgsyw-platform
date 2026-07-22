# REM-P1-061 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21 `ChangeDocApprovalNotificationTest`；4 tests，0 failure/error | PASS |
| L2 | Java 21 `ChangeDocApprovalNotificationTest,ChangeDocTemplateLifecycleTest,ChangeDocTemplateServiceWordTest,ExportServiceTest,TableFieldSupportTest,WorkflowAdapterAuditRemarkTest`；42 tests，0 failure/error | PASS |
| L3 build | `docker compose -f docker-compose.dev.yml build backend`；Java 21 生产编译成功，重建后 `/api/health`=UP | PASS |
| L3 runtime | `FQA_L4_RUN_ID=REM_P1_061_20260720 npx playwright test test/l4-change-approval-scope-comments-current-run.spec.js --workers=1 --output=/tmp/rem-p1-061-l3-r1`；1 passed，6.6s | PASS |
| L3 contract | 同组直接通过通知、1024 字符 Unicode、空意见拒绝、跨组 404、`change_doc` 引用和既有状态/归档链 | PASS |
| Cleanup | `runs/REM_P1_061_20260720/test-data-manifest.json`：`objects=[]`、`cleanupFailures=0`；backend 无未解释 ERROR/5xx | PASS |

扩大测试输出仅包含既有 CJK 字体警告；生产构建和真实运行均通过。原始 L4 失败证据保持不变，no-ff 合并后在同一 L4 run 重验 `CHANGE-011/012`。
