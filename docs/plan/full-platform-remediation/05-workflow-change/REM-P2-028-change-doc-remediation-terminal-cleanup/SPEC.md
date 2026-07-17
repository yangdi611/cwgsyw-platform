# REM-P2-028 实施合同

## 目标

为本地整改测试产生的、已离开 `draft` 的变更文档提供可审计的精确清理路径，同时保持生产终态与归档资产不可被该路径删除。

## API 与不变量

- `DELETE /api/change-docs/{id}/remediation-test?remediationRunId=<runId>` 必须要求 `change_doc:delete`。
- 文档必须存在且属于当前 tenant；`remediationRunId` 必须非空，且当前文档 JSON 的任意字符串字段值精确匹配该标记（不接受子串）。
- `approved` 文档始终拒绝，返回业务冲突；普通 `DELETE /api/change-docs/{id}` 仍只接受 `draft`。
- 成功时只删除该文档的 CI 链接与快照，软删除该文档，并写入 `change_doc/purge_remediation_test` 审计，审计 `afterJson` 仅记录 runId。
- 不删除共享文件、归档文件、模板或任何未带标记的对象；事务失败不得留下部分清理。

## GitNexus 影响

- `ChangeDocService.delete`：direct callers 为 Controller 删除与 CI 链接移除相关路径，LOW。
- `ChangeDocController`：变更仅新增受权限保护的路由，LOW。
- `ChangeDocTemplateService.deleteTemplate`：不改动，LOW；仅用于验证清理后的引用解除。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 有删除权限的同租户用户可清理带 runId 的非 approved 测试文档，链接和快照一并清除并写审计。 |
| AC-002 | 缺失或错误 runId 返回 400，原文档保持可读取。 |
| AC-003 | approved 文档返回 409 且保持可读取，归档资产不受影响。 |
| AC-004 | 普通 draft 删除与模板引用保护行为不变。 |

## 回滚

回滚本事件提交即可移除该受限端点；没有迁移、配置变更或历史数据改写。
