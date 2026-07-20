# REM-P1-053：Workflow 审批审计摘要边界

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-053` |
| 优先级 | P1 |
| 领域 | Workflow / 审计 |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | `FQA_20260718_2050_remp1038` / `FLOW-002` |
| 分支 | `codex/rem-p1-053-workflow-approval-audit-remark-boundary` |
| 基线 | `lint-fix@0049d1ec` |
| 原始失败 | `623258b1` / `/tmp/fqa-2050-flow002-after-rem-p1-052` |

4096 字符 Unicode 审批意见在日报完成回调中被完整拼入 `audit_log.remark VARCHAR(512)`，数据库异常使审批返回 HTTP 500 并回滚。

本事件只为 Workflow 业务回调生成确定性的 ≤512 审计摘要；完整审批意见仍保留在流程/业务字段中。不得修改数据库列、审批权限、状态机、正式绑定或通知合同。

L1-L3 已完成：Java 定向测试 8/8、Workflow/日报/Wiki/权限聚类 161/161、当前分支 backend 镜像构建与健康检查、日报/Wiki 真实 Playwright API/UI 复验均通过；审计摘要严格限制为 512 个 Unicode code points，manifest 为空。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
