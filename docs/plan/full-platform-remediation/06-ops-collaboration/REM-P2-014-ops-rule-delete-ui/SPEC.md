# REM-P2-014 实施合同

## 目标与不变量

关闭 `BUG-FQA-097` 的共同根因，交付“周期规则删除与确认入口”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：后端支持删除周期规则，管理页面却只有编辑和启停。

目标：管理员无法从产品 UI 完成规则清理，测试 fixture 也无法闭环。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：前端 action 列未消费现有 DELETE endpoint。
- 候选文件 / 符号：`frontend/src/app/(dashboard)/ops-calendar/rules/page.tsx`、`backend/src/main/java/com/cwgsyw/platform/module/opscalendar/OpsCalendarRuleController.java`
- 范围：增加 manage 权限删除按钮；确认/取消与成功刷新；受引用/删除失败提示；核对审计。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-097 原始路径通过。 |
| `AC-002` | 全部子路径 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 删除确认/取消；无权限隐藏与 API deny；成功刷新；引用/不存在错误。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
