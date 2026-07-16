# REM-P2-019：Wiki 不存在空间首页请求收敛

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P2-019` |
| 优先级 | P2 |
| 领域 | `04-content-files` |
| 状态 | `VERIFIED` |
| 风险 | LOW |
| 来源 | L4 `FQA_20260716_2300_lintfix` / `WIKI-022` 空间首页子路径 |
| 分支 | `codex/rem-p2-019-wiki-space-home-missing-resource` |

不存在的 Wiki 空间首页已有友好提示，却仍无条件请求 tree 并产生 404 Console error。修复将 tree query 限制为已在可访问空间列表中的 space，保留 API、ACL 与既有有效空间行为。

结论：L1-L3 通过；待合并 `lint-fix` 后重跑 L4 `WIKI-022` 空间首页子路径。

文件：[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [执行 Prompt](./CLAUDE-CODE-PROMPT.md)
