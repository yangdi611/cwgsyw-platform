# REM-P2-009：Wiki 搜索入口与历史导航

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-009` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `CLOSED` |
| 风险 | `LOW` |
| 负责人 | Codex remediation |
| 创建 / 更新 | 2026-07-16 |
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

结论：首页搜索入口、400ms debounce URL、分页 URL 和浏览器历史恢复均已通过真实登录浏览器复验。授权模式下发现的分页前过滤缺陷已修正为“先授权过滤、再分页”，避免第二页被错误隐藏；无测试数据残留。

风险：GitNexus 对前端候选符号为 LOW；运行时发现的 `WikiPageService.search` 及 Mapper `search` 均为 LOW（直接影响 Wiki 搜索与全局搜索聚合）。

下一门禁：等待最终 L4 全平台复验。文档：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
