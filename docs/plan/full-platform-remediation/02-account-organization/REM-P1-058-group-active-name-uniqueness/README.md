# REM-P1-058：用户组活动名称唯一性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-058` |
| 优先级 | P1 |
| 领域 | Organization / Group lifecycle / Data integrity |
| 状态 | `VERIFIED` |
| 风险 | HIGH |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `RBAC-007` |
| 分支 | `codex/rem-p1-058-group-active-name-uniqueness` |
| 基线 | `lint-fix@cd903e7b` |
| 失败快照 | `592f775c` |

同租户创建两个完全相同名称的活动业务组时，第二次请求仍返回 200 并持久化。本事件为创建、改名和恢复建立一致的 trim-normalized 活动名称唯一合同，保留跨租户同名和归档名称复用。

L1 定向测试 26/26、L2 组管理聚类 114/114、L3 当前 backend 真实 API/UI 1/1 均通过；V78 与唯一索引生效，事件数据和活动标记为零，等待顺序提交并合并后执行同 run affected-only L4。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
