# REM-P1-015 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`。
- 规划基线：`lint-fix@842dc84f`。
- 来源缺陷：`BUG-FQA-023`、`BUG-FQA-024`、`BUG-FQA-040`、`BUG-FQA-054`；用例：`AUDIT-001`、`AUDIT-READ-FILTER`、`NOTICE-001`。
- 根因聚类：MyBatisPlusConfig 未注册分页拦截器；Controller/Mapper/UI 未形成一致的筛选参数链。
- GitNexus：索引已刷新至当前规划基线并完成领域 query；尚未编辑业务符号，因此未伪造逐符号 impact 结果。
- 代码、数据、容器：未修改、未启动、未创建测试对象。
- 下一步：认领独立分支后读取本事件全部文档，对候选符号逐项执行 upstream impact，再从 `AC-001` 开始。

## 追加规则

后续只追加状态变化、实际文件/符号、impact、提交/diff、测试命令、证据、清理、回滚和剩余风险；不得覆盖历史记录。

## 2026-07-16：实施与 L1-L3 通过

- 分支：`codex/rem-p1-015-query-pagination-audit-filters`，基线为 `lint-fix@842dc84f`。
- GitNexus upstream impact：`MyBatisPlusConfig`、`AuditLogMapper.queryPage`（3 个直接消费者）、`AuditLogController.list`、`NotificationService.listByUser`、`AuditLogPageInner` 全部为 `LOW`，没有 HIGH/CRITICAL 授权边界。
- 代码：补入 MyBatis-Plus PostgreSQL 分页 interceptor；审计 Controller/Mapper/UI 贯通 action、operatorId、keyword；CMDB 调用点同步新 Mapper 签名。复审发现实例历史旧路径会先分页再内存过滤，已改为 `queryInstanceHistoryPage` 在数据库按实例过滤和分页，避免空页或错误 total。
- L1：后端 Maven compile、前端 typecheck 与审计页 ESLint 通过；Docker production backend/frontend build 通过。
- L2：真实管理员会话只读验证审计 page 1/2 `size=2` 无重叠且 `total=8808`，通知 `total=32`，CMDB models `size=1,total=18`；action/operatorId/keyword/组合筛选均匹配，零结果为 `records=0,total=0`。
- L3：当前分支 backend/frontend 容器已重建，backend health 通过；复审修正后再次构建 backend 并完成只读 API 分页复验。Playwright 完成页面登录、审计筛选控件、关键词请求参数、零结果状态与零 Console error 验证。Nginx 上游在容器重建后短暂 503，隔离浏览器直接使用当前前端和后端端口做同源请求转发完成页面复验。
- 测试数据与清理：只读 API/UI 复验，未创建 runId 对象，无残留或清理动作。
- 回滚：移除分页 interceptor、Mapper/Controller 参数和前端筛选控件即可回到基线；本事件未涉及迁移或外部状态变更。
- 结论：事件级 L1-L3 均 PASS，状态提升为 `VERIFIED`，等待最终 L4 全平台复验。
