# REM-P1-025 实施合同

## 目标与不变量

关闭 `BUG-FQA-049` 的共同根因，交付“Workflow 模板实例可审计清理生命周期”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：Workflow 模板可以创建实例，但没有 delete/unbind/archive 清理入口。

目标：测试和管理员操作会永久留下模板实例，阻断可重复验收和生命周期治理。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：WorkflowTemplateController/Service 只实现创建与读取，没有引用检查、删除或归档事务。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/workflow/template/**`、`frontend/src/app/(dashboard)/workflow/templates/**`
- 范围：定义模板实例 archive/delete 合同；检查 runtime/history/binding 引用；提供确认、审计和 UI 操作；支持 runId 精确清理。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-049 原始路径通过。 |
| `AC-002` | 全部子路径 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 空实例删除/归档；有引用阻断；重复操作幂等；UI 确认与审计。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
