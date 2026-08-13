# CWGSYW Frontend Refactor Execution Prompt v1.0

> 本文是 `figma-neutral-frontend/design-source/` 下的未来 React 重构执行 Prompt。

## 使用说明

本 Prompt 用于未来 React 重构，不用于继续修改 Figma。启动实现前仍需满足当时仓库的任务号、Definition of Ready、分支、worktree 和授权要求。

## 主执行 Prompt

```text
你是 CWGSYW 全新前端重构负责人。目标是把 Figma 文件 Z8EC6psFOj7KMfXapAFk24 已验证的 Neutral Design System 实现为 React，并以真实视图验证闭环逐个替换现有页面。

开始前完整读取：
- /Users/byron/AI/cwgsyw-platform/AGENTS.md
- docs/migration/figma-neutral-frontend/design-source/README.md
- docs/migration/figma-neutral-frontend/design-source/FORMAL-ASSET-API-MANIFEST.md
- docs/migration/figma-neutral-frontend/design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md
- docs/migration/figma-neutral-frontend/design-source/STATUS.md
- 当时仓库的 Definition of Ready、Definition of Done 和 code review checklist

设计源边界：
1. 实时 Figma 是颜色、Token、Typography、Effect、组件 API、尺寸、间距、圆角、阴影、布局和响应式的唯一设计源。
2. 当前代码只用于识别功能、数据、权限、路由、业务状态和待替换消费者；禁止参考当前显色结果。
3. 禁止使用已清理的历史 refactor 文档、旧 CSS/Tailwind/V2 Token 或旧 React Props 反向定义新设计。
4. 常规 UI 和 Primary 只用 Neutral；Info/Success/Warning/Danger 仅表达真实状态。
5. 正式资产只由 FORMAL-ASSET-API-MANIFEST.md 的精确 allowlist 确定；禁止只按名称前缀搜索。

不要直接开始全站改造。先输出并持续更新实施 Checklist：
- R0：READY 判定、授权边界、dirty worktree、影响分析、回滚边界
- R1：从实时 Figma 生成正式 Token、Light/Dark、Typography、Effect recipes
- R2：选择一个最小可交付垂直切片，按 Manifest 回读 Node ID + 完整名称 + 公共/嵌套 API 指纹，列出 React 消费者、状态和验收视图
- R3：实现组件 API、行为、A11y、Story/fixture 和测试
- R4：执行 Light/Dark × 1440/1024/390 Playwright 视图验证
- R5：自动定位并回修 Token/shared component/composition/page 根因
- R6：运行受影响测试、消费者回归、覆盖审计和交付报告

实施规则：
- 只导出 9 个 CWGSYW / ... 正式集合的 176 个 Variables；排除 Collection 1、Remote、Legacy。
- WEB Code Syntax 是 CSS 变量公开名称。Alias 保持 var(...)；组件不直绑颜色 Primitive。
- Variant 的稳定离散轴映射为 union prop；TEXT 映射 string/ReactNode；BOOLEAN 映射 optional region；INSTANCE_SWAP 映射 icon/component prop；Slot 映射 ReactNode/compound component。
- Button/Input/Chip 等 Wrapper 只直接公开 Size 时，仍须读取 Manifest 指定的嵌套 Base API，不能遗漏 Variant、State、Content、Tone、Label、Icon、Clear 或 Loading。
- Hover/Pressed/Focused 由 CSS/ARIA/真实交互驱动，禁止生产 API 使用 state="hover"。Disabled/Loading/Error/Open/Selected 等按行为语义建模。
- 使用成熟的组件/交互 primitives 或现有项目已选库实现 focus trap、roving focus、Portal、dismiss、日期和定位规则；不要手写脆弱行为引擎。
- 390 必须原生 Compact 构图；Data 页面使用列表/卡片，不能缩放桌面 Table。
- 页面局部 override 不能掩盖共享组件问题。根因属于共享组件或 Token 时，回到共享层修复并回归所有消费者。

视图闭环：
1. 每个切片先按 FORMAL-ASSET-API-MANIFEST.md 获取实时正式根的截图、变量、Variant、Component Properties 和嵌套 Base，建立机器可读 baseline manifest。
2. 对比精确 Node ID、完整名称和公共/嵌套 API 指纹。发现 drift 时立即停止并分类为 EXPECTED_DRIFT、STALE_MANIFEST 或 UNAUTHORIZED_OR_AMBIGUOUS_DRIFT；未分类前禁止编码或选择相近资产。
3. 建立确定性 Story 或真实路由 fixture，覆盖 Default、Compact、Hover、Focused、Pressed、Disabled、Loading、Empty、Error、Permission 及适用的 Open/Selected。
4. 用 Playwright 在 Light/Dark、1440/1024/390 截图；Overlay 检查 Portal、边界定位、滚动锁定、Escape、焦点圈定和返回。
5. 比较颜色、层级、状态、对齐、节奏、Typography、组件协调、平衡、响应式和 A11y。Critical 低于 4/5，或有裁切、重叠、不可见内容、错误语义、键盘中断，立即 FAIL。
6. FAIL 后直接在授权范围内修复，按 Token -> shared component -> composition -> page 定位，并重跑受影响截图和测试。不得用 magic number 或 screenshot-only 分支过门禁。
7. 同一症状连续三轮未解决，停止像素盲调，重新审计 Figma API、字体、内容长度、布局约束和运行时状态模型，再继续。
8. 每轮记录 before/after 截图、修改文件、测试结果、评分、未决风险和回滚边界。

整体协调要求：
- 每个组件先过单体，再过同族组合，最后进入五类 Page Pattern 中至少一个真实上下文。
- 页面必须有清晰信息层级和一致密度；相邻组件的高度、对齐、间距、文本层级和交互权重协调，不能形成孤立或突兀区域。
- 必须用真实最长文案、空数据、错误、权限和异步状态检查布局稳定性。
- 不得因为单张截图接近就判定完成；结构、行为、A11y、响应和消费者回归必须同时 PASS。

迁移顺序默认遵循合同第 6 节。一次只完成一个垂直切片。未经当前任务授权，不提交、不推送、不建 PR、不部署、不修改外部任务状态。

阶段总结必须报告：READY 状态、切片范围与非目标、Figma 证据、影响分析、Token/API 映射、实现文件、测试命令与结果、六档截图、A11y 结果、自动回修记录、消费者回归、残余风险、回滚方式和下一指针。不得用“看起来不错”或“文档已存在”代替证据。
```

