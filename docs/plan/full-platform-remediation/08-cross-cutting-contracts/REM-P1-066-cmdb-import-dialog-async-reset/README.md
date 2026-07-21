# REM-P1-066：CMDB 导入对话框异步关闭重置

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-066` |
| 优先级 / 领域 | P1 / 横切异步 UI 合同 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `COMMON-010` |
| 分支 | `codex/rem-p1-066-cmdb-import-dialog-async-reset` |
| 基线 | `lint-fix@84e55ae9` |
| 事件运行 | `REM_P1_066_20260721` |
| 首次失败证据 | `/tmp/fqa-2050-common-remaining-r4` |

CSV 导入执行请求 pending 时关闭对话框，旧请求完成后仍执行 `onSuccess` 并把内部步骤推进至完成页；重新打开时保留旧批次结果，违反异步卸载与重新打开状态隔离合同。

修复为对话框生命周期代次：关闭时递增代次并同步 reset；preview/execute mutation 只在回调属于当前代次时更新 UI。GitNexus upstream impact 为 LOW：1 个直接调用者、1 条实例列表流程。

L1-L3 已通过：frontend typecheck、目标 lint 0 error、事件分支生产镜像构建与容器替换、专用 Playwright preview/execute 两条竞态回归及原 `COMMON-010` 组合场景均通过。所有导入写请求由 Playwright route mock 接管，产品写入为 0。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
