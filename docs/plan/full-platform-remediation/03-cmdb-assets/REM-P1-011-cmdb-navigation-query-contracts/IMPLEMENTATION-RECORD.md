# REM-P1-011 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-039`、`BUG-FQA-087`、`BUG-FQA-095`；用例：`CMDB-019`、`CMDB-022`、`CMDB-023`、`CMDB-037`、`XL-CMDB-009`。
- 根因：前端路由参数、permission action 与模型目录数据源没有统一契约。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-16：认领、影响分析与首次 L3

- 认领分支：`codex/rem-p1-011-cmdb-navigation-query-contracts`，基线 `lint-fix@ff1d3ce`；状态推进为 `VERIFYING`。
- GitNexus 在实施前刷新索引。upstream impact：`InstanceBasicInfoTab` 1 个直接消费者/1 个流程，`CsvImportDialog` 1 个直接消费者/1 个流程，`TwoDViewPage`、`InstanceListPage`、`CmdbOverviewPage` 均无上游消费者，`ModelCard` 1 个直接消费者；全部 `LOW`，无 HIGH/CRITICAL 授权风险。
- 实施：详情编辑门控由不存在的 `cmdb_instance:manage` 对齐为后端 `cmdb_instance:update`；新增安全单次 `decodeURIComponent` 的 modelCode 规范化 helper，所有模型列表请求、缓存键和导入参数使用 canonical 值；2D 卡片使用现行 `/cmdb/instances/by-model/{model}/{id}` 路由。
- 静态：`npm run typecheck` 与四个触及文件的 ESLint 均 PASS。当前分支执行 `docker compose -f docker-compose.dev.yml build frontend` 并仅替换 `frontend` 容器，生产构建 PASS；未触碰数据库卷、Redis、MinIO 或全体会话。
- 运行时：真实 superadmin 会话下，编码中文路由产生 `/api/cmdb/instances/import/template?model=%E4%B8%AD%E6%96%87`（仅单次编码；该不存在模型按预期返回 400）；目录包含 rack，2D 下拉包含 `RACK机柜`。使用两个 `REM_P1_011_*` rack 临时实例，验证 2D 卡片路由到 `/cmdb/instances/by-model/rack/{id}` 和详情「机柜视图」，随后均经产品 DELETE API 精确清理，未留 active 对象。
- 未完成门禁：创建最小 `update` 权限测试身份并验证 UI/API allow/deny；创建后精确清理；使用真实中文 modelId 验证模板 200/CSV 响应。

## 2026-07-16：L1-L3 完成

- 修复 CSV 中文文件名合同：原始中文 `filename` 未在运行时保留，改为 Spring `ContentDisposition` UTF-8 filename；该方法 upstream impact 为 `LOW`。
- 当前事件分支的后端 compile、前端 typecheck、目标 ESLint、Docker frontend/backend production build 均 PASS；既有 CsvImportDialog 有两条未使用变量 warning，未由本次引入。
- 中文“应用”真实 UI：单次编码、HTTP 200、`text/csv;charset=UTF-8`、UTF-8 文件名 `应用_import_template.csv`、Console error=0。
- 最小权限：role 仅含 `cmdb_instance:read` 与 `cmdb_instance:update`；allow 用户 PUT 200 且详情显示「编辑」，deny 用户 PUT 403。
- 所有 runId rack、用户、role assignment 与 role 均经产品 API 逆序清理；`detect_changes` 仅命中预期 CMDB 流程。事件为 `VERIFIED`，等待 L4。
