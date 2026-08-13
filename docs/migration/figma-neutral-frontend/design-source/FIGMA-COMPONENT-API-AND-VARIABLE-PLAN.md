# Figma Neutral Redesign 组件 API 与变量补充计划 v1.1

> 本文是 `figma-neutral-frontend/design-source/` 下的权威设计执行资料。

## 1. 文档目的

本文定义 `CWGSYW/UI + Variables` Figma 文件中全新前端设计的组件资产、目标 API、变量规则、缺口与实施顺序。该 Figma 文件是下一次系统前端重构的唯一视觉与组件设计源。

Figma 文件：`Z8EC6psFOj7KMfXapAFk24`

### 1.1 强制设计源边界

Figma 新设计与当前系统显色设计是两套互相隔离的体系：

```text
当前系统源码 ──仅提取功能与业务场景清单──> Figma 全新设计 ──唯一设计输入──> 未来前端重构
当前颜色 / Token / 组件 API / 布局 / 样式 ────────────X 不允许进入 Figma
```

| 信息类型 | 能否从当前系统读取 | 在 Figma 中的用途 |
|---|---|---|
| 页面、功能和业务场景是否存在 | 可以 | 只用于确认设计覆盖范围 |
| 必须支持的加载、空、错误、权限和交互状态 | 可以 | 只用于确认状态覆盖范围 |
| 当前颜色、CSS Token、Tailwind 类 | 禁止 | 不得参考、复制、兼容或映射 |
| 当前组件外观、尺寸、圆角、阴影、间距 | 禁止 | 不得作为视觉基线 |
| 当前 React Props 和组件分层 | 禁止 | 不得作为 Figma 组件 API 基线 |
| 当前页面布局和信息层级 | 禁止作为设计答案 | 只能说明功能存在，必须重新设计 |

未来重构关系是单向的：先独立完成 Figma，再由未来前端实现 Figma；不得为了兼容当前前端而降低、扭曲或反向修改 Figma 定义。

### 1.2 新设计原则

- 整个非状态界面只允许使用 Neutral 色。
- 主操作、选中、悬停、按下、焦点、禁用、背景、文本、边框和 Overlay 全部使用 Neutral 色阶。
- Info、Success、Warning、Danger 只在明确传达状态含义时使用各自 Status 色。
- 禁止品牌蓝、紫色 Accent、彩色主按钮和彩色装饰性表面。
- 先在 Figma 中重新定义组件和页面，再据此创建新的 React 组件与新前端令牌。
- 当前项目代码只提供功能覆盖清单，绝不提供视觉、Token、组件 API 或布局答案。

## 2. 状态与流程例外

- 决策：`READY WITH APPROVED EXCEPTION`
- 例外授权：用户已授权本轮作为无任务号例外进行 Figma 设计工作，并明确要求讨论后落文档。
- 缺失门禁：当前没有 Linear 任务号、Owner、Priority 或 Milestone。
- 本文阶段范围：只写全新 Figma 设计合同和实施计划，不修改 Figma、React、配置、依赖、API、数据库或发布状态。
- 风险：若后续直接实施而没有跟踪任务，组件重建、实例迁移和前端重构可能缺少可追踪的验收与回滚责任人。
- 临时控制：所有 Figma 写入必须逐组件执行、返回节点 ID、回读绑定并截图验证；前端重构必须另行通过 Definition of Ready。
- 后续任务：进入 Figma 批量实施或 React 重构前创建真实任务并补齐 Owner、Priority、验收标准和发布边界；本文不虚构任务号。
- 回滚边界：文档变更可通过删除本文及 README 索引项撤回；Figma MCP 修改不能依赖桌面 Undo，必须按已记录节点 ID 做反向修复。

## 3. 审计基线

审计日期：2026-08-12。

### 3.1 Figma 基础资产

| 项目 | 当前数量或状态 |
|---|---:|
| 页面 | 25 |
| 组件相关页面 | 11 |
| 本地变量 | 177 |
| COLOR | 86 |
| FLOAT | 89 |
| STRING | 2 |
| BOOLEAN | 0 |
| Text Styles | 7 |
| Effect Styles | 5 |
| `ALL_SCOPES` 变量 | 0 |
| 缺少 Code Syntax | 24 |

