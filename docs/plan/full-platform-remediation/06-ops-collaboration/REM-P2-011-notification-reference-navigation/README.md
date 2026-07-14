# REM-P2-011：通知引用目标跳转合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-011` |
| 优先级 | P2 |
| 领域 | `06-ops-collaboration` |
| 状态 | `NOT_STARTED` |
| 风险 | `LOW` |
| 负责人 | 待实施时认领 |
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

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
