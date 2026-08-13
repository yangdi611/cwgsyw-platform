# Figma Neutral 前端迁移计划

## 1. 目标与完成定义

目标是在不改变后端 API、权限、路由和业务语义的前提下，用 Figma Neutral Design System 重建前端视觉与共享组件体系，并逐步替换真实页面消费者。

全量迁移只有在以下条件同时满足时才完成：

- 正式 Token、61 个 Component / Pattern 根及其 React 映射已实现或有明确不适用结论。
- 81 个当前页面入口全部进入页面矩阵，并具有 `PASS`、批准的排除或后续任务。
- 每个适用页面通过 Light / Dark x 1440 / 1024 / 390、交互、A11y 和业务状态验证。
- 已迁移消费者不再依赖旧视觉语义；旧入口只在消费者为零并有回滚证据时删除。
- 没有用页面局部 CSS、magic number 或截图专用分支掩盖共享缺陷。

上述数量是 YAN-10 建立时的基线。每个实现切片开始前必须重新盘点，不能把数量当作永久常量。

## 2. 范围与非目标

### 范围

- Figma Token 的白名单导出和 Light / Dark theme。
- 正式组件的 React API、运行时状态、A11y 和测试 fixture。
- 五类 Page Pattern 的代码组合与响应式行为。
- 真实路由的功能、权限、状态和视觉迁移。
- 旧组件消费者审计、收敛和可回滚清理。

### 非目标

- 不参考当前显色页面决定新视觉。
- 不改变后端 API、数据库、RBAC 或业务流程，除非另有已就绪 Issue。
- 不一次性全局替换 CSS 后再补组件。
- 不长期维护新旧视觉语义的双向适配层。
- 不以静态截图代替键盘、焦点、Portal、screen reader 和真实状态验证。

## 3. 迁移工作流

每个垂直切片执行同一流程：

```text
Issue Ready
  -> 实时 Figma 基线与 drift 检查
  -> 消费者、权限、数据和状态盘点
  -> React API / Token / A11y 设计
  -> 共享实现与 fixture
  -> Pattern / 页面接入
  -> 视觉与交互闭环
  -> 消费者回归
  -> 旧入口清理评估
  -> 交付报告
```

一次只做一个可独立验证、可独立回滚的切片。共享组件切片至少接入一个代表消费者，避免组件库与真实页面脱节。

## 4. 阶段计划

| Phase | 交付物 | 退出门禁 |
|---|---|---|
| M0 基线与工具链 | Figma baseline manifest、Token 白名单导出、theme、Typography/Effect recipes、确定性 fixture 和截图工具 | Drift 分类完成；Light/Dark 输出稳定；Legacy 和 Remote 资产会使构建失败 |
| M1 基础动作 | Icon、Spinner、Separator、Button、Icon Button | 尺寸和状态完整；键盘/focus/loading 通过；代表 toolbar/form 接入 |
| M2 输入与选择 | Field、Input、Textarea、Select、Combobox、Search、Date Input、Checkbox、Radio、Switch | 表单状态、校验、disabled/loading、ARIA 关联通过 |
| M3 展示与数据 | Tabs、Badge、Status Badge、Chip、Avatar、Card、Metric Card、Table family、Pagination | Table 表头与移动替代视图正确；排序/选择/分页和消费者回归通过 |
| M4 状态与反馈 | Skeleton、Empty、Error、Loading、Alert、Toast、Progress | Status 色语义正确；动态反馈和布局稳定性通过 |
| M5 Overlay 与复杂输入 | Menu、Dropdown、Tooltip、Popover、Dialog、AlertDialog、Drawer、Calendar、Date Picker、Command Palette | Portal、边界、scroll lock、焦点圈定/返回、Escape 和键盘导航通过 |
| M6 页面骨架与 Pattern | Breadcrumb、Headers、Toolbars、Filter Bar、五类 Page Pattern | Default/Compact 与三个 viewport 通过；组件组合协调无突兀层级 |
| M7 路由迁移 | 按 `PAGE-MIGRATION-MATRIX.md` 逐域、逐页面替换 | 每页功能、状态、权限、响应和视觉有证据；共享问题已回修源层 |
| M8 收敛与清理 | 消费者清单、旧入口删除、文档和最终回归 | 旧入口消费者为零；完整回滚边界和全量回归通过 |

