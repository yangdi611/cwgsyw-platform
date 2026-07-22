# REM-P2-023 实施合同

## 目标

`GET /api/reports/export` 的成功 XLSX 响应必须携带 UTF-8 `Content-Disposition: attachment`，文件名为 `日报汇总_<startDate>_<endDate>.xlsx`。现有内容类型、导出字节、授权、范围与审计不变。

## 影响

GitNexus upstream impact（2026-07-17）：`ReportController.export` 无生产直接调用方、无受影响流程，风险 `LOW`；现有控制器测试覆盖范围、权限和日期拒绝。

## 验收

- AC-001：响应含 UTF-8 attachment 的 `Content-Disposition` 和中文文件名。
- AC-002：XLSX MIME、ZIP 内容与现有导出审计保持。
- AC-003：当前分支真实浏览器下载显示中文文件名，零 Console/4xx/5xx。
