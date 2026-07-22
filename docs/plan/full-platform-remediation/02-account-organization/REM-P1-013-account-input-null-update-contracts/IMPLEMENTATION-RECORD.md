# REM-P1-013 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`。
- 规划基线：`lint-fix@842dc84f`。
- 来源缺陷：`BUG-FQA-015`、`BUG-FQA-044`、`BUG-FQA-085`；用例：`GROUP-CRUD`、`ACCOUNT-001`、`ACCOUNT-003`、`RBAC-002`。
- 根因聚类：缺少 @Valid/@Email/@Size；MyBatis-Plus 默认 null 更新策略跳过显式清空字段。
- GitNexus：索引已刷新至当前规划基线并完成领域 query；尚未编辑业务符号，因此未伪造逐符号 impact 结果。
- 代码、数据、容器：未修改、未启动、未创建测试对象。
- 下一步：认领独立分支后读取本事件全部文档，对候选符号逐项执行 upstream impact，再从 `AC-001` 开始。

## 追加规则

后续只追加状态变化、实际文件/符号、impact、提交/diff、测试命令、证据、清理、回滚和剩余风险；不得覆盖历史记录。

## 2026-07-16：实施与清理阻塞

- 分支：`codex/rem-p1-013-account-input-null-update-contracts`，基线 `lint-fix@2b47258`。
- GitNexus upstream impact：GroupController create/update、UserController update、UserService create、AccountService updateProfile、三个前端表单均为 `LOW`；直接消费者最多 1 个，无 HIGH/CRITICAL 授权风险。
- 修复：Group 请求改为 DTO + `@Valid` + 64/255 长度边界；用户 DTO 对 username/email/realName 加入数据库一致的长度与 email 校验，更新 Controller 启用 `@Valid`；账户资料更新用显式列写入以支持 `phone=""` 清空为 null，并每次重算 `profileCompleted`；前端同步输入 `maxLength`。
- L1-L3：空/超长组名、非法 email、超长 username 均 400；手机号设置后清空请求 200，后续 GET 不含 phone（null）且 `profileCompleted=false`；前端限制和 Console=0 已真实浏览器验证；后端 compile、前端 typecheck/ESLint、当前分支 Docker frontend/backend build 均通过（现有 React Hook Form compiler warning 未新增）。
- 清理：所有 runId 用户均通过产品 DELETE API 删除。有效组 fixture `REM_P1_013_GROUP_1784137960396_u` 已归档，所有 active/historical 引用为 0，但 purge preflight 返回 `GROUP_PURGE_RETENTION_NOT_MET`，`purgeEligibleAt=2026-08-14T17:52:40.713814`。
- 状态：`BLOCKED`。禁止直接 SQL/数据库删除，也不得未经用户授权调整测试环境全局 `GROUP_LIFECYCLE_PURGE_RETENTION_DAYS`。恢复方式：等待保留期届满后仅通过产品 purge API 清理；或用户明确授权隔离开发环境的临时保留期调整，完成 purge 后恢复原配置、重建 backend 并重做清理核验。

## 2026-07-16：授权清理完成

- 用户明确授权仅隔离开发环境临时将 `GROUP_LIFECYCLE_PURGE_RETENTION_DAYS=0`；后端健康后，产品 preflight eligible，产品 purge API 删除 group id `26` 返回 200。
- 立即以 `GROUP_LIFECYCLE_PURGE_RETENTION_DAYS=30` 重建 backend 并确认健康。用户、active group、archived group 的 `REM_P1_013` 查询均为 0。
- `detect_changes --scope all`：13 files、15 symbols、0 affected process、LOW；状态解除为 `VERIFIED`，等待 L4。
