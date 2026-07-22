# REM-P1-021：共享文件与 Wiki 附件存储回收

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-021` |
| 优先级 | P1 |
| 领域 | `04-content-files` |
| 状态 | `CLOSED` |
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

L1-L3 已通过：对象删除失败返回 `503` 且保留记录；独立附件删除与页面级联回收均完成运行时 API 复验，测试对象已通过产品 API 精确清理。等待最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
