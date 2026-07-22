# REM-P1-076：CMDB canonical 权限消费一致性

- 状态：`CLOSED`
- 源 L4：`FQA_20260718_2050_remp1038` / `RBAC-013`
- 缺陷：`L4-RBAC-013-001`
- 分支：`codex/rem-p1-076-cmdb-canonical-permission-consumers`
- 基线：`lint-fix@920274e904f9d70b5b0938bb548b5d03606e8157`
- 事件 runId：`REM_P1_076_20260722`
- 下一门禁：提交事件并以 `--no-ff` 合入 `lint-fix`，随后在同一 L4 run 重验受影响 RBAC-013 行。

## 结论

L4 真实差分证明 `cmdb_import:read`、`cmdb_import:execute`、`cmdb_impact:read`、`cmdb_topology:read` 可分配但不控制其对应端点；旧 `cmdb_instance:*` 权限反而可替代放行。事件只修复这四个 canonical consumer，不扩大数据作用域、API payload 或业务语义。

L1-L3 已通过：Java 21 定向 `3/3`、CMDB 聚类 `55/55`、frontend typecheck、变更文件 lint `0 error`、backend package 与 backend/frontend production build 均通过。当前分支运行时 Playwright `1/1` 验证 canonical allow、legacy 403、CSV/JSON/import read chain、impact、topology/compare 和 UI 显隐；Console/pageerror/5xx 为 `0/0/0`，manifest `objects=[]`、`cleanupFailures=0`。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
