# REM-P2-020 实施合同

## 目标与运行时不变量

使流程统计与当前用户可读取的流程实例列表使用一致的定义和实例范围。

- 不放宽 `workflow:read` 或任何流程管理权限；
- 不修改或删除历史流程实例、定义、任务或审计；
- 保持已有流程统计 DTO 的 camelCase 字段、路由和状态含义；
- 统计读取不得产生业务、审计或授权副作用。

## 当前与目标

当前：`/api/workflow/instances/finished` 返回 4 条完成实例，其中 3 条不出现在 `/api/workflow/stats` 的任一统计项。

目标：每条可读取的运行或完成实例均归入其 `processDefinitionKey` 对应统计项；该项的 `totalStarted`、`runningCount`、`finishedCount` 与实例源数据一致。没有实例的定义可保留零值统计项，但不得掩盖有实例的历史定义。

## 预计修改与影响

- 候选符号：`WorkflowService.getProcessStats`、`WorkflowService.getAllProcessStats`、对应 Flowable 查询和测试。
- 实施前必须对每个实际改动符号执行 GitNexus upstream `impact`。
- 不修改前端，除非 API 响应在保持合同下仍无法呈现正确汇总。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | 已完成实例列表中的每个 definition key 都出现在全量统计中，且完成数相等。 |
| `AC-002` | 运行实例同样进入对应统计项，统计项总量等于运行数加完成数。 |
| `AC-003` | 空定义和不存在 key 的统计行为稳定，未产生 5xx 或伪造记录。 |
| `AC-004` | `workflow:read` 拒绝语义不变；统计读取无写入、审计或数据副作用。 |
| `AC-005` | L1 单测、L2 实例/统计对账、L3 当前分支容器和真实 UI/API 复验通过。 |
| `AC-006` | L4 `FLOW-013` 与受影响 `REPORT-003` 在最新集成基线复验通过。 |

## 回滚与停止

回滚仅撤回本事件提交。若修复需要改写 Flowable 历史、批量迁移、全局授权切换，或统计口径存在未批准产品语义冲突，停止并请求用户决定。
