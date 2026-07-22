# REM-P2-013 实施合同

## 目标与不变量

关闭 `BUG-FQA-028`、`BUG-FQA-036` 的共同根因，交付“Workflow 活动历史与统计读模型 schema”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：历史活动返回 snake_case 而页面读 camelCase，统计 Map 也用 snake_case，导致完成节点显示进行中、统计为空或 NaN。

目标：流程追溯和运营统计失真。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：Service 直接返回 Map，没有稳定 DTO/JSON 命名合同。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java`、`backend/src/main/java/com/cwgsyw/platform/module/workflow/dto/**`、`frontend/src/app/(dashboard)/workflow/**`
- 范围：引入类型化活动与统计 DTO；统一 camelCase JSON；处理 null/zero duration；同步前端类型。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-028 原始路径通过。 |
| `AC-002` | BUG-FQA-036 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 运行/完成活动；有/无实例统计；duration null/zero；页面无空 key/NaN。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
