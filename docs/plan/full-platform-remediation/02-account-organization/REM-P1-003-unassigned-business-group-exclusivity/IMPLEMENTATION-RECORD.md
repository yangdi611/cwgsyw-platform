# REM-P1-003 实施记录

## 2026-07-14：启动与影响分析

- 状态：`CLOSED`（前序整改覆盖复验）；分支：`codex/fqa-056-unassigned-business-group-exclusivity`。
- GitNexus：`GroupMembershipService.add` upstream impact 为 `HIGH`，4 个直接调用者、13 个依赖符号、Org/User/Authorization 三模块；无命名 execution process。直接入口包括 `GroupController.addMember`、`UserController.addMembership`、主组设置与授权迁组链。
- 初始拟议的 `add` 补充校验已在 API 复现中发现无法覆盖真实当前状态，故完整撤回，未保留生产代码。

## 2026-07-14：前序覆盖复验与关闭

- 运行时发现 `ActiveGroupReferenceValidator.lockAndRequire` 已仅允许 `business` group；尝试通过 `POST /api/users/{id}/group-memberships` 添加未分配组返回 `409 GROUP_REFERENCE_INACTIVE`。证据：`test-results/REM_P1_003_probe_20260714_194856_fqa056/REM-P1-003/add-unassigned-response.json`。
- `ActiveGroupReferenceValidator` upstream impact 为 CRITICAL（86 个符号、13 个模块、6 个流程），未改动该共享门禁。
- 定向测试 `mvn -q -Dtest=ActiveGroupReferenceValidatorTest test` PASS，其中覆盖 non-business group 稳定拒绝合同。
- 两次失败性复现 run 和 probe 用户均通过产品 API 删除；最终 `REM_P1_003_` 活动用户/组计数为 `0`。`detect_changes` 返回 `No changes detected`。
- 结论：历史 `BUG-FQA-056` 的混合状态起点已被 `REM-P1-001` 引入的 business-only 引用门禁消除。本事件不引入代码提交，`AC-001..004` PASS，状态 `CLOSED`；L4 全量验收保留。
