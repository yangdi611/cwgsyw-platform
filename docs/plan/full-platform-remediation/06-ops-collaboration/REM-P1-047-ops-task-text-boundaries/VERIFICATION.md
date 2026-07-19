# REM-P1-047 验证与证据矩阵

| AC | caseId | 层级 | 证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | `OPS-004` create 255/256 | L1/L2 | Java 21 服务测试与真实 API：255 原样回读，256 HTTP 400 | `PASS` |
| `AC-002` | `OPS-004` update 255/256/blank | L1/L2 | 255 emoji 原样回读；空白/256 均 HTTP 400，详情不变 | `PASS` |
| `AC-003` | invalid zero-side-effect | L1/L2 | 单测证明创建无 mapper/group-lock/audit/notification 交互；真实更新失败前后审计数不变 | `PASS` |
| `AC-004` | title UI boundary | L1/L3 | `256/255` Unicode 计数、可见错误、任务 POST=0、pageerror=0 | `PASS` |
| `AC-005` | module/runtime/cleanup | L3 | 当前分支生产 build、容器、API/UI、active task=0、五类依赖=0、purge audit=1 | `PASS` |
| `AC-006` | same-run `OPS-004` | L4 | 合并后执行 | `PENDING` |

原始失败证据保留在 L4 run `FQA_20260718_2050_remp1038`，快照提交 `cff458729`；255 字符任务已通过 `REM-P1-044` 产品 API 清理，数据库只读核验活动 `OPS_GAP` 任务为 0，shared manifest 为空。

## L1-L3 复验记录

- L1：`maven:3.9-eclipse-temurin-21` 执行 `-Dtest=OpsCalendarTaskServiceTest test`，19/19 PASS；本机 Java 26 因 Mockito inline 不兼容在测试初始化阶段失败，不作为产品结果。
- 前端：`npm run typecheck` 与目标 `npx eslint src/components/ops-calendar/TaskFormDialog.tsx` PASS。
- L2/L3：`test/rem-p1-047-ops-task-text-boundaries.spec.js` 在当前分支生产容器上 2/2 PASS；证据输出 `/tmp/rem-p1-047-playwright`。
- Build：`docker compose -f docker-compose.dev.yml build --parallel backend frontend` PASS；backend Java 21 package、frontend 54 路由 build/typecheck PASS。仅以 `--no-deps` 替换两应用；backend digest `6d5cb304...` healthy，frontend digest `a56fe959...` running，网关 health UP。
- 模块聚类：`OpsCalendar*Test` 34 项中 33 PASS；唯一错误是未触及的 `OpsCalendarMaterialExportTest:45` 既有 Mockito `UnnecessaryStubbingException`。目标任务测试 19/19、模板/节假日/排班/规则测试均 PASS；未修改该无关测试。
- 清理：一次被工具短超时终止的 Playwright 进程留下任务 #36；通过 `REM-P1-044` 产品清理端点处理。最终 `active_task=0`、participant/checklist/log/link/notification=0；保留 1 条预期软删任务和 1 条 purge 审计。backend 最近日志无 ERROR、`DataIntegrityViolation` 或 value-too-long。
- GitNexus unstaged detect：11 tracked files、17 symbols、0 affected processes、LOW。提交前继续执行 staged 与 compare-to-master 检查。

PASS 要求 HTTP、持久化、UI、审计/副作用和清理全部一致；未解释 5xx/409、数据残留或部分覆盖均为 FAIL。L1-L3 通过前不得标记 `VERIFIED`，合并后 L4 通过前不得标记 `CLOSED`。
