# REM-P2-005：Wiki 当前页面导出合同

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-005` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `VERIFIED` |
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

L1-L3 已通过：当前页面导出使用单页端点并下载中文页面名 Markdown；空间导出保持 ZIP。无业务数据写入，等待最终 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
