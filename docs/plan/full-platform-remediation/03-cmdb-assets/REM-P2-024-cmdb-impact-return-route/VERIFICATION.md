# REM-P2-024 验证矩阵

| AC | 用例 | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | CMDB-039 | L1/L3 | PASS | 真实返回 href 为 host/20 |
| AC-002 | CMDB-039 | L1/L2 | PASS | 无 `_` href 回退 |
| AC-003 | CMDB-039 | L3 | PASS | 当前分支 frontend build 与 Playwright 路径通过 |

合并后仍须在新集成基线重跑 L4。
