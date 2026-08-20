# Leftover stripped utilities remint

- `frontend/src/components/cmdb/CiTopologyGraph.tsx`: NodeTooltip 去掉 `bg-popover text-popover-foreground`，改走 Neutral surface / text / border token。
- `frontend/src/components/task-analytics/TaskAnalyticsDashboard.tsx`: 空 `border` / `border-b` / `divide-y` / `hover:` 接到 Neutral border 和 hover token。
- `frontend/src/components/task-analytics/TaskMetricsManager.tsx`: 同样接到 Neutral border / divide token。
- `frontend/src/components/authorization/PermissionDiffDetails.tsx`: 空 `border` / `divide-y` 接到 Neutral token。

测试：`frontend/test/figma-neutral-m8-leftover-stripped-utils.test.cjs`，并扩大 `figma-neutral-m8-leftover-shadcn.test.cjs` 覆盖 `bg-popover`。

整包：`cd /Users/byron/AI/worktrees/YAN-71/frontend && node --test test/figma-neutral-*.test.cjs` → 237/237 PASS。
