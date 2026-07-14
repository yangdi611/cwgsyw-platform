# REM-P1-022：共享文件 write 权限运行时消费者

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-022` |
| 优先级 | P1 |
| 领域 | `04-content-files` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

shared_file:update 可分配，但没有文件本体 metadata/content update API 或 UI consumer。

管理员可授予无效果权限，文件 ACL write 位无法通过实际动作验证。

## 追溯与边界

- 缺陷：`BUG-FQA-077`
- 用例：`FILE-016`、`FILE-017`
- 根因：permission registry 与 SharedFileController 能力集脱节。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 先作保留/下架 action 的产品决策
- 若保留，实现受 update/write ACL 保护的元数据 mutation
- 同步 UI、权限矩阵、审计和冲突合同

非目标：
- 不把 folder manage 当成 file update
- 不默认允许覆盖文件内容
- 不改变 read/delete 权限

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
