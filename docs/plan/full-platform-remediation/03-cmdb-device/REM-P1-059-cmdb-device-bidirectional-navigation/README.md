# REM-P1-059：CMDB 与设备双向导航

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-059` |
| 优先级 | P1 |
| 领域 | CMDB / Device / Cross-module navigation |
| 状态 | `VERIFIED` |
| 风险 | MEDIUM |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `XL-CMDB-003` |
| 分支 | `codex/rem-p1-059-cmdb-device-bidirectional-navigation` |
| 基线 | `lint-fix@738e2686` |
| 失败快照 | `b81a4c9d` |

CI 与设备的 API 关联及删除保护正确，但 CI 详情组件按错误字段读取设备，无法生成设备详情链接；设备详情同时将 CMDB model code 硬编码为 `host`。本事件统一双向导航字段合同。

L1-L3 已完成：frontend typecheck、lint（0 errors，39 个既有 warnings）、Java 21 定向聚类 21/23 通过（2 个既有 `IllegalArgumentException`/`BusinessException` 断言差异）、当前容器 API/UI Playwright 1/1 通过，manifest `objects=[]`、`cleanupFailures=0`。证据目录：`/tmp/rem-p1-059-l3-r2`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
