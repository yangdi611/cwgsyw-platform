# REM-P2-004 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`。
- 规划基线：`lint-fix@842dc84f`。
- 来源缺陷：`BUG-FQA-027`；用例：`HOME-008`。
- 根因聚类：providers.tsx 未提供应用级主题状态，页头/个人菜单也没有切换控件。
- GitNexus：索引已刷新至当前规划基线并完成领域 query；尚未编辑业务符号，因此未伪造逐符号 impact 结果。
- 代码、数据、容器：未修改、未启动、未创建测试对象。
- 下一步：认领独立分支后读取本事件全部文档，对候选符号逐项执行 upstream impact，再从 `AC-001` 开始。

## 追加规则

后续只追加状态变化、实际文件/符号、impact、提交/diff、测试命令、证据、清理、回滚和剩余风险；不得覆盖历史记录。

## 2026-07-16：事件认领与影响分析

- 状态：`IN_PROGRESS`；分支：`codex/rem-p2-004-user-theme-preference`；基线：`lint-fix@08cfc33e`。
- GitNexus query/context：既有 Wiki/Mermaid 已消费 `next-themes`，但顶层未提供 ThemeProvider，Header 也无切换入口。
- upstream impact：`Providers`、`RootLayout`、`WikiPageReader`、`WikiMermaid` 均为 LOW；`Header` 为 LOW（直接调用者为 DashboardLayout，覆盖其八条路径）。未发现 HIGH/CRITICAL。

## 2026-07-16：实现与 L1-L3 复验完成

- 状态：`VERIFIED`；事件分支：`codex/rem-p2-004-user-theme-preference`。
- 实现：顶层接入既有 `next-themes` 的 `ThemeProvider`（class、system 默认、禁用过渡）；RootLayout 抑制主题 hydration 属性差异；Header 用户菜单提供浅色、深色、跟随系统三个可发现选项。主题项置于独立 DropdownMenuGroup，符合 Base UI 菜单结构约束。
- 样式：补齐 V2 设计 token 的 `.dark` 覆盖，使未逐页改造的页面共享主题变量。
- L1：定向 lint、typecheck 和前端生产容器构建通过。
- L2/L3：当前源码构建的 frontend 容器中，真实登录后完成深色刷新持久化、浅色、跟随系统切换；`/reports`、`/wiki/8/87`、`/workflow/design` 均继承深色主题，Console error 为零。
- 数据与清理：本事件只写入浏览器本地主题偏好，未通过产品 API 创建测试对象，因此没有数据库、对象存储、Redis 或审计残留。
- 变更检测：GitNexus `detect-changes --scope all` 仅发现 RootLayout、Providers、Header 及两条预期 Header 流程，总风险 MEDIUM；无 HIGH/CRITICAL。
- 回滚：移除 ThemeProvider 包裹、Header 的主题 DropdownMenuGroup 与本次 `.dark` token 即可恢复原行为。遗留：等待所有事件完成后的 L4 全平台复验。
