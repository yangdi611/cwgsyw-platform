# Figma Neutral 前端迁移状态

## 1. 当前指针

```yaml
tracker: YAN-91
branch: feat/YAN-71-figma-neutral-m7-workflow-design
worktree: /Users/byron/AI/worktrees/YAN-71
status: M8_LOCAL_COMMIT_AUTHORIZED
currentPhase: M8
currentPointer: WAITING_USER_AUTH_FOR_PUSH_PR
visualAudit: WAIVED
lastUpdatedAt: 2026-08-14
baselineSha: cd983965e
ready: READY WITH APPROVED EXCEPTION
handoff: docs/migration/figma-neutral-frontend/HANDOFF.md
```

## 2. 本轮状态

| 交付项 | 状态 | 证据 |
|---|---|---|
| 删除 `@/components/design-system` | PASS | 目录已不存在 |
| 删除 `@/components/v2` | PASS | 目录已不存在 |
| 删除无消费者的 `@/components/ui` | PASS | 目录已不存在 |
| shared 只留 PermissionGuard | PASS | `shared/index.ts` |
| leftover `*-v2-*` / `--v2-*` | PASS | `frontend/test/figma-neutral-m8-leftover-tokens.test.cjs` |
| leftover 蓝/紫/青绿 accent hex | PASS | `frontend/test/figma-neutral-m8-leftover-accents.test.cjs` |
| leftover shadcn / gray 工具色 | PASS | `frontend/test/figma-neutral-m8-leftover-shadcn.test.cjs` |
| leftover 画布裸 hex / 坏 token 属性 | PASS | `frontend/test/figma-neutral-m8-leftover-canvas-hex.test.cjs` |
| leftover globals / sonner 主题 | PASS | `frontend/test/figma-neutral-m8-leftover-globals-theme.test.cjs` |
| leftover sonner 运行时 | PASS | `frontend/test/figma-neutral-m8-leftover-sonner.test.cjs` |
| leftover spatial native select/checkbox/palette | PASS | `frontend/test/figma-neutral-m8-leftover-spatial-chrome.test.cjs` |
| leftover wiki mermaid chrome | PASS | `frontend/test/figma-neutral-m8-leftover-wiki-mermaid.test.cjs` |
| leftover wiki editor chrome | PASS | `frontend/test/figma-neutral-m8-leftover-wiki-editor.test.cjs` |
| leftover resource access selects | PASS | `frontend/test/figma-neutral-m8-leftover-access-selects.test.cjs` |
| leftover resource access delete | PASS | `frontend/test/figma-neutral-m8-leftover-access-selects.test.cjs` 锁 IconButton trash；queryKey 未改 |
| leftover CMDB hover cards | PASS | `frontend/test/figma-neutral-m8-leftover-hover-cards.test.cjs` |
| leftover user/group selects | PASS | `frontend/test/figma-neutral-m8-leftover-user-group-selects.test.cjs` |
| leftover analytics selects | PASS | `frontend/test/figma-neutral-m8-leftover-analytics-selects.test.cjs` |
| leftover sidebar collapse | PASS | `frontend/test/figma-neutral-m8-leftover-sidebar-collapse.test.cjs` |
| leftover wiki status dots | PASS | `frontend/test/figma-neutral-m8-leftover-wiki-status-dots.test.cjs` |
| leftover wiki tree buttons | PASS | `frontend/test/figma-neutral-m8-leftover-wiki-tree.test.cjs` |
| leftover ops calendar buttons | PASS | `frontend/test/figma-neutral-m8-leftover-ops-calendar.test.cjs` |
| leftover native action buttons | PASS | `frontend/test/figma-neutral-m8-leftover-native-btns.test.cjs` |
| leftover overlays / lightbox | PASS | `frontend/test/figma-neutral-m8-leftover-overlays.test.cjs` |
| leftover stripped utilities / popover | PASS | `frontend/test/figma-neutral-m8-leftover-stripped-utils.test.cjs` |
| leftover app chrome buttons | PASS | `frontend/test/figma-neutral-m8-leftover-app-chrome.test.cjs` |
| leftover list buttons | PASS | `frontend/test/figma-neutral-m8-leftover-list-buttons.test.cjs` |
| leftover files tree buttons | PASS | `frontend/test/figma-neutral-m8-leftover-files-tree.test.cjs` |
| leftover field library / form canvas | PASS | `frontend/test/figma-neutral-m8-leftover-field-library.test.cjs` |
| leftover designer / picker buttons | PASS | `frontend/test/figma-neutral-m8-leftover-designer-pickers.test.cjs` |
| leftover CMDB search dropdowns | PASS | `frontend/test/figma-neutral-m8-leftover-search-dropdowns.test.cjs` |
| leftover Neutral chevron icons | PASS | `frontend/test/figma-neutral-m8-leftover-lucide-chevrons.test.cjs` |
| leftover analytics mapped icons | PASS | `frontend/test/figma-neutral-m8-leftover-analytics-icons.test.cjs` |
| leftover wiki/spatial mapped lucide | PASS | `frontend/test/figma-neutral-m8-leftover-mapped-lucide.test.cjs` |
| leftover header search icon | PASS | `frontend/test/figma-neutral-m8-leftover-app-chrome.test.cjs` |
| leftover chrome / dashboard tiles | PASS | `frontend/test/figma-neutral-m8-leftover-chrome-buttons.test.cjs` |
| leftover consumer native `<button>` | PASS | `frontend/src` 除 Neutral primitives 外已无 `<button` |
| leftover M8 scan lock | PASS | `frontend/test/figma-neutral-m8-leftover-scan.test.cjs` 含原生 dialog |
| leftover notification bell | PASS | `frontend/test/figma-neutral-m8-leftover-notification.test.cjs` |
| 81 page coverage lock | PASS | `frontend/test/figma-neutral-m8-page-coverage.test.cjs` |
| 78 page m7 test coverage lock | PASS | `frontend/test/figma-neutral-m8-page-test-coverage.test.cjs` |
| five page pattern route consumers | PASS | `frontend/test/figma-neutral-m8-page-pattern-consumers.test.cjs` |
| leftover native confirm/alert dialogs | PASS | `frontend/test/figma-neutral-m8-leftover-native-dialogs.test.cjs` |
| 81 页面入口 | PASS | 78 Neutral + 3 EXCLUDED redirect |
| 页面矩阵覆盖 | PASS | 81 入口均已入 `PAGE-MIGRATION-MATRIX.md`（VERIFYING / EXCLUDED） |
| 视觉审计 | WAIVED | 用户 2026-08-14 授权后续都不做 |
| Neutral Checkbox/Badge API | PASS | `frontend/test/figma-neutral-m8-neutral-api.test.cjs` |
| Date Range Picker | PASS | `frontend/test/figma-neutral-m5-overlay.test.cjs` |
| 正式子资产导出 | PASS | `frontend/test/figma-neutral-m8-formal-exports.test.cjs` 锁 61 个正式根 |
| 空间房间 4 页 fixture | PASS | `frontend/test/figma-neutral-m7-cmdb-spatial-rooms.test.cjs` |
| 完成度审计 | PARTIAL | `evidence/YAN-91/COMPLETION-AUDIT.md` |
| 下一张 Linear | PASS | [YAN-91](https://linear.app/yangdi/issue/YAN-91/授权提交-figma-neutral-本地实现) |
| Commit | AUTHORIZED | 用户 2026-08-14 授权在 YAN-71 本地提交 |
| Push / PR / 部署 | NOT AUTHORIZED | |

## 3. 已完成切片

Token pipeline、Neutral 组件、Page Pattern、81 个入口、旧视觉入口删除、leftover v2 class / CSS 变量清理，以及空间 / 拓扑 / BPMN 画布 token 接线都已在 YAN-71 本地完成。

本提交收入本地实现。`globals.css` 已去掉 `--v2-*` 和 `--color-v2-*`。侧栏不再用深蓝 / 蓝色高亮，改走 Neutral surface。空间编辑器 / 查看器 / spike 不再写裸 hex，Konva 色走 `canvas-tokens.ts`。`globals.css` 的 shadcn 兼容色和暗色侧栏蓝紫主色已改接到 Neutral；sonner 运行时已换成 Neutral Toast 队列。spatial editor 的 select/checkbox/关闭按钮已改走 Neutral Select / Checkbox / IconButton。Wiki mermaid 工具栏/错误/加载已改走 Neutral，图表现在用 canvas-tokens 上色。Wiki markdown 编辑器主题已从 globals 挪到 WikiEditor.css，并用 Neutral token 替换魔法数字。spatial 组件库瓦片已改走 Neutral Button。资源授权、用户授权、组对话框和任务 analytics/metrics 的原生 select 已改走 Neutral Select。Wiki 树侧栏操作按钮已改走 Neutral Button / IconButton。运维日历格子、事项和设置菜单已改走 Neutral Button / MenuItem。顶栏用户菜单和侧栏分组展开已改走 Neutral Button / MenuItem。任务/工作重试、批量编辑页脚和工作分类 Tabs 已改走 Neutral 组件。文件树展开/选择已改走 Neutral Button / IconButton。应用侧栏收起/展开改走 Neutral IconButton。Wiki 树状态点改回 Neutral status token。任务/工作项重试、批量编辑页脚、端点删除、CI 移除和机柜移出改走 Neutral Button。Wiki 灯箱改走 Neutral overlay scrim + IconButton。空间发布框改走 NeutralDialog。字段组件库、表单画布、版本行、计划步骤、CI picker、用户组 Tabs、模板选择卡、折叠行、密码显隐、dashboard tile 和 analytics widget 已改走 Neutral Button / Card / IconButton。消费层除 Neutral primitives 外已无原生 button。拓扑 / 机柜 hover 卡改走 `cwgsyw-popover cwgsyw-popover--hover`，没有用 inverse `cwgsyw-tooltip`。资源授权删除钮改走 `IconButton icon="trash"`，并补上缺失的 Select import；ACL API / queryKey 未改。GitNexus：NodeTooltip / RackElevationView LOW；ResourceAccessDialog HIGH（FilesPage / WikiPageReader / WikiSpacesPage）。整包 `node --test test/figma-neutral-*.test.cjs` 为 252/252 PASS。

## 4. 下一动作

1. 本地 commit 完成后等人授权 push / draft PR。
2. 未再授权不要部署，也不要把 Linear 标 Done。
3. 视觉审计保持 WAIVED，不要回头做截图评分。
