# REM-P1-027 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-048`、`BUG-FQA-083`、`BUG-FQA-098`；用例：`CHANGE-014`、`CHANGE-015`、`CHANGE-016`、`CHANGE-018`。
- 根因：Template Controller/Service/UI 能力集不完整，模板引用策略和字段配置合同没有统一。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：L1-L3 完成

- GitNexus impact：模板服务、控制器、字段保存、字段支持和前端消费者均为 LOW；`FieldList` 的新建/详情两个直接消费者已同步适配。
- 新增 clone/delete API：复制深拷贝字段与 Word 对象，副本默认禁用；删除严格 restrict，任一未删除变更文档引用即返回 400，未引用模板才删除字段、模板和对象，并记录 create/clone/delete 审计。
- 新增 `number`/`enum`、枚举选项/default、排序配置和表单渲染；服务端校验非法类型、枚举与数字。
- Java 21 定向测试通过；runId `REM_P1_027_20260715215217` 的源模板、副本、文档、引用保护和产品 API 清理均通过且无残留。前端 typecheck 通过，lint 0 error/41 个既有 warning。
