# Design System 统一实施状态 v1.2

## 当前状态

- 状态：`DS-04_VERIFIED / DS-05_DECIDED_BASE_UI / DS-06_STATIC_AUDIT_VERIFIED / AWAITING_OWNER_REVIEW / LEGACY_DELETE_DEFERRED`
- 分支：`codex/frontend-style-unification`
- 代码实施：DS-00、DS-01、DS-02、DS-03 已 `VERIFIED`；业务源码直接 `ui/v2` import 为 0
- 当前执行点：DS-04、DS-05 和 DS-06 静态审计均已完成，当前等待项目负责人 review；未授权前不删除 legacy 入口、不提交、不推送、不合并、不部署
- 本资料包是否允许删除 `components/ui` / `components/v2`：否
- Intent UI 决策：不作为当前默认底层；保留隔离 spike 作为后续按组件族评估的可回滚候选
- 当前权威入口：[`MASTER-PLAN.md`](./MASTER-PLAN.md)
- 页面统一化状态：由 `docs/open-design-refactor/ai-implementation/IMPLEMENTATION-STATUS-v1.0.md` 单独维护，不能与 DS 状态混用

## 基线观察

- Tailwind CSS 4 已启用。
- `components/ui` 使用 Base UI 交互实现。
- `components/v2` 同时存在包装组件和自定义视觉组件。
- `components/shared` 是页面级组合层，应独立保留。
- 当前工作树已有前端页面统一化修改和未追踪文档，后续实施必须先核对 dirty worktree。

## DS-00 基线证据（2026-08-04）

### 工作区和索引

- 分支：`codex/frontend-style-unification`
- 工作区：已有大量前端页面统一化修改，以及未追踪的 `docs/open-design-refactor/ai-implementation/`、`docs/open-design-refactor/design-system-unification/`、`route-layout-matrix-v2.md` 和 `unification-plan-v2.md`；本工作包未覆盖、回滚或删除这些文件。
- GitNexus：`node .gitnexus/run.cjs status` 显示索引最新，索引提交和当前提交均为 `0a68c4e`。

### 组件清单

| 层 | 实际文件数 | 组件文件 |
|---|---:|---|
| `components/ui` | 18 | `alert-dialog`, `avatar`, `badge`, `button`, `card`, `checkbox`, `dialog`, `dropdown-menu`, `input`, `label`, `select`, `separator`, `skeleton`, `sonner`, `switch`, `table`, `textarea`, `tooltip` |
| `components/v2` | 11 + `index.ts` | `Button`, `Card`, `Checkbox`, `Chip`, `Dialog`, `Input`, `Label`, `Select`, `StatusBadge`, `Switch`, `Textarea` |
| `components/shared` | 15 | `DataTable`, `DetailDrawer`, `DetailHeader`, `EmptyState`, `ErrorBoundary`, `ErrorState`, `FilterBar`, `LoadingState`, `MetricCard`, `PageHeader`, `PageShell`, `Pagination`, `PermissionGuard`, `Toolbar`, `WorkspaceShell` |

### 公开导出和重复 API

- `ui` 通过文件级导出暴露 18 个基础组件族；其中 Dialog、AlertDialog、Card、Table、Select、DropdownMenu、Avatar 还暴露多个子组件。
- `v2/index.ts` 当前公开 `Button`、`Card`、`StatusBadge`、`Chip`、`Input`、`Textarea`、`Label`、`Select`、`Checkbox`、`Switch`、`Dialog` 及其子组件。
- 重叠组件族为 `Button`、`Card`、`Checkbox`、`Dialog`、`Input`、`Label`、`Select`、`Switch`、`Textarea`；`v2` 主要是 `ui` 的 V2 token 包装，`StatusBadge`/`Chip` 是 V2 专有语义组件。
- `ui` 还包含 `Badge`、`Table`、`Tooltip`、`DropdownMenu`、`Skeleton`、`Avatar`、`Separator`、`Toast/Toaster` 等目前没有对应 V2 基础入口的组件。

### 业务引用范围

- 直接引用 `components/ui` 的源码文件：约 `59` 个，匹配 import 行约 `109` 行；引用集中在 CMDB、空间布局、工作流、文件预览、布局组件和多个业务对话框。
- 引用 `components/v2` 的源码文件：约 `116` 个，匹配 import 行约 `356` 行；主要使用 `Button`（约 82 个 import 语句）、`Input`（约 64 个）、`StatusBadge`（约 41 个）、`Label`（约 38 个）。
- 引用 `components/shared` 的源码文件：约 `76` 个，匹配 import 行约 `81` 行；`shared` 已经承担页面 Shell、表格、抽屉、状态和工作区组合。
- 结论：旧入口不能直接删除；DS-01/DS-02 必须先提供兼容入口，DS-03 才能按模块逐批减少直接引用。

### Token 基线

- `frontend/src/app/globals.css` 定义 `34` 个 `--v2-*` token，并通过 Tailwind 主题暴露对应工具类。
- 高频工具类包括 `text-v2-muted`、`text-v2-fg`、`border-v2-border`、`bg-v2-surface`、`rounded-v2-md`；业务源码仍存在 `text-v2-warn`、`text-v2-accent`、`bg-v2-canvas`、`shadow-v2-lg` 等未在当前 token 定义中明确对应的类名，需在后续 token 审计中单独处理，不能在 DS-01 顺手改业务视觉。
- 组件源码没有检测到直接硬编码 hex/rgb/oklch 颜色；当前视觉主要通过 `--v2-*` 工具类和 `cn` 合并。

### 验证基线

| 检查 | 结果 | 说明 |
|---|---|---|
| `node .gitnexus/run.cjs status` | `PASS` | 索引最新，当前提交 `0a68c4e` |
| `git diff --check` | `PASS` | 当前工作区无空白错误 |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个既有 warnings；本工作包未修改源码，不能将 warnings 归因于 DS-00 |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功；存在 workspace root 多 lockfile warning |
| `cd frontend && npm test` | `NOT_RUN` | `frontend/package.json` 没有 test script |
| GitNexus upstream impact | `NOT_APPLICABLE` | DS-00 只读盘点和状态文档更新，没有修改函数、类或方法 |
| `detect_changes()` | `NOT_RUN` | 当前工具面未提供可调用的 GitNexus detect_changes MCP；未提交，不以此作为代码验收证据 |
| 运行时/三种 viewport | `NOT_RUN` | DS-00 不改变代码；运行时证据留到组件/页面迁移批次 |

