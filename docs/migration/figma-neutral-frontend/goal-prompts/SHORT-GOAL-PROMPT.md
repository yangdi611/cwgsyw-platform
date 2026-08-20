# 短 Goal Prompt

把需要的整段原样贴进**新 Goal**。当前对话如果已经有指向 YAN-11 / M0 / Light-Dark 截图评分的旧 Goal，不要续跑那个 Goal。

活树默认：

```text
/Users/byron/AI/worktrees/YAN-71
feat/YAN-71-figma-neutral-m7-workflow-design
tracker: YAN-91
baseline: origin/development@cd983965e
```

如果这个目录不存在，或它的 `STATUS.md` 指向更新的 worktree，以磁盘上最新的 `STATUS.md` 为准。不要退回 YAN-11 / YAN-37，也不要在主工作区 `/Users/byron/AI/cwgsyw-platform` 写实现。

---

## 短 Goal：一镜收完整条实施

```text
你是 CWGSYW Figma Neutral 前端实施 Goal。目标是一镜收完整条迁移，不是再写计划，也不是从 M0 重做。

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

用长 Prompt 第 0 节定位活树。2026-08-14 活树是 /Users/byron/AI/worktrees/YAN-71，分支 feat/YAN-71-figma-neutral-m7-workflow-design，当前 Issue 是 YAN-91，基线 origin/development@cd983965e。M0-M8 已在该树本地落地并提交：81 入口 = 78 Neutral + 3 CMDB redirect EXCLUDED；旧 design-system / v2 / ui 已删；本地 commit 36d1ceac6 / da81510cd / d2aa66c74。不要重做 YAN-11 到 YAN-88 已落地页面。不要退回 YAN-11。

整条项目的完成定义见长 Prompt 第 3 节。当前磁盘上代码实施已基本完成，一镜 Goal 按这个顺序收口，不要跳步，也不要整站重写：

1. 核验 STATUS / HANDOFF / COMPLETION-AUDIT 与磁盘是否一致。冲突以磁盘和实时 Figma 为准，立刻改文档。
2. 收剩余 leftover / remint，且只修真缺口：
   - SpatialEditor 的 <Input 必须 size="sm"，禁止 className="h-8" / "mt-1 h-8"。补 frontend/test/figma-neutral-m8-leftover-spatial-inputs.test.cjs（没有就加）。
   - CollapsedEntry 分组 flyout 必须 cwgsyw-popover w-56；单项标题必须 cwgsyw-popover cwgsyw-popover--compact。禁止 shadow-[var(--cwgsyw-elevation-lg)]。禁止 cwgsyw-popover--hover（pointer-events:none 会打断移入 flyout）。扩展 leftover-sidebar-collapse.test.cjs 或新文件锁住这些 class。
   - 再扫原生 <select>、旧 accent / v2、原生 cwgsyw-btn 动作按钮、会掩盖共享尺寸的 magic number。日历格子、导航组行、树节点、dashboard tile、密码显隐、picker option 保持 Neutral CSS 构图，不要整页换成表单 Button。
3. 每修一类就补/更新 figma-neutral-m8-leftover-*.test.cjs，再跑：
   cd /Users/byron/AI/worktrees/YAN-71/frontend && node --test test/figma-neutral-*.test.cjs
   上一完整数是 252/252；有新增测试就更新 STATUS / COMPLETION-AUDIT 计数。需要时再跑 npm run typecheck。
4. 更新 STATUS.md、HANDOFF.md、PAGE-MIGRATION-MATRIX.md、evidence/YAN-91/COMPLETION-AUDIT.md。docs/* 以后提交必须精确 git add -f。
5. 停在 YAN-91 人闸：未再授权不 push、不建 PR、不 merge、不部署、不把 YAN-11..YAN-88 标 Done。本地 commit 已授权，可以把本 Goal 收口的 leftover + 文档打进 YAN-71；不要顺带提交 frontend/src/design-system/figma-neutral/generated/source-map.json，除非 token pipeline 证明它是必要产物。

实时 Figma 文件 Z8EC6psFOj7KMfXapAFk24 是颜色、Token、组件 API、尺寸、间距、布局和响应式的唯一设计源。当前前端只用于功能、路由、权限、数据和业务状态盘点，禁止参考其显色。常规 UI 只用 Neutral；Status 色只表达真实状态。用户已于 2026-08-14 授权跳过视觉审计；不要做截图评分或视觉闭环，直到用户撤回。布局明显坏掉（看不见、错位、重叠、突兀组合）仍按 Token -> Component -> Composition -> Page 修，但不要把 WAIVED 写成视觉 PASS。磁盘 Button / IconButton / Select 使用 lowercase variant，不要为了对齐旧合同改成 Primary。

不要动：bell / panel-left（正式 Icon 没有）、侧栏 76/280、通知角标 10/11px、画布几何、SVG fontSize={9}、analytics / spatial 装饰 lucide 的 h-8 w-8、空间编辑内核 / BPMN / API / queryKey / RBAC / 路由语义。

未分类 Figma drift 立即停止。一直推进到收口完成并停在 push / PR 门，或碰到必须人决定的阻塞。
```

