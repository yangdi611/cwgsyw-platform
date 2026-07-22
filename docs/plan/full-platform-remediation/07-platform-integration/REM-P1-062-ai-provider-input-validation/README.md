# REM-P1-062：AI Provider 输入边界

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-062` |
| 优先级 / 领域 | P1 / AI 与配置 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `AI-002` |
| 分支 | `codex/rem-p1-062-ai-provider-input-validation` |
| 基线 | `lint-fix@c6495ae9` |
| 事件运行 | `REM_P1_062_20260720` |
| 证据 | `/tmp/rem-p1-062-l3-r1` |

AI Provider 更新当前接受非法 URL 和空白 model。本事件增加 API 与 service 双层输入校验，保持合法保存、密钥掩码/留空不修改及测试连接合同。

L1-L3 已通过：Java 21 L1 3/3、L2 12/12、生产构建/健康和真实 API 1/1；8 类非法输入 400 且快照不变，合法规范化、密钥保留/不泄露、隔离 mock 和精确恢复通过。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
