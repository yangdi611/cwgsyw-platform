# REM-P1-063：AI Provider 测试错误合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-063` |
| 优先级 / 领域 | P1 / AI 与配置 |
| 状态 | `VERIFIED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `AI-003` |
| 分支 | `codex/rem-p1-063-ai-provider-test-error-contract` |
| 基线 | `lint-fix@824115b8` |
| 事件运行 | `REM_P1_063_20260720` |
| 证据 | `/tmp/rem-p1-063-l3-r1` |

管理页测试 Provider 的预期上游失败当前落入通用 500。本事件仅为测试连接入口提供受控、无秘密的业务错误合同，业务 AI 生成异常语义不变。

L1-L3 已通过：Java 21 14/14、生产 backend 构建/健康、真实 UI/API 1/1；失败 400/稳定 errorCode、成功 200、两种 toast、密钥不显示、精确恢复和无未处理 5xx 均通过。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
