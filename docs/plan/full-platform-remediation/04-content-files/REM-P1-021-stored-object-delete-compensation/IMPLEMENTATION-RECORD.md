# REM-P1-021 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-053`；用例：`FILE-004`、`FILE-008`、`WIKI-011`、`WIKI-017`、`XL-WIKI-001`。
- 根因：业务记录删除与 StorageService.delete 缺少事务外补偿、幂等重试和可审计失败队列。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始，追加 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：事件认领与删除合同确认

- 状态：`IN_PROGRESS`；基线：`lint-fix@28b8ea6a3f3d9e9d7c1a2c0e9d9c3b54f5d706c4`；分支：`codex/rem-p1-021-stored-object-delete-compensation`；运行标识：`REM_P1_021_20260715_184000`。
- GitNexus：共享文件删除、Wiki 附件上传、Wiki 页面删除、存储删除均为 LOW；直接调用仅在当前共享文件/Wiki 控制器或测试范围内。
- 用户确认：同步删除；对象删除失败返回 `503` 并保留业务记录；新增附件 DELETE，并在页面删除时级联回收。不得清理历史对象或执行全桶扫描。
- 实现将使用页面附件的临时恢复副本保障多对象删除失败时的对象恢复，恢复副本仅在本次产品删除路径内创建和清理。

## 2026-07-15：实现、复验与结算

- 共享文件和 Wiki 附件删除均先建立仅本次操作可见的恢复副本；对象删除失败统一为 `STORAGE_DELETE_FAILED` / HTTP `503`，不软删记录。数据库事务未提交时从副本恢复对象；成功提交后清理副本。
- 新增 `DELETE /api/wiki/attachments/{fileId}`，要求既有 `wiki:update` 与页面 write ACL；删除页面会先回收其及后代页面附件，再软删页面。
- 运行时复验发现 `checkAcl(..., "write")` 错把 ACL 位映射为不存在的 `wiki:write` 功能权限；已最小修正为既有 `wiki:update`，影响分析为 MEDIUM（9 个 Wiki 调用方、1 条流程），读取仍映射 `wiki:read`，未放宽 ACL 或权限范围。
- L1/L2：Java 21 容器定向测试通过。宿主 Java 26 运行 Mockito inline 测试受 Byte Buddy 最高支持 Java 24 限制，已改用与后端一致的 Java 21 容器取得有效结果。
- L3：当前分支重建 backend 并健康；运行标识 `REM_P1_021_20260715111401` 验证独立附件删除 `200 -> 400` 与页面级联回收 `200 -> 400`。临时角色、用户、成员关系、空间、页面及附件均在 finally 中通过产品 API 清理，cleanup failure=0。
- 回滚：还原本事件提交即可恢复原删除语义；运行中产生的 backup key 在提交/回滚回调后均删除，不扫描、不删除历史孤儿对象。
