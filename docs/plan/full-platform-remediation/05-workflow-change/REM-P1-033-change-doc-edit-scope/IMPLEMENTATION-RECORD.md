# REM-P1-033 实施记录

2026-07-17 L4 创建组级 member 测试用户，完成正常首次设置后，用其真实会话更新 superadmin 创建的 runId 草稿 #226。请求返回 200，管理员回读标题已被改写。`ChangeDocService.update` 仅检查 tenant 与状态，Controller 仅检查 `change_doc:update`。文档、用户与授权均通过产品 DELETE 精确清理，关键词回读为零。

同日用户确认范围合同：普通成员仅本人；组长仅本组；`tenant` / `platform` scope 全租户。对 `ChangeDocService` 与 `ChangeDocController` 执行 GitNexus upstream impact；`get` 影响 21 个符号、3 条过程（HIGH），其余直接入口为 LOW。实现将 `SecurityUser` 传入所有 HTTP 读写入口，统一在服务层校验申请人当前主组与实际 `sys_group.leader_id`，并在数据库分页前为 list/search 施加同一范围。详情、快照、导出、邮件模板、AI、更新、提交、补交方案、删除、审批、整改清理和 CI link 均无旁路；工作流内部回调维持系统内部调用语义。

运行时复验使用 `FQA_REM_P1_033_1784253716`：组级 member（`groupScope=group`、`groupId=1`、含 `change_doc:read/update`）首次设置并重新登录后，对 superadmin 草稿 #227 的 `PUT` 返回 `404 RESOURCE_NOT_FOUND`；管理员回读标题未变。#227 与临时用户 #297 均经产品 DELETE 清理，文档与用户关键词查询 `total=0`。主代码 `mvn -DskipTests compile` 和容器镜像构建均通过。定向 Maven test 被既有 `OpsCalendarRuleServiceTest`、`OpsCalendarTaskServiceTest`、`GroupControllerGroupReferenceTest` 的 testCompile 错误阻断，未修改这些无关测试。

补充角色矩阵 `FQA_REM_P1_033_MATRIX_1784254029`：同组 owner #298 创建文档 #229；临时指定为管理组实际组长的 group-scope 用户 #299 更新成功，tenant-scope 用户 #300 更新成功，platform superadmin 更新成功。管理组原 `leaderId=2` 已经产品 API 恢复；#229 与 #298-#300 都经产品 DELETE 清理，文档/用户关键词查询均为 `total=0`。

`REM-P2-031` 合并后从 `lint-fix@cdf3c5ab` 恢复事件分支。Java 21 容器中的变更文档定向测试通过，当前分支 backend 已重建并健康。L4 `FQA0331784257338297137000` 的组级 member 对管理员文档 #231 的 GET、PUT、submit、AI 和 CI link 写入均返回 HTTP 404 / `RESOURCE_NOT_FOUND`；成员本人 #232 更新成功，管理员回读 #231 标题未变。member 没有 `change_doc:delete`，删除本人文档返回预期 403，管理员使用产品 DELETE 精确清理 #231、#232 与用户 #302，关键词回读均为零。事件达到 `VERIFIED`，待 no-ff 合并。
