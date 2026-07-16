# REM-P2-010 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WIKI-001 | L1 | `WikiManualSeederTest` 合同、运行库系统空间/seed page 只读核对 | `PASS` |
| `AC-002` | 系统空间 seed | L2 | 3 个系统空间、49 个已发布 seed 页面、56 个 seed 版本；重启日志为 0 页更新 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 只读页面创建 `403`、非空系统空间删除 `409`、同名用户空间未覆盖、个人排序刷新持久且已恢复 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支容器健康；真实登录 `/wiki` 与 `/wiki/5`；Console error=0 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | GitNexus impact/detect、`runs/REM_P2_010_20260716/result.json`、无产品测试数据 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-078` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。

## 2026-07-16 L1-L3 运行时证据

- `WikiManualSeeder.run` 的 GitNexus upstream impact 为 LOW（0 个直接调用者）；`WikiSpaceService.hasWritePermission` 为 HIGH（24 个直接调用者、52 个受影响符号），因此未改变其逻辑，只验证既有只读拒绝合同。
- 当前分支 backend 启动日志记录：`平台使用手册` 16 页、`Release Notes` 29 页、`Bug 反馈与建议` 4 页，共 49 页且 0 页有更新。只读数据库核对为 3 个未删除的 system seed 空间、49 个已发布 seed 页面、56 个 seed 版本。
- 真实 API 复验通过：`/api/wiki/spaces` 返回 3 个 system 空间；对 `write_scope=none` 的空间创建页面返回 `403`；删除非空系统空间返回 `409`。浏览器登录后 `/wiki` 显示“官方手册”和 3 个空间；进入 `/wiki/5` 后新建/编辑按钮均为 0、Console error=0。
- 在团队空间中执行可逆“下移→刷新→上移→刷新”验证：刷新后顺序保持，最后恢复初始顺序；未创建产品对象，也未变更授权。结果见 `docs/acceptance/full-platform-exhaustive-functional-test-v1.0/runs/REM_P2_010_20260716/result.json`。
- `mvn -q -Dtest=WikiManualSeederTest test` 在既有无关 testCompile 错误前被阻断（`OpsCalendarRuleServiceTest`、`OpsCalendarTaskServiceTest`、`GroupControllerGroupReferenceTest`）；`mvn -q -Dmaven.test.skip=true clean package` 通过。
