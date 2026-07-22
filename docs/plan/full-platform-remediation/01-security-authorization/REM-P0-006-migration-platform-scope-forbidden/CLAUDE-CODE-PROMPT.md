# REM-P0-006 执行入口

完成唯一事件 `REM-P0-006`。先读取根 `AGENTS.md`、整改 README/INDEX、事件五件套和 `AUTHZ-002` L4 失败记录。从本事件分支继续，不扩展其他事件。

只允许修复非 platform 迁移工作台 API 的标准 `403` 拒绝合同；禁止更改 permission、ACL、assignment、cutover、break-glass，禁止 Enforce/Rollback/backfill/异常迁移写操作。编辑前 GitNexus upstream impact，提交前 `detect-changes`。

完成 L1 编译、L2 group-scope deny + platform allow、L3 当前分支后端容器运行时复验，回写证据，提交并 no-ff 合并。合并后完整重置 L4。
