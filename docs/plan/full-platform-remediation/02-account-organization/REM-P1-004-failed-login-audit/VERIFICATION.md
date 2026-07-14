# REM-P1-004 验证与证据矩阵

| AC | 用例 | 层级 | 结果 | 修复后证据 |
|---|---|---|---|---|
| `AC-001` | 错误密码失败审计 | L1/L2 | `PASS` | 定向 Maven 测试 PASS；工作树构建的 API 返回 HTTP `401`，数据库最新审计为 `login_failed` / `用户名或密码错误`。 |
| `AC-002` | 空字段失败审计 | L1/L2 | `PASS` | `AuthControllerTest`、`AuthServiceTest#validationFailureWritesGenericFailedLoginAudit` PASS；API 业务码保持 `400`，审计为 `login_failed` / `登录请求校验失败`。 |
| `AC-003` | 成功登录不回归 | L1/L2 | `PASS` | API HTTP `200` 且返回 token；同批最新审计仅有一条 `login_success`。 |
| `AC-004` | 审计可定位与 fixture 清理 | L3 | `PASS` | 使用共享开发库只读查询核对最新三条 auth 审计；未创建或删除业务 fixture，错误密码字符串在全部 auth 审计备注中的匹配数为 `0`。 |
| `AC-005` | 发布候选版全量验收 | L4 | `PENDING` | 最终 FQA run |

复验环境：2026-07-15，`backend` 由 `.worktree/fqa-006-failed-login-audit/backend` 绝对构建路径重建，健康检查为 `UP`。`detect_changes`：3 个文件、7 个符号、LOW、0 个受影响执行流程。

关闭条件：`AC-001..004` 已全部 PASS、未输出敏感值、`detect_changes` 仅影响预期认证/审计流程，且事件卡与索引同步；`AC-005` 始终保留为最终统一门禁。
