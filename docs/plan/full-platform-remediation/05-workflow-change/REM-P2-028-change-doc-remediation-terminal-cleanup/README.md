# REM-P2-028：变更文档终态测试受限清理

- 优先级：P2；领域：流程与变更；状态：`VERIFIED`
- 来源：最终 L4 `FQA_20260716_2300_lintfix` 的 `CHANGE-005`。
- 问题：无效日期测试被系统接受并进入 `plan_pending`，而既有删除合同仅允许 `draft`，导致测试文档及其模板引用无法通过产品 API 清理。
- 用户影响：测试数据残留会污染后续复验；若以数据库或存储绕过清理，将破坏真实业务的终态保护边界。
- 分支：`codex/rem-p2-028-change-doc-remediation-terminal-cleanup`，基线：`lint-fix@f0fb5737`。
- 范围：只为字段值精确匹配 `remediationRunId` 的同租户非 `approved` 测试文档提供受 `change_doc:delete` 保护的精确清理；清理 CI 链接、快照、文档软删除并留下审计。
- 非目标：不改变普通删除合同、审批文档归档、模板删除规则、共享文件资产、Redis、会话、数据库卷或历史业务数据。
- 验证结论：L1 后端打包通过；L2 已审批拒绝、错误 runId 保留、`plan_pending` 精确清理和读后不存在均通过。原 L4 残留文档 `#211` 与模板 `#8` 已通过产品 API 清理。
- 下一门禁：no-ff 合并后从最新 `lint-fix` 重跑 `CHANGE-005`，保留原 FAIL 并追加 `REVERIFY PASS`。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)
