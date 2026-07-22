# REM-P2-026：变更文档列表查询合同

- 优先级：P2；领域：变更文档；状态：`CLOSED`
- 源：最终 L4 `FQA_20260716_2300_lintfix`，`CHANGE-001`。
- 问题：列表端点返回完整数组，页面仅本地状态筛选和详情抽屉，缺少关键词搜索与分页，无法满足列表查询合同。
- 范围：为列表增加服务端 status/keyword/page/size 查询和页面搜索、分页；保留详情抽屉。
- 非目标：不改文档创建、编辑、审批、导出、权限、状态机或历史数据。
- 分支：`codex/rem-p2-026-change-doc-list-query-contract`，基线：`lint-fix@fe961a3c`。
- 验证结论：L1 构建与静态检查、L2 真实会话 API、L3 真实页面搜索/筛选/分页/详情抽屉均已通过；19 条 runId 草稿已通过产品 DELETE 精确清理，零残留。
- 下一门禁：no-ff 合并后，从最新 `lint-fix` 复跑 L4 `CHANGE-001`。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
