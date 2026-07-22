# REM-P1-022 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FILE-016 | L1 | Java 21 定向用例 `SharedFileControllerTest#updateFile_checksParentContainerPermission` 通过 | `PASS` |
| `AC-002` | FILE-017 | L2 | `REM_P1_022_20260715112010`：上传、`PUT /files/{id}` 重命名与 `GET /files/{id}` 元数据回读均 `200` | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | Controller 强制 `shared_file:update` 与父目录 write ACL；Service 使用规范名冲突 `409`、更新审计；临时文件经产品 API 删除 | `PASS` |
| `AC-004` | 受影响模块 | L3 | `REM_P1_022_UI_20260715113238`：真实 `/files` 页面搜索测试文件、点击重命名、保存并看到成功提示和更新列表；API 回读 `200` | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | `updateFile` impact LOW（0 调用方）；`renameFile` LOW（1 直接调用方）；临时文件 cleanup failure=0 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-077` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。

## 执行明细（2026-07-15）

- 既有实现复核：`SharedFileController.updateFile` 调用 `SharedFileService.renameFile`，要求 `shared_file:update` 与父资源 write ACL；Service 保持文件扩展名、规范名冲突 `409`，并写入 `shared_file/update` 审计；`frontend/src/app/(dashboard)/files/page.tsx` 已提供重命名对话框并调用 `PUT /api/files/{id}`。
- Java 21 精确用例通过。包含整个 `SharedFileControllerTest` 时，两个无关的文件夹更新用例因现有 mock 的 `operatorId` 期望为 `null`、实际默认 `0` 而失败；未修改无关测试或生产代码。
- UI 使用 Nginx 用户入口 `http://localhost/files`（`3001` 直连不代理 `/api`）完成真实点击。测试对象在 finally 中通过 `DELETE /api/files/{id}` 精确清理。
