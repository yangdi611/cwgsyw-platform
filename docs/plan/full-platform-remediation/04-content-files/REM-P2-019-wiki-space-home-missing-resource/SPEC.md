# REM-P2-019 实施合同

## 目标

关闭不存在 Wiki 空间首页的残余 tree 404 Console error。

## 不变量与方案

- 保持后端 404、Wiki ACL、路由和 query key 不变；不改写数据。
- `WikiSpaceHomePage` 已从 `wiki-spaces` 得到 `space` 后，才启用 `wiki-tree` query。
- 无效 space 显示既有 `EmptyState`，不再请求 tree；有效 space 仍读取目录。

## 影响

`WikiSpaceHomePage` upstream impact：0 直接调用、0 流程、LOW。只修改该前端页面。

## 验收

| AC | 条件 |
|---|---|
| AC-001 | `/wiki/999999` 友好空态、Console/4xx response 均为零。 |
| AC-002 | `/wiki/8` 保持最近更新或空列表，且无不存在态。 |
| AC-003 | lint/typecheck、当前分支 frontend 容器及 GitNexus detect 通过。 |
