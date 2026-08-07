# 前端页面统一化 AI 实施 Prompt v1.0

## 1. 推荐入口

新任务优先使用 [`TASK-GOAL-PROMPT-v1.0.md`](./TASK-GOAL-PROMPT-v1.0.md) 的主任务目标 Prompt；它已经包含 finding 追踪、执行手册、当前 WP-00～WP-07 状态和证据复用协议。本文件保留为兼容入口。

## 2. 对话框短 Prompt

将下面内容直接放入 Goal 模式：

```text
请在当前 /Users/byron/AI/cwgsyw-platform 仓库的 codex/frontend-style-unification 分支上，依据实施文档对 WP-00～WP-07 的最终结果执行独立 Review/Acceptance，不重新实施已完成的工作包。先完整读取根 AGENTS.md、frontend/open-design-refactor/ai-implementation/README.md、AI-IMPLEMENTATION-CONTRACT-v1.0.md、START-HERE-v1.0.md、DELIVERY-REPORT-TEMPLATE-v1.0.md、IMPLEMENTATION-SPEC-v1.0.md、IMPLEMENTATION-PLAN-v1.0.md、TEST-ACCEPTANCE-v1.0.md、IMPLEMENTATION-STATUS-v1.0.md，以及 frontend/open-design-refactor/route-layout-matrix-v2.md、unification-plan-v2.md、frontend/DESIGN_TOKENS.md、frontend/src/components/README.md 和 frontend/MIGRATION.md。只复核 API、权限、路由、query keys、业务状态机、响应式边界、状态反馈、特殊工作区和已有 L0-L3 证据；发现真实问题时再暂停并报告，不要扩大实现范围。Review/Acceptance 结果写回 STATUS，并明确剩余合并前风险。未经我明确授权，不 commit、push、merge、deploy 或切换分支。
```

## 3. 完整执行 Prompt

