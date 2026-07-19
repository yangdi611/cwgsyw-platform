# REM-P1-049 验证与证据矩阵

| AC | 层级 | 证据 | 结果 |
|---|---|---|---|
| `AC-001` | L1/L2 | visibility + Service 早拒绝；真实跨组 group/sensitive API 400 | `PASS` |
| `AC-002` | L1/L2 | public/creator/participant/own-group/read_all 正向矩阵；assignee 由 L1 覆盖 | `PASS` |
| `AC-003` | L1 | Service 拒绝后详情 mapper 零交互 | `PASS` |
| `AC-004` | L3 | 当前 backend 真实 UI direct-id 400、标题不泄露、page error/5xx=0 | `PASS` |
| `AC-005` | L1-L3 | build/runtime/cleanup/detect | `PASS` |
| `AC-006` | L4 | same-run `OPS-006` affected-only | `PENDING` |

原始失败：L4 commit `c4a782ed`；`/tmp/fqa-2050-ops-role-scope-r3/.../trace.zip`；expected 400 / received 200。shared manifest `objects=[]`、`cleanupFailures=0`。

## 2026-07-19 L1

- Java 21：`OpsCalendarVisibilityServiceTest` 3/3、`OpsCalendarTaskServiceTest` 24/24、`NotificationTargetResolverServiceTest` 2/2，合计 29/29 PASS；failures/errors/skipped 均为 0。
- 命令：`docker run --rm -v "$PWD/backend:/workspace" -v "$HOME/.m2:/root/.m2" -w /workspace maven:3.9-eclipse-temurin-21 mvn -q -Dtest=OpsCalendarVisibilityServiceTest,OpsCalendarTaskServiceTest,NotificationTargetResolverServiceTest test`。
- 通知 resolver 使用纯单元回归：详情允许时返回 `/ops-calendar?taskId=...`；详情非枚举拒绝时返回 neutral unavailable，不创建缺少任务级产品清理接口的站内通知。

## 2026-07-19 L2-L3

- 生产 backend build PASS，最终镜像 manifest list `74d3b0beb01fd28ff35430116ee687faf2bc07c3b2fa493e3127d0cf5f25b1e0`；仅替换 backend，Docker health `healthy`、容器 actuator 与 gateway 均 `UP`。
- 完整 role/scope 聚类先通过原始 `OPS-006` 拒绝断言，后在无关 `OPS-007` 跨组候选 UI 假设超时；finally 精确清理为零，不作为本事件 PASS。
- 证据审计补跑前两次分别发现测试夹具空邮箱被 account setup 400 拒绝、脱敏 null 字段按 Jackson 合同被省略；两次均由 finally 清理至 manifest 空，未提升任何 AC 为 PASS。
- 修正夹具后，事件专属 `test/rem-p1-049-ops-task-detail-scope.spec.js` 1/1 PASS（10.5 秒），输出 `/tmp/rem-p1-049-runtime-audit-r3`，`.last-run.json.status=passed`。跨组 private/group-sensitive 拒绝；public 基础字段可达但正文/参与人/清单/链接/日志脱敏；creator、跨组 participant、own-group read_group、tenant/read_all 完整详情允许；真实 UI 不泄露拒绝任务标题/正文，public UI 不泄露正文，page error/5xx=0。
- 最终分支复验 `/tmp/rem-p1-049-runtime-final-r2` 1/1 PASS（10.0 秒）；动态对象 runId 与固定 manifest 所有者分离，全部 API/UI 断言和 finally 清理再次通过。
- 事件 manifest `objects=[]`、`cleanupFailures=0`；产品 API 读回 runId 用户/角色/任务均为 0；backend 近 15 分钟无 ERROR/Exception。
