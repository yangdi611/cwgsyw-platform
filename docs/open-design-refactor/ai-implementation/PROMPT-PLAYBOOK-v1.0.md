# 前端页面统一化 Prompt Playbook v1.0

本文件用于只执行一个工作包、进行代码审查或进行运行时验收。所有 Prompt 默认作用于当前 `codex/frontend-style-unification` 分支，不自动创建分支，不 commit/push/deploy/merge。执行前先读取 `AI-IMPLEMENTATION-CONTRACT-v1.0.md`、`FINDING-TRACEABILITY-v1.0.md`、`AI-EXECUTION-RUNBOOK-v1.0.md` 和 `DELIVERY-REPORT-TEMPLATE-v1.0.md`；状态以 `IMPLEMENTATION-STATUS-v1.0.md` 为准。若状态文件显示更早的 `IN_PROGRESS`，不得因为本文件的章节顺序跳过它。

## 1. WP-00 基线 Prompt

```text
只执行前端页面统一化 WP-00。读取 docs/open-design-refactor/ai-implementation/README.md、IMPLEMENTATION-SPEC-v1.0.md、IMPLEMENTATION-PLAN-v1.0.md、TEST-ACCEPTANCE-v1.0.md 和 IMPLEMENTATION-STATUS-v1.0.md。检查当前分支和工作树，确认用户修改；对 81 个 page.tsx 和共享组件做只读静态盘点，确认 lint/typecheck/build/test 命令，选取首页、CMDB、标准列表、详情/表单和特殊工作区作为代表路由。不要修改业务代码。把命令结果、基线失败、环境阻塞和代表路由证据写回 IMPLEMENTATION-STATUS-v1.0.md；完成后运行 git diff --check 并报告下一步 WP-01。
```

## 2. WP-01 共享模板 Prompt

```text
只执行前端页面统一化 WP-01。先读取状态文件和 SPEC/PLAN/TEST 文档，检查 WP-00 是否有有效证据。对计划修改的 PageHeader、shared layout symbols 和新增模板执行 GitNexus upstream impact；HIGH/CRITICAL 先报告。实现最小 PageShell、FormShell、WorkspaceShell、DetailHeader、WorkspaceToolbar，或在已有组件上做行为保持的扩展。模板不得请求 API、读取权限或包含领域逻辑。运行 lint/typecheck 和组件级验证，检查 1440/1024/390，更新状态并执行 detect_changes。不要迁移业务页面，不要修改后端和路由。
```

## 3. WP-02 Shell Prompt

```text
只执行前端页面统一化 WP-02。先验证 WP-01，读取 Dashboard layout、Header、Sidebar 及其调用方。修改 layout/Header/Sidebar 前分别执行 upstream impact 并报告 blast radius。统一普通页、表单/详情页和全宽工作区的容器及滚动边界，保留权限守卫、面包屑、全局搜索、通知、用户菜单、导航 badge 和所有链接地址。验证首页、CMDB、Workflow、Wiki、无权限路由，以及 1440/1024/390；重点检查双滚动条、Header 遮挡和移动端主操作。更新状态并执行 detect_changes，不迁移业务页面。
```

## 4. WP-03 列表试点 Prompt

```text
只执行前端页面统一化 WP-03 列表试点：/cmdb/alerts、/change-docs、/users。先读取合同、状态、SPEC、PLAN、TEST，确认当前工作包选择规则和 WP-02 的共享 Shell 证据；如果状态文件显示更早的 `IN_PROGRESS`，先执行更早工作包，本 Prompt 不构成跳批授权。若已获准继续 WP-03，范围严格限定为三页；不得跳过更早的工作包，也不得在最低退出证据不齐时标记 VERIFIED。对各页面入口执行 impact；对 PageHeader、FilterBar、DataTable、Pagination、DetailDrawer 等共享组件只做影响评估，除非有明确授权不得修改 CRITICAL 共享实现。只统一标题、筛选、工具栏、表格外壳、loading/error/empty、分页和主操作；保留 API、query keys、字段、权限、URL 筛选参数、业务列、Dialog 和既有搜索请求契约。三页分别验证 loading/error/empty/permission、筛选、分页、Dialog、主操作和 1440/1024/390；缺少登录态时如实记为 BLOCKED。试点未通过不要扩展其他列表；证据齐全时按合同更新 WP-03 状态。更新状态并运行 detect_changes。
```

## 5. WP-04 列表批量迁移 Prompt

