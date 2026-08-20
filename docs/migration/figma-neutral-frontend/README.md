# Figma Neutral 前端迁移

## 1. 目的

本目录是 `cwgsyw-platform` 的 Figma Neutral 设计与前端迁移统一资料包。`design-source/` 保存设计事实，其余文档负责迁移顺序、页面覆盖、验证闭环、进度与回滚。

- Linear Issue: [YAN-91](https://linear.app/yangdi/issue/YAN-91/授权提交-figma-neutral-本地实现)
- Planning baseline: [YAN-10](https://linear.app/yangdi/issue/YAN-10/建立-figma-neutral-前端迁移计划与验证基线)
- Figma file: [CWGSYW UI - Variables](https://www.figma.com/design/Z8EC6psFOj7KMfXapAFk24/CWGSYW-UI---Variables)
- 当前阶段：M8 本地已完成，等人授权 push / PR。活树是 `/Users/byron/AI/worktrees/YAN-71`。现场指针见 [HANDOFF.md](./HANDOFF.md) 和 [STATUS.md](./STATUS.md)。

## 2. 同一资料包内的职责边界

| 文档层 | 负责内容 | 不负责内容 |
|---|---|---|
| `design-source/` | Figma 正式 Variables、Component API、Pattern、设计状态和设计到 React 合同 | 真实路由排期、切片状态、代码交付证据 |
| 本目录其余文档 | 迁移阶段、页面矩阵、验证 Runbook、状态与回滚 | 重新解释颜色、尺寸、Variant、Node ID 或组件外观 |

设计事实发生变化时，只更新设计源、Manifest 和合同，再在本目录记录 drift 处理结果；禁止在迁移文档中创建第二套设计定义。

## 3. 权威顺序

1. 实时 Figma 正式资产、Variables、Text Styles 和 Effect Styles。
2. `design-source/FORMAL-ASSET-API-MANIFEST.md`。
3. `design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`。
4. `design-source/STATUS.md`。
5. 本目录的迁移计划、矩阵、验证和状态记录。
6. 当前系统仅用于功能、路由、权限、数据、交互和业务状态盘点。

当前前端的颜色、Token、CSS、组件外观、尺寸、间距和布局没有视觉决策权。

## 4. 不可变规则

- 常规 UI 只使用 Neutral；Info、Success、Warning、Danger 只用于真实状态。
- Figma Component 不能直接导入运行；每个正式资产都需要同名或明确映射的 React 实现。
- 先迁移 Token 和共享组件，再迁移 Pattern，最后迁移真实页面。
- 不需要在每页重复实现基础组件，但 81 个当前页面入口都必须被矩阵覆盖并逐页验收。
- 390 视图使用原生 Compact 构图；桌面 Table 不缩小成移动端 Table。
- 共享问题按 `Token -> Component -> Composition -> Page` 定位并回修，禁止页面局部 override 掩盖根因。
- 每个切片都要提供设计基线、实现、行为、A11y、视觉、消费者回归和回滚证据。

## 5. 文档入口

| 文档 | 用途 |
|---|---|
| [design-source/START-HERE.md](./design-source/START-HERE.md) | Figma 正式设计源和设计执行入口 |
| [MIGRATION-PLAN.md](./MIGRATION-PLAN.md) | 阶段、切片、门禁、风险和回滚策略 |
| [PAGE-MIGRATION-MATRIX.md](./PAGE-MIGRATION-MATRIX.md) | 全路由域覆盖、Pattern 映射和逐页台账模板 |
| [VISUAL-VALIDATION-RUNBOOK.md](./VISUAL-VALIDATION-RUNBOOK.md) | Light / Dark x 1440 / 1024 / 390 视觉闭环 |
| [STATUS.md](./STATUS.md) | 当前指针、已完成项、阻塞项和下一步 |
| [HANDOFF.md](./HANDOFF.md) | 换会话接手：活刀路径、剩余页面、YAN-71 合同 |
| [goal-prompts/README.md](./goal-prompts/README.md) | Goal 模式短/长 Prompt 和使用方式 |
| [DELIVERY-REPORT.md](./DELIVERY-REPORT.md) | YAN-10 规划基线交付报告；YAN-11 证据将另建 |

## 6. 开始后续实现

要用 Goal 一镜收口时：

1. 把 [goal-prompts/SHORT-GOAL-PROMPT.md](./goal-prompts/SHORT-GOAL-PROMPT.md) 的「短 Goal」贴进**新的** Codex Goal。不要续跑 YAN-11 / M0 旧 Goal。
2. AI 必须先读 [goal-prompts/LONG-GOAL-PROMPT.md](./goal-prompts/LONG-GOAL-PROMPT.md) 和本目录合同。
3. 从 `STATUS.md` 的 `currentPointer` 恢复。M0-M8 已落地，不要重做页面。
4. 回读实时 Figma，按 Node ID、完整名称和 API 指纹验证目标资产。
5. 本地 commit 已授权；未再授权不 push、不建 PR、不部署。

本资料包受仓库 `docs/*` 忽略规则影响，提交时必须精确强制加入本目录，禁止顺带加入其他被忽略资料。设计源与迁移执行文档必须在同一评审和版本边界内保持一致。
