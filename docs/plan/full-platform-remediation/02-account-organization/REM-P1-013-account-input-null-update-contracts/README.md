# REM-P1-013：账号与组织输入及显式清空合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-013` |
| 优先级 | P1 |
| 领域 | `02-account-organization` |
| 状态 | `VERIFIED` |
| 风险 | `MEDIUM` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

账号与组织 DTO 校验、数据库长度和显式清空语义不一致，空组名、非法邮箱、超长用户名或清空手机号会得到错误结果。

用户输入被误报为 500，或接口返回成功但旧资料仍保留。

## 追溯

- 缺陷：`BUG-FQA-015`、`BUG-FQA-044`、`BUG-FQA-085`
- 用例：`GROUP-CRUD`、`ACCOUNT-001`、`ACCOUNT-003`、`RBAC-002`
- 原始记录：`docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/FQA_20260712_0329_lintfix/defects.md`
- 原始证据：`test-results/FQA_20260712_0329_lintfix/` 下对应 case 目录；原证据保持只读。

## 边界

根因聚类：缺少 @Valid/@Email/@Size；MyBatis-Plus 默认 null 更新策略跳过显式清空字段。

范围：
- DTO 与数据库边界对齐
- 空白规范化与字段级 400 响应
- 为可清空字段实现显式更新语义
- 同步前端 maxLength 与提示

非目标：
- 不修改密码策略
- 不改变用户组生命周期
- 不迁移非冲突历史资料

结论：L1-L3 已通过；用户授权的隔离开发环境临时保留期覆盖已用于精确清理并恢复默认值，等待最终 L4。

文件导航：[SPEC](./SPEC.md) / [验证矩阵](./VERIFICATION.md) / [实施记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
