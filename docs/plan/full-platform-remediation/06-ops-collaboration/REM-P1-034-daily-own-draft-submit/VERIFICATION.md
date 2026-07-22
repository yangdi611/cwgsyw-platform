# REM-P1-034 验证

| AC | 层级 | 证据 | 结果 |
|---|---|---|---|
| 本人草稿入口 | L1/L2 | `DailyReportVO.reporterId` 与 auth store `userId` 对账；仅 `DRAFT/REJECTED` 且 ID 相同渲染提交按钮 | PASS |
| 提交状态 | L3 | 当前事件分支前端容器，Playwright 从真实 UI 创建 runId 草稿、在“全部日报”点击提交，详情为 `SUBMITTED` | PASS |
| 精确清理 | L3 | 同一真实会话调用 `DELETE /api/daily-reports/{id}/remediation-test?remediationRunId=...` 返回 200，后续读取为 400 | PASS |
| 静态门禁 | L3 | `frontend/npm run lint`：0 error/39 既有 warning；`frontend/npm run typecheck`：通过；仅重建 frontend | PASS |
| 影响分析 | L1 | `DailyReportsPage` upstream：0 direct、0 process、LOW | PASS |

审批待办的管理员可见性不属于本事件；其复现不影响本事件“本人草稿提交”验收，需单独按 `REM-P1-026` 根因处理。
