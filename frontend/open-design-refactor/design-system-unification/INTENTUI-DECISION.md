# Intent UI 演进决策文档 v1.1

## 当前决策

- 状态：`DS-04_VERIFIED / DS-05_DECIDED_BASE_UI`
- 默认底层：`Base UI`，通过 `components/design-system` 对业务公开。
- Intent UI：技术上可行，但仅保留在隔离 spike 作为后续按组件族评估的候选；不复制依赖、不迁移业务页面、不删除旧入口。

## 1. 技术事实

Intent UI 是基于 React Aria Components 和 Tailwind CSS 的可复制组件体系，不是当前项目可以直接安装并自动接管全部 UI 的单一 npm 包。它的组件代码需要复制、调整并纳入项目自己的 design-system。

当前项目已经使用 Tailwind CSS 4、React 19 和 CSS token，因此具备接入条件；但当前基础交互主要来自 `@base-ui/react`，迁移会涉及 Dialog、Select、Popover、Dropdown、焦点和表单 API。

独立试验必须遵守 [`DS-04-SPIKE-PROTOCOL.md`](./DS-04-SPIKE-PROTOCOL.md)：候选实现只能通过 `components/design-system` 适配层暴露，不能直接改变业务导入或主分支依赖。

## 2. 可能收益

- React Aria 提供更完整的键盘、焦点和 aria 行为基础。
- 组件源码归项目所有，便于按运维平台场景调整。
- Tailwind 样式与现有 token 兼容，避免引入另一个 CSS 运行时。
- 可以把组件 API、视觉 token 和无障碍规则集中到 design-system。

## 3. 主要成本

- 需要引入并维护 React Aria 组件依赖和状态模型。
- Base UI 与 React Aria 的组件 API 不兼容，不能只改 import。
- Dialog、Select、Popover 等高频组件会触及大量页面和测试。
- 自定义 V2 API、表单控件和特殊工作区工具栏需要适配。
- 如果没有独立 spike 和回滚边界，迁移会与页面统一化混在一起。

## 4. 技术验证门槛

Intent UI 只有同时满足以下条件，才允许作为 design-system 的默认底层：

1. Button、Input、Dialog、Select、Popover/Dropdown 和一个复杂表单可在 React 19/Next 16/Tailwind 4 下编译运行。
2. 键盘导航、Escape、点击外部关闭、焦点进入和焦点回收通过检查。
3. `react-hook-form` controlled/uncontrolled 场景无行为回归。
4. 暗色模式、`--v2-*` token、移动端和长内容滚动符合现有设计合同。
5. Wiki、CMDB 列表和工作流表单三个代表模块没有 API、权限、路由或 query key 变化。
6. 构建产物和运行时错误不增加，且迁移后的维护代码不明显复杂于当前实现。

## 5. 决策选项

### 选项 A：Base UI 作为底层，推荐默认

先完成 `ui`/`v2` 合并和 design-system 入口，保留现有交互实现。优点是风险最低、可以尽快统一管理；缺点是暂时不享受 React Aria 的完整组件基础。

### 选项 B：Intent UI 作为底层

完成 spike 并通过全部门槛后，再按组件族替换 design-system 内部实现。页面只依赖统一 API，因此不需要再大范围改业务代码。

### 选项 C：混合实现

对 Dialog、Select、Popover 等高交互组件采用 Intent UI，对 Table、Card、Badge 等低交互组件保留当前实现。只有在组件合同明确、团队能接受双底层维护时采用。

## 6. DS-04 / DS-05 最终决策（2026-08-04）

### DS-04 结果

隔离 spike 在 React 19、Next 16、Tailwind CSS 4 下通过了 Button、Input、Dialog、Select、Popover 定位/关闭、react-hook-form 表单、键盘/焦点、长内容内部滚动、明暗主题和 `1440x900`/`1024x768`/`390x844` 运行时矩阵。静态门禁 typecheck、lint、build 和 diff check 通过；无应用控制台错误。完整证据见 [`STATUS.md`](./STATUS.md) 的“DS-04 运行时恢复验收与 DS-05 决策”记录。

### DS-05 选择

选择 `BASE_UI_DEFAULT`，理由如下：

1. `components/design-system` 入口和 V2 compatibility re-export 已经完成，当前统一治理目标不需要再次迁移业务页面。
2. Intent UI 的交互质量满足候选门槛，但 Base UI 与 React Aria 的状态、overlay 和 Select API 不兼容，替换仍需逐组件适配和回归。
3. 当前没有足够收益证明引入第二套交互依赖和维护模型是必要的；保留 Base UI 可以降低发布和回滚风险。
4. 后续如果某个高交互组件确实需要 React Aria 能力，应该单独建立组件族迁移任务，保持 `components/design-system` 对外合同不变，并完成影响分析、bundle/运行时对比、代表业务模块验收和回滚演练。

### 边界说明

- 主分支不新增 `react-aria-components` 或 `tailwind-variants` 依赖。
- Intent UI spike 的内部 `Select` 适配层仍使用当前 RAC 1.20.0 的 `selectedKey/defaultSelectedKey/onSelectionChange` 原语；对外合同仍是项目现有的 `value/defaultValue/onChange`，业务不会感知该差异。
- 不删除 `components/ui` 或 `components/v2`；DS-06 只做最终扫描和审计，删除需要另行授权。