变量集合：

- `CWGSYW / Primitives`：69 个变量，Value 单模式。
- `CWGSYW / Color`：32 个变量，Light / Dark 双模式。
- `CWGSYW / Dimensions`：28 个变量，Value 单模式。
- `CWGSYW / Typography`：23 个变量，Value 单模式。
- `Collection 1`：25 个旧变量；其中 24 个缺少 Code Syntax，需要做消费关系审计后迁移或删除。

### 3.2 已有组件资产

| 组件 | 当前节点 | 当前 API 概况 | 主要问题 |
|---|---|---|---|
| Button | `6:21409` | 5 Variant × 4 Size × 5 State × 4 Icon，400 变体 | 严重变体膨胀；尺寸绑定约 67% |
| Input | `85:18396` | 3 Size × 6 State；文本、图标、清除属性 | 少量硬编码色；尺寸绑定约 49% |
| Select | `95:66` | 3 Size × 7 State；图标、加载属性 | 少量硬编码色；尺寸绑定约 47% |
| Combobox | `273:129` | 4 State | 缺 Size、Hover、Error、Loading、文本与图标属性；尺寸未绑定 |
| Tabs | `114:2` | 2 Style × 2 Size × 4 State；图标与 Badge | 部分嵌套资产颜色未本地绑定；尺寸约 21%；未使用 Text Style |
| Status Badge | `121:2` | 5 Status × 2 Size；图标属性 | 尺寸绑定约 59%；未使用 Text Style |
| Skeleton | `127:2` | 5 Type × 2 State | 少量硬编码色；尺寸绑定约 29% |
| Card | `141:2` | 3 Variant × 3 Padding；文本和显隐属性 | Body/Footer 仍是固定文本，不是可组合 Slot |
| Table | `144:2` | 2 Density × 3 State | 整张表作为单资产，行、列、排序、选择无法组合 |
| Checkbox | `252:61` | Default / Selected / Disabled | Selection 与交互 State 混在同一轴 |
| Radio | `252:71` | Default / Selected / Disabled | Selection 与交互 State 混在同一轴 |
| Switch | `252:84` | Default / Selected / Disabled | Selection 与交互 State 混在同一轴；缺 Size |
| Field | `336:209` | Default / Error / Disabled；Control swap | 基础较完整；需统一控件状态与帮助/错误文案合同 |
| Textarea | `255:73` | 单组件；文本、图标、清除属性 | 没有 Size、State；部分属性没有连接到子节点 |
| Search Input | `255:75` | 单组件 | 没有 Size、State、Value、Clear、Loading；尺寸未绑定 |
| Date Picker | `255:79` | 单组件 | 只是输入框外观；没有 Calendar、Open、Range、Error 等合同 |
| Filter Bar | `255:83` | 单组件；多项显隐和文本属性 | 可作为 Pattern，需改为可替换 Slot 而不是固定两项筛选 |
| Alert | `261:101` | 4 Status；文本和显隐属性 | 缺图标替换、Dismiss 和紧凑布局选项 |
| Chip | `390:155` | 2 Size × 5 Tone；Remove 属性 | 缺 Hover、Selected、Disabled；未使用 Text Style |
| Badge | `391:135` | 5 Tone | 缺 Size 和 Icon；未使用 Text Style |
| Avatar | `391:142` | 3 Size；Initials | 缺 Image、Icon、Fallback、Status Indicator |
| Separator | `391:145` | Horizontal / Vertical | 基础可用；厚度和颜色应全部令牌化 |
| Pagination | `260:51` | 单组件；页码文本和显隐属性 | 缺 Page Item 子组件、Compact 模式和禁用/当前态合同 |
| Dropdown Menu | `260:66` | 单组件；固定四项文本 | 缺 Menu Item、Checkbox、Radio、Submenu、Destructive、State 与 Slot |
| Tooltip | `260:75` | 单组件 | 缺 Placement、Arrow、宽度和长文本行为 |
| Toast | `261:102` | 单组件；文本和操作显隐 | 缺 Tone、Icon、Dismiss、Loading/Promise 等状态 |
| Empty State | `261:107` | 单组件；文本和操作显隐 | 缺图标和 Action 的 Instance Swap / Slot |
| Progress | `261:113` | 单组件 | 缺 Linear/Circular、Size、Tone 和可设计的进度预设 |
| Spinner | `261:117` | 单组件 | 缺 Size、Label 显隐和 Neutral/Status 语义 |
| Dialog | `324:54` | 单组件；文本、显隐、Actions swap | 缺 Size；Body 仍是文本，不是内容 Slot |
| AlertDialog | `329:65` | 2 Size；文本、Media swap | 缺 Intent；Media Icon 有硬编码色 |

