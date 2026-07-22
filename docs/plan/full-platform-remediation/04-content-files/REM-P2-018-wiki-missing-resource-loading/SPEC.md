# REM-P2-018 实施合同

## 目标与不变量

使 `WIKI-022` 的不存在 Wiki 页面以稳定、可解释的页面状态结束，而非永久加载。

- 不放宽资源发现、权限、scope 或 ACL。
- 后端仍可对不存在资源返回其现有 404；前端不得把它当作 pending。
- 不新增写操作、迁移、审计或测试业务对象。

## 根因与方案

`WikiPageReader` 只根据 `isLoading` 渲染加载态。`wikiApi.getPage(pid)` 请求失败后，TanStack Query 的 `isLoading=false`、`page=undefined`，但页面未显式处理 query error，最终表现为不稳定加载态和未处理 404 Console error。

最小修复：读取 `isError`，在首次加载结束且请求失败或无 page 时统一渲染“页面不存在或已删除”。不修改 API 客户端、后端或权限判定。

## 影响分析

- `WikiPageReader` upstream impact：0 直接调用者、0 受影响流程、0 模块，`LOW`。
- 仅触及 `frontend/src/app/(dashboard)/wiki/[spaceId]/[pageId]/page.tsx`。

## 验收

| AC | 条件 |
|---|---|
| AC-001 | `/wiki/999999/999999` 显示友好不存在状态，不再显示永久加载。 |
| AC-002 | 合法 Wiki 页面仍正常加载、导出与既有操作可用。 |
| AC-003 | 不存在页零未解释 Console error / 失败请求；不泄露资源内容。 |
| AC-004 | lint/typecheck、当前分支 frontend 容器运行时复验、GitNexus `detect_changes` 通过。 |

## 回滚与停止

回滚本事件单一前端提交即可恢复旧行为。若合法页面回归、错误态暴露资源数据或出现权限语义变化，停止并标记 `FAIL`。
