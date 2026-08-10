# 前端统一化 AI 执行手册 v1.0

本手册是 AI 执行代理的运行协议，配合 `IMPLEMENTATION-SPEC-v1.0.md`、`IMPLEMENTATION-PLAN-v1.0.md`、`TEST-ACCEPTANCE-v1.0.md` 和 `IMPLEMENTATION-STATUS-v1.0.md` 使用。它解决“下一步做什么、做到什么算完成、何时必须停下”的问题。

## 1. 权威顺序

1. 当前用户指令。
2. 根目录及目标目录适用的 `AGENTS.md`。
3. `AI-IMPLEMENTATION-CONTRACT-v1.0.md`。
4. `FINDING-TRACEABILITY-v1.0.md`。
5. `IMPLEMENTATION-SPEC-v1.0.md`。
6. `IMPLEMENTATION-PLAN-v1.0.md`。
7. `TEST-ACCEPTANCE-v1.0.md`。
8. `IMPLEMENTATION-STATUS-v1.0.md`。
9. `route-layout-matrix-v2.md`、`unification-plan-v2.md`、设计 token 和组件迁移文档。

## 2. 单个工作包的执行循环

### Step 0：接管现场

先运行并记录：

```bash
git status --short --branch
git diff --stat
git diff --check
```

读取状态文件最后一条变更记录，确认当前分支、用户已有改动、未完成工作包和可复用证据。不要因 Prompt 或计划文件存在就把工作包标记为完成。

### Step 1：确定本批边界

填写以下四项：

| 项目 | 必须回答 |
|---|---|
| 目标 | 本批改哪些页面/组件，解决哪个 finding |
| 允许变化 | 外壳、样式、状态组合和响应式行为的具体范围 |
| 禁止变化 | API、权限、路由、query、状态机和领域交互 |
| 退出条件 | 代码、命令、真实点击、截图和 detect_changes 的具体证据 |

每批不同时改变全局导航、共享组件和多个业务领域，除非计划已明确拆分并能独立回滚。

### Step 1.1：选择工作包和依赖门

以 `IMPLEMENTATION-STATUS-v1.0.md` 为唯一进度真相，使用以下顺序：

1. 优先恢复台账中最早的 `IN_PROGRESS` 工作包。
2. `IN_PROGRESS/BLOCKED` 允许继续不依赖外部条件的静态工作，但不允许标记 `VERIFIED`，也不允许启动依赖它的工作包。
3. 没有 `IN_PROGRESS` 时，选择第一个依赖已 `VERIFIED` 或有用户批准 `DEFERRED` 的 `TODO/READY` 工作包。
4. `BLOCKED` 不是通过；只有用户明确授权并写入原因、触发条件后，才可以把某个范围标为 `DEFERRED`。
5. 如果状态台账、用户最新指令和旧 Prompt 冲突，以用户最新指令为准，并把冲突记录到状态变更中。

### Step 2：做影响分析

凡是要修改函数、类或方法，先对准确 symbol 执行 GitNexus upstream impact，并记录：直接调用方、受影响流程、风险等级和缓解措施。`HIGH`/`CRITICAL` 风险必须先缩小范围或向用户报告，不能静默推进。

修改 `PageHeader`、Dashboard layout、Header、Sidebar 等共享入口时，默认按高风险处理；WP-01 已采用新增模板隔离，不直接修改现有 `PageHeader`。

### Step 3：实施最小变更

- 优先复用现有 `components/v2`、`components/shared` 和设计 token。
- 新模板只负责布局、slot、状态承载和可访问性，不请求 API、不读取权限、不承载领域算法。
- 页面迁移先改外壳，再改状态组合，最后才处理触及范围内的旧按钮/Dialog/table。
- 不用正则批量替换，不删除旧组件，不为单页增加大量例外 props。
- 保留用户未提交改动；使用 `apply_patch` 做人工编辑。

### Step 4：执行静态门禁

至少运行：

```bash
git diff --check
cd frontend && npm run lint
cd frontend && npm run typecheck
```

存在脚本且本批影响相关行为时继续运行：

```bash
cd frontend && npm run build
cd frontend && npm test -- --runInBand
```

报告必须区分本次失败、基线失败、环境阻塞和未执行。

### Step 5：执行运行时/视觉验收

启动 `development` 前端时使用未占用端口，不接管已有进程。真实验证从首页或指定入口开始，至少覆盖：

