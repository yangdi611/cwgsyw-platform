# REM-P0-004：历史授权判定差异收敛

| 字段 | 内容 |
|---|---|
| 状态 | VERIFIED |
| 优先级 | P0 |
| 领域 | 安全与统一授权 |
| 分支 | `codex/rem-p0-004-historical-authorization-decision-reconciliation` |
| 基线 | `lint-fix@612b71ec` |
| 来源 | `REM-P0-003` 后 strict preflight 的最新 Shadow 判定差异 |

## 问题

最新 Shadow 观测中有 8 条新旧判定不一致：6 条为 `byron` 在既有 Wiki 资源上的差异，2 条为已删除 runId 测试资源的陈旧观测。前者暴露了统一模型未表达既有 Wiki 空间 ACL 与系统空间策略的语义；后者不应作为严格预检的活跃资源差异。

## 范围

- Bug 反馈与建议空间的 `create`、`update`、`publish` 保持“所有登录用户可用”的既有产品策略；`delete` 仍仅管理员可用。
- Wiki 页面统一判定合并其直接空间的有效 access ACL grant，保持既有“空间 ACL 或页面 ACL 任一命中”写权限语义。
- strict preflight 仅统计活跃资源的最新差异，已删除或不存在的测试资源观测不阻断切换。
- 使用真实 Shadow 会话验证 8 条观测不再构成 active diff；不执行 Rollback 或 Enforce。

## 非目标

- 不批量修改非测试 Wiki ACL、用户、角色、assignment、资源 owner 或历史内容。
- 不把 `member` 的功能权限扩展为 `wiki:delete` 或 `wiki:publish`，不降低 Release Notes 的只读策略。
- 不删除观测审计记录、清空 Redis/会话或重置任意存储卷。

## 结论

Java 21 定向测试、当前分支 Shadow backend 及真实 API 复验均通过：Bug 反馈页面的创建/编辑/发布为 200，删除为 403；既有普通 Wiki 页面读取为 200，Release Notes 为 403。strict preflight 的 `latestDecisionDiffs=0`、`unobservedPermissionGrants=0` 且 `eligible=true`。8 条历史观测均保留审计；未执行 Rollback 或 Enforce。

## 文件

- [SPEC.md](./SPEC.md)：实施合同与不变量。
- [VERIFICATION.md](./VERIFICATION.md)：L1-L3 验证矩阵。
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)：追加式执行记录。
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)：事件恢复入口。
