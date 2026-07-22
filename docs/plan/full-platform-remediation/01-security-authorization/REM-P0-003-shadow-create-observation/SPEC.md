# REM-P0-003 实施规格

## 目标与不变量

`AuthorizationService.decideCreateWithCompatibility` 在有效模式为 Shadow 时必须记录一次创建判定观测，并仍返回 legacy 判定。有效模式为 Legacy 或 Enforced 时不得新增观测，返回语义保持不变。

## 数据合同

| 字段 | 值 |
|---|---|
| `tenant_id` / `user_id` / `module` / `permission_code` | 当前请求上下文 |
| `resource_type` | `create` |
| `resource_id` | `0`（非空表约束下的创建型哨兵，不代表业务资源） |
| `legacy_allowed` | 既有兼容判定 |
| `new_allowed` / `new_reason_code` | `decideCreate` 输出 |

该表示与资源型读写观测区分，且满足 strict preflight 仅按 user/module/permission_code 判断是否已观测的合同。

## 修改范围

- `backend/.../authorization/AuthorizationService.java`：在 BooleanSupplier overload 的 Shadow 分支插入观测。
- `backend/.../authorization/AuthorizationServiceTest.java`：覆盖 Shadow 写观测及 Legacy/Enforced 无新增记录。

## 验收条件

- AC-001：Shadow 创建判定返回 legacy 结果并写入一条 `create/0` 观测；`0` 是满足表非空约束的创建型哨兵，不代表业务资源。
- AC-002：Legacy 与 Enforced 创建判定不新增 Shadow 观测，且授权返回值不变。
- AC-003：Wiki 创建、共享目录创建和根目录上传的调用合同不改变。
- AC-004：使用 `byron` 的真实 Shadow 会话触发五条既有 Wiki/共享文件授权后，strict preflight 的 `unobservedPermissionGrants=0`。现有历史资源判定差异必须由独立 REM 处理，不得在本事件中修改既有 ACL、角色或 assignment。
- AC-005：所有 runId 测试对象经产品 API 精确清理；无临时授权、会话秘密或非测试对象残留。

## 回滚与停止

代码回滚只移除 Shadow 创建观测插入，不触及授权数据。若观测产生新旧判定差异、无法精确清理 runId 对象或预检新增其他 blocker，停止 Enforce 并记录 FAIL/BLOCKED。
