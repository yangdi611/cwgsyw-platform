# REM-P1-057 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| `AC-001` | L1-L3 | PASS | 空组继承单测；真实 child access `ownerGroupId` 与 parent 一致，正向读取 200 |
| `AC-002` | L1-L2 | PASS | 非 setgid 显式组保留、setgid 父组覆盖单测 |
| `AC-003` | L1-L3 | PASS | 根初始化组校验、default ACL copy、96/96 聚类和共享目录生命周期 1/1 |
| `AC-004` | L3 | PASS | `/tmp/rem-p1-057-wiki024-r2`：allow → parent no-x → 403，响应不含标题/内容 |
| `AC-005` | L3 | PASS | image `sha256:55f0d391...`、backend healthy/UP、日志无 ERROR/5xx、manifest/关键词为零 |

原始失败：L4 snapshot `50332f17`；测试资产 `test/l4-wiki-ancestor-traverse-current-run.spec.js`；外部输出 `/tmp/fqa-2050-wiki024-r1..r4` 和 `/tmp/fqa-2050-wiki024-diag`。

事件证据：`AuthorizationResourceMigrationOwnerGroupTest` 3/3 与既有 group-reference 1/1；受影响聚类 96/96；`test/rem-p1-057-wiki-ancestor-runtime.spec.js` 在 `/tmp/rem-p1-057-wiki024-r2` 1/1（2.5s）；`test/l4-file-folder-lifecycle.spec.js` 在 `/tmp/rem-p1-057-shared-folder-r1` 1/1（837ms）。事件 manifest 最终 `objects=[]`、`cleanupFailures=0`，users/roles/spaces runId 搜索均为 0。
