# Impact

GitNexus MCP 本次不可用，未跑 `impact()` / `detect_changes()`。

本轮只改视觉 token / class / 侧栏 chrome / wiki 编辑器 CSS，不改 API、queryKey、RBAC、路由语义。

高触达文件：

- `frontend/src/app/globals.css`
- `frontend/src/components/layout/Sidebar.tsx` 及 sidebar 子组件
- `frontend/src/features/cmdb-spatial/editor/SpatialEditor.tsx`
- CMDB / wiki / authorization leftover chrome

风险：侧栏从暗色改为 Neutral 浅色 surface，是设计源要求，不是功能回归。视觉审计 WAIVED。
