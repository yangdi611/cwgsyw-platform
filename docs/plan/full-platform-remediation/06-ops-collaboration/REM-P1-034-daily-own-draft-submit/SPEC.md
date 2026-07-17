# REM-P1-034 实施合同

## 目标

在 `/daily` 的“全部日报/本组日报”视图中，当前登录用户自己的 `DRAFT` 或 `REJECTED` 日报必须显示“提交审批”；他人日报不得显示该入口。

## 允许变更

- `DailyReportsPage` 的本人与否判定；使用已有 `DailyReportVO.reporterId` 和已认证 `AuthUser.userId`。

## 非目标

- 不改变 `daily_report:approve`、`submit`、`update` 权限。
- 不改变日报/工作流状态机、审批候选规则或后端 API。
- 不改变非测试日报，测试对象只可通过 runId 受限清理端点删除。

## 验收

1. 平台管理员创建的本人草稿在“全部日报”视图显示“提交审批”。
2. 点击后日报转为 `SUBMITTED`，真实 UI 显示待审批。
3. 仅本人的 `DRAFT/REJECTED` 显示入口。
4. runId 测试日报、关联流程和通知经产品 API 精确清理，读取返回不存在。
5. 前端 lint/typecheck 与当前分支前端容器 Playwright 复验通过。