### 3.3 功能覆盖缺口（非设计参考）

以下清单只证明系统需要这些能力，不代表当前组件的颜色、结构、API、尺寸或布局应被继承。Figma 需要为这些能力重新设计正式资产：

- Breadcrumb
- Page Header / Detail Header
- Toolbar / Workspace Toolbar
- Drawer / Sheet
- Popover
- Menu Item 系列
- Icon Button
- Calendar / Date Range Picker
- Metric Card
- Error State
- Loading State
- Command Palette
- Table 子组件体系

领域专用的 BPMN、React Flow、Konva、Wiki Markdown、文件预览和空间布局不改造成基础组件。后续重构时，它们只消费这套全新 Figma 设计产生的基础组件和 Shell。

## 4. 参数模型

“组件参数”必须分成三类，不能全部使用 Variables。

### 4.1 Variables：视觉决策

适用于跨组件复用或需要 Light / Dark 模式的全新视觉值。变量由 Figma 自主定义，不能从当前 CSS Token 派生：

- Color：背景、文本、边框、状态、焦点、Overlay。
- Dimensions：间距、圆角、控件高度、图标尺寸、描边宽度。
- Typography：字号、行高、字重、字体族；成组视觉使用 Text Styles。
- Effects：阴影使用 Effect Styles，不创建伪 FLOAT 阴影变量。

不应作为 Variables：按钮文案、选中状态、图标类型、菜单条目、业务数值、表格数据。

### 4.2 Variant Properties：有限离散状态

只用于有限且互斥的枚举：

- `Size=Sm|Md|Lg`
- `State=Default|Hover|Focused|Pressed|Open|Error|Disabled|Loading`
- `Tone=Neutral|Info|Success|Warning|Danger`
- `Style=Underline|Segmented`
- `Density=Compact|Default`
- `Orientation=Horizontal|Vertical`

规则：公开组件的单个变体矩阵建议不超过 30；超过时使用嵌套基础组件、子组件或拆分资产族。

### 4.3 Component Properties：内容与组合

- TEXT：Label、Title、Description、Placeholder、Helper Text、Value 示例。
- BOOLEAN：Show Icon、Show Clear、Show Helper、Show Footer、Show Action。
- INSTANCE_SWAP：Leading Icon、Trailing Icon、Media、Action、Control、Content Slot。
- Slot：使用可替换的本地占位组件承载复杂内容；不把复杂内容退化为一段 Body 文本。

规则：Component Property 只有在引用已经连接到实际子节点后才算完成；定义存在但未连接不算可用。

## 5. 变量和样式合同

### 5.0 颜色白名单与禁止项

颜色变量必须先按本节重建，再继续补组件参数。

允许的颜色来源只有：

| 类型 | 允许的变量族 | 使用范围 |
|---|---|---|
| Neutral primitives | `neutral/*` | 所有常规界面、主操作、选中、焦点、文本、表面、边框、Overlay |
| Info status | `status/info/*` | 信息提示、信息状态 Badge、Alert、Toast |
| Success status | `status/success/*` | 成功状态与结果反馈 |
| Warning status | `status/warning/*` | 警告状态与风险提示 |
| Danger status | `status/danger/*` | 错误、危险状态与破坏性操作 |

