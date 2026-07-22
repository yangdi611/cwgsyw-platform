# REM-P2-008 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | WIKI-012 | L1 | `preprocessWikiLinks` 不再拼接 raw HTML；受控 Markdown `a` 组件渲染 pending 状态 | `PASS` |
| `AC-002` |  | L2 | 真实页面：未知链接为一个 `role=status` 提示；已知和别名链接均路由至目标页面 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 未知链接页面无 raw `<sup>` 文本/节点/保留锚点；测试空间、两页经产品 DELETE 后均为 404 | `PASS` |
| `AC-004` | 受影响模块 | L3 | 当前事件分支 frontend 容器重建；真实登录、页面渲染、状态语义和 Console=0 通过 | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | 候选符号均 LOW；`detect_changes` 仅预期阅读/Markdown 组件流程；无对象存储写入，回滚为本事件提交 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

历史证据来自 `BUG-FQA-046` 对应章节。PASS 必须同时满足行为、持久化、权限、审计与清理；残留或未解释 5xx/Console error 为 FAIL；缺授权或精确清理能力为 BLOCKED。新证据不得覆盖旧证据。

## 2026-07-16 L1-L3 运行时证据

- GitNexus upstream：`preprocessWikiLinks` LOW、1 个直接页面消费者；`WikiPageReader` LOW、零上游调用者；共享 `createWikiMarkdownComponents` LOW、2 个消费者（阅读与编辑预览）；`WikiMarkdown` LOW、1 个阅读页消费者和 3 条阅读流程。未触及权限、ACL 或后端符号。
- 前端 lint 为既有 39 warnings、0 errors；typecheck 与生产 build 通过。当前分支 frontend 镜像已重建并替换开发容器。
- 真实管理员会话下，通过产品 API 创建唯一 runId 空间、来源页和目标页；来源页含未知、已知、别名及 Markdown 转义输入。阅读页未知链接显示两个可访问状态提示，已知/别名均指向 `/wiki/<spaceId>/<targetPageId>`，Console error 为 0。
- 精确原始路径复验：只含未知链接的页面文本为“未知别名 / 待创建”，`role=status` 计数为 1，不存在历史 raw `<sup title="该页面尚未创建">待创建</sup>` 文本、不存在 `sup` 元素、也不存在 `#wiki-pending-link` 锚点。
- 清理：来源页、目标页及空间均通过产品 DELETE 清理；后续读取分别为 HTTP 404。没有对象存储写入或其他运行数据残留。
