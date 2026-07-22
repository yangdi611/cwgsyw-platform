# REM-P1-069：多组成员 owner-group mode 授权

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-069` |
| 优先级 / 领域 | P1 / 核心授权与 Wiki/共享文件 |
| 状态 | `CLOSED` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `XL-RBAC-002` |
| 分支 | `codex/rem-p1-069-multi-group-owner-mode-authorization` |
| 基线 | `lint-fix@962bd234` |
| 事件运行 | `REM_P1_069_20260721` |
| 首次失败证据 | `/tmp/fqa-2050-rbac-remaining-after-rem-p1-068-r4`；快照 `bcdaaf57` |

用户同时具有两个有效业务组成员关系和对应 group-scope 角色，但将其中一组设为主组后，另一组 owner-group mode 资源不可见。`AuthorizationService.resourcePermissions` 已计算全部有效组，却只用主组判断 owner-group mode。

GitNexus upstream impact 为 HIGH：2 个直接调用者、38 个上游符号，影响 Authorization/Wiki/SharedFile/Search 与文件列表流程。事件只把 owner-group mode 判断从主组等值改为有效组集合包含，不修改 assignment SQL、ACL 优先级、restricted、owner、others 或 break-glass 语义。

L1-L3 已通过：Authorization/Wiki/SharedFile Java 21 `120/120`，生产 backend 构建与单容器替换，真实双组可见/撤销旧新会话收敛 Playwright `1/1`；manifest、活动 marker、backend ERROR/5xx 均为 0。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
