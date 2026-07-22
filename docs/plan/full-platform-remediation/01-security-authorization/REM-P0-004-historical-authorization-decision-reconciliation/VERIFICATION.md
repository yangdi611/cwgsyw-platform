# REM-P0-004 验证矩阵

| AC | 层级 | 验证 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1-L3 | 系统空间策略 allow/deny 定向单测与真实 API | PASS | Java 21 定向测试通过；Bug 反馈 create/update/publish 200、delete 403 |
| AC-002 | L1-L2 | 页面/空间 ACL 合并、缺功能权限拒绝 | PASS | `AuthorizationServiceTest` 覆盖页面空间 grant；`byron` 既有页面读取 200 |
| AC-003 | L1-L2 | 受限系统页面读取拒绝且不可枚举 | PASS | 受限页面 `GET /api/wiki/pages/127` 为 403，统一资源 mode 不再放行 |
| AC-004 | L1-L3 | active diff SQL 排除已删除资源 | PASS | `AuthorizationCutoverServiceTest` 通过；strict preflight `latestDecisionDiffs=0` |
| AC-005 | L3 | 当前分支容器、健康、清理、无 Enforce | PASS | Shadow backend health=UP；runId 页面产品 DELETE 200；未执行切换 |

所有运行时验证均使用当前事件分支构建的 Shadow backend；只通过产品 API 创建/删除 runId 对象。运行时证据：`test-results/FQA_20260717_1245_final_l4/REM-P0-004-historical-authorization-decision-reconciliation/result.json`。
