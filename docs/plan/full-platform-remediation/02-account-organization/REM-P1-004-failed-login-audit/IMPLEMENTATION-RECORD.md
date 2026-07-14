# REM-P1-004 实施记录

## 2026-07-14 至 2026-07-15：实施与验证

- 状态：`VERIFIED`，待提交、合并与最终 L4 全量 FQA。
- 隔离工作树：`/Users/byron/AI/cwgsyw-platform/.worktree/fqa-006-failed-login-audit`。
- 基线：`lint-fix`；主工作区存在并发 agent 工作，未在主工作区切换、暂存或修改文件。
- GitNexus：`AuthController.login`、`AuthService` 与 `recordAuth` upstream impact 均为 LOW；`recordAuth` 的两个直接调用点为认证登录与登出。最终 `detect_changes` 显示 3 个文件、7 个符号、LOW、无 execution process。
- 根因：错误密码分支虽然调用审计写入，但因 `AuthService.login` 的事务随后因认证异常回滚，审计记录未持久化；空字段被 Controller `@Valid` 在服务调用前拦截，也未写审计。
- 实现：Controller 用 `BindingResult` 保持业务码 `400` 合同并调用 `AuthService.recordFailedLoginValidation`；新增独立事务的 `AuthAuditService`，仅负责 `login_failed` 的持久化，不改变成功登录或登出审计的事务语义。记录只写固定说明、来源 IP 和通用主体，不读取或写入密码/token。
- L1：`mvn -q -Dtest=AuthControllerTest,AuthServiceTest test` PASS。
- L2/L3：以工作树绝对路径构建并启动 backend，健康检查 `UP`。错误密码为 HTTP `401`、空请求为 HTTP `200`/业务码 `400`、成功登录为 HTTP `200`；数据库最新三条 auth 审计依次为 `login_success`、校验失败 `login_failed`、错误密码 `login_failed`。错误密码测试字符串未出现在审计备注中。
- 未创建、更新或删除业务 fixture；共享开发数据库仅新增本次登录审计事实。
- 下一门禁：`AC-005` 发布候选版全量 FQA；完成后才可作为发布放行依据。
