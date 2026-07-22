# REM-P0-003 执行入口

在 `/Users/byron/AI/cwgsyw-platform` 的事件分支 `codex/rem-p0-003-shadow-create-observation` 完成唯一事件“Shadow 创建判定观测”。先完整读取根 `AGENTS.md`、`CLAUDE.md`、本目录五件套、总 `README.md`、`INDEX.md`、`REMEDIATION-CHECKPOINT.json` 和 L4 checkpoint。

仅修改 `AuthorizationService` 的创建兼容判定观测与相邻测试；编辑符号前必须 GitNexus upstream impact。Shadow 必须插入 `resource_type=create`、`resource_id=0`（创建型哨兵）的判定观测并保持 legacy 返回，Legacy/Enforced 不插入。不得改 ACL、assignment、cutover、数据库 schema 或非测试授权。

以 runId 对象通过产品 API 验证 Wiki 创建、共享目录创建、文件上传；按文件->目录->空间逆序精确清理。需要重置 byron 密码、Shadow 观测和后续 Rollback/Enforce 已获用户授权，但密码/token 不得写入文件或输出。完成 L1-L3、容器运行时复验、证据回写、GitNexus detect_changes 后才提交并 no-ff 合并到 lint-fix。
