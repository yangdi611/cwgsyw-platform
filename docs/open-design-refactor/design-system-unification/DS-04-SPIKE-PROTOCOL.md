# DS-04 Intent UI 独立试验协议 v1.0

## 1. 目的和结论边界

DS-04 只回答一个技术问题：Intent UI 是否能在当前 React 19、Next 16、Tailwind CSS 4 和现有 design-system 合同下，作为可回滚的内部实现候选。

本阶段不迁移业务页面、不修改 API/权限/路由/query key、不删除 `components/ui` 或 `components/v2`，也不改变当前 development 环境。试验失败时保留 Base UI；试验通过也不等于批准全站替换，必须由 DS-05 单独记录采用决策。

## 2. 启动前置条件和授权

启动前必须同时满足：

1. `STATUS.md` 顶部为 `DS-03_VERIFIED`。
2. 用户明确授权创建隔离目录或独立试验分支，并明确是否允许安装 spike 依赖。
3. 当前工作树已记录；不得覆盖、清理或提交用户已有修改。
4. 已阅读 `README.md`、`MASTER-PLAN.md`、`COMPONENT-CONTRACT.md`、`INTENTUI-DECISION.md` 和本协议。

未满足任一条件时，状态为 `BLOCKED_BY_AUTHORIZATION`，不得创建分支、安装 React Aria 或修改主迁移路径。

## 3. 隔离和回滚策略

推荐使用当前分支之外的临时 worktree：

```text
/Users/byron/AI/cwgsyw-platform-ds04-spike
branch: codex/design-system-intentui-spike
```

创建前先检查目标路径和分支不存在。试验代码、依赖锁文件和探针页面只允许出现在该 worktree；不得把它们复制回 `codex/frontend-style-unification`，除非 DS-05 明确授权。

回滚方式是删除 spike worktree 和试验分支，不执行主分支 reset/checkout，不触碰主分支 dirty worktree。若使用隔离目录而非 worktree，目录删除必须只作用于该目录。

## 4. 依赖和 registry 规则

先读取 `frontend/package-lock.json` 和 `frontend/components.json`。当前项目默认使用 `npx`，`components.json` 没有自定义 registry 时使用 `@intentui`；不要修改 `components.json` 的 `registries`。

依赖候选必须只安装到 spike worktree，并记录版本、包管理命令和 lockfile 变化：

- Intent UI registry 组件：`button`、`input`、`modal`、`select`、`popover`、`menu`。
- 运行时基础：`react-aria-components`、`tailwind-variants`；仅在候选组件实际需要时安装。
- 现有表单验证：复用已存在的 `react-hook-form`，不升级主分支版本。

registry 搜索必须串行执行，并使用隔离 npm 缓存，避免并发 CLI 破坏共享缓存：

```bash
NPM_CONFIG_CACHE=/tmp/codex-intentui-npm-cache \
  npx --yes shadcn@4.16.1 search @intentui -q button
```

安装前确认搜索结果是预期 `registry:ui`，安装后确认文件存在且只在 spike worktree 内。不得将 Intent UI 组件直接安装到主分支的 `src/components/ui`。

## 5. 适配层合同

试验必须通过 `src/components/design-system/intentui-spike/` 或等价的明确适配层暴露候选实现。业务页面不得直接导入 `@/components/ui`、Intent UI registry 路径或 React Aria primitives。

适配层必须保留当前公开合同：

| 组件族 | 必须保留的合同 |
|---|---|
| Button | `variant`、`size`、原生 `disabled`、`loading`、`ref`、事件、accessible name、稳定尺寸 |
| Input | 原生 input 事件和值、`ref`、placeholder、disabled、invalid、focus-visible、token 样式 |
| Dialog | 现有 trigger/content/header/title/description/footer/close 组合、受控状态、Escape、外部点击、焦点进入和回收 |
| Select | 现有 value/defaultValue、onChange、disabled、placeholder、键盘导航和列表滚动 |
| Popover/Dropdown | 触发器语义、Escape、外部点击、定位、长内容内部滚动和移动端边界 |
| Form | `react-hook-form` controlled/uncontrolled、提交/校验错误、loading、防重复提交 |

Intent UI 的 `intent`、`isDisabled`、`isInvalid`、React Aria `cx` 等内部 API 只能在适配层使用。对外仍使用当前项目的 `variant`、`disabled` 等合同，不得让业务感知底层 API 变更。

## 6. 最小实现范围

只实现一个可独立运行的 spike 页面或测试入口，包含：

1. Button：全部现有主要 variant/size，idle/loading/disabled 和图标按钮。
2. Input：普通、必填错误、disabled、invalid、focus-visible。
3. Dialog：打开、首焦点、Escape、外部点击、长内容内部滚动、关闭后焦点回收。
4. Select：键盘打开、上下选择、Escape、外部点击、长选项列表内部滚动。
5. Popover 或 Dropdown：定位、Escape、外部点击和窄 viewport。
6. 一个 `react-hook-form` 表单：controlled/uncontrolled 字段、校验错误、提交 loading 和重复提交保护。

不得把真实业务 API、权限或 development 数据接入 spike；测试数据使用本地 fixture。

## 7. 验收矩阵

| 维度 | 必测视口/场景 | 通过标准 |
|---|---|---|
| 编译 | React 19、Next 16、Tailwind 4 | typecheck、lint、build 无新增 error |
| Button/Input | `1440x900`、`1024x768`、`390x844` | API/ref/尺寸/状态/accessible name 不回归 |
| Dialog | 三种 viewport、键盘 | 首焦点、Escape、外部点击、焦点回收正确；无 document 双滚动 |
| Select/Popover | 三种 viewport、长列表 | 键盘/外部点击正确；内容在内部滚动；不溢出 viewport |
| Form | 成功、校验失败、提交中 | 错误可见、loading 防重复提交、controlled/uncontrolled 均通过 |
| Token | 明暗主题 | 只使用项目 semantic/`--v2-*` token；无新硬编码颜色 |
| 兼容性 | fixture 页面 | 无 API、权限、路由、query key 或业务状态机变化 |
| 维护性 | diff 和依赖 | 候选代码只在 spike；依赖和 bundle 增量可解释 |

## 8. 检查命令和证据

在 spike worktree 执行并保存结果：

```bash
git diff --check
cd frontend && npm run lint
cd frontend && npm run typecheck
cd frontend && npm run build
```

若 `package.json` 没有 test script，记录 `NOT_RUN`，不得伪造测试通过。对适配层中每个被修改的函数、类或方法先执行 GitNexus upstream impact；完成后执行 `detect_changes`，确认只覆盖 spike 文件和预期流程。

运行时证据至少包括三种 viewport 的截图或可复核记录、键盘操作结果、焦点前后元素、滚动容器尺寸、控制台应用错误计数和构建产物路由。不得记录密码、token 或真实业务敏感数据。

## 9. PASS/FAIL 和停止条件

只有第 7 节所有行均通过，且 `detect_changes` 没有主分支业务范围变化，才能将 DS-04 记为 `PASS`。任一核心组件合同、焦点、键盘、滚动、表单或构建门禁失败，立即记为 `FAIL`，停止扩展范围并保留 Base UI。

DS-04 的输出必须追加到 `STATUS.md`：依赖版本、隔离路径、适配层文件、impact、静态结果、运行时证据、detect_changes、失败项和回滚位置。DS-05 再依据这些证据选择 Base UI、Intent UI 或混合方案。