### DS-00 退出结论

- 基线、组件清单、重复 API、业务引用范围、token 和验证命令已写入本台账。
- 结果：`VERIFIED`
- 遗留风险：`ui` 与 `v2` 仍存在大量直接引用；`v2` 的 `Chip` 未进入统一公开 index；部分历史 `v2-*` 工具类没有明确 token 定义；工作区存在用户既有 dirty changes。
- 下一步：进入 `DS-03` 批次 3，按页面模块逐批把 CMDB 普通列表、详情、关联和外围业务组件导入到 `@/components/design-system`。

## DS-01 / DS-02 实施证据（2026-08-04）

### DS-01：统一公开入口

- 新增 `frontend/src/components/design-system/`，包含 20 个基础组件入口和统一 `index.ts`。
- 目标入口覆盖 Button、Card、StatusBadge、Chip、Input、Textarea、Label、Checkbox、Switch、Select、Dialog、AlertDialog、Badge、Table、Tooltip、DropdownMenu、Skeleton、Avatar、Separator、Toaster。
- 本阶段没有修改业务页面导入、API、权限、路由、query key 或领域组件行为。
- 对新增文件没有可用 GitNexus symbol；以文件级导出清单和 TypeScript/build 结果作为影响评估。

### DS-02：V2 canonical 下沉和兼容层

- 将 V2 的实际实现下沉到 `components/design-system`，保留原有 V2 props、ref、状态和 `--v2-*` token 语义。
- 将 `components/v2/*.tsx` 改为单向兼容 re-export 到 `components/design-system`；旧页面无需一次性修改即可继续工作。
- `components/ui` 仍保留为 Base UI 底层实现，供 design-system 内部使用；没有删除旧目录。
- 迁移前 GitNexus upstream impact：`Button` 为 `CRITICAL`（191 个上游符号、40 条流程），`Card` 为 `CRITICAL`（70 个上游符号、19 条流程），`Input` 为 `CRITICAL`（76 个直接上游符号、28 条流程），`SelectTrigger` 为 `CRITICAL`（49 个上游符号、15 条流程），`DialogContent` 为 `CRITICAL`（38 个上游符号、14 条流程），`DialogDescription` 为 `HIGH`（5 个上游符号、3 条流程），`DialogFooter` 为 `CRITICAL`（30 个上游符号、12 条流程），`Chip` 为 `LOW`（5 个上游符号、1 条流程）。高风险通过保留旧路径 re-export 和不改变组件调用合同缓解。