强制规则：

- `bg/*`、`text/*`、`border/*`、普通 `action/*`、`focus/*`、`overlay/*` 只能 Alias 到 `neutral/*`。
- `action/primary` 及其 Hover / Pressed 使用 Neutral，不允许 Alias 到蓝色或其他品牌色。
- `action/destructive` 可以 Alias 到 `status/danger/*`，但仅用于明确的破坏性操作。
- Status 变量只能表达真实状态，不得用于普通按钮、选中态、导航、链接或装饰。
- 白色和黑色视为 Neutral 端点，不建立独立品牌色语义。
- `blue/*`、`green/*`、`amber/*`、`red/*`、`violet/*` 等旧命名不能继续承担常规 UI 颜色；有消费者时迁移到 Neutral 或对应 `status/*`，无消费者时删除。
- 即使某个 `blue/*` 当前值已经是灰色，也必须更名或迁移；变量名称本身也是设计合同，不能保留错误语义。
- 禁止把当前前端的蓝色 Primary、旧 V2 色值或 Tailwind 色类写回 Figma。

### 5.0.1 颜色消费边界

| 场景 | 颜色合同 |
|---|---|
| Primary / Secondary / Ghost 按钮 | Neutral |
| Hover / Pressed / Selected | Neutral |
| Focus Ring | Neutral |
| Tabs Indicator | Neutral |
| 链接与导航选中 | Neutral |
| 表头、卡片、输入框、菜单 | Neutral |
| Disabled | Neutral |
| Info / Success / Warning / Danger 状态 | 对应 Status 色 |
| Destructive Action | Danger Status 色 |
| 图表或业务分类色 | 本计划不批准；需要单独设计决策 |

### 5.1 复用 Figma 内部 Dimensions

Figma 内部的 `CWGSYW / Dimensions` 已足够覆盖多数基础组件，优先完成绑定而不是复制变量。该结论仅针对 Figma 内部集合，不代表复用当前前端尺寸：

| 分类 | 现有变量 |
|---|---|
| Space | `space/0,1,2,3,4,5,6,7,8,10,12,16` |
| Radius | `radius/none,sm,md,lg,xl,2xl,full` |
| Control Height | `control/height-sm,md,lg` |
| Icon Size | `control/icon-xs,sm,md,lg` |
| Border Width | `border/width-default,strong` |

所有基础组件应绑定：

- Auto Layout `paddingLeft/Right/Top/Bottom`
- `itemSpacing`
- `cornerRadius` 或独立角半径
- 控件固定高度
- 图标宽高
- `strokeWeight`

### 5.2 仅按稳定复用场景新增语义尺寸

以下变量只有在至少两个组件或模式复用时才创建：

| 候选变量 | 用途 |
|---|---|
| `table/row-height-compact` | Compact 表格行高 |
| `table/row-height-default` | Default 表格行高 |
| `textarea/min-height-sm|md|lg` | Textarea 最小高度 |
| `dialog/width-sm|md|lg` | Dialog 宽度 |
| `drawer/width-sm|md|lg` | Drawer 宽度 |
| `menu/min-width` | Menu / Combobox Popup 最小宽度 |

单页面布局宽度、自由拖拽宽度和业务字段列宽不创建成全局变量。

### 5.3 Color 合同

- Primary 语义必须直接解析到 Neutral 色阶；不保留 `blue/*` 作为中间主色别名。
- `action/primary`、`action/primary-hover`、`action/primary-pressed` 用于主操作和选中指示。
- `text/primary`、`text/secondary`、`text/disabled` 用于文本层级。
- `bg/surface`、`bg/surface-hover`、`bg/surface-selected` 用于表面状态。
- `focus/ring` 用于所有键盘 Focused 状态。
- `overlay/scrim` 用于 Dialog、Drawer、Popover 需要的遮罩。
- Status 语义继续使用 Info、Success、Warning、Danger 色族，不转为 Neutral。
- 有消费者的旧颜色必须迁移到 Neutral 或对应 Status 语义；无直接或传递消费者的旧色变量删除。

