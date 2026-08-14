# 长 Goal Prompt

CWGSYW Figma Neutral 前端实施的完整纪律。短 Goal 必须先读本文，再读活树里的 `HANDOFF.md`、`STATUS.md` 和 `evidence/YAN-91/COMPLETION-AUDIT.md`。不要把本文当成 Figma 设计任务，也不要回头用当前系统显色定义新界面。

---

## 0. 先定位活树

不要使用 YAN-11 或 YAN-37 作为默认工作目录。旧 Goal / 旧 Prompt 还可能写着它们，那是过期指针。当前对话里如果已经有一个指向 YAN-11 / M0 / Light-Dark 截图评分的旧 Goal，不要继续喂它，用短 Prompt 开新 Goal。

定位算法：

1. 先读 `/Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/STATUS.md`。
2. 若该文件顶部 `worktree` / `tracker` / `currentPointer` 指向更新目录，改读那个目录。
3. 扫描 `/Users/byron/AI/worktrees/YAN-*`，读取每个目录下的 `docs/migration/figma-neutral-frontend/STATUS.md`。
4. 选同时满足这些条件的最高编号目录：
   - 目录存在
   - `frontend/src/design-system/figma-neutral` 存在
   - `STATUS.md` 的 `currentPhase` 最新
   - `lastUpdatedAt` 最新
5. 若 `STATUS.yaml.worktree` 和目录名不一致，以目录本身为准，并立刻修正 STATUS。
6. 只在这个活树里改文件。主工作区 `/Users/byron/AI/cwgsyw-platform` 是 dirty / 无关改动，禁止吸收。

2026-08-14 活树：

```text
/Users/byron/AI/worktrees/YAN-71
feat/YAN-71-figma-neutral-m7-workflow-design
tracker: YAN-91
origin/development@cd983965e
status: M8_LOCAL_COMMIT_AUTHORIZED
currentPointer: WAITING_USER_AUTH_FOR_PUSH_PR
visualAudit: WAIVED
```

当前第一刀不是再迁页面。本地 commit 已授权；先提交 YAN-71，再停在 push / PR 门。

---

## 1. 当前授权例外

用户于 2026-08-14 明确授权：**后面都不要做视觉审计**。

- 不要打开、评分或回修截图。
- 不要把 Light / Dark x 1440 / 1024 / 390 视觉评分写成 PASS。
- 仍要做实现、失败门禁、行为/A11y 实现、消费者隔离和 STATUS 更新。
- 已有截图只作为未评分产物保留。
- 该例外持续到用户撤回。证据见各切片 `evidence/*/PROCESS-EXCEPTION.md`。

READY 判定写：`READY WITH APPROVED EXCEPTION`。原因：Goal 授权的隔离实施；视觉审计 WAIVED；未授权改 tracker / git / 部署，除非用户追加了短 Prompt 的交付授权附言。

---

## 2. 任务身份

你是这条迁移的长期实施负责人。终点不是再写一份计划，而是让正式 Figma 设计成为线上前端的真实视觉和组件体系，并在授权后提交。

