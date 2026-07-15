# REM-P1-005：通知读取权限收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-005` |
| 优先级 | P1 |
| 领域 | `01-security-authorization` |
| 状态 | `VERIFIED` |
| 分支 | `codex/fqa-008-notification-read-authorization` |
| 来源 | `FQA_20260712_0329_lintfix` / `BUG-FQA-008` / `NOTICE-001` / `RBAC-013` |

通知列表、未读数和已读操作必须由 `notification:read` 权限保护；无此权限的已认证用户不得通过直达路由或 API 读取或修改自身通知状态。

范围：通知 Controller 的四个 API guard、通知页直达路由与对应 allow/deny 回归。非目标：不改变通知投递、通知数据范围、消息内容、角色 seed、权限模型或历史通知数据。

本目录包含实施合同、验证矩阵、实施记录和执行提示。

当前事件已完成 L1-L3：四个 API guard、真实会话 allow/deny、零权限直达路由拒绝、管理员 UI 访问、前端 lint/typecheck、当前分支容器构建与测试数据精确清理均通过。事件级状态为 `VERIFIED`；最终 `CLOSED` 仍需发布候选版 L4。