### 5.4 Typography 和 Effect Styles

- 所有可见文本必须应用现有 `CWGSYW/Type/*` Text Style，或有明确新增样式决策。
- Tabs、Status Badge、Chip、Badge、Avatar、Combobox、Search Input、Date Picker 当前未完整使用 Text Style，应补齐。
- Card、Dialog、AlertDialog、Dropdown Menu、Tooltip、Toast、Popover、Drawer 应按层级应用 `CWGSYW/Elevation/*`。
- 阴影颜色保持 Neutral 黑，不引入品牌色阴影。

### 5.5 旧 `Collection 1`

处理顺序固定为：

1. 查找每个变量的直接消费者。
2. 递归查找是否被其他变量 Alias。
3. 有消费者：迁移到正式 Primitives / Color / Dimensions 集合，并更新绑定。
4. 无直接或传递消费者：删除。
5. 不保留两套同义 Neutral、Space、Radius 变量。

## 6. 逐组件全新目标 API

本节 API 是为 Figma 新设计独立定义的目标，不以当前 React Props 为兼容边界。未来 React 重构应适配本节，而不是要求本节适配旧代码。

### 6.1 Button 与 Icon Button

Button 当前 400 变体必须重构，不继续扩展矩阵。

目标公共属性：

- Variant：Primary、Secondary、Outline、Ghost、Destructive。
- Size：Sm、Md、Lg。
- State：Default、Hover、Pressed、Disabled、Loading。
- TEXT：Label。
- BOOLEAN：Show Leading Icon、Show Trailing Icon。
- INSTANCE_SWAP：Leading Icon、Trailing Icon。

结构：

- 内部 `Button/Base` 负责 Variant × State，最多 25 变体。
- 公共 Button 只以 Size 作为外层变体，并暴露内部 Variant / State 属性。
- Icon Button 建独立资产，属性为 Variant、Size、State、Icon、Accessible Label 文档说明。
- Loading 使用 Spinner 子资产，不为 Icon Position 再创建变体。

### 6.2 Input、Select、Combobox、Textarea、Search、Date

统一字段控件状态：Default、Hover、Focused、Error、Disabled、Loading；Select / Combobox 增加 Open。

统一属性：

- Size：Sm、Md、Lg。
- TEXT：Value、Placeholder。
- BOOLEAN：Show Leading Icon、Show Trailing Icon、Show Clear、Show Loading。
- INSTANCE_SWAP：Leading Icon、Trailing Icon。

专项规则：

- Input / Textarea：Error 只负责控件视觉；错误文案由 Field 承载。
- Combobox：与 Select 分开；支持输入、清除、加载和 Open，Chevron 必须使用图标资产。
- Search Input：优先作为 Input 的预配置组合，不复制整套独立视觉实现。
- Date Input：使用 Calendar 图标和相同输入状态。
- Calendar / Date Picker：另建弹层资产，支持 Single / Range 和日期单元格状态。
- Textarea：新增 `Resize=None|Vertical` 仅作为文档/API 合同，不用 Figma 变体模拟浏览器自由缩放。

### 6.3 Field

目标属性：

- State：Default、Error、Disabled。
- TEXT：Label、Helper Text、Error Text。
- BOOLEAN：Required、Show Helper、Show Error。
- INSTANCE_SWAP：Control。

Field 不复制子控件 Focused / Open 状态；这些状态由 Control 实例自身表达。

### 6.4 Checkbox、Radio、Switch

将“值”和“交互状态”拆开：

- Checkbox：Selection=Unchecked|Checked|Indeterminate；State=Default|Hover|Focused|Error|Disabled。
- Radio：Selection=Unchecked|Checked；State=Default|Hover|Focused|Error|Disabled。
- Switch：Selection=Off|On；Size=Sm|Md；State=Default|Hover|Focused|Disabled。
- TEXT：Label。
- BOOLEAN：Show Label。

