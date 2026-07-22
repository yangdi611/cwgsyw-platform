# REM-P1-069 规格

## 范围

- owner-group mode 使用用户全部有效、未删除、同租户业务组成员关系，而不是仅使用主组。
- group-scope assignment 仍必须覆盖资源 owner group；缺少 assignment 仍拒绝。
- 成员关系被删除、组停用/删除或 assignment 失效后立即失去对应 owner-group mode 权限。

## 非目标

- 不修改角色 assignment 查询、成员关系生命周期或主组写入合同。
- 不改变显式 user/group ACL、restricted、owner、others、平台管理员、租户管理员或 break-glass 优先级。
- 不扩大跨租户、非成员组或无功能权限访问。

## 验收标准

- AC-001：非主组有效成员 + 同组有效 assignment 可使用 owner-group mode。
- AC-002：有效组集合不含资源组时，即使主组字段残留也不能获得 group mode。
- AC-003：Authorization/Wiki/SharedFile 受影响测试通过，无跨组旁路。
- AC-004：当前 backend 真实两组 API 链在移除成员前双组可见、移除后仅保留剩余组，并精确清理。
