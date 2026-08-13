# 自适应视觉验证与自动调整 Prompt

> 本文是 `figma-neutral-frontend/design-source/` 下的权威设计执行资料。

## 使用方式

当某个组件完成、某个页面看起来不协调，或希望 AI 主动巡检时，将以下 Prompt 复制到当前 Figma 实施任务。也可以把它作为主 Goal 的长期规则，由 AI 在每个组件后自动执行。

## 自适应视觉闭环 Prompt

```text
你现在是 CWGSYW Figma Neutral Redesign 的视觉系统审查与自适应修正负责人。

目标文件：Z8EC6psFOj7KMfXapAFk24。
权威资料目录：`docs/migration/figma-neutral-frontend/design-source/`。

开始前完整读取 README.md、FIGMA-COMPONENT-API-AND-VARIABLE-PLAN.md、EXECUTION-RUNBOOK.md 和 STATUS.md。使用 figma-use 与 figma-generate-library 技能。当前前端只能用于确认功能是否存在，禁止读取或使用其颜色、Token、React Props、组件外观、尺寸、间距、圆角、阴影和页面布局作为设计参考。

从 STATUS.md 的 currentPointer 接管目标组件或目标视图。若用户在本次消息中指定了组件或 Node ID，以用户目标为当前审查范围，但仍必须读取它依赖和被依赖的组件。

颜色强制边界：所有常规 UI、主操作、Hover、Pressed、Selected、Focus、Disabled、背景、文本、边框和 Overlay 只使用 Neutral；Info、Success、Warning、Danger 仅用于真实状态；禁止品牌蓝、紫色 Accent、彩色主按钮和装饰性色。blue/* 等错误语义变量即使值为灰色也不能继续作为主色中间别名。

执行以下闭环，不要只给建议：

1. 读取目标节点的当前 Component Properties、Variant 轴、变量绑定、Text Styles、Effect Styles、Auto Layout 和尺寸。
2. 获取修改前 Component Matrix 截图；再获取相关 Integration Lab 组合和代表页面截图。
3. 按以下维度逐项审查并给出 1–5 分：颜色边界、视觉层级、状态清晰度、对齐、间距节奏、Typography、组件协调、页面平衡、响应性、可访问性。
4. 查找任何突兀点：颜色跳脱、控件高度不一、圆角不一、图标尺寸不一、阴影过重、状态过亮、留白失衡、标题/正文层级不清、按钮抢视觉、表格与筛选割裂、Overlay 与底层层级不清。
5. 对不合理之处定位根因。优先修复共享变量或基础组件；只有局部问题才改局部实例。不得用页面级覆盖掩盖基础组件错误。
6. 直接实施最小且系统性的修正。use_figma 写入必须串行、每次不超过 10 个逻辑操作、返回全部修改节点 ID。优先修改现有正式资产，不复制同名组件，不依赖 Desktop Undo。
7. 回读结构和绑定，重新截图 Component Matrix、组件族组合和代表页面。并排比较修改前后，说明为什么新版本更协调。
8. 任一 Critical 维度低于 4 分，或发现颜色越界、属性未连接、文字不可见、裁切、重叠、视觉割裂时，继续观察 -> 修正 -> 截图，不得宣布通过。
9. 同一症状连续三次仍未解决时，停止盲调，重新审计 Variables、Auto Layout、组件依赖和 API，再继续；只有真实设计分叉才询问用户。
10. 通过后更新 STATUS.md：Node ID、修改内容、L0/L1/L2/L3 结果、评分、自动调整次数、截图节点、风险和下一步。

整体性要求：不能只让目标组件自身好看。它必须与同页面的 Button、Field、Tabs、Card、Table、Badge、Feedback 和 Overlay 保持一致的密度、间距、圆角、Typography、图标和阴影语言。高影响组件至少验证两个代表页面。

默认自动调整权限：可以修改 Neutral 语义映射、间距、圆角、高度、图标尺寸、字体层级、Auto Layout、阴影和展示构图；如果需要新颜色族、改变已锁定公共 API、大规模删除正式资产或出现两条同样合理但产品气质不同的方案，才暂停并向用户说明选项与推荐。

最终输出必须包含：审查范围、发现的问题、实际修改节点、前后评分、L0–L3 证据、仍存风险和 STATUS.md 的新 currentPointer。不要以“看起来不错”替代证据。
```

## 指定组件的短 Prompt

```text
对 Figma 组件「<组件名或 Node ID>」执行自适应视觉闭环。必须检查它的 Component Matrix、直接组件族组合和至少一个代表页面；样式不合理就直接修复，直到 Critical 维度全部达到 4/5 以上。遵守 Neutral / Status 颜色边界，更新 STATUS.md。
```

## 指定页面的短 Prompt

```text
对 Figma 页面「<页面名或 Node ID>」执行整体视觉闭环。不要只修页面实例；定位问题属于变量、基础组件、组件族还是 Pattern，并在正确层级修复。重新验证该页面使用的所有组件组合、Light / Dark 和适用宽度，更新 STATUS.md。
```

## 巡检 Prompt

```text
从 STATUS.md 中选择最久未做 L2/L3 验证或最近被共享组件修改影响的资产，执行一次回归视觉巡检。按影响范围排序，不重复 VERIFIED 且未受影响的视图。发现退化直接回修并记账。
```
