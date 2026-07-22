# REM-P1-019 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-065`、`BUG-FQA-066`、`BUG-FQA-068`、`BUG-FQA-100`；用例：`FILE-005`、`FILE-008`、`FILE-013`、`FILE-014`。
- 根因：前端 mutation、文件列表 query key、后端存储与数据库写入没有统一上传状态机和幂等/补偿协议。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：事件认领

- 状态：`IN_PROGRESS`；基线：`lint-fix@7067d0ba7d1559311860da0269cbb1b189cd06f6`；分支：`codex/rem-p1-019-shared-file-upload-lifecycle`；运行标识：`REM_P1_019_20260715_171000`。
- 预计范围：共享文件上传 Controller/Service、对象存储补偿、数据库唯一性或预检、文件列表失效与上传进度/取消 UI，以及相关测试和 API/UI 复验。
- 第一门禁：对候选上传与删除/补偿符号完成 GitNexus upstream impact，确认不触及非测试对象或 ACL 语义后再编辑。

## 2026-07-15：L1-L3 验证通过

- GitNexus：`uploadFileUnchecked`、`deleteFileUnchecked`、`renameFile` 和 `FilesPage` 为 LOW；`SharedFile` 为 MEDIUM，唯一约束因此只覆盖普通共享文件，不影响 Wiki/归档来源。
- 实现：新增 20MB 与扩展名白名单，规范名（NFC、trim、lowercase）冲突检查、PostgreSQL 事务咨询锁和普通共享文件局部唯一索引；写入失败或上传中断会精确回收新建对象，删除会先回收主对象及 Markdown 衍生对象。
- 修复：真实 API 首次暴露 MyBatis 无法把 advisory lock 的 `void` SELECT 映射为结果的 500，已改为可映射标量查询并用 Docker Java 21 构建重启后复验。
- API runId `REM_P1_019_20260715095407`：空文件/不支持类型 400、PDF 上传 200、大小写规范名冲突 409、删除后资源访问 403 且目录列表为空；测试文件和目录均通过产品 API 清理。
- UI runId `REM_P1_019_UI_20260715100334`：真实登录后进入共享文档、选目录上传 PDF，当前列表出现；确认删除后列表消失，临时文件与目录均已清理。
- 检查：Docker Java 21 构建通过；`frontend npm run typecheck`、`npm run lint`（0 error、41 条既有 warning）及 `git diff --check` 通过。本机 Maven 测试因 Java 26 与 Mockito/Byte Buddy 兼容性阻断，未将其误记为产品回归。
