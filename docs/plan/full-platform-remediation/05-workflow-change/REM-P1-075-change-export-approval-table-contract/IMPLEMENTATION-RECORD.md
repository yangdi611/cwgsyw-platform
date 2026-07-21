# REM-P1-075 实施记录

## 2026-07-22 发现与认领

- 来源：最终 L4 `XL-EXPORT-002`；当前实现的 PDF 缺动态表格，DOCX/PDF 均缺明确审批状态，PDF application/plan 共用未分区内容。
- GitNexus：`exportPdfDirect` upstream LOW，2 个直接生产调用者（Controller、审批归档），影响 1 条导出流程；`exportDocxProgrammatic` LOW，1 个直接调用者并传播到同一导出流程。
- 从 `lint-fix@414037c2` 创建 `codex/rem-p1-075-change-export-approval-table-contract`，runId `REM_P1_075_20260722`。
- 范围仅限 `ExportService`、Controller 参数传递、定向测试、运行时资产和事件证据。

## 2026-07-22 实施与 L1-L3 收口

- 影响分析：`archiveApprovedDoc` LOW（2 个直接调用者）；`handleWorkflowApproval` LOW（3 个直接调用者）；`selectForUpdate` MEDIUM（6 个直接调用者、18 个受影响符号，全部在 Changedoc 提交/审批锁链）；`approvalStatus` LOW（2 个直接调用者、1 条导出流程）。未触碰 HIGH 风险 `toVO`。
- 实现：DOCX/PDF 增加中英双语审批状态；PDF 增加所选模板的 `fixedDocxTable`、表头、行序、布尔/枚举显示值；Controller/审批归档传递所选模板 ID；审批归档 VO 按 application/plan 注入各自字段配置；`selectForUpdate` 显式为 `fields_data` 配置 `JacksonTypeHandler`，修复统一工作流提交后动态表行被清空。
- 测试：Java 21 L1/L2 定向与聚类测试通过；当前分支 backend package、`--no-deps` 替换和 health `UP` 通过；专用 Playwright 串行测试最终 PASS，覆盖真实工作流 UI 审批、DOCX/PDF 四次浏览器下载、4 个归档文件、双模板不串表、审批状态/人/时间/意见、read-only API 403/UI 隐藏、Console/5xx=0。
- 过程失败归因：首轮 409 为正式 `change_doc` binding 门禁；第二至四轮暴露/确认审批流程回读 `fields_data` 的真实缺陷，最终由 mapper JSONB 映射修复；一次 PDF 中文文本提取失败为字体 ToUnicode 工具限制，导出状态增加稳定 ASCII `(approved)` 以保留可审计文本合同。
- 清理：最终 run `REM_P1_075_20260722` manifest 为 `objects=[]`、`cleanupFailures=0`；数据库/Redis/对象存储未直接写入或清空，backend 之外容器未重启。
- 证据：`evidence/l3-final/result.json`；事件测试资产为 `test/rem-p1-075-change-export-approval-table-contract.spec.js`。
- 下一门禁：运行 `detect_changes()`，提交事件分支并按顺序 no-ff 合并到最新 `lint-fix`，然后在同一 `FQA_20260718_2050_remp1038` 仅重验 `XL-EXPORT-002`。
