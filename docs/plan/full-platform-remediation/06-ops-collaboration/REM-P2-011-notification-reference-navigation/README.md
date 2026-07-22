# REM-P2-011：通知引用目标跳转合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-011` |
| 优先级 | P2 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
| 风险 | `LOW` |
| 负责人 | Codex |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

Wiki 发布通知可以标记已读，但缺少 wiki_page 目标路由映射。

用户无法从通知返回业务对象，只能手工检索。

## 追溯与边界

- 缺陷：`BUG-FQA-025`
- 用例：`NOTICE-002`
- 根因：通知 producer 的 refType 集合与 NotificationItem.getHref 映射未共享注册表。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 建立 refType→route 映射
- 覆盖 Wiki/变更/日报/CI/运维任务
- 失效目标进入友好错误态
- 链接与标记已读行为兼容

非目标：
- 不改变通知投递
- 不增加跨用户可见性
- 不恢复已删除目标

## 2026-07-16 L1-L3 结论

- 通知卡片通过受控目标解析页覆盖 `wiki_page`、`change_doc`、`daily_report`、`ci_instance` 和 `ops_task`，再由既有受权限保护的详情 API 解析至真实路由。
- 真实通知中心点击现有 Wiki 通知进入 `/wiki/8/54`；运维任务引用进入 `/ops-calendar?taskId=9` 并打开任务抽屉，成功路径 Console error 为 0。
- 已删除与未知目标统一显示“通知目标不可用”，不展示目标详情，也不修改通知已读状态或投递记录。
- GitNexus：前端 `getHref` 影响为 LOW（仅通知列表）；通知投递 `NotificationService.notify` 为 CRITICAL（11 个直接调用者），未修改。

下一门禁：提交事件证据并按 `--no-ff` 合并到 `lint-fix`，随后进入 `REM-P2-012`。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
