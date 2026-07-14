# REM-P1-024 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-081`、`BUG-FQA-099`；用例：`FLOW-006`、`FLOW-012`。
- 根因：definitionId、process key、deployment 与 runtime/history 的生命周期边界未在 Service 统一，Flowable 异常直接外泄。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。