---

## 续跑

同一 Goal 被打断、换会话或只想说「继续」时用：

```text
继续 Figma Neutral 前端实施 Goal。先重读 /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/HANDOFF.md、goal-prompts/LONG-GOAL-PROMPT.md、STATUS.md 和 evidence/YAN-91/COMPLETION-AUDIT.md。用定位算法找活树，不要退回 YAN-11 / YAN-37。从 currentPointer 最早未完成项恢复。M0-M8 已迁页面不要重做。当前默认收口 leftover remint：SpatialEditor Input size="sm"、CollapsedEntry cwgsyw-popover / --compact、再扫原生 select / 旧 accent / 原生 cwgsyw-btn，补测并跑 node --test test/figma-neutral-*.test.cjs，然后停在 YAN-91 push / PR 门。视觉审计已授权跳过。本地 commit 已授权；未再授权不 push / PR / 改 Linear 状态 / 部署。
```

---

## 收口剩余 leftover

只清残留外壳，不重迁页面：

```text
只做 Figma Neutral leftover 收口。工作目录按 LONG-GOAL-PROMPT.md 定位，默认 /Users/byron/AI/worktrees/YAN-71。先锁 SpatialEditor Input size="sm" 和 CollapsedEntry cwgsyw-popover / --compact，再扫原生 select、旧 accent / v2、原生 cwgsyw-btn 动作按钮和会掩盖共享尺寸的 magic number。日历格子、导航组行、树节点、dashboard tile、密码显隐、picker option 保持 Neutral CSS 构图，不要整页重写。补单测并跑 node --test test/figma-neutral-*.test.cjs。更新 STATUS 和 COMPLETION-AUDIT。视觉审计 WAIVED。本地 commit 已授权；未再授权不 push / PR / 部署。
```

---

## 自适应回修

把尖括号换成真实目标。视觉评分仍是 WAIVED。

```text
对 <组件名 / 路由 / Figma Node ID / 文件路径> 执行实施期自适应回修。先按 FORMAL-ASSET-API-MANIFEST.md 核对精确 ID、完整名称和 API 指纹。同时检查单体、同族组合和至少一个真实消费者。覆盖真实状态、最长文案、键盘和 screen reader。有裁切、重叠、看不见、颜色越界、错位、突兀组合，直接 FAIL 并按 Token -> Component -> Composition -> Page 修到过门禁。更新 STATUS.md。不要做截图评分。不要重做未受影响页面。
```

---

## 重新打开视觉闭环

只有你撤回「不要做视觉审计」时才用：

```text
视觉审计例外撤回。从现在开始按 VISUAL-VALIDATION-RUNBOOK.md 和长 Prompt 第 8 节做 Light / Dark x 1440 / 1024 / 390 视图验证。Critical 低于 4/5，或有裁切、重叠、看不见、错位、突兀组合，直接 FAIL 并回修。不要伪造截图 PASS。先从当前 pointer 的受影响组件和至少一个真实页面开始，不要一夜评完全站 81 页。
```

---

## 只读审计

```text
只读审计 Figma Neutral 前端实施，不修改代码、Figma、Git 或 Linear。按 HANDOFF.md、LONG-GOAL-PROMPT.md、STATUS.md 和 COMPLETION-AUDIT.md 核对 Token 白名单、React API、页面矩阵、leftover chrome、A11y 和回滚证据。没有证据的项标 NOT VERIFIED，不能写成 PASS。视觉审计是 WAIVED，不要补评截图，也不要写成视觉 PASS。
```

---

## 交付授权附言

只有你真的希望这个 Goal 在收口完成后继续往远程走时，才把下面整段追加到短 Goal 末尾：

```text
交付授权：收口门禁通过后，可以在 /Users/byron/AI/worktrees/YAN-71 的 feat/YAN-71-figma-neutral-m7-workflow-design 上按 YAN-91 commit。docs/migration/figma-neutral-frontend 必须精确 git add -f，不要顺带加其他被忽略资料。push 和打开 draft PR 到 development 前，先在对话里给出 diff 摘要并等我回「授权 push」或「授权开 PR」。不要 merge，不要部署，不要把 YAN-11 到 YAN-88 标成 Done。
```

没有这段，就只做收口和已授权的本地 commit，停在 push / PR 门。
