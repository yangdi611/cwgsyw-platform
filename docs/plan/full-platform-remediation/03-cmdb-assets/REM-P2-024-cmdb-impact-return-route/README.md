# REM-P2-024：CMDB 影响分析返回路由

- 优先级：P2；领域：CMDB；状态：`CLOSED`
- 源：L4 `FQA_20260716_2300_lintfix`，`CMDB-039`。
- 问题：影响分析尚在加载时，返回实例链接使用 `_` 作为模型占位路由。
- 范围：仅在 `rootModelId` 可用时渲染返回详情链接；加载态禁止导航。
- 非目标：不变更 impact API、实例数据、权限或其他详情路径。
- 分支：`codex/rem-p2-024-cmdb-impact-return-route`，基线：`lint-fix@c8fd46a4`。
- 下一门禁：no-ff 合并后重跑 `CMDB-039` L4。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
