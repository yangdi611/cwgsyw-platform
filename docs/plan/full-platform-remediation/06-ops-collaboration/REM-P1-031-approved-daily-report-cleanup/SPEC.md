# REM-P1-031 实施合同

## 目标与不变量

让已审批但带历史 FQA 测试标记的日报，经既有受限 remediation 清理端点精确回收。

- 保持端点、platform scope、当前租户、审计和关联通知/流程清理边界不变。
- 接受 `remediationRunId` 完整文本匹配，或其 `FQA_yyyyMMdd_HHmm` 时间戳对应的内容标记：`FQA_` 后可有业务前缀、再出现同一时间戳。
- 不含完整 runId 或合格历史标记的正常日报一律拒绝，失败不删除任何关联对象。
- 不新增普通删除入口，不编辑已审批日报，不用 SQL 或数据迁移补写测试标记。

## 影响与风险

- 修改符号：`DailyReportService.purgeRemediationReport` 的测试标记判定；Controller 合同不变。
- GitNexus upstream impact：服务 4 个直接消费者（Controller、3 个测试），0 个受影响执行流，`LOW`；事件整体为 HIGH，因为它涉及删除已审批业务对象。

## 验收

| AC | 条件 |
|---|---|
| AC-001 | 完整 runId 保持可清理。 |
| AC-002 | 合格历史 FQA 标记且时间戳匹配时，已审批日报可精确清理。 |
| AC-003 | 普通内容、错误时间戳、非 platform、跨租户均返回 4xx 且零副作用。 |
| AC-004 | 通知、流程映射、Flowable runtime/history、日报与清理审计保持既有精确合同。 |
| AC-005 | L1 单测、L2 真实 API、L3 当前分支容器/UI 或可观察 API 复验均通过并清理。 |

## 回滚

回退本事件提交即恢复完整 runId 严格匹配；已清理对象均为 run-scoped 测试对象，不恢复。
