# REM-P1-002：成员列表软删除一致性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-002` |
| 优先级 | P1 |
| 领域 | `02-account-organization` |
| 状态 | `CLOSED` |
| 分支 | `codex/fqa-016-membership-list-soft-delete` |
| 来源 | `FQA_20260712_0329_lintfix` / `BUG-FQA-016` / `GROUP-CRUD` |

移除成员后，所有成员关系读取路径必须只返回活动 membership；管理员不得看到已经软删除的关系。

## 范围

- 收敛 `GET /api/users/{id}/group-memberships` 的 soft-delete 过滤。
- 复核 `GET /api/groups/{id}/members` 的 Mapper 合同并用回归测试保护。
- 验证添加、移除、主组移除、多组与软删除用户的读模型一致性。

不包含 assignment 失效、会话注销、组 archive/restore、历史数据迁移或其他 FQA 缺陷。

`AC-001..004` 已完成：用户维度列表软删除过滤单测、组成员 Mapper 合同复核、主组/多组 API 生命周期、软删除用户读模型与有效 scope 集成回归均通过。测试对象仅使用 `REM_P1_002_*_fqa016` 前缀，并已通过产品 API 清理。发布前 L4 全量复验仍为独立共同门禁。

## 文件导航

- `SPEC.md`：实现与回滚合同。
- `VERIFICATION.md`：验收矩阵和最终全量复验门禁。
- `IMPLEMENTATION-RECORD.md`：当前实施证据。
- `CLAUDE-CODE-PROMPT.md`：可独立执行入口。