- 列表：筛选、清除、分页、主操作、行操作、loading/error/empty/无权限。
- 详情/表单：进入、返回、保存/取消、校验错误、未保存提示和危险操作确认。
- 工作区：工具栏、面板折叠、画布非空、剩余高度、错误恢复和移动端降级。

尺寸固定为 `1440x900`、`1024x768`、`390x844`。证据可为截图或等价的浏览器检查记录，但必须写出路由、操作、结果和证据位置。

### Step 6：检查影响范围

工作包结束时运行 GitNexus `detect_changes()`。若新增文件尚未被索引，不能把 `No changes detected` 当成通过；应记录“未追踪文件限制”，通过 intent-to-add、刷新索引或其他不提交的安全方式补足检测，或者明确标记 `BLOCKED`。

### Step 7：更新状态台账

追加一条记录到 `IMPLEMENTATION-STATUS-v1.0.md`，至少包含：

```text
日期：YYYY-MM-DD
工作包：WP-xx
目标：
修改文件：
finding：
impact：调用方 / 流程 / 风险 / 缓解
静态验证：命令 / 结果
运行时验证：路由 / viewport / 操作 / 证据
detect_changes：结果 / 限制
遗留风险：
下一步：
```

只有代码、命令、运行时和视觉证据都满足验收，工作包才能标为 `VERIFIED`。

## 3. 证据复用策略

对每项门禁先判断：

| 状态 | 使用条件 | 动作 |
|---|---|---|
| `REUSE` | 输入文件、依赖、运行环境和目标 symbol 未变化 | 引用原证据，不做形式重跑 |
| `RERUN` | 目标代码、依赖、环境或验收路径变化 | 重新执行并保存输出 |
| `BLOCKED` | 缺少登录态、业务数据、端口、浏览器或外部授权 | 记录阻塞，不伪造通过 |
| `NOT_RUN` | 当前工作包尚未到该步骤 | 保持未执行状态 |

重用证据必须写明依据；不能把上一个工作包的截图或测试结果直接当作本批证据。

## 3.1 证据等级

为避免把低等级证据误报成完成，按以下等级记录：

| 等级 | 证据 | 能证明什么 | 不能证明什么 |
|---|---|---|---|
| L0 | 源码阅读、静态扫描 | 结构和模式存在 | 运行时可用、权限和视觉行为 |
| L1 | lint、typecheck、build、HTTP | 编译、构建或服务可达 | 认证后业务闭环和三 viewport |
| L2 | 有授权登录态的真实点击 | 路由、权限、操作和状态闭环 | 所有 viewport 的视觉稳定 |
| L3 | L2 + 1440/1024/390 截图或等价检查 | 目标工作包的运行时/响应式验收 | 未覆盖页面或未执行的状态 |

工作包只有在其退出条件要求的最低等级全部满足后才能 `VERIFIED`；阻塞的 L2/L3 必须写为 `BLOCKED` 或经授权的 `DEFERRED`。

## 4. 必须暂停的情况

- 需要修改后端 API、权限、路由、query keys、数据库或业务状态机。
- HIGH/CRITICAL 影响无法通过拆分和额外验证降低。
- 用户未提交修改与目标文件冲突，且无法安全合并。
- 需要破坏性环境操作、真实生产数据或新的外部授权。
- 共享抽象需要为单个页面增加大量例外分支。
- 运行时发现权限绕过、数据错误、主操作不可达、首屏空白、双滚动条或画布被遮挡。

暂停时只问最小决策问题，并提供证据、影响、可选方案和推荐方案。

## 5. 回滚协议

每个 PR/工作包保持单一页面类型或 Shell 边界。发现 P0 回归时：

1. 停止扩展到下一批。
2. 保留失败截图、日志和当前 diff，便于定位。
3. 回滚整个当前工作包，不用业务页面临时补丁掩盖 Shell 根因。
4. 修正计划或抽象边界后重新执行本批门禁。

## 6. 交付格式

AI 每次结束必须回答，推荐直接套用 [`DELIVERY-REPORT-TEMPLATE-v1.0.md`](./DELIVERY-REPORT-TEMPLATE-v1.0.md)：

1. 本次完成了哪个工作包和哪些 finding。
2. 修改了哪些文件，哪些文件明确未改。
3. impact、静态门禁、运行时/视觉、detect_changes 的真实结果。
4. 当前状态是 `VERIFIED`、`IN_PROGRESS`、`BLOCKED` 还是 `NOT_RUN`。
5. 下一步唯一建议是什么。

未经用户明确授权，不 commit、push、merge、deploy 或切换分支。
