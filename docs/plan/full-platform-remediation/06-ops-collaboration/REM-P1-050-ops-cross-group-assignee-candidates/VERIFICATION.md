# REM-P1-050 验证与证据矩阵

| AC | 层级 | 证据 | 结果 |
|---|---|---|---|
| `AC-001` | L1-L3 | 候选 API + 跨组 UI 选择/创建 | `PASS` |
| `AC-002` | L1-L3 | 最小字段与 read-only 403 | `PASS` |
| `AC-003` | L1/L2 | 资格校验、非法 ID 零写入 | `PASS` |
| `AC-004` | L2/L3 | 无负责人回归、UI Console/5xx | `PASS` |
| `AC-005` | L1-L3 | build/runtime/cleanup/detect | `PASS` |
| `AC-006` | L4 | same-run `OPS-007` affected-only | `PENDING` |

原始失败：snapshot `af5b36c4`；`/tmp/fqa-2050-ops-role-scope-complete-after-rem-p1-049/.../trace.zip`；API 接受跨组负责人，UI 候选缺失。shared manifest `objects=[]`、`cleanupFailures=0`。

## L1-L3 结果

- L1：Java 21 `OpsCalendarTaskServiceTest` 30/30 PASS；覆盖跨组成功、missing/disabled/cross-tenant create 拒绝及 update 拒绝零写入。前端目标 ESLint、typecheck PASS。
- L2：`OpsCalendarTaskServiceTest` 30/30、`OpsCalendarVisibilityServiceTest` 3/3、`NotificationTargetResolverServiceTest` 2/2，共 35/35 PASS。完整 Ops Calendar 运行 52 项中 51 PASS，唯一 ERROR 为未修改的 `OpsCalendarMaterialExportTest:45` 历史 Mockito unnecessary stub（来源 `a37f4709`），不记 PASS。
- L3：frontend `npm run build`、backend Java 21 Docker build、frontend Docker build PASS；当前分支 backend image `sha256:657ce3e...` healthy，frontend image `sha256:5cb8c2a...` running。
- 真实 API/UI：`/tmp/rem-p1-050-ops-assignee-candidates-rerun`，1/1 PASS；create 身份看到跨组候选且响应仅 `id/username/realName/groupId`，read-only 403，非法 ID 400，真实 UI 选中跨组负责人并创建/读回一致，Console page error 和 5xx 均为零。
- 清理：首次 UI 定位超时后按 manifest 通过产品 API 收敛；最终通过轮任务、3 个 assignment、3 个用户、3 个角色均精确清理，manifest `objects=[]`、`cleanupFailures=0`，关键词核验 `activeUsers=0 activeRoles=0`。该首次超时不是产品失败。