```text
只执行前端页面统一化 WP-04：/devices、/groups、/workflow/instances、/ipam、/admin/audit、/cmdb/instances/by-model/[modelCode]。先确认 WP-00～WP-03 已 VERIFIED、WP-04 代码和静态/API 证据已存在；对共享表格和目标页面 symbol 执行 impact。沿用 WP-03 模板，保持业务列、筛选参数、权限和 BPMN viewer 行为；审计页保留高密度扫描体验。只使用当前分支新启动的服务，不使用 3006 的旧构建产物；使用用户授权的 `.env` 中 `FQA_SUPERADMIN_PASSWORD` 进行临时 development 登录，密码和 token 不得输出或写入文档。逐页运行真实点击、loading/error/empty/retry、筛选、分页、Dialog、详情/预览、主操作和 1440/1024/390 证据，更新状态并执行 detect_changes。若 Chrome 扩展或旧 chunk 阻塞，记录为环境 BLOCKED，不把它写成产品代码 FAIL；六页 L2/L3 未齐全前不得进入 WP-05。兼容重定向入口不做重复视觉实现。
```

## 6. WP-05 详情/表单 Prompt

```text
只执行前端页面统一化 WP-05。范围是 CMDB 实例详情/关联新增、设备详情/新建、IPAM 详情、变更文档新建/详情、任务详情/计划/模板详情。先读取详情和表单调用链，对 DetailHeader、FormShell 及每个业务 symbol 执行 impact。统一返回、标题、状态、更新时间、字段分组、错误提示、保存/取消/提交和未保存反馈；不得改变字段语义、API、状态机、审批、发布、归档、附件或权限。完成后验证列表 -> 详情 -> 编辑 -> 保存 -> 返回闭环，覆盖 1440/1024/390，并更新状态和 detect_changes。
```

## 7. WP-06 特殊工作区 Prompt

```text
只执行前端页面统一化 WP-06。范围是 CMDB 拓扑/对比、2D、影响分析、空间布局、BPMN 设计、Wiki 图谱/阅读编辑、文件预览、任务模板设计器。先读取特殊工作区代码和调用方，对 WorkspaceShell、WorkspaceToolbar、画布容器和状态组件执行 impact。只统一工具栏、返回、标题、操作组、面板折叠、剩余高度、loading/error/empty/无权和移动端降级；不得改 ReactFlow、bpmn-js、Markdown、空间布局或文件预览的领域数据和交互。逐个工作区检查非空 canvas、正确 framing、无遮挡、无双滚动条和 1440/1024/390 证据，更新状态并执行 detect_changes。
```

## 8. WP-07 收口 Prompt

```text
只执行前端页面统一化 WP-07。范围是账号、通知目标、日历、AI/配置/备份、任务分析、Wiki 列表和搜索。先确认 WP-04/WP-06 证据，执行目标模式静态扫描并与 WP-00 基线比较。把固定 overlay、裸标题、手写状态和新增旧 Button/原生 table 用法按触及范围收口，不做全库替换；保留模块专用布局。运行 lint/typecheck/build/相关测试（以 package.json 实际脚本为准；没有 test script 就记录 NOT_RUN）、代表路由点击、1440/1024/390 验收和 detect_changes，更新最终状态、遗留 P2 和完成定义。
```

## 9. Code Review Prompt

```text
请 review 当前前端页面统一化变更。先读取 ai-implementation/ 下的 SPEC、PLAN、TEST、STATUS 和当前 diff，不修改代码。优先检查：API/权限/路由/query key 是否改变；共享 Shell 是否造成双滚动条或首屏空白；列表/详情/表单状态是否完整；特殊工作区是否被普通容器限制；移动端是否有遮挡/溢出；是否引入新的旧 Button、裸 h1、固定 overlay 或无理由 any；是否满足 impact/detect_changes 和测试证据。按严重性输出 findings，引用绝对路径和行号；没有问题时明确说明剩余测试缺口和残余风险。
```

## 10. Acceptance Prompt

```text
请依据 TEST-ACCEPTANCE-v1.0.md 对当前前端页面统一化分支做运行时验收。先检查工作树、状态文件和可用前端命令，不修改代码。启动 development 前端（若需要选择未占用端口），从首页真实点击进入目标模块，验证列表、详情/表单、特殊工作区的主路径、权限守卫、loading/error/empty、Dialog、筛选/分页、返回和移动端布局。覆盖 1440x900、1024x768、390x844，记录截图或等价证据。区分 PASS、FAIL、BLOCKED、NOT RUN，并把证据写回 STATUS；不得把源码检查代替实际点击验收。
```

## 11. 阻塞恢复 Prompt

```text
继续当前被阻塞的前端页面统一化工作包。先读取 STATUS 的最近一条阻塞记录，确认同一阻塞是否已经连续复现以及已尝试措施；再检查最新用户指令和 git status。优先采用不改变 API/权限/路由/领域行为的替代方案，避免重复已通过验证。只要 L2/L3 仍被登录态、浏览器、业务数据或外部授权阻塞，就保持当前工作包 `IN_PROGRESS/BLOCKED`，不得进入依赖工作包。若仍需用户决定，使用 DELIVERY-REPORT-TEMPLATE 的阻塞请求格式，明确证据、影响、推荐方案和最小决策问题；若用户批准延后，记录为 `DEFERRED`、授权原因和重新验收触发条件；若可以自行解决，完成代码、验证、状态更新和 detect_changes 后继续下一项。
```
