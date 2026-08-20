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
| 开始 React 实施 / Goal 一镜到底 | 使用 `../goal-prompts/SHORT-GOAL-PROMPT.md`；完整纪律在 `../goal-prompts/LONG-GOAL-PROMPT.md`。不要用本文的 Figma 设计 Prompt |

> 2026-08-14 用户授权：后续 React 实施 Goal 不要做视觉审计。下面的自适应视觉 Prompt 仅在用户撤回该例外后使用。

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

## 4. React 实施入口

React 实施是独立交付流程，使用 Goal Prompt，不使用上面的 Figma 设计 Prompt。

1. 当前任务是 YAN-91，活树在 `/Users/byron/AI/worktrees/YAN-71`。不要退回 YAN-11。
2. 把 `docs/migration/figma-neutral-frontend/goal-prompts/SHORT-GOAL-PROMPT.md` 的「短 Goal」贴进**新的** Codex Goal。
3. AI 必须先读同目录 `LONG-GOAL-PROMPT.md`，以及 `FORMAL-ASSET-API-MANIFEST.md` 和 `FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`。
4. 从迁移 `STATUS.md` 的 `currentPointer` 恢复。M0-M8 已落地，不要重做页面。
5. 视觉审计保持 WAIVED，除非用户撤回。布局明显坏掉仍按 Token -> Component -> Composition -> Page 回修。
6. 当前代码只提供功能、数据、权限和业务状态清单；不得作为新视觉参考。
7. `FRONTEND-REFACTOR-EXECUTION-PROMPT.md` 仍可作补充规则，但启动和续跑以 `goal-prompts/` 为准。

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
