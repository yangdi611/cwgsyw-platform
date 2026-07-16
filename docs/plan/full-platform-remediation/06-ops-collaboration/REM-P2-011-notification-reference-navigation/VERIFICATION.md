# REM-P2-011 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | NOTICE-002 | L1 | `getNotificationTargetHref` 支持全部现有 producer refType；解析页按已知类型路由 | `PASS` |
| `AC-002` | Wiki / 变更 / 日报 / CI / 运维任务 | L2 | Wiki、运维任务真实解析；其余类型复用同一已有详情端点的解析合同 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 删除 Wiki 目标、未知类型均为中性不可用状态；无目标详情、无读状态或投递副作用 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支 frontend 容器重建；真实登录、通知点击、任务抽屉与浏览器复验 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | GitNexus impact/detect、`runs/REM_P2_011_20260716/result.json`、无测试数据 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-025` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。

## 2026-07-16 L1-L3 运行时证据

- `getHref` 的 GitNexus upstream impact 为 LOW：直接调用者仅 `NotificationItem`，再上层为 `NotificationsPage`。`NotificationService.notify` upstream 为 CRITICAL（11 个直接调用者、17 个受影响符号），故保持投递端不变。
- 目标解析页仅调用既有、受权限保护的详情 API：Wiki 读取返回 spaceId 后进入页面；CI 读取返回 modelCode 后进入实例详情；变更、日报和运维任务在成功读取后进入既有详情路由。无新增后端接口、权限或数据模型。
- 当前分支 frontend 容器构建后，真实登录从通知中心点击既有 Wiki 通知进入 `/wiki/8/54`；`ops_task=9` 进入 `/ops-calendar?taskId=9` 并打开任务抽屉；两个成功路径 Console error 为 0。
- 已删除 Wiki 页面与未知类型均显示“通知目标不可用”，目标详情未泄露。删除目标的既有受保护详情 API 返回预期 `404`，被解析页消费为中性状态；不是 5xx 或未解释业务错误。
- `npx eslint`（变更文件）、`npm run typecheck`、`npm run build` 通过；未创建产品测试对象、未修改通知已读状态、授权或投递记录。详见 `docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/REM_P2_011_20260716/result.json`。
