# REM-P1-053 实施记录

## 2026-07-20：认领与根因确认

- 基线：`lint-fix@0049d1ec`；分支：`codex/rem-p1-053-workflow-approval-audit-remark-boundary`。
- L4 失败：4096 字符 Unicode 日报驳回意见返回 HTTP 500；空意见批准、无权限 403 和状态不变已通过。
- PostgreSQL 根因：`audit_log.remark VARCHAR(512)`；日报 adapter 将完整意见拼接进 remark，异常使完成事务回滚。
- 仓库既有合同：审计 remark 必须为 ≤512 的有界摘要，不能让无界用户输入中断业务事务。
- GitNexus：两个审批 Controller 均 LOW/0 上游/0 流程；`completeTask` LOW/2 直接入口/Workflow 单模块；日报 adapter LOW；Wiki approval LOW/1 直接调用者。
- 授权与安全：未修改正式 Workflow/Wiki binding；原始夹具均通过产品 API 清理，manifest 为空；授权保持 enforced。
- 实施方向：完整意见保持原业务/流程语义，仅对日报和 Wiki adapter 的审计 remark 做确定性 Unicode 安全有界摘要。
- 下一门禁：编辑前补齐拟修改 helper/adapter impact，实施 L1 测试后扩大到 L2/L3。

## 2026-07-20：L1-L3 完成

- 实现 `AuditRemark.bounded`：null 与不超过 512 code points 的输入保持不变，超长输入保留前 509 个 Unicode code points 并追加 `...`，避免代理项截断。
- 日报与 Wiki adapter 仅对 audit remark 使用有界摘要；完整审批意见继续保留在既有 Workflow/业务字段中，未修改 schema、DTO、权限、binding、通知或状态机。
- L1：Java 21 `AuditRemarkTest` 2/2、`WorkflowAdapterAuditRemarkTest` 2/2、`WorkflowControllerCompatibilityTest` 4/4，共 8/8；生产编译通过。
- L2：`mvn -q -Dtest='Workflow*Test,DailyReport*Test,Wiki*Test,AuditRemarkTest' test`，161/161 PASS。
- L3：backend Docker build 与健康检查通过；日报 `/tmp/rem-p1-053-flow002-runtime-rerun` 1/1，Wiki `/tmp/rem-p1-053-wiki-runtime-rerun` 1/1；无未解释 Console/5xx，manifest `objects=[]`、`cleanupFailures=0`。
- 一次只读探针误请求 `/api/audit/logs`，返回 `NoResourceFoundException`；该路径不在最终测试中，正确端点为 `/api/audit-logs`，不构成未解释失败。
