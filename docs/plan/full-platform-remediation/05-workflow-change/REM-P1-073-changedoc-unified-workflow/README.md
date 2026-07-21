# REM-P1-073：变更文档接入统一工作流

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-073` |
| 优先级 / 领域 | P1 / ChangeDoc + Workflow |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `CHANGE-020` |
| 分支 | `codex/rem-p1-073-changedoc-unified-workflow` |
| 基线 | `lint-fix@a82119cd` |
| 事件运行 | `REM_P1_073_20260721` |
| 首次失败提交 | `231bc59b` |
| 首次失败证据 | `/tmp/fqa-2050-change020-failure` |

完整申请单与方案提交后状态进入 `pending`，但即使存在有效 `change_doc` binding，统一待办也没有对应任务，业务跳转和统一审批均不可达。失败资产通过产品 API 清理文档、两个模板、binding 和模板实例，manifest 为 0/0。

GitNexus 显示 `ChangeDocService.submit/submitPlan/approve` 与三个 Controller 入口均为 LOW；统一任务摘要为 LOW。既有 `getActiveBinding` 为 HIGH，涉及 Daily/Wiki/Adapter，但本事件只调用、不修改该方法。事件不改变用户批准的 binding 软删除与停用语义。

L1 37/37、L2 124/124、共享 Daily/Wiki/binding 回归 43/43、Java 21 package 与当前分支 backend 构建均通过。真实 Playwright 从完整双模板提交进入统一待办，经 `/workflow/todo` 详情跳转和拒绝审批回写 `rejected`；旧审批旁路返回 409 且状态不变，快照/审计/通知齐全。文档 #298 的 runtime/history/mapping、活动通知、活动文档和快照清理读回均为 0，事件 manifest 为 0/0。下一门禁为 event commit、顺序 no-ff 合并与同 run `CHANGE-020` affected-only 复验。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
