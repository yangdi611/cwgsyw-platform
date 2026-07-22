# REM-P2-005：Wiki 当前页面导出合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-005` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `CLOSED`（L4 回归已修复，待重新合并后续跑） |
| 风险 | `MEDIUM` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

页面“导出”操作运行时下载整个空间，而不是当前页面。

按钮语义与下载内容不一致，用户可能误导出超出预期范围的信息。

## 追溯与边界

- 缺陷：`BUG-FQA-038`
- 用例：`WIKI-017`
- 根因：exportPage 客户端路由、构建产物或后端 Mapping 与页面按钮绑定不一致。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 固定页面导出 endpoint 与参数类型
- 验证下载范围、文件名和 MIME
- 避免缓存/构建版本路由漂移

非目标：
- 不修改空间导出
- 不新增导出格式
- 不处理附件存储回收

L4 发现：含附件引用的既有页面会退化为 ZIP，违背单页 Markdown 合同。回归修复后页面导出始终为 Markdown，空间导出保持 ZIP；当前分支 L1-L3 运行时已复验，无业务数据写入，待合并后恢复最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