## 5. 切片选择规则

优先级按以下因素决定：

1. 被多个路由消费的共享层。
2. 能代表五类 Pattern 的端到端页面。
3. 高风险交互，例如表单、Table、Dialog、Drawer、日期输入和 Command Palette。
4. 视觉或可访问性问题明显但根因已定位的消费者。
5. 低频、专用画布和复杂第三方集成页面。

建议代表页面顺序：账号表单 -> 用户或设备管理 -> CMDB 详情与 Drawer -> Dashboard/任务分析 -> 破坏性 Overlay。该顺序不是授权；实际切片必须由对应 Linear Issue 确认。

## 6. 每个切片的必备产物

- 真实 Linear Issue、独立分支和 worktree。
- 机器可读 Figma baseline manifest 与读取时间。
- 正式 Node ID、完整名称、公共/嵌套 API 指纹和 Variable/Style 来源。
- React API、运行时状态、A11y 和明确未实现项。
- 受影响组件、Pattern、路由、权限和业务状态清单。
- 确定性 Story 或 fixture。
- Light / Dark x 1440 / 1024 / 390 截图与对比结论。
- 自动化检查、键盘流程、screen reader/ARIA 和消费者回归证据。
- 旧入口消费者审计与切片级回滚步骤。

## 7. 共享缺陷处理

发现差异后按以下顺序定位：

| 层级 | 典型问题 | 修复位置 | 必须回归 |
|---|---|---|---|
| Token | 颜色、间距、字号、圆角、阴影全局错误 | Token pipeline / recipe | 所有消费该 Token 的 fixture 和页面 |
| Component | Button、Input、Table Cell 等同族错误 | 正式共享组件 | Component matrix、Pattern、全部消费者 |
| Composition | Toolbar、Filter Bar、Pattern 的组合节奏错误 | 复合组件或 Pattern | 相关 Pattern 和页面族 |
| Page | 只属于该业务页的内容结构问题 | 页面组合层 | 当前页全状态和邻近路由 |

根因尚未确定时不得添加局部 override。连续三轮未解决同一症状时停止像素调整，重新核对 Figma API、Auto Layout、字体、内容长度和运行时状态模型。

## 8. 风险与控制

| 风险 | 控制 |
|---|---|
| 实时 Figma 与 Manifest 漂移 | 切片编码前按 ID、名称、API 指纹回读；未分类 drift 立即停止 |
| 三套当前组件入口造成双轨延长 | 每个切片记录消费者迁移和旧入口剩余数；禁止新增旧入口消费者 |
| 逐页补丁造成视觉分叉 | 强制使用共享缺陷层级和下游回归矩阵 |
| 大范围替换导致不可回滚 | 一次一个垂直切片；保留旧入口直到新切片验证通过 |
| 页面状态覆盖不足 | 矩阵明确 loading/empty/error/permission/业务状态，缺失即不通过 |
| 响应式只做缩放 | 1440/1024/390 分别构图；390 使用 Compact 和移动替代视图 |
| 资料包被 `docs/*` 忽略 | 提交时只精确强制加入本目录，并在 diff 中核对设计源和迁移文档完整性 |

## 9. 验证与回滚

验证遵循 [VISUAL-VALIDATION-RUNBOOK.md](./VISUAL-VALIDATION-RUNBOOK.md)，页面覆盖遵循 [PAGE-MIGRATION-MATRIX.md](./PAGE-MIGRATION-MATRIX.md)。

回滚以垂直切片为单位：恢复旧路由/组件入口和上一份 Token 产物，只撤销该切片的文件与消费者，不影响其他已验证切片。涉及数据、API、权限或路由变化时必须拆出独立 Issue，不能借视觉迁移扩大范围。