### DS-01 / DS-02 验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | 新入口和兼容层无空白错误 |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个 warnings，数量与基线相同 |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，路由清单未改变 |
| `node .gitnexus/run.cjs detect_changes --repo '/Users/byron/AI/cwgsyw-platform' --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 检测到 71 个文件、103 个索引符号和 73 条流程；结果包含用户既有 dirty changes，整体风险为 `CRITICAL`，不能将其当作本批次独立影响 |
| `cd frontend && npm test` | `NOT_RUN` | 没有 test script |
| 运行时/三种 viewport | `NOT_RUN` | 本批次未改变页面入口，待 DS-03 页面批次执行 |

### DS-01 / DS-02 结论

- 结果：`VERIFIED`
- 遗留风险：业务源码仍有大量直接 `ui/v2` 引用；`buttonVariants`、Avatar、DropdownMenu 等旧 UI API 尚未全部纳入页面迁移；当前 worktree 的既有页面统一化修改使全量 detect_changes 结果包含额外噪声。
- 下一步：进入 DS-03 第一批，迁移账户/登录/布局入口的基础组件导入，不修改页面业务行为。

## DS-03 批次 1 实施证据（2026-08-04）

### 范围

- 账户页面：`account/password`、`account/profile`、`account/setup`。
- 认证页：`(auth)/login`。
- 账户表单：`ProfileForm`、`AccountSetupForm`、`PasswordForm`。
- 全局入口：`app/layout.tsx` 的 Toaster、`layout/Header.tsx`、`layout/CommandPalette.tsx`。
- 只改基础组件 import：旧的 `@/components/v2/*` 和 `@/components/ui/*` 改为 `@/components/design-system`；没有改 API、权限、路由、query key、表单字段或状态机。

### impact

- 账户页面和表单：`AccountProfilePage`、`AccountSetupPage`、`AccountPasswordPage`、`LoginPage`、`ProfileForm`、`AccountSetupForm`、`PasswordForm` 均为 `LOW`；表单调用关系只连接到对应账户页面。
- 布局原语：`Avatar` 为 `LOW`；`DropdownMenu` 为 `CRITICAL`（4 个直接上游符号、5 条流程）；`DialogPortal`/`DialogOverlay` 为 `CRITICAL`（各 2 个直接上游符号、11 条流程）；`Dialog` 为 `HIGH`。本批次只改 import，保留底层实现和组合方式。

### 验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | 本批次无空白错误 |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个 warnings，未新增 error |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，路由清单未改变 |
| `node .gitnexus/run.cjs detect_changes --repo '/Users/byron/AI/cwgsyw-platform' --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 结果包含用户既有修改，当前全量检测为 78 个文件、101 个索引符号、73 条流程、`CRITICAL`；未发现本批次独有的业务流程变化 |
| 运行时/三种 viewport | `NOT_RUN` | 当前环境未启动带授权数据的浏览器验收；需在批次页面验证时执行 |

### 结论

- 结果：`PASS`
- 旧入口引用已在账户/认证/全局布局范围减少；旧目录和兼容层继续保留。
- 遗留风险：真实登录态下的 Header 用户菜单、CommandPalette 焦点和 Toaster 尚未做 1440x900/1024x768/390x844 浏览器验收。
- 下一步：进入 DS-03 批次 2，迁移用户、组、设备、IPAM、变更文档页面及其外围业务组件。

## DS-03 批次 2 实施证据（2026-08-04）

### 范围

- 页面：用户、组、设备、IPAM、变更文档列表/新建/详情。
- 业务组件：用户授权/用户对话框、组生命周期/组成员对话框、设备凭据行、变更文档字段和表格编辑器、变更文档动作栏/模板选择器/CI 选择器。
- 统一入口：所有上述文件的基础组件 import 已切换到 `@/components/design-system`；迁移范围内不再直接引用 `@/components/v2/*` 或 `@/components/ui/*`。
- 业务边界：未修改 API、DTO、权限资源、路由、query key、分页/筛选参数、表单字段或业务状态机。

### 兼容合同

- 盘点发现旧 `ui/button` 调用还使用 `outline/default/destructive/link` variant 和 `icon/icon-xs/icon-sm/icon-lg` size。
- 在 canonical `design-system/Button.tsx` 中增加了显式类型化 legacy 别名和 V2 token 样式映射；没有使用 `any`，也没有修改调用方事件、disabled 或 ref 语义。
- 旧 `v2` 页面仍通过 compatibility re-export 可用，后续未迁移模块可以继续工作。

### impact

- 页面入口和大多数业务组合组件为 `LOW`；`UserAuthorizationDialog` 只影响 `UsersPage`，`CredentialRow` 只影响 `DeviceDetailPage`，`FieldList`/`TableFieldEditor` 只影响变更文档详情/新建流程。
- canonical `Button` 当前 GitNexus upstream impact 为 `CRITICAL`（197 个上游符号、46 条流程）；本批次通过保持 props/variant/size 兼容和只改 import 路径缓解。

### 验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | 本批次无空白错误 |
| 迁移范围 legacy import 扫描 | `PASS` | 用户/组/设备/IPAM/变更文档及外围组件无直接 `ui/v2` import |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个 warnings，未新增 error |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，路由清单未改变 |
| `node .gitnexus/run.cjs detect_changes --repo '/Users/byron/AI/cwgsyw-platform' --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 当前全量检测为 91 个文件、84 个索引符号、72 条流程、`CRITICAL`；包含用户既有 dirty changes |
| `cd frontend && npm test` | `NOT_RUN` | 没有 test script |
| 运行时/三种 viewport | `NOT_RUN` | 尚未使用授权浏览器执行真实列表/详情/对话框验收 |

### 结论

- 结果：`PASS`
- 遗留风险：第二批页面仍需真实登录态验证弹窗焦点、表单提交、表格内部滚动和移动端布局；旧入口仍存在于 CMDB、任务/工作流、Wiki/文件和特殊工作区。
- 下一步：进入 DS-03 批次 3，迁移 CMDB 普通列表、详情、关联和外围业务组件；保留空间布局、拓扑、React Flow 等专业画布边界。

## 工作包

| 工作包 | 内容 | 状态 |
|---|---|---|
| DS-00 | 基线、组件清单和合同冻结 | `VERIFIED` |
| DS-01 | 建立 `components/design-system` 入口 | `VERIFIED` |
| DS-02 | V2 兼容层转发和首批基础组件迁移 | `VERIFIED` |
| DS-03 | 业务页面迁移和运行时验收 | `VERIFIED` |
| DS-04 | Intent UI Button/Input/Dialog/Select/表单 spike | `VERIFIED` |
| DS-05 | Intent UI 采用决策和后续迁移 | `DECIDED_BASE_UI_DEFAULT` |
| DS-06 | legacy 静态收口和最终审计 | `STATIC_AUDIT_VERIFIED / LEGACY_DELETE_DEFERRED` |

## 状态记录格式

后续每个工作包追加：

```text
日期：YYYY-MM-DD
工作包：DS-xx
目标：
修改文件：
impact：
静态验证：
运行时验证：
detect_changes：
结果：PASS / FAIL / BLOCKED / NOT_RUN / VERIFIED
遗留风险：
下一步：
```

当前已完成并验证 DS-00、DS-01、DS-02、DS-03；DS-04 隔离 spike 已完成静态验证。未修改 API、权限、路由、query key、数据库或领域状态机；下一执行点是解除浏览器扩展阻塞并补齐 DS-04 剩余运行时矩阵。

## 当前执行口径

- DS-03 批次 1～6 的代码迁移、静态门禁和代表性运行时矩阵已经通过；历史记录中的 `NOT_RUN`/`BLOCKED` 保留为当时事实，由文末新增的恢复验收记录解除总体依赖门。
- 当前不再修改业务 import。专业工作区继续保留 React Flow、Konva、Markdown 和几何交互边界。
- DS-04 依赖和代码只允许留在隔离目录；当前已创建隔离 worktree，主分支不引入 React Aria 依赖。
- 后续记录继续采用追加方式，不回写历史记录制造“当时已通过”的表述。

## DS-03 批次 3 实施证据（2026-08-04）

### 范围

- CMDB 总览：`cmdb/page.tsx`。
- CMDB 管理：模型目录、模型卡片、属性分组、关联类型/定义、模型详情和属性新增/编辑/列表。
- CMDB 普通页面：告警、全局变更、变更统计和影响分析。
- 统一入口：上述 14 个文件的基础组件 import 已切换到 `@/components/design-system`。
- 专业工作区边界：拓扑、拓扑比较、2D 视图和 `features/cmdb-spatial` 未纳入本批；其 React Flow、Konva、画布和领域交互保持不变。
- 业务边界：本批只修改 import 声明，未修改 API、DTO、权限、路由、query key、分页/筛选参数、表单字段或状态机。

### impact

- 编辑前对 21 个准确 symbol 执行 GitNexus upstream impact：`CmdbOverviewPage`、`ModelGroupCatalog`、`Metric`、`ModelCard`、`AssociationDefsSection`、`AssociationsTab`、`AttributeGroupsTab`、`ModelCatalogTab`、`AddAttributeDialog`、`AttributeList`、`EditAttributeDialog`、`ModelDetailPage`、`CmdbAlertsPage`、`CmdbChangesPage`、`ActionCountCard`、`DailyBarChart`、`CmdbChangesStatsPage`、`ImpactAnalysisPage`、`ImpactError`、`ImpactRootCard`、`ImpactNodeCard`。
- 结果全部为 `LOW`。最多只影响 CMDB `AdminPage` 或当前页面自身流程，没有跨模块 HIGH/CRITICAL 风险。
- 缓解方式：不改变函数体和组件 props，只把旧 `ui/v2` 导入改为 canonical design-system 导入；底层实现和兼容 re-export 保持不变。

### 验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | 当前工作树无空白错误 |
| 批次 legacy import 扫描 | `PASS` | 本批普通 CMDB 页面/组件无直接 `ui/v2` import；只剩拓扑、2D 和空间布局专业工作区 |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个既有 warnings |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，生成 55 个路由 |
| `cd frontend && npm test` | `NOT_RUN` | `package.json` 没有 test script |
| `node .gitnexus/run.cjs detect_changes --repo cwgsyw-platform --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 累计工作树为 117 个文件、105 个 symbol、72 条流程、`CRITICAL`；包含页面统一化及前两批既有修改，不能归因于本批单独风险 |
| development 真实路由/三种 viewport | `BLOCKED` | Chrome 被另一个扩展浮层占用；应用内浏览器在当前环境不可用。未绕过扩展、注入 token 或伪造 L2/L3 证据 |

### 结论

- 结果：`PASS_STATIC / RUNTIME_BLOCKED`
- 本批代码和静态门禁完成，但不能标记 `VERIFIED`，DS-03 总体依赖门仍未解除。
- 恢复条件：提供可正常控制的授权 development 浏览器页面后，补做 `/cmdb`、`/cmdb/admin`、`/cmdb/admin/models/{modelCode}`、`/cmdb/alerts`、`/cmdb/changes`、`/cmdb/changes/stats` 和 `/cmdb/impact/{instanceId}` 的真实加载、主要操作、Dialog、内部滚动及 `1440x900`、`1024x768`、`390x844` 验收。
- 下一步：继续 DS-03 批次 4 的任务、工作流、运维日历和普通管理页面 canonical import 迁移；运行时证据继续作为未解除依赖门保留。

## DS-03 批次 4 实施证据（2026-08-04）

### 范围

- 任务体系：任务模板、计划、运行时、分析看板、指标、自动化、审批待办和工作项组件。
- Workflow：管理、绑定、新建/编辑设计、实例、统计和模板页面；BPMN 编辑器/查看器领域实现未修改。
- 运维日历：月/周/列表外围页面、排班、节假日、日工作项 Dialog 和首页日历卡片。
- 普通页面：Dashboard 首页、通知及目标解析、RBAC、后台 AI/审计/备份/变更文档模板/系统配置。
- 共享外围：`RoleDialog`、`PermissionDiffDetails`、`ResourceAccessDialog` 和 `ErrorState`。
- 本批 50 个文件只切换基础组件 import；API、权限、路由、query key、表单字段、审批/发布状态机、BPMN XML 和画布行为均保持不变。

### impact

- 任务小批：21 个主 symbol 全部为 `LOW`；影响限制在任务分析、计划、运行、模板、审批待办和运维日历调用链。
- Workflow 小批：10 个页面/局部 symbol 全部为 `LOW`；BPMN 新建/编辑页只迁移外围 Button/Input/Label 入口。
- 日历/普通管理小批：除以下两项外均为 `LOW`。
- `ResourceAccessDialog` 为 `HIGH`：3 个直接调用方，影响 Wiki 页面、Wiki 空间和文件页 3 类流程。
- `ErrorState` 为 `CRITICAL`：29 个直接调用方、15 条流程、3 个模块。
- 高风险缓解：两项只修改自身的基础组件 import，未改 props、DOM、事件、权限位计算、错误恢复或调用方；在 LOW 范围通过后单独迁移，并执行调用方扫描、typecheck 和全量 build。

### 验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | 当前工作树无空白错误 |
| 批次 legacy import 扫描 | `PASS` | 任务、Workflow、日历、通知、RBAC、后台和外围组件无直接 `ui/v2` import |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个既有 warnings |
| `cd frontend && npm run typecheck` | `PASS` | 每个小批及高风险两项迁移后均通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，生成 55 个路由 |
| `cd frontend && npm test` | `NOT_RUN` | `package.json` 没有 test script |
| `node .gitnexus/run.cjs detect_changes --repo cwgsyw-platform --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 累计工作树为 148 个文件、107 个 symbol、72 条流程、`CRITICAL`；结果包含所有既有页面统一化和 DS 批次修改 |
| development 真实路由/三种 viewport | `BLOCKED` | 同一 Chrome 扩展浮层阻断自动化；应用内浏览器不可用，未用 L0/L1 替代 L2/L3 |

### 结论

- 结果：`PASS_STATIC / RUNTIME_BLOCKED`
- 批次 4 静态迁移完成；业务 legacy import 从批次前 71 个文件下降到 21 个文件。
- 剩余范围只在 Wiki/文件和 CMDB 拓扑、2D、空间布局专业工作区。
- 下一步：进入 DS-03 批次 5，迁移 Wiki/文件普通页面和特殊工作区外围工具栏；画布/编辑器领域实现保持不变。

## DS-03 批次 5 / 批次 6 实施证据（2026-08-04）

### 范围

- Wiki/文件：空间列表、空间首页、阅读、编辑、搜索、树导航、评论、版本、文件列表、审计和文件预览。
- 专业工作区：CMDB 拓扑、拓扑比较、2D 视图，以及空间布局索引、选择面板、版本、编辑器、viewer 和 canvas spike。
- 领域边界：Markdown 编辑器、文档预览、React Flow、Konva、动态 Stage、几何计算、缩放、发布和版本行为均保持不变。
- 收口扫描：业务页面和业务组件不再直接引用 `@/components/ui/*` 或 `@/components/v2/*`。

### impact

- Wiki/文件批次：15 个页面/组件 symbol 全部为 `LOW`，影响限制在文件页/预览和 Wiki 阅读、编辑、搜索、评论、版本及树导航自身流程。
- 专业工作区：12 个页面/编辑器/查看器 symbol 全部为 `LOW`，只影响各自页面或编辑器/查看器内部调用。
- 缓解方式：只切基础组件 import，不修改领域函数体、props、事件、API、权限、路由或状态机。

### 架构收口

- 业务源码直接 legacy import：`0`。
- `components/design-system` 内部实现引用 `components/ui`：17 条，符合内部实现边界。
- `components/ui` 内部组合引用：2 条，均为 Dialog/AlertDialog 复用 Button。
- `components/v2`：只单向 re-export `components/design-system`，没有第二套行为实现。
- `design-system/ui/v2` 对 `components/shared` 的反向依赖：`0`。

### 验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | 当前工作树无空白错误 |
| 全业务 legacy import 扫描 | `PASS` | 排除 design-system/ui/v2 内部后匹配为 0 |
| 基础层反向依赖扫描 | `PASS` | design-system/ui/v2 不依赖 shared |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个既有 warnings |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，生成 55 个路由 |
| `cd frontend && npm test` | `NOT_RUN` | `package.json` 没有 test script |
| `node .gitnexus/run.cjs detect_changes --repo cwgsyw-platform --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 累计工作树为 161 个文件、107 个 symbol、72 条流程、`CRITICAL`；范围包括全部页面统一化和 DS 迁移 |
| development 真实路由/三种 viewport | `BLOCKED` | Chrome 扩展浮层仍阻断自动化；应用内浏览器不可用 |

### 结论

- 结果：`PASS_STATIC / RUNTIME_BLOCKED`
- DS-03 的代码迁移和静态收口完成，但批次 1～6 的缺失 L2/L3 证据仍未补齐，因此 DS-03 不能标记 `VERIFIED`。
- DS-04 已在隔离 worktree 启动并完成静态验证；DS-05 继续受 DS-04 剩余运行时矩阵约束。
- 下一步：增加自动化 import 边界，避免业务代码重新引入 legacy 路径；浏览器恢复后统一补齐代表模块的真实路由和三种 viewport 验收。

## DS-03 静态边界与执行文档收口（2026-08-04）

### ESLint import 边界

- `frontend/eslint.config.mjs` 已对业务 `src/**/*.{ts,tsx}` 禁止导入 `@/components/ui` 和 `@/components/v2`；`components/design-system`、`components/ui`、`components/v2` 内部目录保留实现所需例外。
- 修改前对 `eslintConfig` 执行 GitNexus upstream impact，结果为 `LOW`；影响限制在前端 lint 配置，不涉及业务执行流。
- `eslint --print-config` 确认业务页面的 `no-restricted-imports` 为 `error`，内部实现目录为 `off`。
- 负向 stdin 测试确认新增 legacy 业务 import 会产生 1 个 `no-restricted-imports` error；测试通过 shell 断言预期失败，没有生成源码文件。

### 当前静态证据

| 检查 | 结果 | 说明 |
|---|---|---|
| 业务 legacy import 扫描 | `PASS` | 业务页面和业务组件直接 `ui/v2` import 为 0 |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors，36 个既有 warnings |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，生成 55 个路由 |
| ESLint 负向门禁 | `PASS` | 故意使用 legacy import 的 stdin 输入被拒绝 |
| `detect_changes --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 累计 dirty worktree 为 162 个文件、108 个 symbols、72 条流程、`CRITICAL`；不能归因于本次文档或单批迁移 |
| development 运行时 | `BLOCKED` | 缺少可控制的授权浏览器会话，不能标记 DS-03 `VERIFIED` |

