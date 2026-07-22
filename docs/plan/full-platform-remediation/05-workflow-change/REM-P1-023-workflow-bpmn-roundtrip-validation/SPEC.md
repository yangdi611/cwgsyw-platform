# REM-P1-023 实施合同

## 目标与不变量

关闭 `BUG-FQA-021`、`BUG-FQA-084`、`BUG-FQA-104`、`BUG-FQA-105` 的共同根因，交付“Workflow BPMN 输入校验与设计往返完整性”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：流程 key/XML 无效输入返回 500，设计器保存后 name/category/description 与完整 BPMN 结构不能稳定重载，条件流命名空间又触发解析异常。

目标：用户无法可靠保存、部署、重开和继续编辑流程设计。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：SaveProcessDefinitionReq 缺 validation；设计器初始 XML/序列化命名空间与 Flowable deployment 元数据映射未形成可往返合同。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowController.java`、`backend/src/main/java/com/cwgsyw/platform/module/workflow/WorkflowService.java`、`frontend/src/app/(dashboard)/workflow/design/**`
- 范围：key 与 XML preflight 校验并映射 4xx；补完整 BPMN 命名空间和最小开始/结束结构；统一 name/category/description/XML 保存回读；条件流、assignee、candidateGroups 往返测试。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-021 原始路径通过。 |
| `AC-002` | BUG-FQA-084、BUG-FQA-104、BUG-FQA-105 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 缺 key/非法 key/XML；最小 BPMN；条件流与候选人属性；保存部署重载再保存。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
