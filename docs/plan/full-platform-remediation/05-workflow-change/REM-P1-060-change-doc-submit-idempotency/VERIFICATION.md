# REM-P1-060 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21 `mvn -q -Dtest=SharedFileServiceTest,ChangeDocSubmitIdempotencySqlTest test`；12 tests，0 failure/error | PASS |
| L2 | Java 21 `SharedFileServiceTest,SharedFolderServiceTest,ChangeDocTemplateLifecycleTest,ChangeDocTemplateServiceWordTest,ExportServiceTest,TableFieldSupportTest,ChangeDocSubmitIdempotencySqlTest`；52 tests，0 failure/error | PASS |
| L3 build | 当前事件分支 `docker compose -f docker-compose.dev.yml build backend`；`mvn -q -Dmaven.test.skip=true package`；backend health=healthy，`/api/health`=UP | PASS |
| L3 runtime | `FQA_L4_RUN_ID=REM_P1_060_20260720 npx playwright test test/l4-change-terminal-export-idempotency-current-run.spec.js --workers=1 --output=/tmp/rem-p1-060-l3-final3`；1 passed | PASS |
| L3 contract | submit `200/409`、approve `200/409`、唯一 audit/snapshot、四状态导出、export deny、归档和终端清理 | PASS |
| Cleanup | `docs/acceptance/.../runs/REM_P1_060_20260720/test-data-manifest.json`：`objects=[]`、`cleanupFailures=0` | PASS |

扩大 Changedoc/Sharedfile 测试初次包含未修改的 `SharedFileControllerTest` 时有 2 个既有 `folderId null`/`0L` 参数断言差异；排除该未修改 Controller 后受影响集合 52/52 通过，差异未归入本事件。

原始 L4 `CHANGE-019` 失败证据保持不变；修复后证据追加于 `/tmp/rem-p1-060-l3-final3`，待事件 no-ff 合并后在同一 L4 run 复验受影响 cases。