### 文档恢复点

- `START-HERE.md`、`README.md`、`MASTER-PLAN.md`、`MIGRATION-PLAN.md` 和 `TASK-GOAL-PROMPT.md` 已统一为：DS-03 批次 1～6 代码/静态完成，当前只补运行时证据。
- Intent UI 的 semantic token、form、overlay、collection 和可访问性约定作为 DS-04 spike 输入；其“业务直接导入 `components/ui`”规则与本仓库 canonical design-system 决策冲突，不采纳。
- 结果：`PASS_STATIC / RUNTIME_BLOCKED`。
- 下一步：浏览器恢复后补齐 DS-03 代表模块真实路由和三种 viewport；全部通过后标记 DS-03 `VERIFIED`，再请求独立实验分支授权并启动 DS-04。

## DS-03 运行时恢复尝试（2026-08-04）

### 环境与登录入口

- `http://127.0.0.1:3003/`、`:3004/`、`:3022/`、`:3023/` 均返回 HTTP 200；development 后端 `:8081/` 根路径返回 403，说明服务可达但根路径受保护。
- Chrome 可打开 `http://127.0.0.1:3004/login`，DOM 中正常出现“用户名”“密码”和“登录”控件，三项均唯一可定位。
- 按用户授权读取 `.env` 的 `FQA_SUPERADMIN_PASSWORD` 并仅用于本地 development 登录；密码未输出、未写入文档、未截图、未持久化。

