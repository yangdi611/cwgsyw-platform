# Figma Neutral Redesign 实施运行手册 v1.0

> 本文是 `figma-neutral-frontend/design-source/` 下的权威设计执行资料。

## 1. 执行目标

基于 `CWGSYW/UI + Variables` 已有组件资产，逐个补全 Variables、Variants、Component Properties、组件组合和页面 Pattern，并通过持续视图验证形成未来前端重构的完整设计源。

Figma file key：`Z8EC6psFOj7KMfXapAFk24`

## 2. 固定阶段

### P0：基础接管与颜色重建

- `P0.a` 读取资料与 `STATUS.md`。
- `P0.b` 重建 Figma 页面、变量、组件、样式和 Node ID 台账。
- `P0.c` 为现有 Foundations 和全部 Component 页面保存基线截图。
- `P0.d` 审计颜色变量的直接和传递消费者。
- `P0.e` 把常规 UI 收敛到 Neutral，把真实状态收敛到 Status。
- `P0.f` 处理旧 `Collection 1`、错误语义色名、硬编码颜色和未绑定 Styles。
- `P0.g` 建立 Integration Lab 页面或区域。

退出条件：颜色白名单通过；无未解释硬编码色；现有资产、Node ID 和基线视图完整记录。

### P1：高频基础组件

顺序固定为依赖优先：

1. Icon / Spinner / Separator。
2. Button Base / Button / Icon Button。
3. Input / Textarea / Select / Combobox / Search / Date Input。
4. Field / Checkbox / Radio / Switch。
5. Tabs / Badge / Status Badge / Chip / Avatar。

退出条件：每个组件完成单体、组件族和页面组合三层视觉闭环。

### P2：数据、容器与反馈

1. Card / Metric Card。
2. Table / Header Cell / Row / Cell / Toolbar。
3. Pagination。
4. Skeleton / Loading / Empty / Error。
5. Alert / Toast / Progress。

退出条件：Data、Loading、Empty、Error、Selected、Disabled 等组合状态在代表页面中协调。

### P3：Overlay 与复杂输入

1. Menu Item / Dropdown Menu。
2. Tooltip / Popover。
3. Dialog / AlertDialog / Drawer。
4. Calendar / Date Picker / Date Range Picker。
5. Command Palette。

退出条件：Overlay、Elevation、内部滚动、Placement、焦点和操作层级均通过页面视图验证。

### P4：Pattern、整体协调与交付

1. Breadcrumb / Page Header / Detail Header。
2. Toolbar / Filter Bar / Workspace Toolbar。
3. Form、Table、Detail、Dashboard、Overlay 五类代表页面。
4. 全文件命名、绑定、颜色、Text Style、Effect Style 和可访问性审计。
5. 输出新 Figma Property → 新 React Prop → 新 CSS Token 合同。

退出条件：基础组件和 Pattern 构成统一视觉语言；代表页面没有突兀、割裂或状态冲突；所有证据已写入 `STATUS.md`。

## 3. 单组件执行循环

任何组件必须逐个执行以下循环，不能批量创建后再统一检查。

### Step A：接管

1. 从 `STATUS.md` 读取组件状态和 Node ID。
2. 回读当前 Figma 节点，不凭历史聊天猜测。
3. 获取修改前 Component Matrix 截图。
4. 列出它依赖和被依赖的组件。

### Step B：设计计划

在写入前列出：

- 本轮只修改的节点。
- 保留的现有资产与属性。
- 新增或重构的 Variables / Variants / Component Properties。
- 与相邻组件的尺寸、间距、圆角、文字和状态关系。
- 代表组合视图。
- 回滚节点 ID。

### Step C：小步写入

- `use_figma` 必须串行。
- 单次不超过 10 个逻辑操作。
- 优先修改现有同名资产，不复制第二套组件。
- 所有创建和修改 Node ID 必须返回。
- 失败脚本原子回滚；先分析错误再修正。

### Step D：结构验证 L0

检查：

- 变体轴和数量。
- TEXT / BOOLEAN / INSTANCE_SWAP 是否真实连接。
- Variable scopes、Aliases、Code Syntax。
- Color、Dimensions、Text Styles、Effect Styles 绑定。
- Auto Layout、Hug / Fill、最小和最大尺寸。

结构不通过时禁止截图冒充完成。

### Step E：组件视图验证 L1

截图完整 Component Matrix，检查：

- 所有状态可见且可区分。
- Label、Icon、Badge 和 Indicator 对齐。
- 字体、行高和控件高度协调。
- Hover / Focus / Selected / Disabled 不突兀。
- Light / Dark 均可读。

### Step F：组件族验证 L2

在 Integration Lab 中与直接相邻组件组合：

