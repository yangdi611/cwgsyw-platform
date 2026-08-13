# CWGSYW Formal Asset API Manifest v1.0

> 本文是 `figma-neutral-frontend/design-source/` 下的正式资产 allowlist。

## 1. 身份与使用规则

本清单是 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 中正式 Component / Pattern 设计源的精确白名单。2026-08-13 通过 Plugin API 回读确认：61/61 根存在，完整名称与下表一致。

未来任何 Token/截图基线、React API 设计或 Code Connect 工作都必须同时匹配：

1. 精确 Node ID。
2. 精确完整名称。
3. 公共 Variant / Component Property API 指纹。

只按 `CWGSYW/Component/` 或 `CWGSYW/Pattern/` 名称前缀发现资产是禁止的，因为历史页面仍存在旧同名或 Legacy 资产。Node ID 只用于设计时追溯和构建期校验，不得成为 React 运行时依赖。

每个垂直切片开始前必须回读目标节点并比较本清单。出现节点缺失、名称变化、轴/选项变化、Property 类型变化、嵌套 Base 变化或新增正式候选时，立即停止实现并分类为：

- `EXPECTED_DRIFT`：有当前任务授权、设计依据和清单更新计划。
- `STALE_MANIFEST`：Figma 已被合法更新，但本清单尚未同步。
- `UNAUTHORIZED_OR_AMBIGUOUS_DRIFT`：来源不明或无法判断；不得继续实现。

完成分类和清单更新前，不得用相近名称、旧资产或代码现状替代。

## 2. API 记法

- `A=x|y`：Variant 轴及合法选项。
- `P:T`：Component Property 名称与类型，类型为 `TEXT`、`BOOLEAN`、`INSTANCE_SWAP` 或 `SLOT`。
- `Base -> ...`：外层仅公开稳定轴，嵌套 Base 仍是完整设计 API，基线采集必须一并读取。
- `Runtime`：只能由真实交互、ARIA、状态机或业务状态产生的行为，不代表可任意传入的生产 prop。

`Hover`、`Pressed`、`Focused` 一律属于 Runtime。`Disabled`、`Loading`、`Error`、`Open`、`Selected`、`Checked` 等只有在具有业务或行为意义时才映射 React API。

## 3. 正式资产 Allowlist

### 3.1 基础、动作与输入

| Node ID | 精确名称 | 设计 API 指纹 | Runtime 边界 |
|---|---|---|---|
| `575:5038` | `CWGSYW/Component/Spinner` | `Size=Sm|Md|Lg`; `Tone=Neutral|Info|Success|Warning|Danger`; `Label:TEXT`; `Show Label:BOOLEAN` | 动画、加载公告由运行时实现 |
| `391:145` | `CWGSYW/Component/Separator` | `Orientation=Horizontal|Vertical` | 语义分隔用元素角色表达 |
| `606:19247` | `CWGSYW/Component/Button` | `Size=Sm|Md|Lg`; Base `605:494` -> `Variant=Primary|Secondary|Outline|Ghost|Destructive`; `State=Default|Hover|Pressed|Disabled|Loading|Focused`; Label、前后 Icon 与显隐 | Hover/Pressed/Focused 由交互驱动；Loading 阻止重复提交 |
| `610:19314` | `CWGSYW/Component/Icon Button` | `Size=Sm|Md|Lg`; Base `610:19295` -> 同 Button Variant/State；`Icon:INSTANCE_SWAP`; `Accessible Label:TEXT` | 必须保留可访问名称 |
| `625:105` | `CWGSYW/Component/Input` | `Size=Sm|Md|Lg`; Base `624:20498` -> `Content=Placeholder|Value`; `State=Default|Hover|Focused|Error|Disabled|Loading`; Placeholder、Value、前后 Icon、Clear、Loading | Focus/Error/Loading 与真实输入状态同步 |
| `626:182` | `CWGSYW/Component/Textarea` | `Size=Sm|Md|Lg`; Base `625:21935` -> 与 Input 同类 API | 多行内容顶对齐；高度增长与校验由运行时处理 |
| `641:141` | `CWGSYW/Component/Select` | `Size=Sm|Md|Lg`; Base `639:97` -> `Content=Placeholder|Value`; `State=Default|Hover|Focused|Error|Disabled|Loading|Open`; `Placeholder:TEXT`; `Value:TEXT`; `Leading Icon:INSTANCE_SWAP`; `Show Leading Icon:BOOLEAN`; `Show Loading:BOOLEAN`; `Show Chevron:BOOLEAN`; `Show Clear:BOOLEAN`；Chevron / Clear / Loading 为受显隐属性控制的固定正式子组件 | Open、选择、键盘列表行为由运行时驱动 |
| `642:253` | `CWGSYW/Component/Combobox` | `Size=Sm|Md|Lg`; Base `642:135` -> 与 Select Base 相同的 Variant、TEXT、INSTANCE_SWAP 与 BOOLEAN API；Chevron / Clear / Loading 为受显隐属性控制的固定正式子组件 | 输入、过滤、选项、Open 与键盘行为由运行时实现 |
| `642:21431` | `CWGSYW/Component/Search Input` | `Size=Sm|Md|Lg`; 嵌套 Input Base `624:20498` | 搜索提交、清除和异步 Loading 由运行时实现 |
| `642:21507` | `CWGSYW/Component/Date Input` | `Size=Sm|Md|Lg`; 嵌套 Input Base `624:20498` | 日期格式、校验和 Calendar 关联由日期引擎实现 |
| `665:432` | `CWGSYW/Component/Field` | `State=Default|Error|Disabled`; `Control:INSTANCE_SWAP`; Label、Helper、Error、Required 与显隐 | 负责 label/control/describedby/error 关联 |
| `661:21997` | `CWGSYW/Component/Checkbox` | `Selection=Unchecked|Checked|Indeterminate`; `State=Default|Hover|Focused|Error|Disabled`; Label 与显隐 | 原生/ARIA selection 与键盘行为 |
| `663:471` | `CWGSYW/Component/Radio` | `Selection=Unchecked|Checked`; `State=Default|Hover|Focused|Error|Disabled`; Label 与显隐 | Radio group、roving focus 与键盘行为 |
| `663:542` | `CWGSYW/Component/Switch` | `Selection=Off|On`; `Size=Sm|Md`; `State=Default|Hover|Focused|Disabled`; Label 与显隐 | Checked 状态与键盘行为 |

