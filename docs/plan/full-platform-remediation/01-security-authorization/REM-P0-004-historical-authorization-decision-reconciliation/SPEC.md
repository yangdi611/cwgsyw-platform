# REM-P0-004 实施规格

## 分类与合同

| 类别 | 已观测差异 | 根因 | 修复合同 |
|---|---:|---|---|
| Bug 反馈空间 | `byron wiki:create wiki_space:7` | 系统空间策略在统一判定中仍要求普通 role assignment 覆盖资源位 | `write_scope=all` 对 create/update/publish 直接产生策略允许；delete 保持管理员限制 |
| 普通 Wiki 页面/空间 | `byron` 的 delete/publish 共 4 条 | 旧模型允许空间 ACL 与页面 ACL 任一命中；统一模型仅评估页面 access ACL | 页面判定合并其直接空间的有效 access grant，不能绕过功能权限、作用域或祖先 traverse |
| Release Notes | `byron wiki:read wiki_page:127` | 统一资源 mode 放行，旧页面 ACL 策略拒绝 | 保持旧的页面可见性策略；不得为了消除差异向 member 开放该受限页面 |
| 已删除 runId 资源 | `superadmin` 两条 | Shadow 审计历史仍保留，资源已被产品 API 删除 | 保留审计行；严格预检只统计活跃资源的最新差异 |

## 不变量

1. 功能权限与有效 assignment 仍是非系统策略资源的门票；ACL 不能绕过 `FUNCTION_PERMISSION_DENIED`。
2. `wiki:delete` 与 `wiki:publish` 不因 `wiki:update`、`wiki:create` 或空间 ACL 被暗中授予。
3. 仅 Wiki 页面从其所属空间合并 access ACL；共享文件和其它资源的 named-user、group、owner、others 语义不变。
4. 已删除资源的决策观测保留作审计，不回填、不删除；严格预检和实际资源迁移只评估活跃资源。
5. 不执行任何授权模式切换；成功标准是 Shadow 中 active diff 为零且无新副作用。

## 验收条件

- AC-001：Bug 反馈空间对具有最小登录身份的用户允许 create/update/publish，拒绝 delete；受限系统空间仍拒绝写。
- AC-002：有效 `wiki:delete`/`wiki:publish` 功能权限加空间 ACL 的页面操作在统一判定下允许；缺功能权限时仍拒绝。
- AC-003：Release Notes 等受限系统页面不因资源 mode 被非授权用户读取；不得产生可枚举泄露。
- AC-004：已删除 runId 的两个观测仍可审计但不计入 `latestDecisionDiffs`；活跃资源差异口径准确。
- AC-005：Java 21 L1、真实 Shadow API L2/L3、strict preflight、runId 测试对象清理均通过；不执行 Enforce。

## 回滚

撤销本事件代码提交即可恢复原 Shadow 比较行为；不涉及 ACL/角色/assignment 写入或历史审计删除。
