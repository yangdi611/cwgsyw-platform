# REM-P1-028 实施合同

## 目标与不变量

关闭 `BUG-FQA-059`、`BUG-FQA-102` 的共同根因，交付“变更文档模板加载与创建响应合同”。

- 保持既有成功路径、租户/范围隔离、权限和会话语义。
- 非法输入或状态必须稳定 4xx，失败不得半写入。
- 原证据只读；测试对象带 remediation runId 并经产品入口清理。
- 不用直接 SQL、流程表或对象存储操作伪造业务状态。

## 当前与目标

当前：新建页期待 fieldConfig 而列表返回 fields，并把创建响应对象整体当作数值 ID，导航到 [object Object]。

目标：用户创建草稿后无法进入详情继续编辑，模板动态字段也未加载。对应风险消失，API、服务、DTO、UI、审计和生命周期一致。

## 合同与预计影响

- 根因：前后端 TypeScript/DTO 合同和创建响应类型被错误断言，缺少运行时 ID 校验。
- 候选文件 / 符号：`frontend/src/app/(dashboard)/change-docs/new/page.tsx`、`frontend/src/lib/**`、`backend/src/main/java/com/cwgsyw/platform/module/changedoc/ChangeDocController.java`
- 范围：统一 TemplateVO 字段映射；定义 ChangeDocCreateResponse；使用 data.id 导航并处理缺失/非法 ID；回归单/双模板和详情回读。
- 兼容：保留现有成功响应、路由、query key 和历史业务对象。
- GitNexus：规划索引已刷新；编辑每个符号前 upstream `impact`。

## 实施与验收

步骤：复现/确认 → 固定合同 → 最小改动 → L1/L2/L3 → `detect_changes` → 清理/回滚。

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-059 原始路径通过。 |
| `AC-002` | BUG-FQA-102 各有独立 PASS。 |
| `AC-003` | 正常、边界、deny/不存在、并发和失败零副作用通过。 |
| `AC-004` | 无/单/双模板字段加载；创建 numeric 路由；刷新/编辑/删除草稿；无 id 响应受控失败。 |
| `AC-005` | impact/detect、清理、审计与回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

需要改非测试终态、全租户配置、不可逆流程历史，或出现未解释 5xx/影响超界时停止并 `BLOCKED`。回滚以独立提交为单位；schema/流程数据必须说明兼容恢复。
