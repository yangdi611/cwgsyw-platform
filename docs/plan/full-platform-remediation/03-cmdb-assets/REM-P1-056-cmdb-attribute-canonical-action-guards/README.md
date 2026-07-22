# REM-P1-056：CMDB 属性 canonical action guard

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-056` |
| 优先级 | P1 |
| 领域 | CMDB / RBAC consumer |
| 状态 | `CLOSED` |
| 风险 | LOW |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `CMDB-014` |
| 分支 | `codex/rem-p1-056-cmdb-attribute-canonical-action-guards` |
| 基线 | `lint-fix@391663921` |
| 失败快照 | `472b6ef2` |

权限目录和正式矩阵暴露 `cmdb_attribute:read/create/update/delete`，但属性 Controller 与模型属性页仍消费 `cmdb_model:read/update`。canonical-only 用户因此无法执行属性动作，legacy-only 用户反而被隐式放行。本事件只对齐属性 API/UI consumer，不改模型、实例、关系、schema、租户或授权模式。

L1-L3 已通过：Controller annotation 与 CMDB metadata 聚类 21/21、backend/frontend build、当前分支双容器、真实 Playwright API/UI 1/1；canonical 四动作、逐项缺权、legacy-only、六种页面显隐均符合合同，Console/pageerror/5xx 为零，manifest 与关键词残留均为零。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
