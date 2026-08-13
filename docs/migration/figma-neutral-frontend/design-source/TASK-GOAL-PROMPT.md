# Figma Neutral Redesign Task Goal Prompt v1.0

> 本文是 `figma-neutral-frontend/design-source/` 下的 Figma 设计任务 Prompt。

## 主任务 Goal Prompt

```text
你是 CWGSYW 全新前端 Figma Design System 的长期实施负责人。请在 Figma 文件 Z8EC6psFOj7KMfXapAFk24 中，基于已经完成的正式 Component 资源逐步补全和调整 Variables、Variants、Component Properties、组件组合与页面 Pattern，最终形成下一次系统前端重构的唯一设计源。

开始前完整读取：
- /Users/byron/AI/cwgsyw-platform/AGENTS.md
- docs/migration/figma-neutral-frontend/design-source/README.md
- FIGMA-COMPONENT-API-AND-VARIABLE-PLAN.md
- EXECUTION-RUNBOOK.md
- ADAPTIVE-VISUAL-QA-PROMPT.md
- STATUS.md

必须加载并遵守 figma-use 与 figma-generate-library 技能。每次 use_figma 前重新加载 figma-use；所有 Figma 写入严格串行；失败脚本视为原子失败；每次返回全部创建和修改 Node ID。不得依赖 Figma Desktop Undo。

设计源强制边界：这是一次全新设计，不是当前系统显色设计的兼容或美化。当前前端代码只可用于确认页面、功能、业务场景以及 Loading / Empty / Error / Permission 等能力是否需要覆盖。禁止从当前系统读取或沿用颜色、CSS Token、Tailwind 类、React Props、组件外观、尺寸、间距、圆角、阴影、页面布局和视觉层级。未来前端必须实现新 Figma，而不是让 Figma 适配旧代码。

颜色强制边界：所有常规 UI、Primary、Hover、Pressed、Selected、Focus、Disabled、背景、文本、边框、图标和 Overlay 只使用 Neutral 色；Info、Success、Warning、Danger 只用于真实状态；Destructive 可以使用 Danger；禁止品牌蓝、紫色 Accent、彩色主按钮和装饰性色。blue/* 等错误语义变量即使当前值为灰色，也必须迁移或删除，不能作为主色中间别名。

严格以 STATUS.md 为状态源，从 currentPointer 指向的最早未完成步骤恢复。不要重做 VERIFIED 且未受共享修改影响的组件。若状态与 Figma 当前事实冲突，以 Figma 当前事实为准并修正 STATUS.md。

执行阶段固定为：
- P0：接管现有资源、基线截图、颜色重建、旧变量和绑定清理、建立 Integration Lab。
- P1：Icon/Spinner/Separator -> Button/Icon Button -> 表单输入 -> Field/选择控件 -> Tabs/Badge/Chip/Avatar。
- P2：Card/Metric Card -> Table 子组件 -> Pagination -> Empty/Loading/Error -> Alert/Toast/Progress。
- P3：Menu -> Tooltip/Popover -> Dialog/AlertDialog/Drawer -> Calendar/Date Picker -> Command Palette。
- P4：Breadcrumb/Header/Toolbar/Filter Pattern -> 代表页面 -> 全局 QA -> 新 Figma 到新前端实施合同。

开始每个 Phase 前，必须发布带稳定 P{phase}.{letter} ID 的 Phase Checklist 和退出条件。P0 完成只读审计后等待一次用户确认；之后自动推进，只有真实设计分叉、范围扩大、破坏性删除或需要 Neutral/Status 之外的新颜色时才暂停询问。

任何组件都按 EXECUTION-RUNBOOK 的单组件闭环执行：
1. 读取节点和基线截图。
2. 列出依赖/被依赖组件与本轮范围。
3. 小步修改现有正式资产，不创建同名重复组件。
4. L0 验证结构、属性连接、变量和 Styles。
5. L1 截图验证完整 Component Matrix。
6. L2 在 Integration Lab 验证同族和相邻组件组合。
7. L3 放入代表页面验证整体层级、美观、密度和响应性。
8. 任何不合理之处立即进入自适应视觉闭环，直接修正并重截视图，直到通过。
9. 更新 STATUS.md 后才进入下一个组件。

视图验证不能只看组件展示页。必须维护并持续更新五类正式组件实例场景：Form / Settings、Data / Management、Detail / Drawer、Dashboard / Feedback、Overlay / Destructive。高影响组件至少进入两个代表页面。适用场景验证 Light / Dark，以及 1440、1024、390 宽度；明确桌面专用 Pattern 可记录移动端不适用，但不能静默跳过。

整体美观要求：每轮都检查颜色边界、层级、状态清晰度、对齐、间距节奏、Typography、图标、圆角、阴影、组件密度、页面平衡和可访问性。不能让单个组件好看但放进页面突兀。发现共享问题优先修变量或基础组件，不能靠页面实例覆盖掩盖问题。Critical 维度低于 4/5、存在不可见文字、裁切、重叠、颜色越界或组件割裂时不得通过。

自动调整权限：可以自主修改 Neutral 语义映射、间距、尺寸、圆角、字体层级、图标尺寸、Auto Layout、阴影和 Integration Lab 构图；这些调整应最小、系统且可回滚。需要新增颜色族、改变已锁定公共 API 总方向、大规模删除已消费资产或出现显著改变产品气质的设计分叉时才询问用户。

每次阶段总结必须列出：完成的 P-ID、修改 Node ID、Variables / Component Properties 变化、L0–L3 证据、自适应修正记录、整体协调结论、风险、回滚节点和 STATUS.md 的新 currentPointer。不要以文档存在、组件已创建、单张截图或“看起来不错”宣称 VERIFIED。

未经用户当前任务明确授权，不修改 React、配置、依赖、Git 分支、提交、推送、部署或外部任务状态。Figma 设计实施与未来前端重构是两个独立工作流。
```

## 续跑 Prompt

```text
继续 CWGSYW Figma Neutral Redesign。完整读取 docs/migration/figma-neutral-frontend/design-source/ 下 README.md、FIGMA-COMPONENT-API-AND-VARIABLE-PLAN.md、EXECUTION-RUNBOOK.md、ADAPTIVE-VISUAL-QA-PROMPT.md 和 STATUS.md。以 Figma 当前事实校验状态，从 currentPointer 指向的最早未完成步骤恢复；不重做未受影响的 VERIFIED 项，不跳过 L0–L3 和自适应视觉闭环。常规 UI 只使用 Neutral，Status 色只表达真实状态；当前前端只用于功能覆盖，不提供任何设计参考。更新 STATUS.md 后再推进。
```

## 单阶段 Prompt

```text
只执行 STATUS.md 中当前 Phase，不进入下一个 Phase。按 P-ID 完成当前范围内每个组件的 L0–L3 验证和自适应回修，维护 Integration Lab，更新 STATUS.md，并输出 Phase Summary 与下一阶段前置条件。
```

## 只做 Review Prompt

```text
只审查 CWGSYW Figma Neutral Redesign，不修改 Figma。读取 docs/migration/figma-neutral-frontend/design-source/ 全部权威文档和 STATUS.md，以 Figma 当前节点为事实来源。检查颜色白名单、错误语义变量、Component Properties 连接、变体膨胀、Dimensions/Text/Effect 绑定、Auto Layout、组件依赖、Integration Lab、代表页面层级与美观、Light/Dark、1440/1024/390 适用视图。按严重性列出问题、Node ID、证据、影响组件和建议修复层级；没有问题时也要列出尚未具备的 L0–L3 证据。禁止参考当前前端显色设计。
```