### 阻塞证据

- 在点击“登录”提交时，Chrome 被另一个扩展 UI 接管并阻止自动化，无法观察登录结果或进入任何授权业务页面。
- 应用内浏览器选择器返回不可用，当前没有第二个受支持的浏览器控制面可完成真实交互。
- 已关闭本次自动化创建且曾填写密码的临时标签；没有保留含凭据的登录页面。
- 该阻塞与 DS-03 批次 3、批次 4、批次 5/6 的历史记录相同，已连续重复，当前无法获得 L2/L3 运行时证据。

### 结论

- 结果：`RUNTIME_BLOCKED`。
- 该条历史记录保留为当时事实；文末恢复验收记录已解除 DS-03 总体依赖门，当前阻塞属于 DS-04 spike 自身运行时矩阵。
- 恢复条件：关闭或完成 Chrome 当前扩展 UI 后重新继续本任务；无需重建服务、重做代码迁移或重新准备文档。

## DS-03 development 运行时验收完成（2026-08-04）

### 环境与边界

- 使用 `http://localhost:3023` 代理访问当前分支构建，API 指向 development 后端；以授权 superadmin 会话完成真实数据验收。
- `FQA_SUPERADMIN_PASSWORD` 只从 `.env` 读取并用于登录，没有输出、写入文档、截图展示或持久化。
- 预览进程曾因旧 `.next` 产物在空间布局详情触发 `ChunkLoadError`；重启当前构建的 Next preview 后消失，判定为预览进程与构建产物不一致的环境问题，不是应用代码回归。
- 控制台仅观察到 Chrome 扩展 `iohjgamcilhbgmhbnllfolmkmmekfmci` 自身的 messaging timeout；应用来源无 error。

### 代表路由与交互证据

