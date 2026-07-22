# REM-P1-025 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | FLOW-005 | L1 | Java 21 容器：`WorkflowTemplateServiceLifecycleTest`、模板生成/校验测试通过 | `PASS` |
| `AC-002` | BUG-FQA-049 | L2 | API 创建、删除、列表归零、重复删除稳定 400 | `PASS` |
| `AC-003` | 边界 / deny / 零副作用 | L2 | 绑定、运行、历史引用均服务层拒绝；不存在/重复删除返回 400 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端与前端镜像构建、健康检查、真实浏览器确认删除通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | impact MEDIUM；runId 对象通过产品 API 清理，剩余数为 0 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据为 `BUG-FQA-049` 对应章节。PASS 要求行为、持久化、权限、审计、清理全部一致；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理为 BLOCKED。禁止覆盖历史证据。

## 本次运行记录

- 运行时间：2026-07-15；环境：当前事件分支 Docker 后端 `http://localhost:8081`、Nginx 用户入口 `http://localhost`。
- API：未绑定且未启动的 runId 模板实例创建后删除返回 200、列表过滤为 0；重复删除和不存在 ID 均返回 400。
- UI：隔离 Playwright 从登录页创建 runId 模板实例，在 `/workflow/templates` 点击“删除”、确认对话框后行消失；API 复核剩余为 0，控制台 error 为 0。
- 引用保护：定向服务测试证明启用绑定、运行实例、历史实例三种状态均拒绝删除且不删 deployment、不更新模板实例。