### 3.2 导航与展示

| Node ID | 精确名称 | 设计 API 指纹 | Runtime 边界 |
|---|---|---|---|
| `114:2` | `CWGSYW/Component/Tabs` | `Style=Underline|Segmented`; `Size=Md|Sm`; `State=Selected|Default|Hover|Disabled`; Label、Leading Icon、Badge 与显隐 | Selected、roving focus、tab/tabpanel 关系 |
| `677:63` | `CWGSYW/Component/Tabs/List` | `Items:SLOT` | 方向键与激活策略由运行时实现 |
| `682:23779` | `CWGSYW/Component/Badge` | `Size=Sm|Md`; `Tone=Neutral|Info|Success|Warning|Danger`; Label、Icon 与显隐 | Status 色仅用于真实状态 |
| `121:2` | `CWGSYW/Component/Status Badge` | `Size=Md|Sm`; `Status=Neutral|Info|Success|Warning|Danger`; Label、Icon 与显隐 | 状态不能只依靠颜色表达 |
| `682:23930` | `CWGSYW/Component/Chip` | `Size=Sm|Md`; Base `682:23911` -> `Tone=Neutral|Info|Success|Warning|Danger`; `State=Default|Hover|Selected|Disabled`; `Label:TEXT`; `Show Remove:BOOLEAN`; `Remove Icon:INSTANCE_SWAP` | Hover 运行时驱动；Remove 是独立可访问操作 |
| `682:24092` | `CWGSYW/Component/Avatar` | `Type=Initials|Icon|Image`; `Size=Sm|Md|Lg`; Initials、Icon、Image、Status；Status Base `682:23937` -> Tone | 图片加载/失败和状态说明由运行时实现 |
| `704:363` | `CWGSYW/Component/Card` | `Variant=Static|Interactive|Selected`; `Padding=Md|Sm|Lg`; Title、Description、Header Action、Body/Footer Slots 与显隐 | Interactive/Selected 需正确元素和键盘语义 |
| `713:25370` | `CWGSYW/Component/Metric Card` | `State=Default|Hover`; `Tone=Neutral|Info|Success|Warning|Danger`; Label、Value、Unit、Description、Icon、Trend | Hover 运行时驱动；Tone 只表示真实指标状态 |

### 3.3 数据与分页

