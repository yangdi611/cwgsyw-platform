# 实施记录

## 2026-07-17

- L4 首次失败：直连网关与后端均返回 XLSX MIME 和字节，但缺失 `Content-Disposition`；页面 fallback 名不能替代 HTTP 下载合同。
- GitNexus：`ReportController.export` upstream 为 LOW，生产 direct callers=0、processes=0；仅现有 ReportControllerTest 覆盖。
- 实施：采用项目 `OpsCalendarMaterialController` 的既有模式，`ContentDisposition.attachment().filename(filename, UTF_8)`。
- 验证：主包 `mvn -Dmaven.test.skip=true package` 通过；当前分支 backend 容器响应含 RFC 5987 `filename*`，独立 Playwright 下载 `日报汇总_2026-07-01_2026-07-31.xlsx`，Console/HTTP 4xx/5xx=0。无新增业务对象或夹具；导出审计为既有产品合同副作用。
