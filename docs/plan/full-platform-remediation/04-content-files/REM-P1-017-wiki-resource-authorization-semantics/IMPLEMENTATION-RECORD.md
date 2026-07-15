# REM-P1-017 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-045`、`BUG-FQA-058`、`BUG-FQA-067`、`BUG-FQA-089`；用例：`WIKI-002`、`WIKI-006`、`WIKI-022`、`WIKI-023`、`P-045`、`P-046`、`P-047`。
- 根因：Wiki resource adapter、统一 ResourceAccessService、ownerGroup 默认值与页面级 action 映射没有共享同一主体分类和存在性顺序。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：L1-L3 实施与复验通过

- 状态：`VERIFIED`；分支：`codex/rem-p1-017-wiki-resource-authorization-semantics`；运行标识：`REM_P1_017_20260715_161119`。
- 已落实产品决策：所有管理员创建 Wiki 空间必须显式选择归属组；组级用户固定会话当前组，提交的其他组 ID 由后端忽略；不切换全租户模式，也未修改非测试 ACL。
- 不存在页面或空间先返回 `RESOURCE_NOT_FOUND`（404），前端展示不可操作空状态；父页创建子页改为检查父页写权限，owner 可正常创建；仅会话当前组匹配 ownerGroup 时使用 group mode bits，其他成员关系无命名 ACL 时按 others 回退。
- GitNexus upstream impact：`WikiController.checkAcl#3` MEDIUM（9 直接调用方、1 Wiki 流程）、`checkSpaceRead#2` LOW（4）、`WikiPageService.createPage#3` LOW（3、1 流程）、`WikiSpaceService.createSpace#5` LOW、`AuthorizationService` MEDIUM（9）；无 HIGH/CRITICAL 符号级变更。
- 提交前 `detect-changes` 识别 17 个文件、28 个符号和 29 条流程，整体为 CRITICAL（统一授权与 Wiki 控制器入口）；受影响链路均为本事件预期范围，已以全量测试和浏览器/API 复验覆盖。
- 定向 Maven 测试、后端全量 Maven 测试、TypeScript 校验和前端 lint 均通过；浏览器/API 复验覆盖未选组拒绝、显式组创建、父子页、缺失资源 404 和精确清理。
- 回滚：revert 本事件提交即可恢复原有行为；未执行全局 Redis/session/卷清理，也未使用 SQL 删除测试数据。