| Node ID | 精确名称 | 设计 API 指纹 | Runtime 边界 |
|---|---|---|---|
| `730:166` | `CWGSYW/Component/Table/Header Cell` | `Align=Left|Center|Right`; `Sort=None|Asc|Desc`; Label、Checkbox | 排序和全选由数据状态驱动；灰底浅灰文字为正式视觉 |
| `731:142` | `CWGSYW/Component/Table/Cell` | `Align=Left|Center|Right`; `Content:SLOT` | 单元格语义和溢出策略按列合同实现 |
| `731:204` | `CWGSYW/Component/Table/Row` | `State=Default|Hover|Selected|Disabled`; `Cells:SLOT`; Checkbox | Hover/Selected 与真实行状态同步 |
| `731:26400` | `CWGSYW/Component/Table/Toolbar` | 固定 Search Input + `Show Search:BOOLEAN`; `Filters:SLOT`; `Show Filters:BOOLEAN`; `Actions:SLOT`; `Show Actions:BOOLEAN` | 筛选、批量操作和权限由运行时实现 |
| `736:27003` | `CWGSYW/Component/Table` | `Density=Compact|Default`; `State=Data|Empty|Loading`; Header、Rows、State Content Slots | 排序、选择、Loading/Empty 与数据合同同步；390 不缩放桌面表格 |
| `779:305` | `CWGSYW/Component/Pagination/Page Item` | `Type=Number|Previous|Next|Ellipsis`; `State=Default|Hover|Focused|Current|Disabled`; Label | Hover/Focused 运行时驱动；Current/Disabled 来自分页状态 |
| `791:365` | `CWGSYW/Component/Pagination` | `Density=Default|Compact`; Current Page、Total Count/Pages、Items Slot、Page Size/Jump/Total 显隐 | 边界禁用、页大小、跳页和标签由运行时实现 |

### 3.4 状态与反馈

| Node ID | 精确名称 | 设计 API 指纹 | Runtime 边界 |
|---|---|---|---|
| `127:2` | `CWGSYW/Component/Skeleton` | `Type=Text|Avatar|Card|Table Row|List Item`; `State=Static|Loading` | 动画与 reduced-motion 由运行时实现 |
| `814:976` | `CWGSYW/Component/Empty State` | `Layout=Default|Compact`; `Title:TEXT`; `Description:TEXT`; `Icon:INSTANCE_SWAP`; `Action:SLOT`; `Show Icon:BOOLEAN`; `Show Description:BOOLEAN`; `Show Action:BOOLEAN`；Title 必显 | Action 权限和业务空态由运行时决定 |
| `815:13899` | `CWGSYW/Component/Error State` | `Layout=Default|Compact`; `Title:TEXT`; `Description:TEXT`; `Error Icon:INSTANCE_SWAP`; `Retry Action:SLOT`; `Show Icon:BOOLEAN`; `Show Description:BOOLEAN`; `Show Retry:BOOLEAN`；Title 必显 | Retry、错误说明和公告由运行时实现 |
| `816:1006` | `CWGSYW/Component/Loading State` | `Layout=Default|Compact`; `Type=Spinner|Skeleton`; Content Slot、Label 与显隐 | `aria-busy`/公告和异步生命周期由运行时实现 |
| `856:16960` | `CWGSYW/Component/Alert` | `Layout=Default|Compact`; `Tone=Info|Success|Warning|Danger`; `Title:TEXT`; `Description:TEXT`; `Icon:INSTANCE_SWAP`; `Action:SLOT`; `Show Icon:BOOLEAN`; `Show Description:BOOLEAN`; `Show Action:BOOLEAN`; `Show Dismiss:BOOLEAN`；Dismiss 为固定子节点 | Tone 必须是真实状态；Dismiss 与公告由运行时实现 |
| `859:193` | `CWGSYW/Component/Toast` | `Layout=Default|Compact`; `Tone=Neutral|Info|Success|Warning|Danger`; `Title:TEXT`; `Description:TEXT`; `Icon:INSTANCE_SWAP`; `Action:SLOT`; `Show Icon:BOOLEAN`; `Show Description:BOOLEAN`; `Show Action:BOOLEAN`; `Show Dismiss:BOOLEAN`；Dismiss 为固定子节点 | 队列、超时、暂停和 live region 由运行时实现 |
| `860:141` | `CWGSYW/Component/Progress` | `Size=Sm|Md|Lg`; Label、Percentage、Progress Base；Base `859:31908` -> Tone、`Value=0|25|50|75|100` | React 接受连续数值/indeterminate，不受 Figma 示例刻度限制 |

