# REM-P1-075 规格

## 范围

- DOCX/PDF 明确输出审批状态；批准态同时输出审批人、时间和意见。
- PDF 按所选 application/plan 模板渲染该模板的 `fixedDocxTable`，保持列头、显示值与行序。
- PDF application/plan 仅包含所选模板的动态表格，不串表。

## 非目标

- 不改变审批状态机、权限、归档数量、文件名/MIME、上传 DOCX 模板语义或数据库。

## 验收标准

- AC-001：批准态 DOCX/PDF 均含明确审批状态、人、时间、意见。
- AC-002：DOCX/PDF 均渲染所选模板表格，含空表头、布尔/枚举显示值与存储行序。
- AC-003：application/plan 导出分区正确；既有权限、终态和归档合同不回归。
- AC-004：Java 21 L1-L2、当前 backend、真实 API/UI 下载、解析和精确清理全部通过。

## 回滚

移除审批状态行、PDF 模板参数和 PDF 表格渲染 helper；无需迁移或数据恢复。
