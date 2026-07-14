# REM-P1-027 实施合同

## 目标与不变量

关闭 `BUG-FQA-048`、`BUG-FQA-083`、`BUG-FQA-098` 的共同根因，交付“变更模板复制、字段配置与引用保护生命周期”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：变更模板缺少复制、实体删除、引用保护、字段排序与默认值配置，生命周期无法审计和精确清理。

目标：管理员无法安全复用、维护或删除模板，测试夹具和历史引用会积累。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：Template Controller/Service/UI 能力集不完整，模板引用策略和字段配置合同没有统一。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/changedoc/**`、`frontend/src/app/(dashboard)/admin/change-doc-templates/**`、`backend/src/main/resources/db/migration/**`
- 范围：实现 clone 与 delete/archive；被文档引用时拒绝或使用不可变快照；字段 sort/default/type 合同和 UI；审计、确认及对象/字段清理。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-048 原始路径通过。 |
| `AC-002` | BUG-FQA-083、BUG-FQA-098 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 复制后独立编辑；字段排序/default/type；空模板删除；引用保护与确认/审计。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
