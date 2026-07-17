# REM-P1-033 验证矩阵

| AC | 检查 | 结果 |
|---|---|---|
| AC-001 | 普通成员编辑本人/他人/跨组文档 | PASS（他人草稿 `PUT` 返回 `404 RESOURCE_NOT_FOUND`，管理员回读无写入） |
| AC-002 | 组长、tenant、platform scope 的读写删除提交边界 | PASS：真实同组临时组长、tenant scope 和 platform scope 均成功更新同一 owner 文档；原组长已恢复 |
| AC-003 | CI link、导出、审批及状态机无越权旁路 | PASS：member 对详情、更新、提交、AI 和 CI link 写入口均为 `404 RESOURCE_NOT_FOUND`；本人更新成功且管理员文档无写入 |

## 本轮证据

- `mvn -q -f backend/pom.xml -DskipTests compile` 通过；Docker backend 镜像构建并健康启动。
- runId `FQA_REM_P1_033_1784253716` 的 member 真实会话越权更新 #227 返回 HTTP 404 / `RESOURCE_NOT_FOUND`；管理员回读标题保持原值。
- #227 与用户 #297 仅用产品 DELETE 清理，文档及用户关键词回读均为 `total=0`。
- runId `FQA_REM_P1_033_MATRIX_1784254029`：同组 owner #298、临时实际组长 #299、tenant #300 与文档 #229 完成更新范围矩阵；临时组长、tenant 和 platform 更新均为 HTTP 200。管理组原 `leaderId=2` 已恢复，所有 runId 用户和文档均精确删除且关键词为零。
- `REM-P2-031` 合并后，Java 21 容器中的 `TableFieldSupportTest`、`ExportServiceTest`、`ChangeDocTemplateLifecycleTest` 与 `ChangeDocTemplateServiceWordTest` 均通过。
- runId `FQA0331784257338297137000` 的当前分支 L4 复验：组级 member 对管理员文档 #231 的 `GET`、`PUT`、`submit`、`ai-generate` 和 `ci-links` 写入均返回 HTTP 404 / `RESOURCE_NOT_FOUND`；成员本人文档 #232 更新成功，管理员回读 #231 标题未变。成员无 `change_doc:delete`，本人删除返回预期 403；管理员随后通过产品 API 删除 #231/#232 与用户 #302，文档和用户关键词均为 `total=0`。

已知复现：runId 组级 member 用户以 `change_doc:update` 对 superadmin 草稿 `PUT` 返回 200 并改写标题；对象已产品 API 清理。