这样可以表达 Checked + Disabled、Checked + Focused 等组合，避免现有 Selected / Disabled 互斥错误。

### 6.5 Tabs

保留：Style=Underline|Segmented、Size=Sm|Md、State=Default|Hover|Selected|Disabled。

补充和修正：

- Label、Show Leading Icon、Leading Icon、Show Badge、Badge 保持组件属性。
- 所有 Label 应用 Text Style。
- 嵌套 Icon 和 Badge 必须消费本地语义变量或通过实例属性正确继承。
- Selected Indicator 使用 `action/primary`；Underline 背景透明。
- 增加 `Tabs/List` 组合资产，通过 Slot 放置 Tab Item，不为标签数量创建变体。

### 6.6 Badge、Status Badge、Chip、Avatar

- Badge：Tone=Neutral|Info|Success|Warning|Danger；Size=Sm|Md；Label；Show Icon；Icon。
- Status Badge：保留 Status 和 Size；统一为 Tone 命名或在文档中明确 Status 是业务语义映射层。
- Chip：Tone、Size、State=Default|Hover|Selected|Disabled；Label；Show Remove；Remove Icon。
- Avatar：Type=Image|Initials|Icon；Size=Sm|Md|Lg；Image / Icon swap；Initials；Show Status；Status Tone。

Tone 通过嵌套视觉子组件暴露，避免 Tone × Size × State 形成超过 30 的公共矩阵。

### 6.7 Card 与 Metric Card

Card：

- Variant=Static|Interactive|Selected。
- Padding=Sm|Md|Lg。
- Title、Description、Show Description。
- Header Action、Body Slot、Footer Slot 使用 Instance Swap。
- Show Header、Show Footer 使用 Boolean。

Metric Card 新建正式资产：

- Tone=Neutral|Info|Success|Warning|Danger。
- State=Default|Hover。
- Label、Value、Unit、Description、Trend Label。
- Show Icon、Icon、Show Trend；Trend Direction=Up|Down|Flat。

### 6.8 Table

整表资产拆成可组合层：

- Table：Density=Compact|Default；State=Data|Empty|Loading。
- Header Cell：Align=Left|Center|Right；Sort=None|Asc|Desc；Show Checkbox。
- Row：State=Default|Hover|Selected|Disabled；Show Checkbox。
- Cell：Align=Left|Center|Right；Content Slot。
- Table Toolbar：Show Search、Show Filters、Show Actions；通过 Slots 组合。
- Empty / Loading 使用正式 Empty State 和 Skeleton 子资产。

列数、行数和业务数据通过 Slot / 重复实例设计，不为每一种表结构创建变体。

### 6.9 Pagination

- Density=Compact|Default。
- Page Item：State=Default|Hover|Current|Disabled；Type=Number|Previous|Next|Ellipsis。
- Pagination/List 使用 Slot 放置 Page Item。
- TEXT：Current Page、Total Pages、Total Count。
- BOOLEAN：Show Total、Show Page Size、Show Jump。

不为 1 到 N 的每个页码建立变量或变体。

### 6.10 Alert、Toast、Empty、Error、Loading、Progress

- Alert：Tone=Info|Success|Warning|Danger；Title、Description；Icon swap；Show Description、Show Action、Show Dismiss。
- Toast：Tone=Neutral|Info|Success|Warning|Danger；Title、Description；Icon；Action；Show Description、Show Action、Show Dismiss。
- Empty State：Title、Description；Illustration/Icon swap；Action swap；对应显隐 Boolean。
- Error State：单独资产；Title、Description、Retry Action、Error Icon。
- Loading State：Spinner / Skeleton 两类组合；Label、Show Label、Minimum Height 示例只写文档，不做全局变量。
- Progress：Type=Linear|Circular；Size=Sm|Md|Lg；Tone=Neutral|Info|Success|Warning|Danger；Value 只提供 0/25/50/75/100 设计预设，不创建 101 个变体。
- Spinner：Size=Sm|Md|Lg；Label；Show Label；Tone=Neutral|Info|Success|Warning|Danger。