### 3.5 Menu、Overlay 与复杂输入

| Node ID | 精确名称 | 设计 API 指纹 | Runtime 边界 |
|---|---|---|---|
| `900:32915` | `CWGSYW/Component/Menu Item` | `Type=Default|Checkbox|Radio|Submenu|Destructive`; `State=Default|Hover|Selected|Disabled`; `Label:TEXT`; `Leading Icon:INSTANCE_SWAP`; `Trailing Icon:INSTANCE_SWAP`; `Shortcut:TEXT` 与对应显隐 BOOLEAN | roving focus、selection 与 submenu 行为 |
| `903:33021` | `CWGSYW/Component/Dropdown Menu` | `Items:SLOT` | Portal、定位、dismiss、Escape 与焦点返回 |
| `898:541` | `CWGSYW/Component/Tooltip` | `Placement=Top|Right|Bottom|Left`; Content；Arrow 显隐 | 延时、hover/focus 触发与 viewport 碰撞 |
| `898:528` | `CWGSYW/Component/Popover` | `Placement=Top|Right|Bottom|Left`; `Title:TEXT`; `Content Slot:SLOT`; `Show Title:BOOLEAN`; `Show Arrow:BOOLEAN` | Portal、定位、dismiss 与焦点管理 |
| `894:1433` | `CWGSYW/Component/Dialog` | `Size=Sm|Md|Lg`; `Title:TEXT`; `Description:TEXT`; `Body Slot:SLOT`; `Primary Action:INSTANCE_SWAP`; `Secondary Action:INSTANCE_SWAP`; Description / Close / Footer 显隐 BOOLEAN | Portal、scroll lock、focus trap、Escape、焦点返回 |
| `897:394` | `CWGSYW/Component/AlertDialog` | `Intent=Default|Destructive`; `Size=Sm|Default`; `Title:TEXT`; `Description:TEXT`; `Media Icon:INSTANCE_SWAP`; `Primary Action:INSTANCE_SWAP`; `Cancel Action:INSTANCE_SWAP`; `Show Description:BOOLEAN`; `Show Media:BOOLEAN` | 破坏性确认不得静默关闭；初始焦点需审慎 |
| `898:507` | `CWGSYW/Component/Drawer` | `Side=Left|Right`; `Size=Sm|Md|Lg`; `Title:TEXT`; `Description:TEXT`; `Body Slot:SLOT`; `Primary Action:INSTANCE_SWAP`; `Secondary Action:INSTANCE_SWAP`; Description / Close / Footer 显隐 BOOLEAN | Portal、scroll lock、focus trap、Escape、焦点返回 |
| `914:730` | `CWGSYW/Component/Calendar Day` | `State=Default|Hover|Today|Selected|Range Start|Range Middle|Range End|Disabled|Outside|Unavailable`; Day | 日期网格键盘导航与 selection 由日期引擎实现 |
| `914:34402` | `CWGSYW/Component/Calendar` | `Selection=Single|Range|None`; Month | locale、月份导航、禁用规则与焦点由日期引擎实现 |
| `915:34881` | `CWGSYW/Component/Date Picker` | `State=Closed|Open|Disabled|Error`; 嵌套 Date Input + Calendar | Open、解析、格式化、校验与 Portal 由运行时实现 |
| `915:34882` | `CWGSYW/Component/Date Range Picker` | `State=Closed|Open|Disabled|Error`; 嵌套 Date Input + Calendar | 范围选择、解析、校验与 Portal 由运行时实现 |
| `925:1792` | `CWGSYW/Component/Command Item` | `State=Default|Selected|Disabled|Hover`; Label、Leading Icon、Shortcut | 过滤、roving focus、selection 与执行由运行时实现 |
| `928:1777` | `CWGSYW/Component/Command Group` | `Title:TEXT`; `Items:SLOT` | 分组语义和动态结果由运行时实现 |
| `929:1990` | `CWGSYW/Pattern/Command Palette` | `Layout=Default|Compact`; `State=Results|Empty|Loading`; `Search Field:SLOT`; `Content:SLOT` | Portal、搜索、异步结果、Escape 与焦点返回 |

### 3.6 页面骨架与 Page Patterns

