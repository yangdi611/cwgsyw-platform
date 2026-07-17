# REM-P1-033 验证矩阵

| AC | 检查 | 结果 |
|---|---|---|
| AC-001 | 普通成员编辑本人/他人/跨组文档 | PASS（他人草稿 `PUT` 返回 `404 RESOURCE_NOT_FOUND`，管理员回读无写入） |
| AC-002 | 组长、tenant、platform scope 的读写删除提交边界 | PASS：真实同组临时组长、tenant scope 和 platform scope 均成功更新同一 owner 文档；原组长已恢复 |
| AC-003 | CI link、导出、审批及状态机无越权旁路 | IMPLEMENTED：所有 Controller 外部入口改经统一校验；待完整角色夹具复验 |

## 本轮证据

- `mvn -q -f backend/pom.xml -DskipTests compile` 通过；Docker backend 镜像构建并健康启动。
- runId `FQA_REM_P1_033_1784253716` 的 member 真实会话越权更新 #227 返回 HTTP 404 / `RESOURCE_NOT_FOUND`；管理员回读标题保持原值。
- #227 与用户 #297 仅用产品 DELETE 清理，文档及用户关键词回读均为 `total=0`。
- runId `FQA_REM_P1_033_MATRIX_1784254029`：同组 owner #298、临时实际组长 #299、tenant #300 与文档 #229 完成更新范围矩阵；临时组长、tenant 和 platform 更新均为 HTTP 200。管理组原 `leaderId=2` 已恢复，所有 runId 用户和文档均精确删除且关键词为零。
- 定向 Maven tests 未运行：仓库既有 testCompile 错误位于 `OpsCalendarRuleServiceTest`、`OpsCalendarTaskServiceTest` 和 `GroupControllerGroupReferenceTest`，与本事件无关；不得据此将事件标为 `VERIFIED`。

已知复现：runId 组级 member 用户以 `change_doc:update` 对 superadmin 草稿 `PUT` 返回 200 并改写标题；对象已产品 API 清理。
