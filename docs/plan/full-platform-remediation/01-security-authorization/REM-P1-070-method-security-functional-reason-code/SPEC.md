# REM-P1-070 规格

## 范围

- `@PreAuthorize` 方法级功能权限拒绝返回 HTTP 403 与 `FUNCTION_PERMISSION_DENIED`。
- MVC 方法安全异常与 Security filter 拒绝保持同一 JSON reason-code 合同。
- 既有业务层 `ROLE_SCOPE_NOT_COVERED`、`RESOURCE_ACCESS_DENIED`、`ANCESTOR_TRAVERSE_DENIED` 保持不变。

## 非目标

- 不修改权限表达式、角色 assignment、scope、ACL、ancestor、break-glass 或跨租户语义。
- 不把业务层授权拒绝统一覆盖为功能权限拒绝。
- 不改变全局 Jackson `non_null` 序列化策略。

## 验收标准

- AC-001：撤销最后有效功能权限后，旧会话访问受 `@PreAuthorize` 保护的 API 返回 403 与 `FUNCTION_PERMISSION_DENIED`。
- AC-002：响应不泄露资源内容，空 data 在现有序列化合同下可缺省或为 null。
- AC-003：scope、资源 ACL 与 ancestor 拒绝继续返回原精确 reason code。
- AC-004：当前事件分支 backend 的单测、生产构建、真实 API 与精确清理通过。