## 续跑 Prompt

```text
继续 CWGSYW Figma-driven React refactor。重新读取 FORMAL-ASSET-API-MANIFEST.md、FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md、实施状态和当前代码差异，从最早未完成的垂直切片恢复。先以 Node ID + 完整名称 + 公共/嵌套 API 指纹验证实时 Figma 与基线是否漂移；未分类 drift 必须停止。不重做未受影响且有完整证据的 PASS 项，不跳过 Light/Dark × 1440/1024/390、交互、A11y 和消费者回归。发现视觉或组合不合理时，在当前授权范围内按 Token -> shared component -> composition -> page 自动回修，直到门禁通过。
```

## 单组件自适应调整 Prompt

```text
审查并调整 <组件名/React 路径/Figma Node ID>。先按 FORMAL-ASSET-API-MANIFEST.md 核对精确 ID、完整名称和公共/嵌套 API 指纹，未分类 drift 立即停止。以实时 Figma 正式资产为唯一设计源，同时检查组件单体、同族协作和至少一个 Page Pattern。覆盖所有真实 Variant、runtime state、最长内容、Light/Dark、1440/1024/390 和键盘/screen reader。Critical 低于 4/5 或存在裁切、重叠、不可见内容、错误颜色语义时直接判 FAIL；定位正确根因层修复并完整回归。不要通过页面 override 或 screenshot-only 条件掩盖共享问题。
```

## 单页面自适应调整 Prompt

```text
审查并调整 <路由/Page Pattern>。先列出它使用的正式 Figma Pattern、共享组件和业务状态，再以 Default/Compact 原生构图实现 1440/1024/390，不缩放桌面布局。验证 Loading、Empty、Error、Permission、交互和 Overlay；对颜色、层级、对齐、节奏、Typography、组件协调、平衡、响应和 A11y 评分。任何 FAIL 必须回到 Token/shared component/composition/page 的正确层修复并回归其他消费者。
```

## 只读审计 Prompt

```text
只读审计当前 Figma-driven React 重构，不修改代码、Figma、Git 或外部系统。逐项核对正式 Token 白名单、Legacy 排除、React API 映射、Variant/runtime state、五类 Pattern、Light/Dark × 1440/1024/390、Loading/Empty/Error/Permission、Portal/focus/keyboard/screen reader 和截图闭环。按严重度输出可复现证据、文件/节点、缺失测试、影响范围和建议修复层；没有证据的项目标记 NOT VERIFIED，不能推断为 PASS。
```
