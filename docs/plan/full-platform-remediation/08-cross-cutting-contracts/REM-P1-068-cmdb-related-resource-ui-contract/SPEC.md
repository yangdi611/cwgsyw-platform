# REM-P1-068 规格

## 范围

- `ChangeDocVO` 对齐 `LinkedChangeDocVO` 的 `id/changeNo/title/status/applicantName/impactLevel/linkCreatedAt`。
- `DailyReportVO` 对齐 `DailyReportBriefVO` 的 `id/reporterName/reportDate/status/completedItemsBrief`。
- 变更文档使用 `/change-docs/{id}`，日报使用 `/daily/{id}`。
- 保持现有查询键、API、权限、页面结构和空态语义。

## 非目标

- 不改变后端 DTO 或 API 路径。
- 不改变关联创建/解除、权限或清理语义。
- 不处理 `XL-CMDB-006`、`XL-EXPORT-002/004` 尚未执行的聚合 AC。

## 验收标准

- AC-001：真实 API DTO 字段可渲染变更文档和日报。
- AC-002：两个链接 href 指向现有详情路由。
- AC-003：typecheck、lint、生产构建、真实页面组件回归通过。
- AC-004：测试产品写入 0，Console/pageerror/5xx 为空。
