# Figma Neutral 前端迁移交接

给下一任实施模型用。先读本文，再读 `goal-prompts/LONG-GOAL-PROMPT.md` 和 `STATUS.md`。不要从主工作区 `/Users/byron/AI/cwgsyw-platform` 或 `/Users/byron/AI/worktrees/YAN-11` 继续写代码。

记录时间：2026-08-14  
授权：用户明确授权后续不做视觉审计，直到撤回。  
交付：用户已授权 YAN-71 本地 commit。未再授权不 push / PR / merge / 部署。

---

## 0. 30 秒恢复

| 项 | 值 |
|---|---|
| 活刀 Issue | [YAN-71](https://linear.app/yangdi/issue/YAN-71/实施-figma-neutral-m7迁移-workflowdesign) |
| 活刀 worktree | `/Users/byron/AI/worktrees/YAN-71` |
| 活刀分支 | `feat/YAN-71-figma-neutral-m7-workflow-design` |
| 基线 SHA | `cd983965e`（与本地 `development` / `#141` 相同） |
| 当前指针 | M8 leftover 已锁。用户已授权 YAN-71 本地 commit。下一门是 push / PR |
| 本地进度 | M0-M6 组件已在本树；M7 已本地接上 78/81 完整页，另有 3 个 CMDB redirect 无视觉表面 |
| Linear 进度 | 落后于磁盘。YAN-10 Done；YAN-11 及几乎全部 M7 仍是 Backlog / In Progress |
| 视觉审计 | WAIVED |
| 下一域 | 本地提交后等人授权 push / PR。旧 design-system / v2 / ui 已删除 |

`/workflow/design` **不是列表页**。Linear 描述写错了。磁盘上的真实页面是「设计新流程」：名称 / Key / 分类 / 描述 + BPMN 画布 + 保存并部署。流程定义列表在 `/workflow/admin`。

---

## 1. 立刻可贴的短 Prompt

把下面整段贴进新会话 / Goal。不要改路径。

```text
你是 CWGSYW Figma Neutral 前端实施 Goal。从现有未提交实现继续，不要重做已落地的 Token / 组件 / 81 页。

先完整读取并遵守：
/Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/HANDOFF.md
/Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/goal-prompts/LONG-GOAL-PROMPT.md
/Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/STATUS.md

只在这个 worktree 改文件：
/Users/byron/AI/worktrees/YAN-71
分支：feat/YAN-71-figma-neutral-m7-workflow-design
Issue：YAN-91
基线：cd983965e

当前指针：M8 leftover remint 已完成。用户已授权 YAN-71 本地 commit。下一张是等人授权后 push / PR。不要从 /workflow/design 重开，也不要回到 YAN-11。

实时 Figma Z8EC6psFOj7KMfXapAFk24 是唯一设计源。常规 UI 只用 Neutral；Status 色只表达真实状态。视觉审计 WAIVED。未再授权不 commit、不 push、不建 PR、不部署、不改 Linear 状态为 Done。
```

续跑只用这段：

```text
继续 Figma Neutral 前端实施。先读 /Users/byron/AI/worktrees/YAN-71/docs/migration/figma-neutral-frontend/HANDOFF.md 和 STATUS.md。只在 STATUS 写的活刀 worktree 里改。从 currentPointer 最早未完成项恢复。不重做已落地的 Token / 组件 / 81 页。视觉审计保持 WAIVED。本地 commit 已授权。未再授权不 push / PR / 部署。
```

---

## 2. 仓库真相，不要搞错

### 2.1 三棵树

| 路径 | 用途 | 能不能继续写 |
|---|---|---|
| `/Users/byron/AI/cwgsyw-platform` | 本地 `development`，`#141` 已同步远程 | 否。几乎没有 Neutral 实现；STATUS 仍停在 YAN-10 |
| `/Users/byron/AI/worktrees/YAN-11` | 最早 M0 树，只有 token pipeline | 否。没有完整 components，prompt 里的旧路径已作废 |
| `/Users/byron/AI/worktrees/YAN-71` | 当前活刀，含全部未提交实现 | 是。下一任从这里开始 |

YAN-12 到 YAN-70 的 worktree 也在 `/Users/byron/AI/worktrees/YAN-*`。YAN-70 与 YAN-71 的已迁页面内容一致，但是独立 inode。**不要回去改 YAN-70。** 后续新切片从 YAN-71 拷未提交文件。

### 2.2 未提交是正常状态

YAN-11 到 YAN-70 的实现全部堆在工作区，从未 commit。这违反了长 Prompt 里「不要把 M0 到 M8 塞进同一个长期脏分支」的理想纪律，但是当前物理事实。下一任必须：

1. 把 YAN-71 这份脏树当成唯一实现源。
2. 新 worktree 先 `git worktree add` 到 `origin/development` / `cd983965e`。
3. 再把 YAN-71 里未提交的 `frontend/src/design-system/`、已迁页面、测试、`docs/migration/figma-neutral-frontend/` 拷过去。
4. 不要从干净 `development` 重写 Token 或组件。

主工作区若有无关脏改动，一律不碰。

### 2.3 Linear 不要当成完成度

本地已完成、tracker 未改的切片包括 YAN-11 到 YAN-70。用户没有授权把它们标 Done，也没有授权 commit。创建下一张 Issue 可以；改状态、关单、贴 PR 不行。

YAN-40 和 YAN-42 都叫迁移 `/tasks`，是重复开单。任务域已经在本地做完，不要再为 `/tasks` 开第三张。

---

## 3. 已经落地的东西

### 3.1 Neutral 运行时

全部在：

```text
frontend/src/design-system/figma-neutral/
```

入口：

- CSS：`@/design-system/figma-neutral/index.css`
- 组件：`@/design-system/figma-neutral/components`

已导出：Icon / Spinner / Separator / Button / IconButton / Field / Input / Textarea / SearchInput / DateInput / Select / Combobox / Checkbox / Radio / Switch / Tabs / Badge / StatusBadge / Chip / Avatar / Card / MetricCard / Table / Pagination / Skeleton / EmptyState / ErrorState / LoadingState / Alert / Toast / Progress / Menu / Dropdown / Tooltip / Popover / Dialog / AlertDialog / Drawer / Calendar / DatePicker / CommandPalette / Breadcrumb / PageHeader / DetailHeader / Toolbar / WorkspaceToolbar / FilterBar / 五类 Page Pattern。

Pattern 函数名：

- `FormSettingsPage`
- `DataManagementPage`
- `DetailDrawerPage`
- `DashboardFeedbackPage`
- `OverlayDestructivePage`

生成器和合同：`generate.cjs`、`export-tokens.cjs`、`contract.cjs`、`recipes.cjs`、`source/`、`generated/`。

### 3.2 已迁 50 页

账号 3、users、groups、rbac 2、login、devices 3、ipam 2、files 2、notifications 3、ops-calendar 3、work、tasks 13、admin 6、change-docs 3、wiki 6。

其中 6 个任务页是薄包装，页面文件本身没改，组件已经 Neutral：

- `/tasks/[taskId]` -> `TaskDetail`
- `/tasks/plans` -> `TaskPlanList`
- `/tasks/plans/new` -> `TaskPlanEditor`
- `/tasks/templates` -> `TaskTemplateList`
- `/tasks/templates/new` -> `TaskTemplateCreate`
- `/tasks/analytics` -> `TaskAnalyticsWorkbench`

隔离单测在 `frontend/test/figma-neutral-*.test.cjs`。YAN-70 记录 wiki-search 时整包 145/145。

参考实现，优先抄：

- 列表：`frontend/src/app/(dashboard)/devices/page.tsx`
- 表单：`frontend/src/app/(dashboard)/admin/config/page.tsx`
- 搜索/数据页：`frontend/src/app/(dashboard)/wiki/search/page.tsx`
- 测试模板：`frontend/test/figma-neutral-m7-wiki-search.test.cjs`

### 3.3 设计源

Figma：<https://www.figma.com/design/Z8EC6psFOj7KMfXapAFk24/CWGSYW-UI---Variables>  
File key：`Z8EC6psFOj7KMfXapAFk24`

权威顺序不可颠倒：

1. 实时 Figma 正式资产
2. `design-source/FORMAL-ASSET-API-MANIFEST.md`
3. `design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`
4. `design-source/STATUS.md`
5. 本目录迁移计划 / 矩阵 / STATUS
6. 当前系统：只盘点功能

P0-P4 Figma 设计已交付。不要重做设计文件。未分类 drift 先停。

---

## 4. 页面切片状态（磁盘已完成，文档曾滞后）

下面 4.3 / 4.4 若仍写「未迁」，以 `page.tsx` 和 STATUS 为准：首页和 CMDB 已在本树落地。不要从这里重做。

磁盘上的 81 个 `page.tsx` 入口已经接上 Neutral，或批准为 CMDB redirect。下面这张表不再是待办，只保留给对照 Linear。不要再从这里重做页面。

### 4.1 Workflow 历史对照（已落地，不要重做）

| 建议顺序 | 路由 | 真实页面 | Primary Pattern | 已有 Issue |
|---|---|---|---|---|
| 1 | `/workflow/design` | 新建流程 + BPMN 画布 | Form / Settings + Workspace toolbar | YAN-71 |
| 2 | `/workflow/design/[id]` | 编辑已有定义 / 指定版本 | Form / Settings + Workspace | 未开 |
| 3 | `/workflow/admin` | 流程定义列表、版本、启停、删除、重命名 | Data / Management + Overlay | 未开 |
| 4 | `/workflow/instances` | 运行中/已结束实例，BpmnViewer | Data / Management + Detail | 未开 |
| 5 | `/workflow/templates` | 模板定义与实例 | Data / Management + Overlay | 未开 |
| 6 | `/workflow/bindings` | 流程绑定启停删除 | Data / Management + Overlay | 未开 |
| 7 | `/workflow/stats` | 流程统计 | Dashboard / Feedback | 未开 |

权限盘点：

- `/workflow/design`、`/workflow/admin`、`/workflow/templates`、`/workflow/bindings`：`workflow:configure`
- instances / stats 用页面内 `hasPermission('workflow', 'configure')` 控制危险操作

### 4.2 YAN-71 具体合同

`/workflow/design` 已在本树落地，不要重做。BpmnEditor 内核仍保留。证据：`frontend/test/figma-neutral-m7-workflow-design.test.cjs`。

### 4.3 CMDB

CMDB 23 个 `page.tsx` 已在本树落地或批准为 redirect。空间编辑器只换外壳，不改数据语义。不要重做。

### 4.4 首页

`frontend/src/app/(dashboard)/page.tsx` 已接 Neutral `DashboardFeedbackPage`。不要重做。

### 4.5 M8 leftover

M8 已在本树落地：旧 `@/components/design-system` / `v2` / `ui` 已删，shared 只留 PermissionGuard。原生 select / 旧 accent / 动作按钮 / Wiki 灯箱 / 空间发布框 / CMDB 搜索下拉外壳 / Breadcrumb 与 NavGroup chevron / 拓扑机柜 hover 卡 / 资源授权删除钮 已收口。侧栏 76/280 和 10/11px 角标没有对应 Figma token，未发明变量。本地已提交 `36d1ceac6` 和 `da81510cd`。未再授权不要 push / PR / 部署。

---

## 5. 每一页固定做法

```text
R0 Ready
  -> R1 回读 Figma 正式资产，分类 drift
  -> R2 盘点权限、API、queryKey、状态、旧入口
  -> R3 只换外观，接 Neutral Token / Pattern
  -> R4 视觉审计 WAIVED，跳过截图评分
  -> R5 不做像素盲调；布局明显坏掉仍按 Token -> Component -> Composition -> Page 修
  -> R6 单测、STATUS、矩阵、evidence、准备下一张 Issue
```

开始改代码前声明：

- `READY WITH APPROVED EXCEPTION`
- 例外：视觉审计 WAIVED；整包实现未提交
- 当前 Issue / 分支 / worktree / SHA
- 范围与非目标
- GitNexus upstream impact，或本页还没有可分析符号
- 验证命令
- 回滚边界
- 本轮没有 commit / push / PR 授权

禁止：

- 参考当前显色、V2 Token、旧 React Props 来决定新 API
- 用蓝/紫/旧 accent 做普通主按钮
- 390 把桌面 Table 缩小冒充移动端
- 页面局部 magic number 掩盖共享缺陷
- 改 API、queryKey、RBAC、路由语义
- 从干净 development 重写 design-system

验证最低集：

```bash
cd /Users/byron/AI/worktrees/YAN-71/frontend
node --test test/figma-neutral-m7-<slice>.test.cjs
# 需要看回归时再跑整包
node --test test/figma-neutral-*.test.cjs
```

证据目录：`docs/migration/figma-neutral-frontend/evidence/YAN-XX/`  
至少写 `PROCESS-EXCEPTION.md`、`consumer-regression.md`、`rollback.md`、`impact.md`。不要为了 WAIVED 的视觉审计伪造六档截图 PASS。

`docs/*` 默认 gitignore。以后真的提交时必须精确 `git add -f docs/migration/figma-neutral-frontend/...`，不要顺带加别的被忽略资料。

---

## 6. 开下一张 Issue / worktree

Goal 被授权一镜实施，所以可以自己开下一张 Linear Issue。模板：

- 标题：`实施 Figma Neutral M7：迁移 <route>`
- 只写这一页
- 写清 Depends on 上一张
- 写明视觉审计 WAIVED
- 写明未再授权不 commit / push / PR
- 建议 worktree：`/Users/byron/AI/worktrees/<ISSUE>`
- 建议分支：`feat/<ISSUE>-figma-neutral-m7-<short>`

建树后立刻从 YAN-71 同步未提交实现，再改新页面。不要把 STATUS 指针留在旧树上。

---

## 7. 文档哪些可信

| 文件 | 可信度 |
|---|---|
| 本文 `HANDOFF.md` | 2026-08-14 现场交接，先信这个 |
| `STATUS.md` | 已改到 YAN-71；若和磁盘冲突，以磁盘为准并立刻改 STATUS |
| `PAGE-MIGRATION-MATRIX.md` | 81 个入口已入矩阵：78 `VERIFYING`（视觉 WAIVED）+ 3 `EXCLUDED` redirect |
| `goal-prompts/*` | 已改到 YAN-71。旧文案里的 YAN-11 / YAN-43 作废 |
| 主工作区 `docs/migration/.../STATUS.md` | 过期，仍停在 YAN-10 |
| Linear YAN-11..YAN-70 状态 | 过期，不要用来判断代码在不在 |

---

## 8. 完成整条迁移的定义

只有这些同时成立，才能说 Goal 完成：

1. 9 个正式 Variables 集合在稳定 Token pipeline 里。
2. 正式 Component / Pattern 都有 React 实现或批准的不适用结论。
3. 五类 Page Pattern 已有真实消费者。
4. 81 个页面入口都是本地 Neutral 消费者，或批准 EXCLUDED。
5. 已迁页不再依赖旧视觉入口。
6. M8 旧入口删除前消费者为零，且用户授权了提交。

1-5 和 M8 删除 / leftover `v2` token 清理都已在 YAN-71 落地，并纳入本地 commit。还缺 push / PR 授权。不要回头重做 M0-M6，除非实现坏了。
