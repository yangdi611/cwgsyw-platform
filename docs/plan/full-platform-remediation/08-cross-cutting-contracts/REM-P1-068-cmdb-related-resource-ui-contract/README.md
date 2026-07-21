# REM-P1-068：CMDB 关联资源 UI 数据合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-068` |
| 优先级 / 领域 | P1 / CMDB 横切资源导航 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `XL-CMDB-004/005` |
| 分支 | `codex/rem-p1-068-cmdb-related-resource-ui-contract` |
| 基线 | `lint-fix@7bbd9915` |
| 事件运行 | `REM_P1_068_20260721` |
| 首次失败证据 | `/tmp/fqa-2050-cmdb-change-export-remaining-r4` |

`InstanceResourcesTab` 使用 `docId/reportId/date/authorName`，但后端关联资源 API 返回 `id/reportDate/reporterName`；日报链接还指向不存在的 `/daily-reports/{id}`，导致真实 CI 资源页无法显示和跳转关联变更文档/日报。

修复为前端接口与后端 DTO 对齐，并将日报链接改为真实 `/daily/{id}`。GitNexus upstream impact 为 LOW：1 个直接调用者 `InstanceDetailPage`、单一 CMDB 模块、3 条详情页流程。

L1-L3 已通过：frontend typecheck、目标 lint、生产构建与容器替换、专用 route-mock Playwright `1/1`；真实 DTO 字段、两类 href、可见文本、Console/5xx 均通过，产品写入 0。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
