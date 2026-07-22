# REM-P1-053 验证矩阵

| AC | caseId | 层级 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | FLOW-002 / 日报长意见 | L1-L3 | PASS | `AuditRemarkTest`、日报 adapter 测试；`/tmp/rem-p1-053-flow002-runtime-rerun`；4096 Unicode 驳回成功、状态正确、审计 remark 512 code points |
| AC-002 | Wiki 审批长意见 | L1-L3 | PASS | adapter 测试；`/tmp/rem-p1-053-wiki-runtime-rerun`；长意见批准/审计回读通过 |
| AC-003 | 空/短/边界兼容 | L1-L2 | PASS | Java 21 8/8；Workflow 聚类 161/161；空意见批准与完整业务意见保留通过 |
| AC-004 | 无权限与零副作用 | L2-L3 | PASS | 无 approve 权限 API/UI 403，日报保持 `SUBMITTED`；manifest `objects=[]` |
| AC-005 | 构建/UI/清理 | L3 | PASS | backend Docker build/health、真实 Playwright 1/1 + 1/1、Console/5xx=0、`cleanupFailures=0` |

## 原始失败

- L4 run：`FQA_20260718_2050_remp1038`
- 失败提交：`623258b1`
- 测试：`test/l4-workflow-approval-contract-current-run.spec.js`
- trace：`/tmp/fqa-2050-flow002-after-rem-p1-052`
- 根因：`DailyReportWorkflowAdapter.onWorkflowCompleted` 写入超过 `audit_log.remark VARCHAR(512)` 的审计文本。
- 清理：`objects=[]`、`cleanupFailures=0`。

## PASS 门禁

L1 定向、L2 日报/Wiki/权限聚类、L3 当前分支 backend 与真实 API/UI 全部通过，零未解释 5xx/Console error，测试数据精确清理完成；事件达到 `VERIFIED`，提交与 no-ff 合并仍按全局顺序执行。
