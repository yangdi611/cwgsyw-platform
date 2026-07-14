# REM-P2-009：Wiki 搜索入口与历史导航

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-009` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `NOT_STARTED` |
| 风险 | `LOW` |
| 负责人 | 待实施时认领 |
| 创建 / 更新 | 2026-07-15 |
| 来源 | `FQA_20260712_0329_lintfix` |

## 问题与影响

Wiki 首页没有搜索入口，搜索页又固定 router.replace，关键词无法通过浏览器历史恢复。

用户难以发现搜索，后退/前进不能恢复查询上下文。

## 追溯与边界

- 缺陷：`BUG-FQA-071`
- 用例：`WIKI-013`
- 根因：首页信息架构和搜索页 URL 状态策略未形成产品合同。
- 原始证据：`defects.md` 对应章节和 `test-results/FQA_20260712_0329_lintfix/`；保持只读。

范围：
- 首页提供可发现搜索入口
- 关键词/分页写入 URL
- 明确 push/replace 策略并支持 back/forward
- 保持输入焦点与 debounce

非目标：
- 不重做搜索后端排序
- 不实现高级语法
- 不改变搜索权限

下一门禁：逐符号 GitNexus upstream impact；高风险先告警。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
