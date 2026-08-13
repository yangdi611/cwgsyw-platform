# Figma Neutral Redesign 执行入口

> 本文是 `figma-neutral-frontend/design-source/` 下的设计执行入口。

## 1. 你应该使用哪个 Prompt

| 场景 | 使用文档 |
|---|---|
| 第一次启动完整实施 | `TASK-GOAL-PROMPT.md` 的“主任务 Goal Prompt” |
| 在同一任务中继续 | 直接说“继续”，AI 必须读取 `STATUS.md` |
| 在新任务中恢复 | `TASK-GOAL-PROMPT.md` 的“续跑 Prompt” |
| 只检查并自动修正视觉 | `ADAPTIVE-VISUAL-QA-PROMPT.md` 的“自适应视觉闭环 Prompt” |
| 只审查、不修改 | `TASK-GOAL-PROMPT.md` 的“只做 Review Prompt” |
| 开始未来 React 重构 | 先读 `FORMAL-ASSET-API-MANIFEST.md` 和 `FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`，再使用 `FRONTEND-REFACTOR-EXECUTION-PROMPT.md` |

## 2. Figma 设计执行

1. 将 `TASK-GOAL-PROMPT.md` 中的“主任务 Goal Prompt”完整复制到 Codex Goal / 任务目标。
2. 确认 AI 已读取：
   - `README.md`
   - `FIGMA-COMPONENT-API-AND-VARIABLE-PLAN.md`
   - `EXECUTION-RUNBOOK.md`
   - `ADAPTIVE-VISUAL-QA-PROMPT.md`
   - `STATUS.md`
3. AI 先执行 P0 只读接管和基线截图，打印 Phase Checklist。
4. 第一次进入 Figma 写入前，由用户确认 P0 的范围、顺序和例外。
5. 之后按 P0 → P1 → P2 → P3 → P4 自动推进；只有真实设计分叉、破坏性删除或范围扩大才停下来询问。

当前 `P0-P4.e` 已全部完成。只有需要修改正式 Figma 设计时才继续使用本节；不要用 Figma 设计 Prompt 启动 React 重构。

## 3. Figma 日常续跑

同一任务中只需要输入：

```text
继续。读取 STATUS.md，从 currentPointer 指向的最早未完成步骤恢复；不要重做 VERIFIED 项，不要跳过视觉闭环。
```

如果希望 AI 主动复查刚完成的设计：

```text
对 currentPointer 对应组件执行自适应视觉闭环。检查组件单体、同族组合和代表页面三个层级；不合理就直接修正，直到满足门禁，再更新 STATUS.md。
```

## 4. React 重构入口

React 重构是独立交付流程：

1. 获取真实任务号并满足当时仓库 Definition of Ready。
2. 完整读取 `FORMAL-ASSET-API-MANIFEST.md` 和 `FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`。
3. 开始每个切片前，以 Node ID + 完整名称 + API 指纹回读实时 Figma；drift 未分类时停止实现。
4. 使用 `FRONTEND-REFACTOR-EXECUTION-PROMPT.md` 的主执行 Prompt。
5. 一次只实施一个垂直切片，并完成 Light / Dark × 1440 / 1024 / 390、交互、A11y 和消费者回归。
6. 当前代码只提供功能、数据、权限和业务状态清单；不得作为新视觉参考。

## 5. Figma 完成定义

任何组件都不能因为“已经是 Component”就算完成。必须同时具备：

- 正确的 Variables、Variants 和 Component Properties。
- Neutral / Status 颜色边界正确。
- Component Matrix 截图通过。
- 与相邻组件组合后协调。
- 放入代表页面后层级、密度和美观通过。
- Light / Dark 以及适用状态可读。
- 结构、变量绑定、视觉和状态证据写入 `STATUS.md`。

## 6. 重要边界

- 当前前端只提供功能覆盖清单，禁止提供颜色、Token、Props、外观、尺寸或布局参考。
- 现有 Figma Component 是逐步补全和调整的起点；先检查、复用和修正，不重建同名重复资产。
- 常规 UI 只用 Neutral；Info、Success、Warning、Danger 只用于真实状态。
- MCP 修改不能依赖 Figma Desktop Undo；所有写入必须记录节点 ID 并用反向脚本回滚。
- 新资料受 `docs/*` 忽略；如需纳入 Git，必须精确 `git add -f`，不得把无关 `docs` 或 `monitoring/` 一并加入。
