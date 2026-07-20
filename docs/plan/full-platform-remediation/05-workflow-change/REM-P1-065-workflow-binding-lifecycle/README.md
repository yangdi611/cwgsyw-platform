# REM-P1-065：流程绑定完整生命周期

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-065` |
| 优先级 / 领域 | P1 / Workflow |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `FLOW-010` |
| 分支 | `codex/rem-p1-065-workflow-binding-lifecycle` |
| 基线 | `lint-fix@02270f10` |
| 事件运行 | `REM_P1_065_20260721` |
| 首次失败证据 | `/tmp/fqa-2050-flow010-failure` |

流程绑定页和 API 只有创建/覆盖，没有编辑、停用、启用或删除入口，无法满足 `FLOW-010` 的完整生命周期与版本选择合同。只读 L4 探测记录控件 `1/0/0/0`、`productWrites=0`、Console/5xx 为 0，现有 daily/wiki 正式绑定前后不变。

GitNexus 显示 binding 实体为 `CRITICAL`，7 个直接依赖、5 个模块和 1 条模板创建流程；既有 `bind` 与 `getActiveBinding` 为 `HIGH`。用户已批准软删除、停用/删除阻止新启动且不回退旧键、已有实例继续、重新启用重新校验和全操作审计合同。

L1-L3 已通过：Java 21 定向 18/18、Workflow/Daily/Wiki 聚类 167/167、backend/frontend 生产构建、Flyway V79、真实 UI/API Playwright 1/1、存量 v1 实例保护、权限/异常/审计与精确清理均通过。事件 manifest 为 0/0，活动 runId binding/定义/实例/用户/角色均为 0；软删墓碑保留完整删除人和删除时间。等待事件提交、顺序 no-ff 合并后在同一 L4 run affected-only 重验 `FLOW-010`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
