# 文档管理员系统 Wiki 访问调整

## 范围

- 允许具有有效 `doc_admin` assignment 的用户管理 `write_scope=all` 的系统 Wiki 空间及其页面。
- 保持 `write_scope=none` 和 `super_admin_only` 的系统空间只读；系统手册和 Release Notes 继续只能由 `WikiManualSeeder` 更新。
- 严格预检不将锁定系统资源的历史 Shadow 写入拒绝视为 Enforce blocker，审计记录保持不变。

## 非目标

- 不改变系统空间的 seed 内容来源或 `manifest.yaml` 同步。
- 不给予文档管理员跨资源的隐式通用权限。
- 不删除或改写 `authorization_decision_diff` 历史记录。

## 验证

- 文档管理员可在 `write_scope=all` 系统空间执行允许的资源操作。
- 文档管理员仍不能修改或管理锁定系统空间。
- 预检继续阻断活动资源的真实 Shadow 差异，但忽略锁定系统资源的预期拒绝。

## 回滚

- 回滚应用代码即可恢复现有系统空间策略；无需数据迁移或数据回写。
