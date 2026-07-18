# REM-P0-006 验证矩阵

| AC | 层级 | 验证 | 状态 |
|---|---|---|---|
| AC-001 | L1/L2 | group-scope fixture 调用四个读取端点 | PASS（HTTP/body `403`） |
| AC-002 | L2 | 拒绝前后只读 cutover 对照 | PASS |
| AC-003 | L2 | superadmin 读取 preflight/cutover | PASS |
| AC-004 | L1/L3 | Maven、当前分支 backend rebuild、health、真实 API/UI | PASS（Playwright `1/1`） |

合并后必须从最新 `lint-fix` 全量重置 `275+78` L4；旧 run PASS 不迁移。
