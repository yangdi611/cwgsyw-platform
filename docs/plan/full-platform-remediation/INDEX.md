# 全平台整改事件索引

更新时间：2026-07-14
来源测试运行：`FQA_20260712_0329_lintfix`

## 当前队列

| ID | 优先级 | 事件 | 根因聚类 | 源缺陷 / 用例 | 状态 | 风险 | 下一门禁 | 事件目录 | Claude Code |
|---|---|---|---|---|---|---|---|---|---|
| `REM-P0-001` | P0 | membership 移除后 group assignment 失效 | 授权关系生命周期与运行时有效性漂移 | `BUG-FQA-017`；`RBAC-026`；`XL-RBAC-002/006/009` | `CLOSED` | `CRITICAL` | groups `11..15` 已经产品 API archive；`AC-012` 复跑 `10/10 PASS`。L4 `275+78` 仍是独立发布候选版门禁 | [事件卡](./01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/README.md) / [最终总结](./01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/FINAL-SUMMARY-REPORT.md) | [第三轮返修 Prompt](./01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/CLAUDE-CODE-REWORK-ROUND3-PROMPT.md) |
| `REM-P1-001` | P1 | 可审计用户组归档、恢复与清除能力 | 组织对象缺少生命周期与引用收敛合同 | `REM-P0-001 / AC-012`；groups `11..15` | `CLOSED` | `HIGH` | `AC-001..021` 全部 PASS；历史 session incident 已披露并经用户接受，session epoch 修复及重启不变性复验通过。L4 `275+78` 仍为独立发布门禁 | [事件卡](./02-account-organization/REM-P1-001-auditable-group-lifecycle/README.md) / [PRD](./02-account-organization/REM-P1-001-auditable-group-lifecycle/PRD.md) / [SPEC](./02-account-organization/REM-P1-001-auditable-group-lifecycle/SPEC.md) | [执行 Prompt](./02-account-organization/REM-P1-001-auditable-group-lifecycle/CLAUDE-CODE-PROMPT.md) |

## 关联但未合并

| 来源 | 问题 | 处理原则 |
|---|---|---|
| `BUG-FQA-016` | membership 软删除后成员列表仍展示 | 与 `REM-P0-001` 用户表现相邻但根因是成员列表查询未过滤逻辑删除；后续登记独立事件，不混入 P0 授权修复。 |

## 状态统计

| 状态 | 数量 |
|---|---:|
| `DRAFT` | 0 |
| `READY` | 0 |
| `IN_PROGRESS` | 0 |
| `VERIFYING` | 0 |
| `BLOCKED` | 0 |
| `CLOSED` | 2 |
| `ROLLED_BACK / SUPERSEDED` | 0 |

## 使用约定

- 新事件先复制 [_templates/remediation-event-template.md](./_templates/remediation-event-template.md) 和 [Claude Code prompt 模板](./_templates/CLAUDE-CODE-PROMPT.template.md)，再登记索引；禁止只建散落的单个 SPEC 文件。
- 状态变化时同时更新事件 `README.md`、`IMPLEMENTATION-RECORD.md` 和本索引。
- 源缺陷可以关联多个事件，但每个事件必须说明自己解决和不解决的边界。
- 同一事件可以覆盖多个失败用例；关闭时每个用例必须有独立验证结果。
