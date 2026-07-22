# REM-P1-054：水印角度与即时预览合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-054` |
| 优先级 | P1 |
| 领域 | Config / Change Export |
| 状态 | `CLOSED` |
| 风险 | LOW |
| 来源 | `FQA_20260718_2050_remp1038` / `CONFIG-004` |
| 分支 | `codex/rem-p1-054-watermark-angle-preview-contract` |
| 基线 | `lint-fix@43e1a940` |
| 失败快照 | `49e6717e` |

真实水印管理页只支持开关、文本、透明度和位置，缺少 catalog 要求的角度与即时效果；V11 与 PDF 导出服务已经存在 `watermark.angle`，形成配置链断点。

本事件已补齐兼容的 angle DTO/Controller/UI、即时预览和导出消费回归，不修改权限、schema、导出路由或既有配置键。L1-L3 全部通过：Java 14/14、frontend lint/typecheck/build、当前 backend/frontend 容器健康、真实 Playwright 1/1；配置恢复精确且 manifest 为空。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
