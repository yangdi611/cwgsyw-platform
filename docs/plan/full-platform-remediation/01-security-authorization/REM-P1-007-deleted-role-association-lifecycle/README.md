# REM-P1-007：已删除角色关联读取与清理一致性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-007` |
| 优先级 | P1 |
| 领域 | `01-security-authorization` |
| 状态 | `VERIFIED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

角色软删除后，permissions 关联接口仍按 roleId 直接读取关系，泄露已删除对象的授权集合。

管理端无法判断角色是否真正删除，孤儿关系可能继续影响缓存、审计或兼容授权计算。

## 追溯

- 缺陷：`BUG-FQA-055`、`BUG-FQA-093`
- 用例：`RBAC-009`、`RBAC-018`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：RoleController/RbacService 的关联读取缺少租户、存在性和软删除校验；删除事务未形成明确的关系收敛合同。

范围：
- 统一角色存在性校验
- 明确 role-permission 删除或软删过滤策略
- 保护 Wiki 等共享 helper 的只读调用

非目标：
- 不改变角色 assignment 的业务模型
- 不恢复历史已删除角色
- 不扩展角色权限编辑功能

事件级结论：L1-L3 已通过；等待最终 L4 全量 FQA，不得提前标记 `CLOSED`。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
