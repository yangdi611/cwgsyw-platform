# REM-P1-065 验证记录

| 层级 | 命令 / 证据 | 结果 |
|---|---|---|
| L1 | Java 21：`ProcessBindingServiceLifecycleTest`、`WorkflowRuntimeFacadeGroupReferenceTest`、`WorkflowControllerCompatibilityTest`、`WorkflowTemplateServiceLifecycleTest` | PASS，18/18 |
| L2 | Java 21：Workflow、Daily、Wiki 全聚类 | PASS，167/167 |
| L3 build | `docker compose -f docker-compose.dev.yml build backend frontend`；只替换 backend/frontend | PASS；后端/前端生产构建成功，backend/Postgres healthy，HTTP 200，Flyway V79 applied |
| L3 runtime | `FQA_BASE_URL=http://127.0.0.1 npx playwright test test/rem-p1-065-workflow-binding-lifecycle.spec.js --workers=1 --output=/tmp/rem-p1-065-playwright-final` | PASS，1/1；5.7 秒；Console/5xx 为 0 |
| Cleanup | 事件 `test-data-manifest.json` 与只读 PostgreSQL 核对 | PASS；manifest `objects=[]`、`cleanupFailures=0`，活动 binding/定义/实例/用户/角色均为 0 |

## 首败证据

- `test/l4-workflow-binding-lifecycle-current-run.spec.js`
- `/tmp/fqa-2050-flow010-failure/result.json`
- 控件：create `1`、edit `0`、enable/disable `0`、delete `0`。
- 产品写入 `0`；现有 daily/wiki bindings 未变化；Console/5xx 和 cleanup failure 均为 0。

## 验收结论

| AC | 结果 | 证据 |
|---|---|---|
| AC-001 | PASS | 唯一自定义 businessType 创建 v1 binding，API/UI readback 与精确版本一致。 |
| AC-002 | PASS | UI 编辑切换 v2；先前启动的 v1 实例在切换、停用和删除后仍保持运行。 |
| AC-003 | PASS | UI 停用后 readback disabled；挂起定义重启用返回 409 且无部分写入，激活后重启用成功。 |
| AC-004 | PASS | UI 删除确认/取消、重复删除 404、软删后同 businessType 新建活动 binding 均通过。 |
| AC-005 | PASS | 不存在定义返回 400 且无 binding；挂起定义拒绝重启用且状态不变。 |
| AC-006 | PASS | 管理员 UI 编辑/启停/删除可用；只有 workflow:read 的账号 API 403、直达页面回首页。 |
| AC-007 | PASS | bind/enable/disable/delete 审计可查；软删元数据完整；产品 API 逆序清理与 manifest 0/0。 |

## 运行时安全核对

- 测试仅创建自定义 `businessType=rem_p1_065_*`，没有修改 daily/wiki/change/device 正式 binding。
- 最终只读核对：活动 runId binding `0`，定义 `0`，运行实例 `0`，用户 `0`，角色 `0`。
- 六条测试 binding 墓碑均满足 `is_deleted=true`、`deleted_at/deleted_by` 非空；它们是批准合同要求的审计历史，不是活动残留。
