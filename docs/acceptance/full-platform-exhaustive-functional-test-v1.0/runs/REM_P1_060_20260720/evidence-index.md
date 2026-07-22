# REM-P1-060 L3 证据索引

| 证据 | 内容 |
|---|---|
| `/tmp/rem-p1-060-l3-final3` | 当前事件分支真实 Playwright 运行，1 passed；submit/approve 并发、状态生命周期、导出和权限拒绝 |
| `test-data-manifest.json` | 运行结束 `objects=[]`、`cleanupFailures=0` |
| `backend/src/test/.../SharedFileServiceTest.java` | 缺失 MinIO 对象孤儿元数据清理与普通存储故障保护 |
| `backend/src/test/.../ChangeDocSubmitIdempotencySqlTest.java` | tenant-scoped `FOR UPDATE` SQL 合同 |
| `/tmp/rem-p1-060-l3-final3/.../trace.zip` | Playwright 网络/运行时追踪 |

原始 L4 `FQA_20260718_2050_remp1038` 失败证据未覆盖；本索引只追加事件修复后的证据。
