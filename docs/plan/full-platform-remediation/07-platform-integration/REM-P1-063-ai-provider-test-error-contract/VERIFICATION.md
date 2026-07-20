# REM-P1-063 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1/L2 | Java 21 `AiConfigControllerTest,AiProviderConfigValidationTest,ChangeDocApprovalNotificationTest,WorkflowAdapterAuditRemarkTest`；14/14 | PASS |
| L3 build | 生产 backend 构建；`/api/health`=UP | PASS |
| L3 runtime | `/tmp/rem-p1-063-l3-r1`；真实 UI/API 1/1 in 2.3s | PASS |
| Error contract | 失败 400/`AI_PROVIDER_TEST_FAILED`，成功 200；无 `Unhandled exception`/5xx/秘密泄露 | PASS |
| Cleanup | provider 精确恢复；manifest 0/0 | PASS |
