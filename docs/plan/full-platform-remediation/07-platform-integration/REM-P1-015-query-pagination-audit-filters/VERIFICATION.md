# REM-P1-015 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | AUDIT-001 | L1 定向 | 后端 Maven compile；前端 typecheck 与 audit 页 ESLint 通过 | `PASS` |
| `AC-002` | AUDIT-READ-FILTER / NOTICE-001 | L2 根因聚类 | 真实会话 API：审计 page 1/2 (size=2) 各 2 条、无重叠、`total=8808`；通知 `size=2` 返回 2 条、`total=32` | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | action、operatorId、keyword 和组合筛选均命中预期；不存在关键词返回 `records=0,total=0`；全部为只读请求，无测试数据 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前分支 Docker production backend/frontend build 通过且 backend healthy；CMDB models `size=1` 返回 1 条、`total=18` | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | upstream impact：MyBatisPlusConfig、AuditLogMapper.queryPage、AuditLogController.list、NotificationService.listByUser、AuditLogPageInner 均 LOW；提交前执行 `detect_changes` | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-023`、`BUG-FQA-024`、`BUG-FQA-040`、`BUG-FQA-054` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。

## 2026-07-16 L1-L3 复验记录

- L1：Docker Maven `-DskipTests compile`、`npm run typecheck`、审计页 ESLint 通过。
- L2：真实 superadmin 会话调用 `/api/audit-logs`、`/api/notifications`；分页、count、三类筛选、组合筛选和零结果全部通过。
- L3：由当前事件分支构建并替换 backend/frontend 容器，backend health 为 healthy；Playwright 容器完成登录、`/admin/audit` 真实页面加载、三控件可见、关键词请求参数及零结果状态验证，Console error 为零。复审额外修正旧实例历史查询在分页后内存过滤可能造成的空页；改为数据库按实例分页，重新构建 backend 并复验审计/通知分页。
- 环境说明：Nginx 到重建容器的临时 upstream 曾返回 503；页面复验改由隔离浏览器对当前 frontend 和 backend 端口进行同源请求转发，不改变产品数据或代码。
- 测试数据：未创建或修改任何业务对象；无清理操作。
