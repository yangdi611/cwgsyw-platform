# REM-P2-009 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-071`；用例：`WIKI-013`。
- 根因：首页信息架构和搜索页 URL 状态策略未形成产品合同。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：认领、根因修复与 L1-L3 验证

- 状态：`VERIFIED`；分支：`codex/rem-p2-009-wiki-search-discovery-history`；基线：`lint-fix@84403626`。
- 前端实现：首页增加始终可见的“搜索知识库”入口；搜索页将关键词和大于 1 的页码写入 URL，使用 `router.push` 保留历史；外部 URL 变化回填输入、debounce 与页码，输入获得 autofocus。
- 运行时根因补充：强制授权模式原本先以 20 条截断数据库搜索结果、再逐项过滤不可读资源，并把 total 置为当前页可见数，导致可读的第二页不可能出现。`WikiPageService.search` 现先完成授权过滤，再对可见结果分页并计算 total；非强制模式的数据库分页合同不变。新增单元测试锁定该顺序。
- GitNexus：前端符号均 LOW；`WikiPageService.search` LOW（Wiki API、全局搜索直接调用）和 `WikiPageMapper.search` LOW（服务直接调用）。`detect_changes --scope all` 仅报告本事件 4 文件、12 个符号、2 条既有 Wiki 前端流程，MEDIUM；相对 `master` 的 CRITICAL/1242 文件是长期分支历史差异，非本事件范围。
- 验证：frontend lint 0 error（39 条既有 warning）、typecheck/build 通过；backend package 与当前事件容器构建通过。定向 Maven 测试被三个既有无关 testCompile 错误阻断，未将其归因给本事件。真实表单登录、首页点击、debounce、分页、back/forward、空态和 Console=0 均 PASS。
- 数据安全：最终验证为只读。分页夹具的两个 runId 草稿空间和 42 页已通过 Wiki 产品 API 删除；只读检查 active runId space/page=0。未发布任何临时页，未产生通知或对象存储写入。
- 回滚：回退本事件提交即可恢复旧首页及 URL 状态；后端授权搜索分页逻辑也随提交回退。无迁移、无全局授权、无外部系统变更。