### 6.11 Dialog、AlertDialog、Drawer、Popover、Tooltip、Menu

Dialog：

- Size=Sm|Md|Lg。
- Title、Description、Show Description、Show Close、Show Footer。
- Body、Primary Action、Secondary Action 使用 Instance Swap / Slot。
- Overlay 使用 `overlay/scrim`，容器使用 Elevation。

AlertDialog：

- Size=Sm|Default。
- Intent=Default|Destructive。
- Media、Title、Description、Cancel / Action 属性。
- Media Icon 颜色必须绑定语义变量。

新增：

- Drawer / Sheet：Side=Left|Right；Size=Sm|Md|Lg；Header、Body、Footer Slots；Overlay。
- Popover：Placement=Top|Right|Bottom|Left；Content Slot；Arrow 显隐。
- Tooltip：Placement、Content、Show Arrow；长文本最大宽度写入组件说明。
- Menu Item：Type=Default|Checkbox|Radio|Submenu|Destructive；State=Default|Hover|Selected|Disabled；Leading Icon、Label、Shortcut、Trailing Icon。
- Dropdown Menu：使用 Menu Item Slot，不保留固定四条文本结构。

### 6.12 页面级组合模式

以下资产放在 Pattern 层，不与基础原子组件混为一组：

- Breadcrumb：Item、Current、Separator、Overflow。
- Page Header / Detail Header：Title、Subtitle、Eyebrow、Actions Slot、Status Slot。
- Toolbar / Workspace Toolbar：Leading、Filters、Actions Slots；Compact / Default。
- Filter Bar：Search、Filter Items、Reset / Actions 均为 Slot。
- Command Palette：Search Field、Group、Result Item、Empty、Loading。

## 7. 实施优先级

### P0：颜色重建、基础清理与门禁

1. 按 5.0 白名单审计全部颜色变量及其直接、传递消费者。
2. 常规 UI 色迁移到 `neutral/*`；Status 色迁移到对应 `status/*`。
3. 删除无消费者的旧色变量，特别是错误语义的 `blue/*`、`violet/*` 等变量。
4. 审计并处理 `Collection 1`，不保留重复 Neutral、Space、Radius。
5. 修复所有硬编码颜色和未绑定 Text Style。
6. 补齐 Figma 内部 space、radius、height、icon、stroke 绑定。
7. 建立自动审计表：颜色来源、尺寸、Text Style、Effect Style、组件属性引用。

退出条件：非 Status 界面只消费 Neutral；Status 色没有越界消费；没有无法解释的硬编码颜色；旧变量都有迁移或删除结论；基础组件维度绑定达到目标。

### P1：高频基础控件

1. Button / Icon Button 重构。
2. Input、Select、Combobox、Textarea。
3. Field、Checkbox、Radio、Switch。
4. Tabs、Badge、Chip、Avatar。

退出条件：每个组件属性可在实例面板中操作；State / Size 覆盖完整；截图无不可见状态。

### P2：数据与反馈

1. Table 子组件体系。
2. Pagination。
3. Alert、Toast、Empty、Error、Loading、Progress、Spinner、Skeleton。
4. Card / Metric Card。

退出条件：Data、Loading、Empty、Error、Selected、Disabled 均有可组合设计证据。

### P3：Overlay 与复杂输入

1. Dialog、AlertDialog、Drawer、Popover、Tooltip。
2. Menu Item / Dropdown Menu。
3. Calendar / Date Picker / Date Range Picker。
4. Command Palette。

退出条件：Overlay、Elevation、Placement、内部滚动、焦点状态和操作区合同均已记录并验证。

### P4：页面 Pattern 与全新前端重构输入

1. Breadcrumb、Page Header、Detail Header、Toolbar、Filter Bar。
2. 用组件实例重建代表页面片段。
3. 以 Figma 为源，定义新的 Figma Property → 新 React Prop → 新 CSS Token 实施合同。
4. 当前前端只参与功能回归对照，不参与视觉或 API 映射。
5. 在真实任务下启动全新前端重构，旧组件只作为分阶段替换对象。