- Figma: `https://www.figma.com/design/Z8EC6psFOj7KMfXapAFk24/CWGSYW-UI---Variables`
- File key: `Z8EC6psFOj7KMfXapAFk24`
- 规划基线: YAN-10，已完成并进入 `development`
- 设计交付: Figma P0-P4 已完成
- 当前 Issue: [YAN-91](https://linear.app/yangdi/issue/YAN-91/授权提交-figma-neutral-本地实现)
- 交接: 活树 `docs/migration/figma-neutral-frontend/HANDOFF.md`
- 状态源: 活树 `docs/migration/figma-neutral-frontend/STATUS.md`
- 完成审计: 活树 `docs/migration/figma-neutral-frontend/evidence/YAN-91/COMPLETION-AUDIT.md`
- 页面台账: `docs/migration/figma-neutral-frontend/PAGE-MIGRATION-MATRIX.md`
- 资产 allowlist: `docs/migration/figma-neutral-frontend/design-source/FORMAL-ASSET-API-MANIFEST.md`
- 设计到代码合同: `docs/migration/figma-neutral-frontend/design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`

不要重做设计文件，除非实现证明正式资产有未分类 drift，必须先停下来分类。

Linear 状态不可信。YAN-11 到 YAN-88 多数仍是 Backlog / In Progress，但本地已经走过 M0-M8。以磁盘 STATUS、矩阵、单测和 COMPLETION-AUDIT 为准。未再授权不要改 Linear 状态，也不要把这些单标 Done。YAN-40 / YAN-42 都叫 `/tasks`，不要再为 `/tasks` 开第三张。

---

## 3. 整条项目的完成定义

只有这些同时成立，Goal 才能说整条迁移完成：

1. 9 个 `CWGSYW / ...` 正式集合的 Variables 已进入稳定 Token pipeline；`Collection 1`、Remote、Legacy、非法 WEB Code Syntax 会使构建失败。
2. 61 个正式 Component / Pattern 根都有同名或合同映射的 React 实现，或有批准的不适用结论。
3. 五类 Page Pattern 已实现 Default / Compact，并至少各有一个真实路由消费者。
4. 81 个当前页面入口都进入页面矩阵，状态为 `PASS`、`VERIFYING`（仅当视觉仍 WAIVED）、或批准的 `EXCLUDED`。
5. 每个适用页面通过行为、A11y、权限、业务状态验证。视觉评分只在用户撤回 WAIVED 后才成为完成条件。
6. 已迁移消费者不再依赖 `@/components/design-system`、`@/components/v2`、`@/components/ui`；`@/components/shared` 只保留非视觉入口。
7. 没有页面局部 CSS、magic number、原生 `<select>` / 旧 accent / 原生 `cwgsyw-btn` 掩盖共享缺陷。构图控件可以继续用 Neutral CSS button，不要强行换成表单 `Button`。
8. 用户授权后，YAN-91 的 commit / push / draft PR 完成。本地 commit 已授权。没有 push / PR 授权时，第 8 点的远程交付保持 `NOT AUTHORIZED`，不能假装已经推送。

`176 / 61 / 81` 是 YAN-10 基线，不是永久常量。每个切片开始前必须实时复核。

2026-08-14 本地对照：1-6 已在 YAN-71 落地。第 7 条 leftover 已覆盖 v2 token、旧 accent、shadcn、画布裸 hex、globals/sonner、spatial/wiki/select/sidebar/wiki tree/ops calendar/native action button。侧栏 76/280 和画布几何仍是构图尺寸，没有对应 Figma token，不要发明变量。第 8 条未授权。

没有交付授权，Goal 不能标 complete。也不要因为停在提交门就第一次标 blocked。

---

## 4. 设计源合同

实时 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 是颜色、Token、组件 API、尺寸、间距、布局和响应式的唯一设计源。当前系统前端只用于功能、路由、权限、数据和业务状态盘点，禁止参考其显色。

权威顺序不可颠倒：

1. 实时 Figma 正式资产
2. `FORMAL-ASSET-API-MANIFEST.md`
3. `FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`
4. `design-source/STATUS.md`
5. 本目录迁移计划 / 矩阵 / STATUS
6. 当前系统：只盘点功能

颜色合同：

- 常规 UI、Primary、Hover、Pressed、Selected、Focus、Disabled、背景、文本、边框、Overlay 只用 Neutral
- Info / Success / Warning / Danger 只表达真实状态
- 状态不能只靠颜色

组件合同：

- Figma Component 不能直接导入运行。要在 `frontend/src/design-system/figma-neutral/components` 做同名 React 实现。
- 页面从 `@/design-system/figma-neutral/components` 导入，并引用 `@/design-system/figma-neutral/index.css`。
- **以磁盘组件实现为准。** 当前 Button / IconButton / Select 使用 lowercase variant：`primary` / `secondary` / `ghost` / `destructive`。不要为了旧合同把已过门禁的 API 改成 `Primary`，除非用户单独授权。
- CSS class 保持小写：`cwgsyw-btn--secondary`、`cwgsyw-page-header--compact`。
- 日历格子、侧栏导航组行、树节点、dashboard tile、密码显隐、picker option 是 Neutral CSS 构图 button，不要整排换成表单 `Button`。

禁止：

- 参考当前显色、旧 CSS、V2 Token、旧 React Props
- 使用已清理的 `open-design-refactor` 或旧 `frontend/DESIGN_TOKENS.md`
- 用蓝、紫或其他 Accent 做普通主操作
- 用页面 override 掩盖共享缺陷
- 没有消费者审计和回滚证据就删旧实现
- 从干净 `origin/development` 重写 Neutral 源层
- 改 API / queryKey / RBAC / 路由语义 / BPMN / 空间编辑内核

---

## 5. 当前收口顺序

M0-M8 页面不要重做。按这个顺序做完就停：

1. 再读活树 `STATUS.md` + `COMPLETION-AUDIT.md`，防并行 agent 又改过。
2. 扫 leftover：原生 `<select>`、`bg-blue-` / 旧 accent、`bg-v2-` / `--v2-`、`@/components/design-system|v2|ui`、原生 `<button class="cwgsyw-btn">`、硬编码 px 掩盖共享尺寸。
3. 只修真正的旧外壳。构图控件保持 Neutral CSS。
4. 每修一类就加 `figma-neutral-m8-leftover-*.test.cjs`，再跑整包：
   `cd /Users/byron/AI/worktrees/YAN-71/frontend && node --test test/figma-neutral-*.test.cjs`
5. 更新 `STATUS.md`、`COMPLETION-AUDIT.md`、`evidence/YAN-91/`、`HANDOFF.md`。
6. 完成本地 commit 后停在 push / PR 门。

改已有 function/class/method 前先跑 GitNexus upstream impact，必须加 `--repo cwgsyw-platform`。HIGH / CRITICAL 先报告。

---

## 6. 工作流、Git 和文档

先读：

- `~/.codex/workflows/software-delivery/WORKFLOW.md`
- 仓库 `docs/process/DEFINITION-OF-READY.md`
- 仓库 `docs/process/DEFINITION-OF-DONE.md`

硬规则：

- 真实 Linear Issue，不编造编号。当前收口用 YAN-91。
- 一 Issue 一分支。不要在主工作区里为了切分支毁掉别人的 dirty tree。
- 普通工作基于 `origin/development`，但 Neutral 源层只能从已验证活树继承。
- `docs/*` 被忽略；加入本资料包时必须精确 `git add -f`，不要顺带加其他被忽略目录。
- 提交前跑 `detect_changes()`。

授权边界：

| 动作 | 一镜 Goal 默认 |
|---|---|
| 读 Figma / 读代码 / 写当前收口实现 / 更新迁移文档 | 允许 |
| 创建下一张实施 Issue 和新 worktree | 仅当磁盘证明还需要新页面切片 |
| 改正式 Figma 资产 | 不允许，除非 drift 处理被单独授权 |
| commit / push / PR / merge / 部署 | 默认不允许 |
| 改后端 API、数据库、RBAC、路由语义 | 不允许，必须另开 Issue |
| 把 YAN-11 到 YAN-88 标 Done | 不允许 |

用户追加了短 Prompt 里的「交付授权附言」时，按其文本执行，不要扩大成 merge 或部署。push / draft PR 前先给 diff 摘要，再等一句「授权 push」或「授权开 PR」。

---

## 7. 恢复协议

每次醒来只做这件事：

1. 读本文、`HANDOFF.md`、`STATUS.md`、`COMPLETION-AUDIT.md`
2. 用第 0 节定位活树
3. 以 `currentPointer` 为唯一恢复点
4. 不重做未受影响且有完整证据的 PASS / VERIFYING 项
5. 不跳过交互、A11y、回归；视觉审计保持 WAIVED
6. 先修坏掉的门禁和 leftover，再谈提交

若 `STATUS.md` 和磁盘事实冲突，以磁盘和实时 Figma 为准，并立刻修正 STATUS。HANDOFF 里若还写「CMDB / 首页 / workflow 未迁」，以磁盘 `page.tsx` 为准并改 HANDOFF。

---

## 8. 阶段输出

每个工作段落结束时用短报告，不要空话：

- READY 判定
- 当前 Issue / Phase / Pointer / 活树
- 本轮实际改动
- 命令与真实结果：`PASS` / `FAIL` / `BLOCKED` / `DEFERRED` / `NOT RUN` / `WAIVED` / `NOT AUTHORIZED`
- 自动回修了什么
- 未决风险
- 回滚方式
- 下一个 pointer

禁止用「看起来不错」「文档已经有了」「差不多还原了」代替证据。不要把视觉 WAIVED 写成视觉 PASS。

---

## 9. 停机条件

立刻停下来等人：

- 未分类 Figma drift
- 必须改 API / 权限 / 路由语义才能继续
- GitNexus 返回 HIGH / CRITICAL 且无法在本切片消化
- 用户没有交付授权，但继续下去只能 commit / push / PR
- 活树丢失、主工作区 dirty 冲突、或 Neutral 源层不在当前树

没有这些阻塞时，不要停在规划文档上。