- 全局 Shell：首页宽度等于 viewport，主内容区单独承担垂直滚动；用户菜单包含资料、密码、主题和退出；Command Palette 以 Dialog 打开，combobox 可聚焦，Escape 可关闭。
- 账户/用户：`/users` 数据加载正常；新建用户 Dialog 打开后焦点进入首个输入框、body 锁定滚动、Escape 关闭。桌面、1024 和移动端 Dialog 均完整位于 viewport 内。
- CMDB：`/cmdb`、`/cmdb/admin` 正常加载；`/cmdb/alerts` 和 `/cmdb/instances/2d-view` 正确显示空状态；主机 `test-ac5-host` 可打开详情 Dialog。
- CMDB 动态数据：`/cmdb/impact/21` 显示 6 个节点、6 条关联；`/cmdb/topology/21` 的 React Flow 同样稳定显示 6 个节点、6 条关联，工作区无文档级溢出。
- 任务/流程/日历：`/tasks`、`/ops-calendar` 正常显示数据；`/workflow/instances` 正确显示空状态；桌面和 1024 viewport 无文档级横向溢出。
- 空间布局：`/cmdb/spatial/rooms/332` 在 1440、1024、390 viewport 分别渲染两张非空 Konva canvas；尺寸分别为约 `840x747`、`424x578`、`314x532`，无应用错误或文档级溢出。
- Wiki：从可见空间进入 `/wiki/6/364`，阅读页正常显示发布内容；编辑操作进入 `/wiki/6/364/edit`，Markdown 双栏编辑器填满剩余工作区。移动端目录默认收起，展开后以 260px overlay 显示且不压缩正文；目录内部可滚动，底部“知识图谱 / 导出空间”保持可达。
- 文件：从文件列表可见记录进入 `/files/preview/22`，Word 内容正常渲染并填满剩余高度；长文档由预览容器内部滚动，390px 下横向超宽内容也由预览容器内部承载，document 保持 `scrollWidth === clientWidth`。
- 无在线预览能力的 OTHER 文件 `/files/preview/65` 正确显示“不支持在线预览”空状态和下载操作。

### Viewport 矩阵

| Viewport | 代表证据 | 结果 |
|---|---|---|
| `1440x900` | Shell、菜单、Command Palette、用户 Dialog、CMDB、影响/拓扑、任务/流程/日历、Wiki 阅读/编辑、文件预览、Konva | `PASS` |
| `1024x768` | 用户列表/Dialog、运维日历、空间布局；无文档级横向溢出 | `PASS` |
| `390x844` | 用户 Dialog、文件列表/预览、Wiki 编辑和目录 overlay、空间布局；无文档级横向溢出 | `PASS` |

### 本轮发现与修复

- 发现移动端 Wiki 固定 260px 目录与 76px 全局侧栏叠加后，把正文压缩到约 48px，并可能导致底部操作不可达。
- 修改 `wiki/[spaceId]/layout.tsx`：移动端默认收起目录、展开时使用绝对定位 overlay；目录树与底部操作分离为内部可滚动区和固定操作区；桌面仍默认展开。
- 修改前对 `WikiSpaceLayout` 执行 upstream impact，结果 `LOW`：0 个直接上游调用者、0 条受影响流程，只调用 `WikiTreeSidebar` 与 `cn`。修复后已在桌面和移动端真实验证。

### 结论

- 结果：`VERIFIED`。
- 覆盖了真实数据、空状态、Dialog、焦点、Escape、内部滚动、横向溢出、React Flow、Konva、Markdown 编辑器、文件预览以及三种最低 viewport；DS-03 的总体依赖门解除。
- DS-04 当前为 `PASS_STATIC / RUNTIME_BLOCKED`。不得把静态结果升级为完整 PASS；运行时阻塞解除后只补验证，不扩散 spike 依赖。

