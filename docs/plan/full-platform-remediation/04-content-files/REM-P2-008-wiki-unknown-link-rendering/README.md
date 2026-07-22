# REM-P2-008：Wiki 未知链接友好渲染

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-008` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `CLOSED` |
| 风险 | `LOW` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

未知 Wiki 链接把内部提示标签作为原始文本显示。

读者看到实现细节，无法理解链接失效状态。

## 追溯与边界

- 缺陷：`BUG-FQA-046`
- 用例：`WIKI-012`
- 根因：Markdown/Wiki link 扩展返回的提示标记被当成文本节点而非受控组件。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 定义未知/已删除/无权链接三态
- 以可访问组件渲染提示
- 保留普通外链和内部有效链接

非目标：
- 不替换 Markdown 引擎
- 不自动创建缺失页面
- 不泄露无权目标信息

L1-L3 已通过：未知链接以可访问“待创建”状态提示呈现，不出现原始 `<sup>` 文本或节点；有效和别名内部链接路由保持正确，外部/普通链接不受影响。当前事件前端容器已重建，真实浏览器验证零 Console error；runId 空间和页面已经产品 API 精确清理。等待最终 L4 全量复验。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
