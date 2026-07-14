# REM-P1-005：通知读取权限收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-005` |
| 优先级 | P1 |
| 领域 | `01-security-authorization` |
| 状态 | `IN_PROGRESS` |
| 分支 | `codex/fqa-008-notification-read-authorization` |
| 来源 | `FQA_20260712_0329_lintfix` / `BUG-FQA-008` / `NOTICE-001` / `RBAC-013` |

通知列表、未读数和已读操作必须由 `notification:read` 权限保护；无此权限的已认证用户不得通过直达路由或 API 读取或修改自身通知状态。

范围：通知 Controller 的四个 API guard、通知页直达路由与对应 allow/deny 回归。非目标：不改变通知投递、通知数据范围、消息内容、角色 seed、权限模型或历史通知数据。

本目录包含实施合同、验证矩阵、实施记录和执行提示。
