# Figma Neutral 实施 Goal Prompt

这是把 Figma Neutral 设计落到前端的 Goal 模式资料，不是继续改 Figma 的设计 Prompt。

2026-08-14 已按 YAN-91 一镜收口状态重写。旧稿里的 YAN-11 / YAN-37 /「还剩 31 页」/ 原生 select 待办 / 214 测试作废。

## 1. 怎么开 Goal

1. 在 Codex 里**新建一个 Goal**，不要续跑指向 YAN-11 / M0 / 截图评分的旧 Goal。
2. 把 [SHORT-GOAL-PROMPT.md](./SHORT-GOAL-PROMPT.md) 里的「短 Goal：一镜收完整条实施」整段贴进去。
3. 需要远程走时，再把同一文件里的「交付授权附言」追加到 Goal 末尾；没有这段，Goal 只做到本地 commit，然后停在 push / PR 门。
4. 被打断后只发「续跑」段，不要重开一套互相打架的目标。

| 场景 | 文件 | 怎么用 |
|---|---|---|
| 换会话接手 | [../HANDOFF.md](../HANDOFF.md) 和 [../STATUS.md](../STATUS.md) | 先看活刀、当前 Issue、完成审计 |
| 第一次用 Goal 一镜收口 | [SHORT-GOAL-PROMPT.md](./SHORT-GOAL-PROMPT.md) | 把「短 Goal」整段贴进 Codex Goal / 任务目标 |
| 完整纪律、停机条件和收口顺序 | [LONG-GOAL-PROMPT.md](./LONG-GOAL-PROMPT.md) | 短 Goal 会要求 AI 先读这份；也可整份作为 Goal |
| 同一 Goal 被打断后继续 | `SHORT-GOAL-PROMPT.md` 的「续跑」 | 只发续跑段 |
| 只清残留 leftover | `SHORT-GOAL-PROMPT.md` 的「收口剩余 leftover」 | 不重迁页面 |
| 某组件/页面难看或错位，要当场修 | `SHORT-GOAL-PROMPT.md` 的「自适应回修」 | 指定组件、路由或 Node ID。视觉评分仍是 WAIVED |
| 撤回「不要视觉审计」 | `SHORT-GOAL-PROMPT.md` 的「重新打开视觉闭环」 | 才会按 Runbook 截图评分 |
| 只审不改 | `SHORT-GOAL-PROMPT.md` 的「只读审计」 | 不改代码、Figma、Git、Linear |
| 收口完要 push / PR | 把「交付授权附言」追加到短 Goal | 没有这段就停在 push / PR 门 |

不要把 `design-source/TASK-GOAL-PROMPT.md` 当作 React 实施 Goal。那份只服务 Figma 设计，而且 P0-P4 已经完成。

## 2. 启动前确认

- 活树: `/Users/byron/AI/worktrees/YAN-71`
- Branch: `feat/YAN-71-figma-neutral-m7-workflow-design`
- 当前 Issue: [YAN-91](https://linear.app/yangdi/issue/YAN-91/授权提交-figma-neutral-本地实现)
- 交接: [`../HANDOFF.md`](../HANDOFF.md)
- 状态源: [`../STATUS.md`](../STATUS.md)
- 完成审计: [`../evidence/YAN-91/COMPLETION-AUDIT.md`](../evidence/YAN-91/COMPLETION-AUDIT.md)
- 设计合同: [`../design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`](../design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md)
- 主工作区 `/Users/byron/AI/cwgsyw-platform` 有无关 dirty 改动，不要在那里实施

如果 Goal 启动时活树已经前移，AI 必须按长 Prompt 第 0 节重新定位，不要退回 YAN-11 或 YAN-37。

## 3. 「一镜到底」现在指什么

Goal 的终点仍是整条前端迁移：`M0 Token -> 共享组件 -> Pattern -> 81 个页面入口 -> 旧入口收敛 -> 授权后提交`。

2026-08-14 磁盘事实：

- M0-M8 页面迁移已在 YAN-71 本地完成并提交
- 81 入口 = 78 Neutral + 3 CMDB redirect EXCLUDED
- 旧 `@/components/design-system` / `v2` / `ui` 已删
- 视觉审计 WAIVED
- leftover select / v2 / accent / native `cwgsyw-btn` 动作按钮已大部分收口
- SpatialEditor Input `size="sm"` 和折叠侧栏 `cwgsyw-popover` 已改，对应 leftover 锁可能还要补
- 本地 commit 已授权；push / PR 还没授权

所以现在的一镜 Goal 不是再从 `/ops-calendar/rosters` 往下迁页面，而是：

1. 核验文档和磁盘一致
2. 收口剩余 leftover / remint
3. 保持 `figma-neutral-*.test.cjs` 全绿
4. 本地 commit
5. 停在 YAN-91 push / PR 门，除非用户贴了交付授权附言

它不是一张无限大工单。若磁盘证明某页其实没迁完，再按切片补那一页，不要整域重写。

## 4. 不要混进 Goal 的东西

- 当前前端的颜色、Token、CSS、组件外观、尺寸、间距、布局
- 已清理的 `open-design-refactor` / 旧 `DESIGN_TOKENS.md`
- 用 Figma 设计 Prompt 去改 React，或用 React 实施 Prompt 去改 Figma
- 把 Linear Backlog 当成「还没做」
- 重做 YAN-11 到 YAN-88 的已有本地实现
- 把视觉 WAIVED 写成视觉 PASS
- 未授权就把 YAN-11 到 YAN-88 标 Done
- 为了对齐旧合同把 lowercase `variant="primary"` 改成 `Primary`
- 把 Goal 标 complete（push / PR 未授权）
