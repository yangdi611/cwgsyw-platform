# REM-P1-050 实施记录

## 2026-07-19：认领、影响与实现

- 分支 `codex/rem-p1-050-ops-cross-group-assignee-candidates`，基线 `lint-fix@dd447b55`，runId `REM_P1_050_20260719`。
- L4 snapshot `af5b36c4`；API 正确接受跨组 assignee，真实 `TaskFormDialog` 候选缺失；全部任务/RBAC 夹具产品 API 清理为零。
- GitNexus：`TaskFormDialog` LOW（1 direct/2 total/1 UI flow）；Controller/Service class LOW；`createManual` MEDIUM（9 direct，主要测试），`update` LOW（3 direct），0 flow。业务用户枚举与资格风险按 HIGH 告警后在批准的 `OPS-007` 合同内继续。
- 实现：新增权限保护的最小候选端点，前端不再复用通用用户管理列表；create/update 在写入前统一验证所有任务人员存在、同租户且启用。
- Java 21 定向测试、前端 typecheck 和目标 eslint PASS。

## 2026-07-19：L1-L3 复验与清理

- Java 21 受影响聚类 35/35 PASS；完整 Ops Calendar 52 项中 51 PASS，唯一 ERROR 是未修改 `OpsCalendarMaterialExportTest:45` 的历史 Mockito unnecessary stub（`a37f4709`），未作为通过结论。
- frontend 本机生产 build、backend/frontend Docker build PASS；只替换当前分支 backend/frontend，backend healthy，启动无 ERROR/Exception、无 migration、会话 epoch 未递增。
- 事件 Playwright 首轮 API 合同均通过，但错误使用未关联的视觉 label 定位标题导致 60 秒超时；finally 被总时限中止后，按 manifest 通过产品 API完成剩余对象清理，核验 activeUsers/activeRoles 均为 0。随后改用真实 placeholder、原子 manifest 和创建响应即时登记。
- 最终 `/tmp/rem-p1-050-ops-assignee-candidates-rerun` 1/1 PASS：跨组候选、四字段、read-only 403、非法 ID 400、真实 UI 创建与 assignee 读回、Console/5xx=0；任务、assignment、用户、角色全部产品 API 清理，manifest 空、cleanupFailures=0。
- GitNexus `detect_changes(scope=all)`：5 个变更符号、13 个事件文件、0 affected process、LOW，均为 Controller/Service/ServiceTest/TaskFormDialog 预期范围。`compare master` 因 `lint-fix` 长期累计差异显示 1536 文件、295 flows、CRITICAL，不代表本事件增量；提交以精确 staged detect 再确认。
- 回滚仅删除专用端点、Service 资格校验、DTO 与前端候选切换；无 schema、迁移或数据 restore。
