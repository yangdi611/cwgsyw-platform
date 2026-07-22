# REM-P1-059 验证记录

| 层级 | 命令/证据 | 状态 |
|---|---|---|
| L1 | `frontend npx tsc --noEmit`；`frontend npm run lint`（0 errors，39 个既有 warnings）；Java 21 focused test 新增断言通过 | PASS |
| L2 | `DeviceServiceTest,CiInstanceCommandServiceTest,CiRelationServiceTest,CiTopologyCompareServiceTest,CmdbVoSerializationTest`：21/23 PASS；2 个既有 scope-denial exception assertion mismatch，非本事件回归 | PASS_WITH_BASELINE_NOTE |
| L3 | `REMEDIATION_RUN_ID=REM_P1_059_20260720 FQA_BASE_URL=http://127.0.0.1 npx playwright test test/rem-p1-059-cmdb-device-navigation.spec.js`：1 passed（2.8s）；API、CI→device、device→CI、删除保护、清理 | PASS |
| Cleanup | event manifest `objects=[]`、`cleanupFailures=0`；backend healthy；无本事件未解释 5xx | PASS |

证据目录：`/tmp/rem-p1-059-l3-r2`。Java 26 宿主运行曾因 Mockito/Byte Buddy 不兼容失败，已用项目 Java 21 环境复验；该环境失败不计入产品断言。
