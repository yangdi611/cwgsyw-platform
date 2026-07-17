# 实施记录

## 2026-07-17：认领、授权与影响

- 原始 L4 `CHANGE-005` 发现无效日期 `2026-99-99` 被接受并提交为 `plan_pending`；文档 #211 和其模板 #8 无法按既有普通删除合同清理。
- 用户明确授权新增受限终态测试清理端点；授权不包括清 Redis、会话、数据库卷、SQL 绕过或对象存储绕过。
- GitNexus upstream impact 已对 `ChangeDocService.delete`、`ChangeDocController`、`ChangeDocTemplateService.deleteTemplate` 执行；直接影响少，风险 `LOW`，未发现 HIGH/CRITICAL 阻断。

## 2026-07-17：实现与验证

- 修改 `ChangeDocController.purgeRemediationTest` 与 `ChangeDocService.purgeRemediationTest`：新增受权限保护的 DELETE 路由；校验 tenant、runId 和 approved 终态；事务内删除 CI links/snapshots，软删除文档并写 `purge_remediation_test` 审计。
- `mvn -Dmaven.test.skip=true package` 通过；以真实 superadmin 会话完成 L2 正反验证。
- #212 使用错误 runId 返回 400 并保持可读取；正确 runId 返回 200 且后续读为不存在。#2 approved 返回 409。
- 已清理 L4 产生的 #211；引用解除后模板 #8 已经由既有产品 API 删除。未触碰共享归档资产。

## 待完成

- 提交前运行 GitNexus `detect_changes --scope staged`。
- no-ff 合并后，在最新 `lint-fix` 重跑 `CHANGE-005` 并把原 FAIL 后追加复验结果与零残留证据。
