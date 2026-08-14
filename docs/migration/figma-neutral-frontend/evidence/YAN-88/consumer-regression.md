# Consumer regression

- 旧 visual 入口：`@/components/design-system` / `v2` / `ui` 目录已删除。
- leftover `text-v2-*` / `bg-v2-*` / `border-v2-*` / `--v2-*` 已从 `frontend/src` 清零。
- 侧栏 chrome 从深蓝 + 蓝色选中态改到 Neutral surface / text / status-danger badge。
- `globals.css` 已删除 `@theme` 和 `:root` / `.dark` 里的 v2 token，wiki editor / mermaid / table header 改走 `--cwgsyw-*`。
- 隔离测试：`frontend/test/figma-neutral-m8-old-entry-removed.test.cjs`
- 隔离测试：`frontend/test/figma-neutral-m8-leftover-consumers.test.cjs`
- 隔离测试：`frontend/test/figma-neutral-m8-leftover-tokens.test.cjs`

- leftover 蓝/紫/青绿 hex 已从空间图、拓扑、日历色板、BPMN 当前节点覆盖层清掉。
- 隔离测试：`frontend/test/figma-neutral-m8-leftover-accents.test.cjs`
- 81 页审计：`page-audit.md`

- leftover `bg-muted` / `text-gray-*` / `bg-accent` 已改成 Neutral token。
- 根 layout 引入 Neutral CSS；`body` 使用 `--cwgsyw-bg-canvas`。
- 隔离测试：`frontend/test/figma-neutral-m8-leftover-shadcn.test.cjs`
