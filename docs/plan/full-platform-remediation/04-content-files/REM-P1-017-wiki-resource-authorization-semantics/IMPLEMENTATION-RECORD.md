# REM-P1-017 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-045`、`BUG-FQA-058`、`BUG-FQA-067`、`BUG-FQA-089`；用例：`WIKI-002`、`WIKI-006`、`WIKI-022`、`WIKI-023`、`P-045`、`P-046`、`P-047`。
- 根因：Wiki resource adapter、统一 ResourceAccessService、ownerGroup 默认值与页面级 action 映射没有共享同一主体分类和存在性顺序。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。
