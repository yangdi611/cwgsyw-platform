# REM-P1-002 实施记录

## 2026-07-14：启动

- 状态：`IN_PROGRESS`。
- 基线：从 `lint-fix` 衍生的 `codex/fqa-016-membership-list-soft-delete`；当前 `development` 已包含该基线。
- GitNexus：`findUserIdsByGroup` upstream impact 为 `LOW`，直接调用者 `GroupMembershipService.findUsersByGroup`，二级调用者 `GroupController.getMembers`；无执行流程命中。
- 根因复核：组成员 Mapper 当前已经过滤 `is_deleted=false`；用户维度 `GroupMembershipService.list` 缺少等价谓词。
- 实际改动：`GroupMembershipService.list` 加入 `isDeleted=false`；`GroupMembershipServiceTest.listExcludesSoftDeletedMemberships` 断言 wrapper 的字段和值。
- L1：`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home PATH="$JAVA_HOME/bin:$PATH" mvn -q -Dtest=GroupMembershipServiceTest test`，PASS。
- 实施后 `detect_changes`：整体工作区含前序未提交测试，显示 14 文件/75 symbols/MEDIUM；本事件相关流程仅 `ListMemberships -> UserGroupMembershipVO`。不得将无关测试改动计入本事件提交。

## 2026-07-14：运行时复验准备与临时阻断

- 当前 backend 已使用本分支源码重新构建并启动，`GET http://localhost:8081/actuator/health` 返回 `{"status":"UP"}`；启动日志确认保留 Redis 会话，未递增全局 epoch。
- 尝试以历史 FQA 的默认管理员凭据登录仅返回 HTTP `401` / `用户名或密码错误`。该请求未生成 token、session、用户、组或 membership fixture。
- 未重置管理员密码、未查看或读取浏览器 cookie/local storage、未尝试直接写数据库或授权关系。
- 当时 `AC-003` 与依赖它的 `AC-004` 暂记 `BLOCKED`；未重置管理员、未读取既有浏览器会话。

## 2026-07-14：运行时复验完成

- 用户提供受控管理员凭据后，`superadmin` 登录成功；凭据未写入证据文件或文档。
- L2 API run：`REM_P1_002_20260714_172525_fqa016`。添加同一用户至 groups `20/21` 后，两组各有 1 名成员、用户 membership 列表有 2 条；移除非主关系后 group `21` 为 0、用户列表仅余 group `20`；移除主关系后 group `20` 和用户列表均为 0。证据：`test-results/REM_P1_002_20260714_172525_fqa016/REM-P1-002/api-lifecycle-result.json`。
- L3 API run：`REM_P1_002_20260714_172650_fqa016`。用户加入 group `22` 后经产品 API 软删除，组成员读取从 1 收敛为 0。证据：`test-results/REM_P1_002_20260714_172650_fqa016/REM-P1-002/soft-deleted-user-result.json`。
- 两个 run 均使用产品 API 删除用户、归档测试组；清理证据确认活动测试用户和活动测试组均为 `0`。
- L3 有效 scope 回归：`JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home PATH="$JAVA_HOME/bin:$PATH" mvn -q -Dtest=AuthorizationPersistenceIntegrationTest#effectiveAssignmentQueriesUseTheSameRuntimeContract test`，PASS。
- 结论：`AC-001..004` PASS，事件状态更新为 `CLOSED`；`AC-005` 仍由所有整改事件完成后的 L4 全量复验统一结算。
