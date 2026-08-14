# 短 Goal Prompt

把需要的整段原样贴进新 Goal。当前对话如果已经有指向 YAN-11 / M0 / 截图评分的旧 Goal，不要续跑那个 Goal。

---

## 短 Goal

```text
你是 CWGSYW Figma Neutral 前端实施 Goal。从现有未提交实现继续，不要重做已落地的 Token / 组件 / 81 页。

先完整读取并遵守：
/Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/goal-prompts/LONG-GOAL-PROMPT.md

然后读取活树里的：
- /Users/byron/AI/cwgsyw-platform/AGENTS.md
- docs/migration/figma-neutral-frontend/HANDOFF.md
- docs/migration/figma-neutral-frontend/STATUS.md
- docs/migration/figma-neutral-frontend/PAGE-MIGRATION-MATRIX.md
- docs/migration/figma-neutral-frontend/evidence/YAN-91/COMPLETION-AUDIT.md
- docs/migration/figma-neutral-frontend/design-source/FORMAL-ASSET-API-MANIFEST.md
- docs/migration/figma-neutral-frontend/design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md

用长 Prompt 第 0 节定位活树。2026-08-14 活树是 /Users/byron/AI/worktrees/YAN-71，分支 feat/YAN-71-figma-neutral-m7-workflow-design，当前 Issue 是 YAN-91，基线 origin/development@cd983965e。M0-M8 页面迁移已在该树本地完成：81 入口 = 78 Neutral + 3 EXCLUDED redirect；旧 design-system / v2 / ui 已删。不要重做 YAN-11 到 YAN-88 已落地页面。不要退回 YAN-11。

当前只做收口，顺序固定：
1. 核验 STATUS / HANDOFF / COMPLETION-AUDIT 与磁盘是否一致。
2. 清 leftover 旧外壳：原生 select、旧 accent / v2 token、原生 cwgsyw-btn 动作按钮。构图控件不要强行换成表单 Button。
3. 每修一类补 figma-neutral-m8-leftover-*.test.cjs，跑 node --test test/figma-neutral-*.test.cjs。
4. 更新 STATUS、矩阵、COMPLETION-AUDIT、HANDOFF。
5. 停在 YAN-91 提交门：未再授权不 commit、不 push、不建 PR、不改 Linear 状态、不部署。

实时 Figma 文件 Z8EC6psFOj7KMfXapAFk24 是颜色、Token、组件 API、尺寸、间距、布局和响应式的唯一设计源。当前前端只用于功能、路由、权限、数据和业务状态盘点，禁止参考其显色。常规 UI 只用 Neutral；Status 色只表达真实状态。用户已于 2026-08-14 授权跳过视觉审计；不要做截图评分或视觉闭环，直到用户撤回。不要把视觉 WAIVED 写成视觉 PASS。磁盘 Button / IconButton / Select 使用 lowercase variant，不要为了对齐旧合同改成 Primary。

未分类 Figma drift 立即停止。共享问题按 Token -> Component -> Composition -> Page 修。一直推进到收口完成并停在提交门，或碰到必须人决定的阻塞。
```

---

## 续跑

同一 Goal 被打断、换会话或只想说「继续」时用：

```text
继续 Figma Neutral 前端实施 Goal。先重读 /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/HANDOFF.md、goal-prompts/LONG-GOAL-PROMPT.md、STATUS.md 和 evidence/YAN-91/COMPLETION-AUDIT.md。用定位算法找活树，不要退回 YAN-11 / YAN-37。从 currentPointer 最早未完成项恢复。M0-M8 已迁页面不要重做。当前默认收口 leftover chrome，然后停在 YAN-91 提交门。视觉审计已授权跳过。未再授权不 commit / push / PR / 改 Linear 状态 / 部署。
```

---

## 收口剩余 leftover

只清残留外壳，不重迁页面：

```text
只做 Figma Neutral leftover 收口。工作目录按 LONG-GOAL-PROMPT.md 定位，默认 /Users/byron/AI/worktrees/YAN-71。扫原生 select、旧 accent / v2、原生 cwgsyw-btn 动作按钮和会掩盖共享尺寸的 magic number。日历格子、导航组行、树节点、dashboard tile、密码显隐、picker option 保持 Neutral CSS 构图，不要整页重写。补单测并跑 node --test test/figma-neutral-*.test.cjs。更新 STATUS 和 COMPLETION-AUDIT。视觉审计 WAIVED。未再授权不 commit / push / PR / 部署。
```

---

## 自适应回修

把尖括号换成真实目标。视觉评分仍是 WAIVED。

```text
对 <组件名 / 路由 / Figma Node ID / 文件路径> 执行实施期自适应回修。先按 FORMAL-ASSET-API-MANIFEST.md 核对精确 ID、完整名称和 API 指纹。同时检查单体、同族组合和至少一个真实消费者。覆盖真实状态、最长文案、键盘和 screen reader。有裁切、重叠、看不见、颜色越界、错位、突兀组合，直接 FAIL 并按 Token -> Component -> Composition -> Page 修到过门禁。更新 STATUS.md。不要做截图评分。不要重做未受影响页面。
```

---

## 只读审计

```text
只读审计 Figma Neutral 前端实施，不修改代码、Figma、Git 或 Linear。按 HANDOFF.md、LONG-GOAL-PROMPT.md、STATUS.md 和 COMPLETION-AUDIT.md 核对 Token 白名单、React API、页面矩阵、leftover chrome、A11y 和回滚证据。没有证据的项标 NOT VERIFIED，不能写成 PASS。视觉审计是 WAIVED，不要补评截图，也不要写成视觉 PASS。
```

---

## 交付授权附言

只有你真的希望这个 Goal 在收口完成后按 YAN-91 提交时，才把下面整段追加到短 Goal 末尾：

```text
交付授权：收口门禁通过后，可以在 /Users/byron/AI/worktrees/YAN-71 的 feat/YAN-71-figma-neutral-m7-workflow-design 上按 YAN-91 commit。docs/migration/figma-neutral-frontend 必须精确 git add -f，不要顺带加其他被忽略资料。push 和打开 draft PR 到 development 前，先在对话里给出 diff 摘要并等我回「授权 push」或「授权开 PR」。不要 merge，不要部署，不要把 YAN-11 到 YAN-88 标成 Done。
```

没有这段，就只实施和更新文档，停在未提交的 worktree。
