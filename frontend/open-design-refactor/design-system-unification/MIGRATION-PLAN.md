# UI / V2 合并迁移计划 v1.2

> 总体目标、当前状态和负责人操作顺序以 [`MASTER-PLAN.md`](./MASTER-PLAN.md) 为准；本文件保留阶段执行细节。

## Phase 0：冻结基线

目标：记录当前依赖和行为，不修改业务代码。

执行：

1. 检查分支和 dirty worktree，保留用户已有改动。
2. 统计 `components/ui`、`components/v2`、`components/shared` 文件和引用。
3. 记录现有 lint、typecheck、build 和可用运行时入口。
4. 以 `route-layout-matrix-v2.md` 和现有页面统一化资料作为页面边界。

退出条件：基线、组件清单、引用清单和不可变业务边界写入状态台账。

## Phase 1：建立 design-system 入口

目标：创建 `components/design-system`，不迁移业务页面。

执行顺序：

1. 先迁移 Button、Input、Textarea、Label、Card、StatusBadge、Chip。
2. 再迁移 Checkbox、Switch、Select、Dialog、AlertDialog。
3. 最后迁移 Badge、Table、Tooltip、DropdownMenu、Skeleton、Avatar、Separator、Toast。
4. 组件逐个保持 typed props、ref、状态和 token 语义。
5. 为每个组件添加统一 `index.ts` 导出。

退出条件：新入口可以独立编译，且不改变任何业务页面。

## Phase 2：建立兼容层

目标：减少一次性改动的回归范围。

- `v2` 的公开导出改为 re-export `design-system`，旧路径短期可用。
- `ui` 保留为内部实现，不再新增业务引用。
- 记录每个旧组件对应的 design-system 目标组件。
- 禁止用全库正则替换，按模块和组件类型迁移。

退出条件：任何新页面只允许使用 design-system/shared；旧路径引用数量不增加。

## Phase 3：业务引用迁移与运行时验收

以下代码迁移和静态门禁已全部完成，不得按旧的“从零开始”口径重做：

1. 账户、Header、Sidebar 和登录页（已完成）。
2. 用户、组、设备、IPAM、变更文档（已完成）。
3. CMDB 总览、管理、告警、变更、统计和影响分析（已完成）。
4. 任务、工作流、运维日历和普通管理页面（已完成）。
5. Wiki、文件列表/预览和外围组件（已完成）。
6. 拓扑、2D、空间布局专业工作区及全库静态收口（已完成）。

代表性运行时矩阵已经完成：账户/全局菜单、用户 Dialog、CMDB 总览/管理/告警/影响、任务/Workflow/日历、Wiki/文件、拓扑/空间布局均覆盖真实状态和必要交互，并检查 `1440x900`、`1024x768`、`390x844`。DS-03 已标记为 `VERIFIED`，详细证据见 `STATUS.md` 文末记录。

页面视觉统一工作包 `WP-00`～`WP-07` 与本阶段相关，但不替代组件入口迁移；需要在状态台账中分别记录。

每批只迁移一个组件族或一个明确模块，保留 API、权限、路由和 query key。

## Phase 4：Intent UI 技术验证

DS-03 `VERIFIED` 后，在独立实验分支或隔离目录验证 Button、Input、Dialog、Select、Popover/Dropdown 和一个 `react-hook-form` 表单。DS-04 已在隔离目录通过静态和运行时门禁，DS-05 已选择 `BASE_UI_DEFAULT`；执行顺序、依赖清单、验收矩阵和回滚方式见 [`DS-04-SPIKE-PROTOCOL.md`](./DS-04-SPIKE-PROTOCOL.md)，决策记录见 [`INTENTUI-DECISION.md`](./INTENTUI-DECISION.md)。

Intent UI 验证失败不阻塞 Base UI + design-system 合并；它只决定 design-system 的内部实现方向。

## Phase 5：清理和收口

只有在以下条件全部满足后才删除或归档旧目录：

- 业务源码不再直接引用 `components/v2`。
- 业务源码不再直接引用 `components/ui`，或剩余引用已明确标记为专业/基础内部实现。
- 组件族的行为和视觉验收均通过。
- lint、typecheck、build、运行时和三种 viewport 证据齐全。
- `detect_changes()` 只显示预期组件和页面影响。

## 回滚

- 每个 PR 只处理一个组件族或一个页面模块。
- 兼容层保留到迁移完成，允许快速回退导入路径。
- 出现 API、权限、路由、状态机、双滚动或焦点回归时，回滚当前批次，不用页面内临时 CSS 掩盖问题。
