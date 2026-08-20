# 视觉验证闭环 Runbook

> 当前 Goal 例外（2026-08-14，用户授权）：不要执行本 Runbook 的截图评分和视觉闭环。保留本文作为原始合同；STATUS.md 中的 `visualAudit: WAIVED` 优先。


## 1. 目的

本 Runbook 用于验证 React 实现是否忠实执行 Figma Neutral Design System，同时保持真实功能、交互、权限和可访问性。视觉验证不是最后一次截图检查，而是每个切片的持续反馈环。

## 2. 必备条件

开始验证前必须具备：

- 目标 Linear Issue、范围、消费者和回滚边界。
- 实时 Figma baseline manifest：文件 key、读取时间、Node ID、完整名称、公共/嵌套 API 指纹、Variable/Style 来源。
- 可重复的 Story 或测试 fixture，数据、角色、主题、viewport 和时间均确定。
- Default、Loading、Empty、Error、Permission 以及业务特定状态的稳定入口。
- Figma 参考图和 React 实现图使用一致内容与视图条件。

任何 Node ID、名称或 API 指纹 drift 未分类时，停止验证和实现。

## 3. 最小视图矩阵

| Theme | 1440 | 1024 | 390 |
|---|---|---|---|
| Light | 必须 | 必须 | 必须 |
| Dark | 必须 | 必须 | 必须 |

每个尺寸分别渲染，不允许用缩放截图代替布局。390 必须使用 Compact 构图；Data Pattern 使用移动列表/卡片或正式移动结构，不压缩桌面 Table。

Overlay 切片还要在每个适用尺寸验证打开态、viewport 边界、滚动内容、Portal 层级和关闭后的焦点返回。

## 4. 单轮闭环

1. **Capture**：生成 Figma 基线和 React 实现截图，并记录主题、viewport、fixture、字体和 commit。
2. **Compare**：并排检查颜色语义、信息层级、状态、对齐、节奏、Typography、组件协调、视觉平衡和响应重排。
3. **Exercise**：走查 hover、pressed、focus、selected、disabled、loading、open/close、键盘和 screen reader 流程。
4. **Classify**：将差异归因到 Token、Component、Composition 或 Page。
5. **Repair**：只在根因层修复，不在页面添加掩盖性 override。
6. **Regress**：重跑当前层、受影响 Pattern 和所有已知消费者。
7. **Record**：记录实际结果、截图、剩余差异、豁免和下一指针。

不合理的样式应在本轮直接调整并重验，不等待全量页面完成后集中修补。

## 5. 评分与失败门禁

每个维度按 1-5 评分，以下为 Critical：

- 颜色与语义
- 信息层级与可读性
- 对齐、间距和节奏
- Typography 与文本容纳
- 组件之间的协调性
- 响应式重排
- 交互状态与反馈
- 可访问性

任一 Critical 维度低于 4/5，或出现以下问题，整轮判定 `FAIL`：

- 内容不可见、裁切、重叠、错位或溢出。
- Neutral / Status 边界错误，普通操作出现非 Neutral 强调色。
- 状态只靠颜色表达，或 Light/Dark 任一主题不可读。
- 390 使用压缩桌面布局，或操作区被动态内容推移。
- 键盘流程中断、焦点不可见、焦点圈定/返回错误。
- Dialog、Popover、Drawer 等 Portal 或层级错误。
- 为通过截图添加页面专用 magic number 或条件分支。

字体栅格化的小范围像素噪声可以记录阈值，但布局位移、颜色错误、内容丢失和状态不清不能豁免。

## 6. 组件配合检查

验证分四层进行：

| 层 | 检查对象 | 退出条件 |
|---|---|---|
| L0 Structure | Variables、Styles、Variants、Properties、Auto Layout | 绑定、API 和结构与正式资产一致 |
| L1 Component | 单组件完整状态矩阵 | 尺寸、状态、文本、图标和 A11y 通过 |
| L2 Composition | 同族组件和复合组件 | 层级、间距、密度和行为协调 |
| L3 Page | 真实 Pattern 与业务页 | 功能、状态、响应、美观和消费者回归通过 |

单组件截图通过不代表切片通过。至少一个代表 Composition 和一个真实页面消费者必须一并验证。

## 7. 自动回修规则

- 同一差异出现在多个页面：先检查 Token 或共享 Component。
- 同族控件对齐一致但组合突兀：检查 Composition / Pattern。
- 只在一个业务内容结构中发生：再考虑 Page 层。
- 修复共享层后，自动重跑所有已登记消费者，不只重拍当前页。
- 同一症状连续三轮未解决：停止像素盲调，重新读取 Figma API、Auto Layout、字体、内容长度和状态模型。
- 修复会改变正式设计含义时：停止代码回修，先创建/更新设计决策并处理 Figma drift。

## 8. A11y 与交互证据

按组件适用性记录：

- Tab 顺序、方向键、Enter/Space、Escape 和焦点返回。
- `focus-visible`、disabled、loading 和错误说明。
- Label、description、error、required 的 ID 与 ARIA 关联。
- Dialog/AlertDialog/Drawer 的名称、描述、初始焦点和焦点圈定。
- Menu、Tabs、Calendar、Command Palette 的 roving focus 或等价键盘模型。
- Toast/Alert/Progress 的 live region、可读值或不确定状态。
- 颜色对比，以及状态不只由颜色表达。

## 9. 证据结构

每个切片的交付记录至少包含：

```text
evidence/<ISSUE-ID>/
  baseline-manifest.json
  screenshots/
    light-1440.png
    light-1024.png
    light-390.png
    dark-1440.png
    dark-1024.png
    dark-390.png
  visual-review.md
  interaction-a11y.md
  consumer-regression.md
  rollback.md
```

证据可以存放在仓库批准的位置或 CI artifact；Linear 必须链接权威位置。没有真实证据时状态只能是 `NOT RUN`、`BLOCKED` 或 `DEFERRED`，不能写 `PASS`。