## 8. 每个组件的完成标准

一个组件只有同时满足以下条件才算完成：

1. 组件名称、用途和不适用场景已写入 Description。
2. Variant 轴只有有限离散状态，命名一致，没有无意义组合。
3. TEXT、BOOLEAN、INSTANCE_SWAP 属性已连接到真实子节点。
4. 所有可见颜色绑定 CWGSYW 本地变量；常规 UI 只能消费 Neutral，Status 色必须有明确状态含义；不批准外部颜色变量例外。
5. padding、gap、radius、height、icon size、stroke width 已绑定 Dimensions，或记录固定几何例外。
6. 文本应用 Text Styles。
7. 浮层和卡片按规则应用 Effect Styles。
8. Default、Hover、Focused、Pressed、Open、Error、Disabled、Loading 中适用状态均有覆盖。
9. Light / Dark 模式均可读，禁用和错误状态不只依赖颜色区分。
10. 组件集元数据校验通过，截图无裁切、重叠、不可见文字或错误图标。
11. 返回并记录所有创建/修改节点 ID；失败脚本按原子失败处理。
12. 文档中的目标 API 与 Figma 实例面板一致。

### 建议量化门禁

| 项目 | 门禁 |
|---|---:|
| 本地颜色变量绑定 | 100%，不允许外部颜色变量例外 |
| 常规 UI 的 Neutral 消费 | 100% |
| Status 色越界消费 | 0 |
| 旧前端颜色 / Token 引用 | 0 |
| Text Style 覆盖 | 100% 可见文本 |
| Effect Style 覆盖 | 100% 需要阴影的容器 |
| Dimensions 绑定 | 不低于 90%，其余必须是固定几何例外 |
| 未连接 Component Property | 0 |
| 单个公开变体矩阵 | 建议 ≤ 30 |
| 无说明硬编码颜色 | 0 |

## 9. 非目标

- 本文不要求 Figma Component 自动运行 React 代码。
- 本文不承诺 Figma 与 React 100% 自动映射；未来实现必须以 Figma 为源建立新的可追踪合同。
- 本文不参考、兼容或迁移现有前端的显色设计、蓝色 Primary、V2 Token、组件外观或旧 Props。
- 本文不允许用“值已经变灰”为理由保留 `blue/*` 等错误语义变量名。
- 本文不修改业务 API、权限、路由、Query Key 或业务状态机。
- 本文不为动态数据、自由文本、任意宽度或每一个数值创建 Variables / Variants。
- 本文不在没有真实任务和验收环境的情况下启动 React 重构。

## 10. 文档影响评估

| 项目 | 决策 | 说明 |
|---|---|---|
| PRD / Feature Requirement | Create | 本文首次定义 Figma 组件 API 与变量补充范围，作为后续设计和前端重构输入 |
| ADR | Not applicable | 当前未改变前端运行时底层、依赖或架构决策；若采用新的 Slot / 组件映射技术再单独记录 |
| API / Data Model / Migration / Security / Operations | Not applicable | 本阶段只涉及 Figma 与设计文档 |
| Current System Baseline | Not applicable | 本文只记录全新 Figma 设计基线，不更新或继承当前前端设计基线 |
| Follow-up Documentation Task | Follow-up task | Figma 实施完成后更新节点 ID、属性矩阵和截图证据；前端重构时另建“新 Figma → 新实现”合同 |

## 11. 下一步决策点

进入 Figma 实施前只需要确认以下顺序，不再重新讨论总原则：

1. 是否按 P0 先把所有非 Status 颜色收敛为 Neutral，并清理旧变量、硬编码和 Dimensions / Styles 绑定。
2. Button 是否接受“内部 Base + 外层 Size + 独立 Icon Button”的拆分方案。
3. Table 是否接受拆成 Table / Header Cell / Row / Cell / Toolbar 的组合体系。
4. Pattern 层是否按 P4 后置，不阻塞基础组件完成。

默认推荐：按 P0 → P1 → P2 → P3 → P4 顺序实施。
