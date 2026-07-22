# REM-P2-003 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-057`；用例：`WIKI-008`。
- 根因：CreatePageRequest/SavePageRequest、Service 与数据库未共享标题规范。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-16：事件认领与影响分析

- 状态：`IN_PROGRESS`；分支：`codex/rem-p2-003-wiki-title-validation`；基线：`lint-fix@3671f9cf`。
- GitNexus query/context 已定位创建、保存、ACL、版本回退和树/编辑页面链路。
- upstream impact：`WikiPageService.createPage` 为 MEDIUM（5 个直接调用点，1 条创建流程）；`savePage` 为 MEDIUM（6 个直接调用点、4 个回退链间接调用点）；`WikiPageMapper`、`WikiTreeSidebar`、`WikiEditorPage` 为 LOW。未发现 HIGH/CRITICAL。
- 标题比较采用 trim 后精确匹配，不扩展大小写折叠或历史数据批量修改。

## 2026-07-16：实现与 L1-L3 复验

- 实现：DTO/Controller 输入校验；`createPage`、`savePage`、`movePage` 统一 trim、255 字符上限与同级预检；V77 以事务 advisory lock 和触发器防止并发重复，同时不对历史同名页的纯正文保存施加新约束；冲突统一为 `409/WIKI_PAGE_SIBLING_TITLE_CONFLICT`。前端新建、重命名、编辑均限制 255 字符并显示计数，编辑页空白标题不可保存。
- L1：新增 Wiki 服务与全局异常映射合同测试；`mvn -Dtest=... test` 仍被既有 `OpsCalendarRuleServiceTest`、`OpsCalendarTaskServiceTest`、`GroupControllerGroupReferenceTest` 的 testCompile 失败阻断。本事件生产 `mvn -DskipTests compile`、后端容器构建均通过。
- L2：`REM_P2_003_20260716_134537` 真实会话 API：trim 创建 200；空白和 256 字符 400；普通重复 409 + 明确 errorCode；并发为一成一冲突；runId 页面残留 0。此前临时空空间和中断运行残留均经产品 DELETE API 清理为零。
- L3：当前事件分支重建 backend/frontend 容器，健康检查通过；本地 Playwright 经真实 `/login` 进入编辑页，验证 `maxlength=255`、空白保存禁用、计数可见、Console error=0。
- 已知边界：子页创建在历史页面 ACL 下返回 403，属于 `REM-P1-017` 的授权合同，不在本事件绕过；标题合同在可创建根页、重命名服务单测与并发 API 路径均已覆盖。
- 影响结论：创建/保存为 MEDIUM，移动/前端为 LOW；实体 `WikiPage` 分析为 HIGH，未修改该实体。最终 `detect_changes` 仅命中预期 Wiki 创建链、编辑页及专属异常映射。
- 回滚：revert 本事件提交；V77 触发器、服务/DTO/前端校验随提交一并回退，无历史数据迁移。
- 事件状态：`VERIFIED`，等待最终 L4。
