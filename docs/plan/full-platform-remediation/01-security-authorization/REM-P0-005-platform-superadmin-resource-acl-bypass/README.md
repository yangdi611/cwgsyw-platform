# REM-P0-005：Platform 超级管理员资源 ACL 绕过

| 字段 | 内容 |
|---|---|
| 状态 | VERIFIED |
| 优先级 | P0 |
| 领域 | 安全与统一授权 |
| 分支 | `codex/rem-p0-005-platform-superadmin-resource-acl-bypass` |
| 基线 | `lint-fix@039502b4` |
| 来源 | 最终 L4 `FQA_20260717_1245_final_l4` Shadow 判定差异 |

## 问题

用户确认 platform 超级管理员应绕过 Wiki 与共享文件的资源 ACL。当前统一裁决虽确认其功能权限与 platform assignment，却仍在资源 ACL 与祖先 traverse 阶段拒绝，造成旧模型允许、Shadow 新模型拒绝，并阻断 strict preflight。

## 范围

- 仅有效 `super_admin@platform` assignment 在 Wiki、共享文件、共享文件夹资源上绕过资源 ACL 与祖先 traverse。
- 保留功能权限、有效 assignment、资源存在和迁移完整性检查；不能以 platform 用户身份绕过缺失的功能权限。
- 增加定向单测、当前分支 Shadow 运行时 API/UI 复验及 strict preflight 证据。

## 非目标

- 不扩大 tenant admin、document admin、break-glass 或普通 platform scope 角色的权限。
- 不修改任何非测试 ACL、角色、assignment、用户、资源内容或授权切换状态。
- 不删除历史 `authorization_decision_diff` 审计记录。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

## 结论

用户确认的 platform 超级管理员 ACL 绕过已实现并在当前分支 Shadow 容器中验证：受限 Wiki 页面与共享文件读取均为 200，strict preflight 的 `latestDecisionDiffs=0`、`eligible=true`。普通 platform 角色和缺功能 permission 的 platform 超级管理员仍拒绝；未执行授权模式切换或非测试授权数据写入。
