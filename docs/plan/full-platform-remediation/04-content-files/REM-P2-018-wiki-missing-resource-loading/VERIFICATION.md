# REM-P2-018 验证矩阵

| AC | 用例 | 层级 | 证据 | 结果 |
|---|---|---|---|---|
| AC-001 | `WIKI-022` 不存在 page/space | L1/L3 | `/wiki/999999/999999` 显示“页面不存在或已删除”，不再加载 | PASS |
| AC-002 | 已存在 Wiki 页面 | L2/L3 | `/wiki/8/54` 保持正文/页面信息与导出入口 | PASS |
| AC-003 | Console/Network | L3 | 无效及有效路径 Console=0、4xx response=0 | PASS |
| AC-004 | lint/typecheck/build/detect | L2/L3 | lint 0 error（39 条既有 warning）、typecheck、当前分支 frontend 容器构建、detect | PASS |

原始 L4 FAIL 保留于 `FQA_20260716_2300_lintfix` 的执行记录与证据索引；不得覆盖。
