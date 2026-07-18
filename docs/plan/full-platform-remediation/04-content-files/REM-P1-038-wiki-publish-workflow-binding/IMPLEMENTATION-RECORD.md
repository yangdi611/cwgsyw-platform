# 实施记录

## 2026-07-18 认领

- L4 `ST-WIKI-001` 新失败：runId Wiki 页面提交审批 HTTP `500`。
- 失败命令：`FQA_L4_RUN_ID=FQA_20260718_1715_remp1029 npx playwright test test/l4-wiki-state-current-run.spec.js --workers=1`。
- GitNexus 已更新至 `a3163b9e`；`WikiPageService` upstream impact 为 1 个 direct caller、0 个识别流程，风险 `LOW`。
- 失败夹具清理后 manifest 为 `objects=[]`、`cleanupFailures=0`。

## 2026-07-18 L1/L3

- 对 `WikiPageService.submitForReview` 的 GitNexus upstream impact：1 个 direct caller，Wiki 模块，`LOW`。
- 实施最小修复：以 `WorkflowRuntimeFacade.startBusinessProcess` 和 `WikiWorkflowAdapter.BUSINESS_TYPE` 替换直接调用旧 `wiki_publish` key。
- L1：`backend/mvn -q -DskipTests compile` 通过。
- L3：仅执行 `docker compose -f docker-compose.dev.yml up -d --build --no-deps backend`；backend healthy，未重启 PostgreSQL、Redis、MinIO、Nginx 或 frontend，未执行迁移。
- L3 定向测试：原 HTTP `500` 收敛为 HTTP `409`；统一 runtime 正确拒绝缺失 `wiki_page` binding。事件 run manifest 为空。
- 只读 API：可用定义为 `dailyReportApproval`、`test` 和临时 `remp1023...`，没有可信 Wiki 发布定义。此前调用的 `GET /api/workflow/bindings` 不存在，静态资源 404 被全局异常处理为 500；正确 `GET /api/workflow/center/bindings` 返回 200 且仅列出 `daily_report` binding，确认 `wiki_page` binding 缺失。创建/部署或绑定定义会写入租户级产品配置，等待用户明确授权。

## 2026-07-18 补充定向单测

- `WikiPageServiceTest` 新增 submit success 与 facade-failure 两项；以 OpenJDK 21.0.11 执行 `mvn -f backend/pom.xml -Dtest=WikiPageServiceTest test`，25/25 PASS。先前 JDK 26 的 Mockito inline mock 初始化失败是本机运行时兼容问题，未计为产品测试失败。

## 2026-07-18 授权运行时复验和回退缺口

- 用户授权后，使用产品 API 创建 runId `REM_P1_038_20260718_1805` 的 `single_approval` Wiki 模板实例 `7`、流程 key `remp1038wiki`、`wiki_page` binding `2`；授权前不存在任何 Wiki binding。审批人固定为 superadmin ID `1`，只适用于本次受控验证。
- 首次状态链暴露测试资产两个问题：指定用户任务应查询 `/api/workflow/center/tasks/my`，且返回的 `businessId` 为字符串。两次失败均由 finally 删除页面/空间；产生的 runId 流程均通过产品 API以 reject 完成，最终 running instances 为 0。测试修正后完整链通过。
- 状态链 PASS：submit -> review，reject -> draft，edit -> resubmit，approve -> published；页面与空间被产品 API逆序清理，manifest `objects=[]`、`cleanupFailures=0`。Wiki content/comments/export 回归串行 3/3 PASS。
- 回退审计：`GET /api/workflow/center/bindings` 显示当前仍有 binding `2`；控制器只有 GET/POST，`ProcessBindingService` 只有 bind/list/validate，无 unbind/disable。模板删除亦被已保留的流程历史拒绝。遵守 Goal 禁止 SQL/Flowable 直接删除的约束，未绕过。
- 用户随后明确接受 `wiki_page -> remp1038wiki` 为正式审批策略；binding `2` 与模板实例 `7` 因而成为批准的租户配置，不再视为测试残留。运行中实例仍为 0；保留 Flowable 历史和审计符合已授权范围。
