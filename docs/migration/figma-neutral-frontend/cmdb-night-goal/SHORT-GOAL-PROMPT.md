# CMDB 逐页夜间 Goal：短 Prompt

把下面代码块原样粘贴进新 Goal。短 Prompt 故意不复制执行细节；每次启动或续跑都必须从磁盘完整重读长 Prompt、基线与状态账本，因此即使会话压缩或中断也不会依赖旧上下文。

```text
继续 CMDB 逐页夜间实施 Goal。

固定工作目录是 /Users/byron/AI/worktrees/YAN-71，分支 feat/YAN-71-figma-neutral-m7-workflow-design，任务身份 YAN-71，流程判定 READY WITH APPROVED EXCEPTION。只能在该 worktree 工作，不得切换到主工作区，也不得覆盖、清理、暂存或吸收既有用户修改。

先完整读取并严格遵守：
/Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/cmdb-night-goal/LONG-GOAL-PROMPT.md

然后重新读取：
- /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/cmdb-night-goal/CMDB-PAGE-STATUS.md
- /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/CMDB-OVERVIEW-IMPLEMENTATION-BASELINE.md
- /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/design-source/FORMAL-ASSET-API-MANIFEST.md
- /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md
- 仓库 AGENTS.md、全局 software-delivery workflow、docs/process/ 与当前页相关源码/测试/diff。

按长 Prompt 的恢复算法，从最早 IN_PROGRESS 恢复；没有则取最早 TODO。一次只处理一页。实现和验证齐全但没有用户现场确认时写 READY_FOR_USER_REVIEW，然后继续下一条 TODO；不得重复回修 READY_FOR_USER_REVIEW，也不得重做 CONFIRMED 页面。没有 TODO 后列出待用户确认队列并停止。

实时 Figma 文件 Z8EC6psFOj7KMfXapAFk24 是设计最高权威。所有新增或替换 SVG icon 必须在官方集合 6:22411 中定位具体节点，对最终节点调用 get_design_context，下载并保存原始资产到 frontend/public/figma-icons/。绝对禁止手写 svg/path、截图临摹、emoji/字符代替或提交临时资产 URL。

修改任何 symbol 前先做 GitNexus upstream impact。MCP 工具未加载时必须回退到项目 CLI：node .gitnexus/run.cjs status 与 node .gitnexus/run.cjs impact ... --repo cwgsyw-platform；HIGH/CRITICAL 立即停止。每页结束运行 detect-changes、定向测试、比例化回归和真实浏览器验证，并更新基线及状态账本。

默认不 commit、不 push、不建 PR、不 merge、不部署、不更新 Linear/Notion，不修改 API、RBAC、数据库或路由语义。当前 Goal 已批准累计 worktree HIGH 继续例外；设计冲突、权限/数据阻塞、破坏性选择或需扩大范围时记录并将不安全状态标为 DEFERRED/BLOCKED，然后继续下一条可安全处理的页面，不得执行未授权动作。始终用 PASS/FAIL/BLOCKED/DEFERRED/NOT RUN/NOT AUTHORIZED 报告真实状态。
```

## 极短续跑版

同一个 Goal 已经加载过上述文件，仅因上下文中断需要继续时，也可使用：

```text
继续 CMDB 夜间 Goal。不要依赖会话记忆：先完整重读 /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/cmdb-night-goal/LONG-GOAL-PROMPT.md、CMDB-PAGE-STATUS.md 和 ../CMDB-OVERVIEW-IMPLEMENTATION-BASELINE.md，再按恢复算法从最早 IN_PROGRESS 或 TODO 继续一页。所有 SVG 只取 Figma Z8EC6psFOj7KMfXapAFk24 的 6:22411；GitNexus MCP 缺失则用 node .gitnexus/run.cjs CLI。累计 worktree HIGH 与可记录阻塞不再中断队列，但不得借此执行未授权或破坏性动作。没有用户确认只能写 READY_FOR_USER_REVIEW。未获新授权不 commit/push/PR/merge/deploy/改 tracker。
```
