# REM-P2-018：Wiki 不存在资源加载态收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-018` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | L4 `FQA_20260716_2300_lintfix` / `WIKI-022` |
| 分支 | `codex/rem-p2-018-wiki-missing-resource-loading` |

## 问题

直达不存在的 Wiki 空间/页面时，阅读页持续显示“加载中…”，并在浏览器产生 `404` Console error；用户没有可解释的不存在状态。

## 范围与边界

- 将 Wiki 阅读页的资源读取失败明确渲染为中性“不存在或已删除”状态。
- 保持现有 Wiki 权限、ACL、API、路由和 query key 不变。
- 不改变后端 404 合同，不修改既有资源或授权数据。

结论：L1-L3 已通过；等待按事件流程合并 `lint-fix` 后重新建立 L4 分支复验 `WIKI-022`。

文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
