# REM-P1-006 验证与证据矩阵

## 验收映射

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | RBAC-006 | L1 定向 | `CustomPermissionEvaluatorTest`：`cmdb_model:write` 满足 canonical `update`，read 不满足 update | `PASS` |
| `AC-002` | RBAC-013 / RBAC-015 / FILE-016 / AI-004 / AUDIT-003 / BACKUP-003 / IPAM-008 | L2 根因聚类 | `REM_P1_006_20260715012447` Playwright：IP、审计、AI、备份、通知管理真实导航均通过 | `PASS` |
| `AC-003` | 边界 / deny / 无副作用 | L2 | 最小 `cmdb_instance:read + wiki:read + shared_file:read` 首页零 API 403；`cmdb_instance:export` deny 为 403；8 个临时用户/角色通过产品 API 逆序清理 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 后端 compile/定向测试、前端 lint/typecheck/build、当前分支容器重建及真实 API/UI 复验 | `PASS` |
| `AC-005` | GitNexus / cleanup / rollback | L3 | upstream impact 已记录；提交前待运行 staged `detect_changes`；回滚为 event commit 的 no-ff revert | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新发布候选 run | `PENDING` |

## 原始失败证据

历史结论位于 `defects.md` 的 `BUG-FQA-010`、`BUG-FQA-013`、`BUG-FQA-035`、`BUG-FQA-069`、`BUG-FQA-070`、`BUG-FQA-074` 章节及 `test-results/FQA_20260712_0329_lintfix/`。修复后证据必须新建目录，禁止覆盖首次失败截图、trace 或 result。

## 执行规则

- PASS：预期、持久化、副作用、权限、审计和清理全部一致。
- FAIL：任一原始路径仍失败、出现未解释 5xx/Console error 或产生数据残留。
- BLOCKED：缺少明确授权、外部配置、独占窗口或精确清理能力；写明责任方和解除条件。
- L1→L2→L3 顺序执行；L4 是共同发布门禁。
- 清理使用产品 API 逆序执行，只删除本次 runId 对象，核对 active/cleanup_failed 均为 0。

## 已执行证据

- L1：`mvn -q -DskipTests compile`；`JAVA_TOOL_OPTIONS='-Dnet.bytebuddy.experimental=true' mvn -q -Dtest=CustomPermissionEvaluatorTest,SharedFileControllerTest test`，均通过。Java 26 下后者开关是 Mockito/Byte Buddy 环境兼容措施。
- L2：`REM_P1_006_20260715012447` 以产品 API 创建 4 个最小角色和 4 个最小账号，完成首次账号设置后，通过 Playwright 从 `http://localhost` 的 Nginx 标准入口真实登录和点击。结果：`cmdb_wiki_files_home_zero_403`、`ip_pool_navigation`、`audit_navigation`、`ai_navigation`、`backup_navigation`、`notification_manage_navigation`、`export_deny` 全部 PASS；清理为 4 用户和 4 角色，失败数 0。
- L3：`npm run lint`（0 error，41 条既有 warning）、`npx tsc --noEmit`、`docker compose -f docker-compose.dev.yml build backend frontend`、`docker compose -f docker-compose.dev.yml up -d --no-deps backend frontend` 均通过；backend healthy，frontend 返回 HTTP 200。管理员会话导出为 200，显式可访问组内共享文件重命名为 200，均经产品 API 清理。
- 浏览器使用 `localhost` Nginx 入口；直接访问 `3001/api/*` 是 Next.js 404，属于开发拓扑而非权限结果，未作为产品复验入口。