### 最终静态门禁

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | 当前工作树无空白错误 |
| 业务 legacy import 精确扫描 | `PASS` | 排除 `design-system/ui/v2` 内部目录后，业务 `ui/v2` import 为 0 |
| 基础层反向依赖扫描 | `PASS` | `design-system/ui/v2` 对 `shared` 引用为 0 |
| V2 兼容层检查 | `PASS` | `components/v2` 文件全部仅 re-export `components/design-system` |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors、36 个既有 warnings |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，生成 55 个页面数据项，路由清单完整 |
| `cd frontend && npm test` | `NOT_RUN` | `package.json` 没有 test script |
| `detect_changes --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 累计工作树为 162 个文件、108 个 symbols、72 条流程、`CRITICAL`；范围包含整个页面统一化与 DS 迁移，不能归因于本轮文档收口或 LOW-risk Wiki 修复 |

说明：该累计结果包含全量页面统一化和 DS 迁移，不将其归因于 Button 单点修复或本轮文档。

## Button loading 合同修复（2026-08-04）

### 发现和影响

- `COMPONENT-CONTRACT.md` 要求 canonical `Button` 支持 `loading`，但 `frontend/src/components/design-system/Button.tsx` 原先没有该 prop。
- 修改前对准确 symbol `Button` 执行 GitNexus upstream impact：`CRITICAL`，107 个直接上游符号、197 个累计受影响符号、46 条流程、13 个模块。
- 高风险缓解：只增加 typed `loading?: boolean` 和按钮内部状态；不改变默认 variant/size、ref、事件、children 的可访问名称或业务调用方。

### 实施和行为证据

- `loading=true` 时强制 `disabled`，设置 `aria-busy` 和 `data-loading`，使用绝对定位 spinner，并以透明 children 保留原尺寸。
- `loading=false` 保持原有 children、variant、size、ref、事件和 DOM 语义。
- 一次性本地探针覆盖文本按钮和图标按钮：文本按钮 `126.42x40`、图标按钮 `32x32`；loading 状态均 disabled，点击不会增加计数，普通按钮 accessible name 保持 `Save changes`；应用错误为 0。
- 探针路由已删除：`frontend/src/app/(auth)/login/button-contract-probe/page.tsx`。

### 最终静态门禁

| 检查 | 结果 | 说明 |
|---|---|---|
| `git diff --check` | `PASS` | Button 修复和文档变更无空白错误 |
| `cd frontend && npm run typecheck` | `PASS` | `tsc --noEmit` 通过 |
| `cd frontend && npm run lint` | `PASS_WITH_WARNINGS` | 0 errors、36 个既有 warnings |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack 构建成功，生成 55 个页面数据项 |
| 业务 legacy import 扫描 | `PASS` | 排除 design-system/ui/v2 内部实现后，业务直接 `ui/v2` import 为 0 |
| 基础层反向依赖扫描 | `PASS` | design-system/ui/v2 对 shared 引用为 0 |
| `npm test` | `NOT_RUN` | `frontend/package.json` 没有 test script |
| `detect_changes --scope unstaged` | `PASS_WITH_WORKTREE_NOISE` | 162 文件、108 symbols、72 flows、`CRITICAL`；结果包含累计 dirty worktree |

### 结论

- 结果：`CONTRACT_PATCH_VERIFIED`。
- DS-03 运行时验收仍以本台账文末 `VERIFIED` 记录为准；本次没有重新接入 development 或改变业务路由。
- 当前下一步：按 [`DS-04-SPIKE-PROTOCOL.md`](./DS-04-SPIKE-PROTOCOL.md) 解除浏览器阻塞并补齐 Dialog、Select、表单和移动端运行时证据；不修改主分支业务代码。

## DS-04 Intent UI 独立 Spike（2026-08-04）

### 范围与隔离

- 隔离 worktree：`/Users/byron/AI/cwgsyw-platform-ds04-spike`
- 分支：`codex/design-system-intentui-spike`
- 主分支 `codex/frontend-style-unification` 未加入 React Aria 依赖、spike 路由或适配层代码。
- 依赖仅安装在 spike：`react-aria-components@1.20.0`、`tailwind-variants@3.3.1`；现有 `react-hook-form` 未升级。
- registry 查询确认了 `@intentui` Button/Input/Field/Modal/Select/Popover/Menu 候选；未执行会覆盖现有 `components/ui/button.tsx` 的 registry add。

### 适配层

- `frontend/src/components/design-system/intentui-spike/IntentButton.tsx`
- `frontend/src/components/design-system/intentui-spike/IntentField.tsx`
- `frontend/src/components/design-system/intentui-spike/IntentModal.tsx`
- `frontend/src/components/design-system/intentui-spike/IntentSelect.tsx`
- `frontend/src/components/design-system/intentui-spike/index.ts`
- `frontend/src/lib/primitive.ts`
- 探针页面：`frontend/src/app/(auth)/design-system-intentui-spike/page.tsx`
- 对外保留当前项目 `variant`、`size`、`disabled`、`loading`、`value/defaultValue`、`onChange` 和 ref/事件合同；React Aria `intent`、`isDisabled`、`isPending`、`cx` 仅在适配层内部使用。
- 页面只使用本地 fixture 和 `react-hook-form`，不调用 API、不读取权限、不改变业务状态。
- 适配层复核：字段 description 使用 React Aria `Text slot="description"`，Dialog 使用 `Text slot="description"` 和显式 Close 控件；Select 使用 `items` + render function，未在 collection 中使用 `.map()`。

### impact

- 对现有 canonical `Button` 执行 GitNexus upstream impact：`CRITICAL`，107 个直接上游、197 个累计符号、46 条流程、13 个模块；本 spike 未修改该公共实现。
- 对现有 canonical `Input` 执行 GitNexus upstream impact：`CRITICAL`，77 个直接上游、141 个累计符号、37 条流程、8 个模块；本 spike 未修改该公共实现。
- spike 新增文件尚未进入 GitNexus 索引，没有可用 symbol/caller 图；按协议记为 `NOT_APPLICABLE / new unindexed files`，不把“未检测到”解释为无影响。

### 静态验证

| 检查 | 结果 | 说明 |
|---|---|---|
| `npm run typecheck` | `PASS` | React 19/Next 16 类型检查通过 |
| `npm run lint` | `PASS_WITH_WARNINGS` | 0 errors；36 个既有 warnings，spike 未新增 warning |
| `npm run build` | `PASS` | Next 16.2.12/Turbopack 成功，生成 56 个页面数据项，包含 `/design-system-intentui-spike` |
| `git diff --check` | `PASS` | spike 变更无空白错误 |
| `npm test` | `NOT_RUN` | `frontend/package.json` 没有 test script |
| `npm audit` | `NOT_BLOCKING / RECORDED` | spike 与当前前端同样为 6 moderate、21 high、0 critical；依赖审计不在本 spike 范围内，不能据此宣称安全修复 |

### 浏览器运行时证据

- 使用本地 `http://127.0.0.1:3044/design-system-intentui-spike`，development 业务数据未接入。
- 已通过：默认桌面 viewport 基线无 document 双滚动、无应用错误；`1440x900` 下 Button 主 variant、图标按钮、accessible name、Tab 焦点和稳定尺寸通过；Select 打开后长选项已渲染，页面无横向溢出；浏览器日志无应用 error。
- 未完成：Dialog 首焦点/Escape/外部点击/焦点回收，Select Escape 和内部滚动的完整交互，react-hook-form 校验/提交 loading/防重复提交，以及 `1024x768`、`390x844` 矩阵。
- 阻塞：Chrome 扩展 `iohjgamcilhbgmhbnllfolmkmmekfmci` 的浮层多次接管页面，导致自动化 tab 在后续操作中不可控；应用内浏览器当前不可用。没有绕过扩展、注入 token 或伪造 L2/L3 证据。

### detect_changes 限制

- 主仓库 CLI 对现有 dirty worktree 的全量结果：`163 files / 121 indexed symbols / 72 flows / CRITICAL`，包含用户既有页面统一化修改、主分支文档和历史 DS 迁移，不能归因于 DS-04 spike。
- 新 spike 文件未被主仓库索引，`detect_changes` 无法可靠映射它们；该限制已记录，不能把全量结果当作 spike 独立通过。

### 结论、决策门和回滚

- 当前历史结果：`PASS_STATIC / RUNTIME_BLOCKED`。该段保留为浏览器阻塞期间的事实，不代表最终状态。
- 回滚：删除 `/Users/byron/AI/cwgsyw-platform-ds04-spike` worktree 和 `codex/design-system-intentui-spike` 分支即可；不触碰主分支 dirty worktree，不删除 `components/ui`/`components/v2`。
- 下一步：补充记录已完成的恢复验收，并执行 DS-05 决策记录；不把 spike 依赖扩散到主迁移路径。

