# UI / V2 合并总计划 v1.1

## 1. 文档定位

这份文档是 `components/ui`、`components/v2` 和 `components/design-system` 合并工作的总计划与决策地图。

它回答四个问题：

1. 现在系统真实处于哪一个阶段。
2. 最终要收敛成什么结构。
3. 每一步允许改什么、必须验证什么、什么时候可以进入下一步。
4. 哪些事情需要项目负责人决定，哪些事情 AI 可以自行执行。

页面视觉统一资料位于 `frontend/open-design-refactor/ai-implementation/`。两套资料可以并行参考，但页面统一化工作包完成，不代表 UI/V2 合并完成；反之亦然。

## 2. 当前基线和真实状态

| 项目 | 当前事实 |
|---|---|
| 工作分支 | `codex/frontend-style-unification` |
| 前端栈 | Next.js 16、React 19、Tailwind CSS 4 |
| 当前交互底层 | `@base-ui/react` |
| `components/ui` | shadcn 风格基础组件和 Base UI 底层实现 |
| `components/v2` | V2 主题包装、兼容 API 和少量语义组件 |
| `components/shared` | 页面 Shell、列表、详情、状态和工作区组合组件 |
| canonical 入口 | `components/design-system` 已建立 |
| 已完成 | DS-00、DS-01、DS-02；DS-03 批次 1～6 的代码迁移、legacy import 收口和静态门禁 |
| 当前工作 | DS-04 已 `VERIFIED`；DS-05 已决定 `BASE_UI_DEFAULT`；DS-06 静态审计已完成，当前等待负责人 review |
| Intent UI | 技术可行性已在隔离 spike 验证；依赖仍只存在于隔离 spike，不作为当前迁移路径 |
| 发布边界 | 当前只在分支上实施；未经明确授权不 commit、push、merge、deploy |

当前状态的细节、历史证据和阻塞记录以 [`STATUS.md`](./STATUS.md) 为准。状态台账中的历史记录不应覆盖顶部的“当前状态”。

## 3. 最终目标架构

```text
frontend/src/components/
├── design-system/       # 基础 UI 唯一公开入口
│   ├── Button.tsx
│   ├── Dialog.tsx
│   ├── Select.tsx
│   ├── Table.tsx
│   └── index.ts
├── shared/              # 页面级和跨模块组合组件
├── ui/                  # 迁移期内部实现，最终不再被业务页面直接依赖
└── v2/                  # 迁移期 compatibility re-export，最终归档或删除
```

最终公开导入只有两类：

```tsx
import { Button, Dialog, StatusBadge } from '@/components/design-system'
import { DataTable, PageShell } from '@/components/shared'
```

“统一管理”不等于把所有组件塞进一个超大文件。每个组件独立维护，`design-system/index.ts` 负责稳定出口，token 集中在 `globals.css`，页面只依赖公开入口。

## 4. 不可变业务边界

UI/V2 合并只改变组件归属、导入路径、可复用样式和交互实现，不得改变：

- 后端 API、DTO、请求方法和响应语义。
- React Query query key、分页参数、筛选参数和 URL 结构。
- 权限资源、权限判断、重定向和无权状态。
- 保存、提交、审批、发布、归档、删除、恢复等业务状态机。
- Wiki Markdown、Mermaid、BPMN、React Flow、Konva、空间布局、文件预览和任务模板设计器的领域行为。
- 业务字段、表格列语义、排序规则和数据加载时序。

基础组件不得请求 API、读取权限、拼接业务路由或依赖领域 store。页面级组合组件可以组合基础组件，但不得把业务知识反向放回基础层。

## 5. 分阶段实施路线

### DS-00：基线冻结（已完成）

盘点组件文件、公开导出、重复 API、业务引用、token、验证命令和 dirty worktree。结果写入 `STATUS.md`，不以文档创建代替代码完成。

### DS-01：建立 canonical 入口（已完成）

在 `components/design-system/` 建立逐组件文件和统一 `index.ts`，覆盖 Button、Card、StatusBadge、Chip、Input、Textarea、Label、Checkbox、Switch、Select、Dialog、AlertDialog、Badge、Table、Tooltip、DropdownMenu、Skeleton、Avatar、Separator、Toaster。

