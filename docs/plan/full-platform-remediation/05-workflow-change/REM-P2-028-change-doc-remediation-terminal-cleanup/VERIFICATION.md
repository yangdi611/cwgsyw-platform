# REM-P2-028 验证矩阵

| AC | 层级 | 检查 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1 | 编译受限端点、事务清理与审计写入 | PASS | `backend: mvn -Dmaven.test.skip=true package` 通过。 |
| AC-002 | L2 | 真实会话创建带 `REM-P2-028-20260717-positive` 的文档 #212，提交为 `plan_pending`；错误 runId 删除返回 400，随后 GET 仍为 200 | PASS | 当前分支容器 API 回读。 |
| AC-001 | L2 | 正确 runId 删除 #212 返回 200，随后 GET 返回 400 不存在 | PASS | 当前分支容器 API 回读；未使用 SQL、卷或 Redis 清理。 |
| AC-003 | L2 | 已审批文档 #2 调用受限端点返回 409 | PASS | 文档仍存在；未触及归档资产。 |
| AC-004 | L2 | L4 旧残留 #211 由受限端点清理，模板 #8 随后通过既有产品 DELETE 清理 | PASS | 用户明确授权后执行；对象现为零残留。 |

## 发布门禁

原始 `CHANGE-005` FAIL 必须保留。事件提交 no-ff 合并到 `lint-fix` 后，重新建立 L4 分支并以实际 UI/API 走完日期输入、终态处理和零残留检查；只有追加 `REVERIFY PASS` 后，才允许继续 `CHANGE-006`。