```text
你是 cwgsyw-platform 的前端统一化主实施工程师。你的任务是依据 frontend/open-design-refactor/ai-implementation/ 下的文档，完成真实可运行、可验证、可回滚的页面统一化。不要把 81 个入口逐页美化；按页面模板和下沉业务组件治理。

一、强制阅读

1. 根 AGENTS.md 以及目标目录链路上适用的 AGENTS.md。
2. frontend/open-design-refactor/ai-implementation/README.md。
3. IMPLEMENTATION-SPEC-v1.0.md。
4. IMPLEMENTATION-PLAN-v1.0.md。
5. TEST-ACCEPTANCE-v1.0.md。
6. IMPLEMENTATION-STATUS-v1.0.md。
7. route-layout-matrix-v2.md 和 unification-plan-v2.md。
8. frontend/DESIGN_TOKENS.md、frontend/src/components/README.md、frontend/MIGRATION.md。

完整阅读，不要只读摘要。冲突按 README 的权威顺序处理；当前用户消息优先。

二、总目标

建立 PageShell/FormShell/WorkspaceShell、DetailHeader、WorkspaceToolbar 等最小共享模板，统一 Dashboard Shell、标准列表、详情、表单、工作台和特殊工作区的外壳、状态反馈、操作区和响应式行为。该实现目标已按 WP-00～WP-07 完成；当前只进行独立 Review/Acceptance，不重做已 VERIFIED 的工作包。

三、绝对保护边界

- 不改后端 API、DTO、数据库、migration、权限资源或业务状态机。
- 不改路由地址、动态参数、重定向、React Query query key、分页和筛选参数。
- 不改变 CMDB、Workflow、Wiki、文件、空间布局、BPMN、ReactFlow、Markdown 的领域行为。
- 不一次性删除 components/ui，不进行全库正则替换，不新增长期 alias 或双体系扩散。
- 不把特殊工作区强制改成普通 Card/List 页面。
- 不覆盖、reset、checkout、删除用户已有修改或无关文件。

四、执行纪律

1. 开始先检查 git status --short --branch、git diff --stat 和当前分支。
2. 从 IMPLEMENTATION-STATUS-v1.0.md 第一个未完成工作包继续，已具备有效证据的工作不重复做。
3. 探索陌生模块时使用 GitNexus query/context；编辑任何函数、类或方法前执行准确 symbol 的 upstream impact。
4. impact 为 HIGH/CRITICAL 时，先在 commentary 报告直接调用方、受影响流程、风险和缓解方式；没有用户确认不要扩大高风险范围。
5. 人工编辑使用 apply_patch；不使用 destructive git 命令。
6. 每完成一个工作包，先运行对应验证，再更新 IMPLEMENTATION-STATUS-v1.0.md，最后运行 detect_changes。
7. 持续工作每 30-60 秒给出简短进展，说明发现、修改和验证状态。

五、实施顺序

WP-00：只读基线和契约冻结。记录 81 个入口、组件使用统计、命令可用性和代表路由；不改业务代码。

WP-01：实现最小共享模板。模板只负责布局、间距、slot 和状态，不请求 API、不读取权限、不包含领域逻辑。

WP-02：统一 Dashboard layout、Header、Sidebar 和普通页/表单/工作区滚动边界。保留权限守卫、搜索、通知、用户菜单和导航地址。

WP-03：先迁移 /cmdb/alerts、/change-docs、/users 三个列表试点。试点未通过，不扩展批量迁移。

WP-04：迁移 /devices、/groups、/workflow/instances、/ipam、/admin/audit、/cmdb/instances/by-model/[modelCode]。

WP-05：迁移 CMDB/设备/IPAM/变更文档/任务的详情与表单，统一返回、状态、字段分组、保存和错误反馈。

WP-06：迁移拓扑、2D、影响分析、空间布局、BPMN、Wiki 图谱、文件预览和任务模板设计器，只统一 WorkspaceShell、工具栏、面板边界和状态。

WP-07：已处理账号、通知目标、日历、管理配置、任务分析、Wiki 列表等低频页面，并完成静态扫描、状态收口和三视口验收。

六、验证合同

- 每个页面/工作区覆盖 loading、error、empty、permission denied 和 narrow viewport。
- 每个工作包至少验证 1440x900、1024x768、390x844 中目标路由；截图或等价证据必须记录。
- 运行 git diff --check、frontend lint、typecheck、build（存在时）和相关测试。
- 使用真实点击验证首页 -> 模块 -> 列表 -> 详情/编辑 -> 返回，以及筛选、分页、Dialog、主操作和权限守卫。
- 特殊工作区检查画布非空、 framing 正确、工具栏/文字/面板无重叠、无双滚动条。
- 提交或最终验收前运行 detect_changes，确认没有超出当前工作包的符号和执行流影响。
- 区分基线失败、本次失败、环境阻塞、未执行和通过；不得把未验证写成通过。

七、暂停条件

只有以下情况才暂停并请求用户决定：需要改变 API/权限/路由/业务状态机；impact HIGH/CRITICAL 且无法通过拆分降低风险；发现用户修改与目标文件冲突且无法安全合并；测试环境需要外部授权或破坏性操作；统一抽象需要单页大量例外 props。普通的组件命名、间距和迁移顺序由你采用现有代码中最保守且可回滚的方案。

八、完成定义

只有 WP-00 至 WP-07 全部 VERIFIED 或有明确授权的 DEFERRED，TEST-ACCEPTANCE 的 P0 全部通过、P1 无未解释失败、命令和视觉证据已写入状态文件、detect_changes 符合预期、工作树无临时无关改动，才可报告目标完成。
```

## 4. 续跑 Prompt

```text
继续当前 cwgsyw-platform 前端页面统一化 Goal。先读取 frontend/open-design-refactor/ai-implementation/IMPLEMENTATION-STATUS-v1.0.md、README.md 和当前工作包所需的 SPEC/PLAN/TEST 文档，检查 git status 和最新用户指令；从第一个未完成工作包继续，不重做已有有效证据。保持 API、权限、路由、query keys、业务状态机和特殊工作区领域行为不变。编辑 symbol 前执行并报告 GitNexus upstream impact，完成工作包后运行对应 lint/typecheck/测试、真实路由和 1440/1024/390 验收，更新状态并执行 detect_changes。普通选择自行推进；只有行为边界、高风险或外部授权阻塞才暂停。未经明确要求不 commit、push、merge、deploy 或切换分支。
```
