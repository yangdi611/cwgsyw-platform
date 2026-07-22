# REM-P1-038：Wiki 发布审批统一工作流绑定

- 状态：`CLOSED`；优先级：P1；分支：`codex/rem-p1-038-wiki-publish-workflow-binding`
- 来源：L4 `FQA_20260718_1715_remp1029` 的 `ST-WIKI-001`。

新建可写 Wiki 空间页面提交审批时返回 HTTP `500`，无法从 `draft` 进入 `review`。根因是 `WikiPageService.submitForReview` 直接使用已失效的旧 Flowable key，而其他业务已采用统一 workflow runtime/binding。

范围仅限 Wiki 页面提交与统一流程回写；不改变 ACL、非测试数据、授权模式或外部服务。L1、L2/L3 和 Wiki 回归均通过。用户已明确接受 `wiki_page -> remp1038wiki`（指定 `superadmin` 审批）为正式租户审批策略，因此不再执行解绑或模板删除；下一门禁为独立提交、no-ff 合并和从新集成点完整重置 L4。

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