### DS-02：建立兼容层（已完成）

- V2 的公开入口单向 re-export 到 `design-system`。
- `ui` 保留为内部 Base UI 实现。
- 继续支持旧页面的 props、ref、variant、size 和子组件组合。
- 不删除旧目录，不做全库正则替换。

### DS-03：业务引用迁移（已完成）

只改基础组件导入和必要的兼容适配，按以下顺序推进：

| 批次 | 范围 | 当前状态 |
|---|---|---|
| 1 | 账户、登录、Header、CommandPalette、Toaster | `VERIFIED` |
| 2 | 用户、组、设备、IPAM、变更文档及外围组件 | `VERIFIED` |
| 3 | CMDB 总览、管理、告警、变更、统计和影响分析 | `VERIFIED` |
| 4 | 任务、工作流、运维日历和普通管理页面 | `VERIFIED` |
| 5 | Wiki、文件列表/预览和外围组件 | `VERIFIED` |
| 6 | 拓扑、2D、空间布局专业工作区及全库静态收口 | `VERIFIED` |

每个批次都必须先做准确 symbol 的 upstream impact，再做最小修改。专业画布内部不强行改造成普通列表或 Card；只统一其工具栏、标题、状态和剩余高度边界。

### DS-04：Intent UI 技术 spike（后置，已完成）

只有 DS-03 通过静态和运行时门禁后，才在隔离目录或独立分支验证 Intent UI。至少覆盖 Button、Input、Dialog、Select、Popover/Dropdown 和一个 `react-hook-form` 表单。

验证内容和停止条件见 [`DS-04-SPIKE-PROTOCOL.md`](./DS-04-SPIKE-PROTOCOL.md)。Intent UI 的 semantic token、表单、overlay、collection 和可访问性约定作为 spike 输入；其“业务直接导入 `components/ui`”规则与本仓库架构冲突，不采纳，任何候选实现都必须隐藏在 `components/design-system` 后。spike 已通过，但 React Aria 依赖仍不复制到主迁移路径。

### DS-05：Intent UI 采用决策（已完成）

根据 `INTENTUI-DECISION.md` 已选择：

- 继续 Base UI 作为 `design-system` 内部实现（默认推荐）。
- 在统一 API 不变的前提下逐组件替换为 Intent UI。
- 只在高交互组件采用 Intent UI，低交互组件保留当前实现。

当前决策为 `BASE_UI_DEFAULT`：页面继续只依赖 `components/design-system`，内部默认保留 Base UI。若未来要替换单个高交互组件，必须创建独立组件族迁移任务并重新完成 impact、bundle/运行时对比、代表模块验收和回滚演练。

该决策只影响 `design-system` 内部实现，不得重新打开已完成页面的业务改造。

### DS-06：legacy 收口（最后阶段，静态审计已完成）

业务源码直接依赖 `components/ui`/`components/v2` 已收口为 0，ESLint 边界已经建立，基础层对 `shared` 的反向依赖扫描为 0。DS-06 的静态审计已完成；旧入口仍不得删除，归档或删除必须另行获得用户授权并完成回滚演练。

## 6. 每批次执行合同

开始编辑前：

1. 读取根 `AGENTS.md`、本目录文档和 `STATUS.md`。
2. 执行 `git status --short --branch`，保护已有 dirty changes。
3. 对将要修改的函数、类或方法执行 GitNexus upstream impact。
4. 记录目标文件、允许变化、禁止变化和退出条件。

编辑完成后：

1. `git diff --check`。
2. `cd frontend && npm run lint`，不能新增 error。
3. `cd frontend && npm run typecheck`。
4. `cd frontend && npm run build`；没有 test script 时记录 `NOT_RUN`。
5. 执行 GitNexus `detect_changes`，说明 dirty worktree 或未追踪文件造成的观测限制。
6. 从真实入口或授权 development 会话做代表页面验收，覆盖 loading、error、empty、permission、主操作、Dialog、返回和三种 viewport：`1440x900`、`1024x768`、`390x844`。
7. 把证据、风险、阻塞、回滚边界和下一步追加到 `STATUS.md`。

