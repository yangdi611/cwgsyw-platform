# REM-P2-008 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-046`；用例：`WIKI-012`。
- 根因：Markdown/Wiki link 扩展返回的提示标记被当成文本节点而非受控组件。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：认领、实现与 L1-L3 验证

- 状态：`VERIFIED`；分支：`codex/rem-p2-008-wiki-unknown-link-rendering`；基线：`lint-fix@6706c1f`。
- GitNexus：`preprocessWikiLinks`、`WikiPageReader`、`createWikiMarkdownComponents` 与 `WikiMarkdown` upstream 均为 LOW。共享 Markdown 组件的两个直接消费者为阅读和编辑预览，因此实现仅识别阅读页生成的保留 href，普通链接与编辑预览不变。
- 根因与实现：未知链接曾生成 raw `<sup>` HTML，ReactMarkdown 未启用 raw HTML，因而标签作为普通文本显示。现在未知链接生成 `#wiki-pending-link` 保留 href；Markdown `a` 组件将其替换为含 `role=status`、文本和 title 的受控提示，不渲染可点击锚点或原始内部标签。
- 验证：frontend lint/typecheck/production build 通过（lint 为 39 条既有 warning，0 error）。当前分支容器重建后，真实浏览器验证未知链接状态、已知/别名路由、无 raw `sup` 和零 Console error。测试空间与页面均通过产品 API 删除并只读确认 404。
- 回滚：回退本事件提交即可恢复旧字符串预处理；无 schema、对象存储或持久化合同变更。
