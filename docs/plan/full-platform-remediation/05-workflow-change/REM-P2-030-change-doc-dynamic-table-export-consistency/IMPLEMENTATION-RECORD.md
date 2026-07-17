# REM-P2-030 实施记录

## 发现

2026-07-17 L4 `CHANGE-006`：固定表格的 API/UI 生命周期和产品 API 清理通过，但测试模板 #4 无 DOCX；`ExportService.exportDocxFor` 捕获该情形后进入 `exportDocxProgrammatic`，现有 `buildDocument` 只输出固定字段，未输出动态表格。导出一致性不能被推断为通过。

## 实施状态

2026-07-17 已从 `lint-fix@49eb97654` 建立独立分支 `codex/rem-p2-030-change-doc-dynamic-table-export-consistency`。GitNexus 查询确认导出入口为 `ChangeDocController.export`；对 `ExportService`、`exportDocxFor`、`buildDocument` 和 `ChangeDocTemplateService.fillDocx` 执行 upstream impact：风险均为 LOW。`buildDocument` 的直接调用者为 `exportDocxProgrammatic`，经 `exportDocxFor` 影响导出控制器、审批归档和一个导出流程；未发现 HIGH/CRITICAL 风险。开始实施程序化回退的动态表格渲染与定向测试；不得在 L4 证据分支混入此事件代码。

## 实现与验证

- `ExportService` 的无 DOCX 程序化路径按当前导出模板选择 application 或 plan 字段配置；仅对 `fixedDocxTable` 新增表格标题、列标题和行。行顺序遵循持久化数组；checkbox 输出稳定“是/否”；空表输出标题行；普通字段、模板填充、Controller、权限和状态机未改动。
- L1：新增 `ExportServiceTest`，与已有 `ChangeDocTemplateServiceWordTest` 独立执行 `8/8` 通过，覆盖模板克隆、程序化行顺序、checkbox 与空表表头。全仓 Maven testCompile 仍由三项既有无关测试源码错误阻断；`mvn -DskipTests compile` 通过。
- L2：重建当前事件分支 backend 容器。runId `REM_P2_030_20260717_0917` 草稿 #221 调用产品 DOCX 导出，OOXML 读回 `test1/teset2/test3` 与 `first → second → third`、`否/是/否`；随后产品 DELETE 200、关键词回读 `total=0`。
- L3：真实 Chromium 登录 `/change-docs/2`，点击“导出方案 Word”，下载 `CHG-20260628-001_方案.docx`；Console error 和应用 4xx/5xx 均为 0。该历史已审批文档仅只读导出，未修改。
- 回滚：还原本事件提交即可恢复旧回退行为；无迁移、无外部配置、无 SQL/对象存储/Redis/会话/卷绕过。

## 回滚与数据边界

不得用 SQL、对象存储直写/删除、Redis、会话或卷操作制造/清理夹具。仅使用产品 API 和具有明确 runId 的测试对象；事件完成后回读零残留。