如果真实登录态、业务数据或浏览器能力不可用，状态必须保持 `BLOCKED` 或 `NOT_RUN`，不能用源码检查、HTTP 200 或未认证页面替代业务验收。

## 7. 风险和回滚

| 风险 | 处理方式 |
|---|---|
| 共享 Button/Dialog/Select 影响面大 | 保留兼容 re-export；按组件族和页面批次迁移 |
| legacy API 不完全一致 | 在 canonical 组件增加显式 typed alias，禁止 `any` |
| 页面出现双滚动或遮挡 | 优先修正 Shell/剩余高度边界，不在页面散落临时 CSS |
| 专业工作区交互回归 | 只改外围工具栏和容器；画布内部保持领域实现 |
| Intent UI 迁移成本超预期 | 保留 Base UI 实现，页面不感知底层替换失败 |
| 用户已有修改冲突 | 停止冲突文件，保留用户内容并请求决定 |

每个 PR 只包含一个组件族或一个明确页面批次。发现 API、权限、路由、状态机、焦点、双滚动或移动端回归时，回滚当前批次，不回滚用户已有的无关修改。

## 8. 完成定义

总体目标只有在以下条件全部满足时才能报告完成：

1. DS-00～DS-03 已完成并通过运行时门禁，或每个未完成项都有用户明确授权的 `DEFERRED` 和重新验收条件。
2. Intent UI spike 已有明确 PASS/FAIL 结论；未通过时明确保留 Base UI 的决定。
3. 业务页面只从 `design-system` 或 `shared` 导入，剩余 legacy 引用均有书面例外。
4. 组件合同、API/ref/键盘/焦点/滚动行为和 token 规则通过验收。
5. lint、typecheck、build、运行时和三种 viewport 证据已记录。
6. `detect_changes` 范围可解释，未发现后端、数据库或无关领域行为变化。
7. 项目负责人完成 Review，并明确是否允许 commit、push、merge 和 deploy。

在这些条件满足前，文档、Prompt、静态扫描或局部页面通过都只能算阶段完成，不能宣称“UI/V2 已全部合并”。

## 9. 项目负责人操作顺序

1. 在当前分支确认工作树没有需要覆盖的用户修改。
2. 将 [`TASK-GOAL-PROMPT.md`](./TASK-GOAL-PROMPT.md) 的主任务 Prompt 粘贴到 AI Goal。
3. AI 按 `STATUS.md` 顶部当前指针推进；DS-04、DS-05 和 DS-06 静态审计已完成，当前等待负责人 review，不重做 DS-03。
4. AI 报告 `VERIFIED` 后，先让它执行 Review Prompt，再决定是否继续。
5. 遇到 `BLOCKED`，提供登录态/浏览器能力，或明确授权 `DEFERRED`；不要要求 AI 猜测凭据、注入 token 或修改数据库。
6. DS-04/DS-05 已完成；不要把 Intent UI 依赖复制到页面迁移路径，未来组件族替换必须另行授权。
7. 最终 Review 通过后，再由项目负责人单独决定提交、推送、合并和部署。

## 10. 文档索引

- [`START-HERE.md`](./START-HERE.md)：项目负责人第一次接手时的最短操作路径。
- [`README.md`](./README.md)：资料包入口和分层说明。
- [`ARCHITECTURE-DECISION.md`](./ARCHITECTURE-DECISION.md)：目录职责和不可变边界。
- [`COMPONENT-CONTRACT.md`](./COMPONENT-CONTRACT.md)：组件 API、状态和可访问性合同。
- [`MIGRATION-PLAN.md`](./MIGRATION-PLAN.md)：阶段执行顺序和回滚策略。
- [`INTENTUI-DECISION.md`](./INTENTUI-DECISION.md)：Intent UI 技术事实和决策门。
- [`DS-04-SPIKE-PROTOCOL.md`](./DS-04-SPIKE-PROTOCOL.md)：Intent UI 独立试验执行协议。
- [`ACCEPTANCE-CHECKLIST.md`](./ACCEPTANCE-CHECKLIST.md)：每批次验收清单。
- [`STATUS.md`](./STATUS.md)：唯一进度和证据台账。
- [`TASK-GOAL-PROMPT.md`](./TASK-GOAL-PROMPT.md)：可直接粘贴的 Goal Prompt。