| Node ID | 精确名称 | 设计 API 指纹 | Runtime 边界 |
|---|---|---|---|
| `943:2063` | `CWGSYW/Pattern/Breadcrumb` | `Items:SLOT` | 当前页、链接和 landmark 语义 |
| `947:2116` | `CWGSYW/Pattern/Page Header` | `Layout=Default|Compact`; Breadcrumb、Eyebrow、Title、Subtitle、Status、Actions 与显隐 | 标题级别、权限操作和响应重排 |
| `947:22448` | `CWGSYW/Pattern/Detail Header` | `Layout=Default|Compact`; Page Header API + Identity、Metadata、Tabs Slots | Tabs、操作权限和响应重排 |
| `959:38114` | `CWGSYW/Pattern/Toolbar` | `Layout=Default|Compact`; Leading、Filters、Actions Slots 与显隐 | 操作权限、折叠和响应重排 |
| `959:38142` | `CWGSYW/Pattern/Workspace Toolbar` | `Layout=Default|Compact`; Leading、Filters、Actions Slots 与显隐 | 工作区状态、权限和响应重排 |
| `959:38267` | `CWGSYW/Pattern/Filter Bar` | `Layout=Default|Compact`; Search、Filter Items、Reset、Actions Slots 与显隐 | 查询状态、reset 和响应重排 |
| `979:3728` | `CWGSYW/Pattern/Page/Form Settings` | `Layout=Default|Compact`; Header、Form Content、Supporting Content Slots 与显隐 | 校验、dirty、提交、成功/失败、权限 |
| `980:4171` | `CWGSYW/Pattern/Page/Data Management` | `Layout=Default|Compact`; Header、Toolbar、Filter、Primary Content Slots 与显隐 | Loading/Empty/Error、筛选、排序、选择、分页、权限 |
| `981:4870` | `CWGSYW/Pattern/Page/Detail Drawer` | `Layout=Default|Compact`; Header、Workspace Toolbar、Primary Content、Drawer Slots 与显隐 | Loading/缺失/Error、只读/编辑、Drawer、权限 |
| `981:41152` | `CWGSYW/Pattern/Page/Dashboard Feedback` | `Layout=Default|Compact`; Header、Metrics、Feedback、Supporting States Slots 与显隐 | Loading/Empty/Error、部分数据和动态反馈 |
| `982:5760` | `CWGSYW/Pattern/Page/Overlay Destructive` | `Layout=Default|Compact`; Header、Context Menu、Overlay、Confirmation Slots 与显隐 | Open/Closed、Loading/Error、确认/取消、危险操作和权限 |

## 4. 五类 Pattern 组合合同

| Pattern | 组合责任 | 视图责任 |
|---|---|---|
| Form Settings | Header 定义层级；Form Content 组织 Field/Input/Select/Textarea/Switch/Button；Supporting Content 承载说明或 Alert | Default 用于 1440/1024；Compact 是 390 原生纵向构图 |
| Data Management | Header + Toolbar + Filter + Table/mobile list + Pagination 协作 | 390 使用列表/卡片，不压缩桌面 Table；表头灰底浅灰文字保持正式设计 |
| Detail Drawer | Detail Header + Workspace Toolbar + Primary Content + Drawer | Drawer 保持 overlay 行为；Compact 按自然内容高度重排 |
| Dashboard Feedback | Header + Metric/Card + Feedback + Supporting States | 指标状态色必须有真实语义；Loading/Empty/Error 不造成布局跳变 |
| Overlay Destructive | Header + Menu/Popover/Dialog/AlertDialog/Command Palette | 必须验证 Portal、viewport 边界、scroll lock、键盘、焦点圈定和返回 |

所有 Pattern 都必须在 Light / Dark × 1440 / 1024 / 390 下验证。共享缺陷必须回到 Token 或正式组件修复，不得用页面局部 override 掩盖。

## 5. 基线采集门禁

每个未来实现切片必须产出一份机器可读 baseline manifest，至少记录：读取时间、文件 key、目标根 Node ID、完整名称、节点类型、公共 API 指纹、嵌套 Base 指纹、Variable/Style 来源和参考截图。只有以下条件全部成立才可开始编码：

- 目标 ID 全部存在且名称精确匹配。
- 公共与嵌套 API 指纹匹配本清单。
- 资产未落入 Legacy `Collection 1`、Remote 或旧同名集合。
- 正式 Variable / Style 审计仍通过。
- 任何 drift 已被分类、授权并同步到本清单与合同。