| 当前组件 | 必测组合 |
|---|---|
| Button | Field、Dialog Footer、Toolbar、Empty State |
| Input / Select / Combobox / Textarea | Field、Form Section、Filter Bar |
| Checkbox / Radio / Switch | Field Group、Table Toolbar、Dialog Form |
| Tabs | Card Header、Detail View、Badge |
| Badge / Chip / Avatar | Table Cell、Card、Header |
| Table | Toolbar、Filter、Pagination、Empty / Loading |
| Dialog / Drawer | Form、Table Detail、Action Footer |
| Alert / Toast / Progress | Form、Dashboard、Overlay |

### Step G：页面验证 L3

把组件放入至少一个代表页面；高影响组件必须覆盖两个页面。检查：

- 视觉层级是否自然。
- 组件密度是否一致。
- 主次操作是否清楚。
- 页面是否平衡、留白是否有节奏。
- 状态色是否只表达状态。
- 是否存在某个组件过亮、过暗、过大、过圆或阴影过重。
- 1440、1024、390 宽度下是否仍协调；明确桌面专用 Pattern 可记录移动端不适用。

### Step H：自适应回修

任何 L1、L2、L3 失败都立即进入：

```text
观察 -> 定位根因 -> 提出最小调整 -> 修改现有资产 -> 回读结构 -> 重截 L1/L2/L3 -> 比较
```

同一症状连续三次未解决时，不重复盲调；重新审计变量、Auto Layout、组件依赖和目标 API，然后继续。只有真实设计分叉才询问用户。

### Step I：记账

在 `STATUS.md` 记录：

- 组件和 Phase ID。
- 修改前后 Node ID。
- Variables / Properties 变化。
- L0 / L1 / L2 / L3 结果。
- 自动调整次数与调整原因。
- 当前风险和下一步。

## 4. Integration Lab

必须在 Figma 中维护一个使用正式组件实例的组合验证区，不允许用脱离组件的临时矩形替代。

最低场景：

1. `Form / Settings`：Field、Input、Select、Combobox、Textarea、Switch、Button、Alert。
2. `Data / Management`：Page Header、Tabs、Filter Bar、Table、Badge、Pagination、Empty / Loading。
3. `Detail / Drawer`：Detail Header、Card、Status Badge、Tabs、Drawer、Actions。
4. `Dashboard / Feedback`：Metric Card、Progress、Alert、Toast、Skeleton。
5. `Overlay / Destructive`：Dropdown、Popover、Dialog、AlertDialog、Danger Action。

每完成一个组件，更新相关场景实例并重新验证；不能只看组件自己的展示页。

## 5. 自动调整权限

AI 可以直接调整：

- Neutral 阶梯中的具体语义映射。
- 间距、控件高度、圆角、图标尺寸、字重、行高。
- Auto Layout、Hug / Fill、对齐和最小尺寸。
- 阴影层级和 Overlay 强度。
- 组件展示页和 Integration Lab 的构图。
- 为消除视觉割裂而进行的同族组件一致性修复。

AI 必须停下来询问：

- 需要新增 Neutral / Status 之外的颜色族。
- 需要改变已锁定的组件公共 API 总方向。
- 需要删除或替换大量已被页面消费的正式组件。
- 两种设计方案都合理且会显著改变产品气质。
- 需要扩大到新业务能力，而不只是补全现有能力。

## 6. 美观和整体协调门禁

每个代表视图按 1–5 分检查；任一 Critical 项低于 4 不通过。

| 维度 | Critical | 通过定义 |
|---|---|---|
| 颜色边界 | 是 | 常规 UI 只有 Neutral，Status 不越界 |
| 层级 | 是 | 页面焦点、主操作、内容层级清晰 |
| 状态清晰度 | 是 | Hover / Focus / Error / Disabled 清晰但不刺眼 |
| 对齐与节奏 | 是 | 基线、间距和网格一致 |
| 组件协调 | 是 | 相邻组件不因圆角、尺寸、阴影或密度产生割裂 |
| Typography | 是 | 字号、字重、行高形成统一层级 |
| 平衡与留白 | 否 | 页面不拥挤、不空洞，视觉重心稳定 |
| 响应性 | 否 | 适用宽度下无裁切、溢出和不合理堆叠 |
| 可访问性 | 是 | 对比、焦点和非颜色状态表达有效 |

## 7. 状态定义

- `NOT_STARTED`：尚未接管。
- `AUDITED`：完成只读审计和基线截图。
- `IN_PROGRESS`：正在修改或回修。
- `L0_PASS`：结构和绑定通过。
- `L1_PASS`：组件 Matrix 通过。
- `L2_PASS`：组件族组合通过。
- `VERIFIED`：L0–L3 和 Light / Dark 适用视图全部通过。
- `BLOCKED`：同一外部阻塞满足严格阻塞条件，不能继续。
- `DEFERRED`：仅在用户明确批准时使用。

`L0_PASS`、局部截图漂亮或单个状态正确，都不等于 `VERIFIED`。
