# REM-P1-018：Wiki 版本快照与回退完整性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-018` |
| 优先级 | P1 |
| 领域 | `04-content-files` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

Wiki 版本回退返回成功，但正文被清空。

用户执行恢复操作会丢失内容，历史版本不再可信。

## 追溯与边界

- 缺陷：`BUG-FQA-076`
- 用例：`WIKI-016`
- 根因：WikiPageVersion 快照写入/读取与 revert→savePage 映射未保证正文、标题和版本元数据完整。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 固定版本快照 schema
- 修复回退事务与新版本生成
- 保证正文、标题、附件引用和审计一致
- 对空/旧格式快照提供受控失败

非目标：
- 不重做编辑器
- 不删除历史版本
- 不自动修复无法判定的空快照

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