## DS-04 运行时恢复验收与 DS-05 决策（2026-08-04）

### 隔离环境

- worktree：`/Users/byron/AI/cwgsyw-platform-ds04-spike`
- 分支：`codex/design-system-intentui-spike`
- 服务：隔离 worktree 生产构建，`http://127.0.0.1:3044/design-system-intentui-spike`
- 依赖：`react-aria-components@1.20.0`、`tailwind-variants@3.3.1`；主分支未引入这些 spike 依赖。
- 页面只使用本地 fixture；不调用 development API、不读取权限、不改变业务状态。

### impact

- `IntentUiSpikePage` upstream impact：`LOW`，0 个直接上游、0 条流程。
- `IntentButton` upstream impact：`LOW`，1 个直接上游（spike 页面）、0 条流程。
- `IntentModal`、`IntentSelect` upstream impact：此前已记录为 `LOW`，各只由 spike 页面调用。
- 未修改 canonical `components/design-system/Button`、`Input` 或任何业务页面；canonical Button/Input 的 `CRITICAL` impact 仅作为不触碰公共实现的风险边界记录。

### 运行时验收

| 场景 | 证据 | 结果 |
|---|---|---|
| Button | primary/secondary/outline/danger、disabled、icon `36x36`、accessible name、Tab 焦点、loading | `PASS` |
| Input | 普通输入、disabled/read-only 输入、`aria-invalid=true`、FieldError、focus-visible | `PASS` |
| Dialog | 首焦点在 dialog、Escape、遮罩点击、显式 Close、焦点回收、长内容子容器滚动 | `PASS` |
| Select | 长列表 `clientHeight=224`、`scrollHeight=756`、选中 `Preview environment 18`、Escape、遮罩点击、焦点回收和定位 | `PASS` |
| Form | 空提交不导航、校验错误可见、提交期间按钮 disabled/pending、快速三击只计一次 | `PASS` |
| Viewport | `1440x900`、`1024x768`、`390x844`；无横向溢出，Dialog 均在 viewport 内 | `PASS` |
| Theme | light/dark 下 `bg-v2-bg`、`bg-v2-surface`、`text-v2-fg` token 实际颜色变化 | `PASS` |
| Overlay scroll | 打开 Dialog 时 `html` 滚动锁定；Dialog/Select 内容各自内部滚动；无应用控制台错误 | `PASS` |

说明：`IntentButton` 的 `aria-busy` 不会被 React Aria DOM 输出；`isPending` 已输出 `data-pending`、`aria-disabled` 和原生 `disabled`，并由 React Aria 承担 pending 的无障碍语义。该行为符合当前 RAC 版本，不视为失败。

### 静态门禁

| 检查 | 结果 | 说明 |
|---|---|---|
| `cd frontend && npm run typecheck` | `PASS` | React 19/Next 16 类型检查通过 |
| `cd frontend && npm run lint -- --quiet` | `PASS` | 0 errors；全量 lint 保持 36 个既有 warnings |
| `cd frontend && npm run build` | `PASS` | Next 16.2.12/Turbopack，生成 56 个页面数据项，包含 spike 路由 |
| `git diff --check` | `PASS` | spike 与文档无空白错误 |
| `cd frontend && npm test` | `NOT_RUN` | `frontend/package.json` 没有 test script |
| GitNexus index status | `PASS` | 隔离 worktree 索引最新 |
| `detect_changes` | `LIMITED` | spike 新增文件未进入索引，主 worktree 全量结果包含用户既有 dirty changes；不能作为 spike 独立符号审计证据 |

### DS-04 结论

- `DS-04_VERIFIED`：组件合同、键盘/焦点、滚动、表单、主题、移动端和构建门禁均通过。
- Intent UI 具备作为 design-system 内部候选的技术可行性；没有发现必须立即回退的核心缺陷。
- 该结论只适用于隔离 spike，不等于批准全站替换，也不把 React Aria 依赖复制到主迁移路径。

### DS-05 采用决策

- 决策：`BASE_UI_DEFAULT`。
- `components/design-system` 继续作为唯一业务公开入口，内部默认保留当前 Base UI 实现。
- 暂不把 `react-aria-components`、`tailwind-variants` 引入主分支，不做全站 Intent UI 替换，不重新修改已完成页面导入。
- 采用理由：当前统一治理目标已通过 design-system 入口和兼容层实现；Intent UI 虽然技术可行，但会引入第二套状态/overlay API、依赖和维护模型，当前收益不足以抵消迁移与回归成本。
- 后续触发条件：若要替换某个高交互组件，必须单独建立组件族迁移任务，保留外部合同，先做 impact、bundle/运行时对比、代表业务模块验收和可回滚演练，再申请授权。
- `DS-06` 最终 legacy 扫描、依赖边界和回滚审计已完成；不删除 `components/ui` 或 `components/v2`，除非另行授权。

## DS-06 最终静态审计（2026-08-04）

### 审计结果

- 业务源码（排除 `components/design-system`、`components/ui`、`components/v2` 内部实现目录）直接导入 `@/components/ui` 或 `@/components/v2`：`0`。
- `components/design-system`、`components/ui`、`components/v2` 反向导入 `@/components/shared`：`0`。
- `components/v2` 仍为单向 compatibility re-export；`components/ui` 仅作为 design-system 的内部实现，符合当前架构边界。
- ESLint `no-restricted-imports` 负向门禁已验证，业务新增 legacy import 会被拒绝。
- 主分支未引入 spike 的 `react-aria-components`、`tailwind-variants` 依赖；Intent UI 代码仅存在于隔离 worktree。

### DS-06 结论

- 结果：`STATIC_AUDIT_VERIFIED / LEGACY_DELETE_DEFERRED`。
- UI/V2 合并的公开入口、兼容层、业务迁移、Intent UI 技术决策和静态边界均已收口。
- `components/ui` 和 `components/v2` 不在本轮删除范围；删除、归档或清理必须由负责人另行授权，并在独立变更中完成回滚演练。
- 当前可以进入项目负责人 review；未授权前不 commit、push、merge、deploy 或删除旧目录。
