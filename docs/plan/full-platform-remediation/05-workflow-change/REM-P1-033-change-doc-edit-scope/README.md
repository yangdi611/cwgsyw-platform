# REM-P1-033：变更文档编辑数据范围

- 优先级：P1；领域：流程与变更；状态：`CLOSED`
- 来源：最终 L4 `FQA_20260716_2300_lintfix` 的 `CHANGE-008`。
- 已复现：组级 `member` 仅凭 `change_doc:read/update`，成功 HTTP 200 更新 superadmin 创建的同租户草稿。测试文档 #226、临时用户 #296 及其授权关系均已通过产品 API 删除，关键词回读为零。
- 已确认合同：普通成员仅本人；组长仅本组；`tenant` / `platform` scope 可访问全租户文档。越权资源不可枚举。
- 当前进度：服务层统一范围校验、Java 21 L1 定向测试、真实 member/组长/tenant/platform API 矩阵与受影响 L4 `CHANGE-008` 均通过，所有 runId 夹具已精确清理。待事件提交并 `--no-ff` 合并到 `lint-fix` 后进入最终全平台 L4。

## 文件

- [SPEC.md](./SPEC.md)
- [VERIFICATION.md](./VERIFICATION.md)
- [IMPLEMENTATION-RECORD.md](./IMPLEMENTATION-RECORD.md)
- [CLAUDE-CODE-PROMPT.md](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
