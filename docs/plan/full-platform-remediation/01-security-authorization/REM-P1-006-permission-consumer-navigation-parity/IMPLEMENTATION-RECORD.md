# REM-P1-006 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`。
- 规划基线：`lint-fix@842dc84f`。
- 来源缺陷：`BUG-FQA-010`、`BUG-FQA-013`、`BUG-FQA-035`、`BUG-FQA-069`、`BUG-FQA-070`、`BUG-FQA-074`；用例：`RBAC-006`、`RBAC-013`、`RBAC-015`、`FILE-016`、`AI-004`、`AUDIT-003`、`BACKUP-003`、`IPAM-008`。
- 根因聚类：权限 action/alias 没有统一运行时解析；导航父组按单一资源门控，页面初始化未按权限启用查询。
- GitNexus：索引已刷新至当前规划基线并完成领域 query；尚未编辑业务符号，因此未伪造逐符号 impact 结果。
- 代码、数据、容器：未修改、未启动、未创建测试对象。
- 下一步：认领独立分支后读取本事件全部文档，对候选符号逐项执行 upstream impact，再从 `AC-001` 开始。

## 追加规则

后续只追加状态变化、实际文件/符号、impact、提交/diff、测试命令、证据、清理、回滚和剩余风险；不得覆盖历史记录。

## 2026-07-15：认领与产品决策

- 分支：`codex/rem-p1-006-permission-consumer-navigation-parity`，基线：`lint-fix@30f7a388`。
- 用户已明确决定“补齐权限”：保留并实现 `group:delete`、`shared_file:update` 等已登记权限的真实 consumer，不采用下架或禁止分配策略。
- runId 与具体触及符号待只读根因核对和逐项 GitNexus upstream impact 后登记；尚未修改业务代码、未创建测试对象。

## 2026-07-15：根因确认与首轮实现

- GitNexus upstream impact：`GroupController`、`SharedFileController`、`CiInstanceController`、`CiModelController`、`OpsCalendarTaskController` 均为 LOW（0 direct caller / 0 process）；`Sidebar` 仅由 `DashboardLayout` 直接消费，LOW。`usePermission` 为 CRITICAL（60 direct consumer、42 process），因此别名改动严格限定为已批准的 `cmdb_model:write -> update` 单一兼容关系。
- `group:delete` 已由已关闭的组生命周期安全消费为归档：后端 `POST /groups/{id}/archive` 与用户组页面归档按钮均使用该 action；不恢复危险的直接物理删除。
- 补齐 `shared_file:update` 的受资源父级权限约束的文件重命名 API/UI，写入 before/after 审计；补齐 `cmdb_instance:export` 的受权限保护 CSV 导出 API/UI。
- `ops_calendar:read_group/read_all` 现在可进入既有可见性服务决定范围；`cmdb_model:write` 在后端 evaluator 与前端 permission hook 中对 `update` 生效，反向不会授予 write；导航父组按可见子项显示，AI/审计子项按自身 read permission 显示。
- 低权限页面按权限启用 CMDB 模型元数据、Wiki/共享文件用户组查询，避免无权 403 噪音。
- L1：`mvn -q -DskipTests compile`、`JAVA_TOOL_OPTIONS=-Dnet.bytebuddy.experimental=true mvn -q -Dtest=CustomPermissionEvaluatorTest,SharedFileControllerTest test` 通过；本机 Java 26 需该 Byte Buddy 兼容开关。前端 `npm run lint` 为 0 error/41 条历史 warning，`npx tsc --noEmit` 通过。
- L3：从当前分支重建 backend/frontend，二者均健康。管理员真实会话的 `GET /cmdb/instances/export` 为 200；以 runId 文件夹/文件验证 `shared_file:update` 重命名为 200，文件和文件夹均通过产品 API 清理为 0。初次根目录上传被既有资源范围策略 403 拒绝，未产生对象；改用显式可访问 owner group 后通过。
- 后续：创建最小角色/账号矩阵，完成 write/update、read_group/read_all、export/update deny、系统/资源导航和低权限零 403 复验；完成前不得提交或合并。

## 2026-07-15：L2-L3 运行时复验完成

- 首页 `DashboardPage` 与 `DashboardOpsCalendarCard` 的 upstream impact 均为 LOW：前者无 direct caller，后者仅被首页直接消费；新增查询门控严格匹配后端 guard。`usePermission` 的 alias 影响仍为 CRITICAL，保持仅有 `cmdb_model:write -> update` 的已批准兼容关系。
- `REM_P1_006_20260715012447` 使用产品 API 创建最小角色和账号，完成首次登录 setup 后通过 Playwright 从 Nginx 标准入口进行真实点击。最小 CMDB/Wiki/共享文件账号首页未产生 API 403；IP 地址池、审计日志、AI 配置、备份与恢复、系统配置均可通过可见侧栏入口到达；无 `cmdb_instance:export` 的账号收到 403。
- 测试夹具首次使用管理员的空主组，未产生有效组级角色分配，已立即清理；后续选择现有活动业务组后通过。所有成功 run 的 4 用户、4 角色均通过产品 API 逆序删除，清理失败数为 0。未使用 SQL、Redis、对象存储或全量会话清理。
- 运行时发现 `3001` 是仅前端容器端口，`/api/*` 不代理；标准 Nginx 入口 `localhost` 正确代理并用于最终浏览器证据。该拓扑差异不涉及代码或产品授权合同。
- 结论：L1-L3 PASS，事件状态为 `VERIFIED`，下一门禁为最终 L4。回滚方式为对事件提交执行普通 revert；不涉及 schema 或数据迁移。
