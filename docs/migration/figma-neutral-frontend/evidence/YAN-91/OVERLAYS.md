# Leftover overlays remint

- `frontend/src/components/wiki/WikiImage.tsx`: lightbox 去掉 `bg-black/80` / lucide 关闭钮，改走 `cwgsyw-overlay-scrim` + Neutral `IconButton`。
- `frontend/src/features/cmdb-spatial/editor/SpatialEditor.tsx`: 发布框去掉手写 `bg-black/40` dialog，改走 `NeutralDialog` + `Field` + Neutral 页脚按钮。
- `frontend/src/components/cmdb/RackAssignmentCard.tsx`: 机柜“删除”从原生 danger text button 改走 Neutral `Button size="sm" variant="destructive"`。

测试：`frontend/test/figma-neutral-m8-leftover-overlays.test.cjs`、`frontend/test/figma-neutral-m8-leftover-native-btns.test.cjs`、`frontend/test/figma-neutral-m8-leftover-spatial-chrome.test.cjs`。

整包：`cd /Users/byron/AI/worktrees/YAN-71/frontend && node --test test/figma-neutral-*.test.cjs` → 235/235 PASS。
