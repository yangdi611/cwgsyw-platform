# REM-P1-024 实施合同

## 目标与不变量

关闭 `BUG-FQA-081`、`BUG-FQA-099` 的共同根因，交付“Workflow 定义版本与实例状态生命周期”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：删除定义声称删除全部版本却只删一个 deployment；挂起定义发起和实例终止异常又没有稳定业务合同。

目标：管理员无法确认定义是否真正清除，状态操作返回不可预测错误并遗留版本/实例。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：definitionId、process key、deployment 与 runtime/history 的生命周期边界未在 Service 统一，Flowable 异常直接外泄。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java`、`backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java`、`frontend/src/app/(dashboard)/workflow/**`
- 范围：明确并实现单版本/全版本删除语义；保护 binding 与运行实例；挂起定义发起前置校验；实例终止、审计和稳定 4xx 合同。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-081 原始路径通过。 |
| `AC-002` | BUG-FQA-099 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 多版本删除语义；有绑定/运行实例保护；挂起发起拒绝；实例终止与列表/历史刷新。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
