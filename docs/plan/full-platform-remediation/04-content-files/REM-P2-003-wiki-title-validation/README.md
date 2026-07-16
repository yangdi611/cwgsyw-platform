# REM-P2-003：Wiki 页面标题规范与同级唯一性

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-003` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `VERIFIED`（L1-L3 已通过，等待最终 L4） |
| 风险 | `MEDIUM` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

页面创建/保存没有标题 trim、长度和同级唯一校验，超长值最终触发数据库错误。

用户得到 500 或创建难以区分的同名页面。

## 追溯与边界

- 缺陷：`BUG-FQA-057`
- 用例：`WIKI-008`
- 根因：CreatePageRequest/SavePageRequest、Service 与数据库未共享标题规范。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- DTO 与服务层规范化
- 同级唯一冲突合同
- 必要唯一约束与并发处理
- 前端即时校验

非目标：
- 不改变页面路径策略
- 不批量重命名历史页面
- 不修改正文编辑

当前分支：`codex/rem-p2-003-wiki-title-validation`（基线 `lint-fix@3671f9cf`）。标题按 trim 后精确匹配；L1-L3 已通过，最终关闭仍需 L4。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
