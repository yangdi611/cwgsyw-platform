# REM-P1-050：运维任务跨组负责人候选

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-050` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `VERIFIED` |
| 风险 | `HIGH` |
| 分支 | `codex/rem-p1-050-ops-cross-group-assignee-candidates` |
| 基线 | `lint-fix@dd447b55` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `L4-OPS-007-001` |

## 问题

任务 API 接受并正确读回跨组负责人，但 `TaskFormDialog` 复用按当前身份收敛的通用 `/api/users`，导致组级创建者 UI 无法选择跨组用户。服务端同时缺少 assignee/participant/recipient/escalation 用户的同租户启用资格校验。

L1-L3 已通过：Java 21 受影响聚类 35/35、前后端生产构建、当前分支容器、候选 API 权限/最小字段、真实 UI 跨组选择与创建均 PASS；manifest、临时用户和角色均为零。下一门禁：完成 detect、事件提交和 no-ff 合并后，同 run 仅重验 `OPS-007`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
