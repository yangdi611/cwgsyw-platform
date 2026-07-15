# REM-P1-020 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-062`、`BUG-FQA-063`；用例：`FILE-002`、`FILE-003`。
- 根因：Folder DTO/Controller/Service 生命周期不完整，树结构不变量与名称规范没有服务/数据库兜底。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：事件认领与影响分析

- 状态：`IN_PROGRESS`；基线：`lint-fix@cec39d8d9ffe151510b67283e2fe427f08dd05e1`；分支：`codex/rem-p1-020-shared-folder-crud-validation`；运行标识：`REM_P1_020_20260715_181500`。
- `SharedFolderService.createFolder`：LOW，1 个直接调用者（`SharedFileController.createFolder`），1 条创建流程；`deleteFolder`：LOW，1 个直接调用者；`FilesPage`：LOW，无上游调用。
- 授权边界：只复用现有 `shared_file:manage`/`shared_file:update` 及资源父级检查，不切换授权模式、不修改跨租户/非测试授权数据。
- 下一步：确认现有 Folder/ACL 继承模型后实现 rename/move、输入规范及测试。

## 2026-07-15：L1-L3 验证通过

- 用户确认合同：重命名使用 `shared_file:update`；移动需源目录和目标父目录均具 `shared_file:manage`；移动保留属主、ACL 行和 `aclInherited`，继承型目录改由新父级动态生效。
- 实现：新增 `PATCH /api/files/folders/{id}`、目录编辑 UI、`normalized_name` 迁移与根/子目录局部唯一索引；服务以租户树事务锁串行更新，拒绝空白、路径/控制字符、超长、规范名冲突、自环及后代环。
- 权限：重命名检查源父级 update；移动检查源父级 manage 和目标父级 manage，移动至根目录额外使用现有 ownerGroup/scope 创建判定；未修改授权模式或 ACL 数据。
- API runId `REM_P1_020_20260715102332`：rename/move 200；子目录环 400；同级重名 409；空白名 400；树回读一致，所有测试目录已由产品 DELETE API 逆序清理。
- UI runId `REM_P1_020_UI_20260715102815`：真实登录、共享文档树编辑入口、改名与选择目标目录后 PATCH 200 并显示成功反馈；临时目录已清理。
- 检查：Docker Java 21 构建、前端 typecheck、lint（0 error、41 条既有 warning）、diff 检查和测试编译通过。本机 Maven 运行受 Java 26 Mockito/Byte Buddy 兼容性阻断，未将其误记为产品回归。
- GitNexus 暂存 `detect-changes`：27 个符号、17 条共享文件目录/列表流程，风险 `CRITICAL`；逐项审查后均落在已批准的目录生命周期、权限消费者、树与创建流程范围。相对 `master` 的结果包含 1215 个历史文件差异，不能作为本事件范围证据。
