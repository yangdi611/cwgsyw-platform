# REM-P1-021：共享文件与 Wiki 附件存储回收

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-021` |
| 优先级 | P1 |
| 领域 | `04-content-files` |
| 状态 | `NOT_STARTED` |
| 风险 | `HIGH` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

共享文件删除不回收 MinIO 对象，Wiki 附件也没有可证明的产品级删除闭环。

删除后的二进制持续占用存储并可能形成隐私与合规风险，同时阻塞附件/审批归档验收。

## 追溯与边界

- 缺陷：`BUG-FQA-053`
- 用例：`FILE-004`、`FILE-008`、`WIKI-011`、`WIKI-017`、`XL-WIKI-001`
- 根因：业务记录删除与 StorageService.delete 缺少事务外补偿、幂等重试和可审计失败队列。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 定义记录/对象删除顺序和幂等语义
- 共享文件与 Wiki 附件统一回收
- 失败补偿任务与可观测状态
- 只清理可证明归属的 runId 对象

非目标：
- 不执行全桶扫描删除
- 不删除历史孤儿对象而无报告
- 不改变下载权限

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
