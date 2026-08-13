# Figma Neutral 前端迁移状态

## 1. 当前指针

```yaml
tracker: YAN-10
branch: docs/YAN-10-figma-neutral-frontend-migration
base: origin/development@1ed8c9ab7b148d697f8a75f828801cfae96a1459
status: UNIFIED_DESIGN_AND_MIGRATION_BASELINE_VERIFIED
currentPhase: M0
currentPointer: CREATE_FIRST_IMPLEMENTATION_SLICE_ISSUE
figmaDesignStatus: P4_DELIVERED
reactMigrationStarted: false
lastUpdatedAt: 2026-08-13
```

## 2. YAN-10 状态

| 交付项 | 状态 | 证据 |
|---|---|---|
| Linear Issue、范围、验收、风险和回滚 | COMPLETE | YAN-10 |
| 独立分支与 worktree | COMPLETE | `docs/YAN-10-figma-neutral-frontend-migration`; `/Users/byron/AI/worktrees/YAN-10` |
| 迁移入口 | COMPLETE | `README.md` |
| Figma 设计源归档 | COMPLETE | `design-source/` 10 份权威资料 |
| 总体迁移计划 | COMPLETE | `MIGRATION-PLAN.md` |
| 页面迁移矩阵 | COMPLETE | `PAGE-MIGRATION-MATRIX.md` |
| 视觉验证闭环 | COMPLETE | `VISUAL-VALIDATION-RUNBOOK.md` |
| Markdown 链接和文档校验 | PASS | 16 份文件完整；相对链接无断链；`git diff --check` 通过 |
| 历史 refactor 清理 | PASS | 34 份远端基线历史资料删除；共享组件 README 旧入口已替换 |
| 交付报告 | COMPLETE | `DELIVERY-REPORT.md` |
| Commit / push / PR | NOT AUTHORIZED | 不在本任务当前授权范围 |

## 3. 设计与代码基线

| 项目 | YAN-10 基线 |
|---|---|
| Figma file key | `Z8EC6psFOj7KMfXapAFk24` |
| Figma 设计状态 | P0-P4 已交付 |
| 正式 Component / Pattern 根 | 61，未来切片开始前实时复核 |
| 正式 Variables | 176，未来切片开始前实时复核 |
| 正式 Page Pattern | 5 |
| 当前 Next.js 页面入口 | 81 |
| 当前共享组件入口 | `components/design-system`、`components/ui`、`components/v2`、`components/shared` 并存 |
| React 重构 | 尚未开始 |

## 4. 当前约束与依赖

- Figma 是唯一视觉、Token、组件 API 和布局设计源。
- 当前系统仅提供功能、路由、权限、数据、交互和业务状态清单。
- 常规 UI 只用 Neutral；Status 色只用于真实状态。
- Figma 设计源已迁入 `docs/migration/figma-neutral-frontend/design-source/`，与迁移执行文档共享同一版本边界。
- 历史 `docs/open-design-refactor/` 已清理，不再作为本次设计或迁移输入。
- 本资料包被 `docs/*` 忽略；未来提交时必须精确强制加入本目录并审查完整 diff。
- YAN-10 只建立迁移执行基线，不授权 React、Figma、API、数据、权限或路由修改。

## 5. 后续 Issue 建议

下一任务应从 M0 开始，建立 Figma baseline manifest、Token 白名单导出、Light/Dark theme、Typography/Effect recipes 和确定性视觉 fixture。该任务需要重新通过 Definition of Ready，并在编码前执行 GitNexus impact analysis。

后续每个阶段都应拆为小型垂直切片，更新本状态文件和页面矩阵；不得将整个前端迁移塞入一个长期分支。

## 6. 状态更新协议

每次续跑必须：

1. 读取 YAN-10、本目录、实时 Figma 设计合同和上一个切片交付报告。
2. 从 `currentPointer` 指向的最早未完成项继续，不重做已验证项。
3. 将结果标记为 `PASS`、`FAIL`、`BLOCKED`、`DEFERRED` 或 `NOT RUN`。
4. 记录真实命令、截图、消费者、风险和回滚证据。
5. 更新页面矩阵和旧入口剩余消费者，避免状态只存在于对话中。
