# 实施记录

## 2026-07-21：发现与实现

- L4 可逆 CMDB/change/export 主链已通过 API、DOCX/PDF、CSV 模板子项，进入真实 CI 资源页后无法找到 `/change-docs/{id}`，首次失败 `/tmp/fqa-2050-cmdb-change-export-remaining-r4`。
- 源码/API 对照确认组件字段 `docId/reportId/date/authorName` 与后端 `id/reportDate/reporterName` 不一致，日报 href 也不存在。
- 失败快照提交 `e57f8407`；从 `lint-fix@7bbd9915` 创建独立事件分支。
- GitNexus upstream impact LOW：1 个调用者、单一模块、3 条详情页流程。
- 前端类型与渲染全部对齐后端 DTO，日报路由改为 `/daily/{id}`。

## 2026-07-21：L1-L3

- typecheck、目标 lint 0 error、生产 frontend 构建和容器替换通过。
- 专用 Playwright route-mock 真实详情页组件；首次补齐完整实例 DTO，第二次定位并 mock 虚拟实例的 reverse-defs 只读请求，最终 `1/1` 在 1.2 秒通过。
- 产品写入 0，无 manifest 对象，无清理动作，Console/pageerror/5xx 为空。
- 事件实现与 L1-L3 证据提交：`4349419d57aa2d44df13c73f95bb5fccede90edb`。
