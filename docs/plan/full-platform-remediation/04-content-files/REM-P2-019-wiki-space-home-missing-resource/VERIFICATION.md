# REM-P2-019 验证矩阵

| AC | 用例 | 层级 | 证据 | 结果 |
|---|---|---|---|---|
| AC-001 | `WIKI-022` 无效空间首页 | L1/L3 | Playwright `/wiki/999999` | PASS |
| AC-002 | 有效空间首页 | L2/L3 | Playwright `/wiki/8` | PASS |
| AC-003 | 静态/构建/影响 | L2/L3 | lint/typecheck/container/detect | PASS |
