# REM-P2-020 实施记录

后续只追加，不覆盖历史。

## 2026-07-17：L4 发现与认领

- 状态：`IN_PROGRESS`；分支：`codex/rem-p2-020-workflow-stats-instance-aggregation`；基线：`lint-fix@8736b8f1`。
- 原始 L4 只读证据：已完成实例列表为 4，流程统计仅包含日报审批流的 1 条完成实例；运行实例列表为 0。页面字段与统计 API 自身一致，但统计与实例源列表不一致。
- 未修改产品数据、权限、会话或 Flowable 历史；下一步为 GitNexus 查询与实际统计服务符号影响分析。

## 2026-07-17：实现与 L1-L3 复验

- GitNexus upstream impact：`WorkflowService.getAllProcessStats` 仅由 `WorkflowController.allStats` 调用，LOW；`getProcessStats` 由单定义和全量统计 Controller 路径调用，LOW。`WorkflowStatsPage` 同为 LOW、无上游调用；无 HIGH/CRITICAL。
- 根因：全量统计只枚举 `latestVersion()` 定义。三条已删除定义的历史实例仍在实例列表中，但其历史行仅存不可解析的 definition id，缺少 definition key，故无法计入现有 key 统计。
- 实现：全量统计以当前定义、可解析历史 key、运行 key 的并集生成；无法恢复 key 的历史实例被明确归入 `historical-deleted-definition` / “历史已删除流程定义”，不篡改或伪造历史定义。前端仅隐藏缺失版本的孤立 `v`。
- 验证：主包构建、当前分支 backend/frontend 容器和真实 API/UI 对账通过。定向 Maven test 被四项既有无关测试源码编译错误阻断，未将其记为 PASS。
- 数据与回滚：只读验证，无测试数据；回滚仅撤回本事件提交，将重新出现统计漏项。

## 2026-07-18：最终 L4 发现的保留桶单项统计回归

- 分支：`codex/rem-p2-020-historical-workflow-stats-single-key`；基线：`lint-fix@7d65aef6`。L4 `REPORT-003` 发现全量响应为 `historical-deleted-definition=3/0/3`，相同 key 的单项端点为 `0/0/0`。
- GitNexus impact：`getProcessStats` 的直接调用者为 `getAllProcessStats` 和 `WorkflowController.processStats`，再上游为 `WorkflowController.allStats`；3 个受影响符号、单模块、LOW 风险。`getAllProcessStats` 仅由 `allStats` 直接调用，同为 LOW。
- 根因：保留桶仅在 `getAllProcessStats` 尾部组装，`getProcessStats` 将该 synthetic key 当成 Flowable definition key 查询，导致归零。
- 实现：`getProcessStats` 对唯一保留 key 从不可解析历史实例计算其稳定 read model（总数、完成数、平均耗时），不写入 Flowable、数据库、审计或授权关系；所有普通 definition key 保持原查询路径。
- L1：增加 `historicalDeletedDefinitionStatsMatchAllStatsBucket`；因本机 Java 26/ByteBuddy 兼容，使用 `JAVA_TOOL_OPTIONS=-Dnet.bytebuddy.experimental=true`。在将 HistoryService 改为 deep stub 并明确历史 query mock 后，6 个 `WorkflowServiceLifecycleTest` 通过。
- L2/L3：后端主包构建通过；当前分支 backend 容器健康；真实 API 输出 historical 全量/单项字段完全一致；`test/l4-report-stats.spec.js` 通过。未创建、修改或清理测试对象。
- 回滚：撤回本事件提交即可恢复旧行为；无数据回滚步骤。
