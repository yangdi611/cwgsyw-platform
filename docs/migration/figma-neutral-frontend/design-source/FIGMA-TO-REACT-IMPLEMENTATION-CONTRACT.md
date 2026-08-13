# CWGSYW Figma to React Implementation Contract v1.0

> 本文是 `figma-neutral-frontend/design-source/` 下的权威设计到代码合同。

## 1. 合同身份

本合同定义未来 React 前端重构如何实施 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`。它是设计到代码的单向实施合同，不是当前前端的兼容迁移说明。

权威顺序如下：

1. 实时 Figma 正式资产、Variables、Text Styles 和 Effect Styles。
2. `FORMAL-ASSET-API-MANIFEST.md` 对正式根的精确 allowlist 和 API 指纹。
3. 本合同对运行时语义、可访问性和验证方式的补充。
4. `STATUS.md` 中已验证的 Node ID、审计和视觉证据。
5. 当前系统仅用于枚举功能、权限、数据和业务状态，不能决定新界面的颜色、Token、组件 API、尺寸、间距、圆角、阴影或布局。

禁止用旧 React 组件、旧 CSS、Tailwind 类、旧 V2 Token、历史截图、旧显色页面或已清理的历史 refactor 文档反向兼容、改写或稀释 Figma 定义。

## 2. 实时设计源清单

本合同在 2026-08-13 以 Plugin API 回读确认：

| 资产 | 正式设计源 | 前端处理 |
|---|---:|---|
| Local Variables | 201 | 不可直接全量导出 |
| `CWGSYW / ...` 正式集合 | 9 | 白名单 |
| 正式 Variables | 176 | 允许进入 Token 构建 |
| Legacy `Collection 1` | 25 | 永不导出、永不消费 |
| 正式公开 Component / Pattern 根 | 61 | React 组件与 Pattern 的设计源 |
| Text Styles | 10 | 映射为 Typography recipes |
| Effect Styles | 5 | 映射为 Shadow / Overlay recipes |

61 个公开根按族覆盖：

- 基础与动作：Spinner、Separator、Button、Icon Button。
- 输入：Input、Textarea、Select、Combobox、Search Input、Date Input、Field、Checkbox、Radio、Switch。
- 展示：Tabs、Tabs/List、Badge、Status Badge、Chip、Avatar、Card、Metric Card。
- 数据：Table Header Cell、Table Cell、Table Row、Table Toolbar、Table、Pagination Page Item、Pagination。
- 状态：Skeleton、Empty、Error、Loading、Alert、Toast、Progress。
- Overlay：Menu Item、Dropdown Menu、Tooltip、Popover、Dialog、AlertDialog、Drawer。
- 复杂输入：Calendar Day、Calendar、Date Picker、Date Range Picker、Command Item、Command Group、Command Palette。
- 页面骨架：Breadcrumb、Page Header、Detail Header、Toolbar、Workspace Toolbar、Filter Bar。
- Page Pattern：Form / Settings、Data Management、Detail / Drawer、Dashboard / Feedback、Overlay / Destructive。

61 个根的精确 Node ID、完整名称、公共/嵌套 API 和 Runtime 边界以 `FORMAL-ASSET-API-MANIFEST.md` 为准。它是设计时 allowlist：基线采集必须同时匹配 Node ID、完整名称和 API 指纹。只按 `CWGSYW/Component/...` 或 `CWGSYW/Pattern/...` 名称前缀搜索正式资产是禁止的。

旧同名资产和 `Legacy/...` 资产不属于 61 个正式根。Node ID 只用于设计时追溯和构建期校验，不得在 React 中成为运行时依赖。实时 Figma 与 Manifest 不一致时必须停止实现，先分类为预期 drift、过期 Manifest 或未授权/不明确 drift；不得静默选择相近资产。

## 3. Token 构建合同

### 3.1 导出白名单

Token 构建器只读取名称以 `CWGSYW / ` 开头的本地集合。当前白名单为：

- `CWGSYW / Primitives`
- `CWGSYW / Color`
- `CWGSYW / Dimensions`
- `CWGSYW / Typography`
- `CWGSYW / Icon Context`
- `CWGSYW / Metric Context`
- `CWGSYW / Pagination Density`
- `CWGSYW / Feedback Context`
- `CWGSYW / Pattern Layout`

`Collection 1`、Remote Variables、未解析 Alias、无 WEB Code Syntax 的变量必须使构建失败，不能静默回退到硬编码值。

### 3.2 CSS 名称与层级

- 变量的 `codeSyntax.WEB` 是 CSS Custom Property 的精确公开名称，例如 `var(--cwgsyw-bg-surface)`。
- 176/176 正式变量必须具有合法 `var(--...)` 语法；同一集合内不得重复。
- Primitives 是内部基础层，Semantic / Context / Pattern 是消费层。组件和页面只能消费语义或上下文层，不能直绑颜色 Primitive。
- Primitives 与 Dimensions 中表达同一数值的跨集合同名 CSS Token，只输出一个公开声明；消费层 Alias 继续引用它，禁止生成重复声明覆盖顺序。
- 生成结果必须稳定排序，并保留 `Figma collection / variable ID / mode / alias chain` 的机器可读来源清单。

### 3.3 Light / Dark

- Light 和 Dark 来自 Figma Color mode，不从当前系统主题文件推导。
- `:root` 输出 Light；`[data-theme="dark"]` 输出 Dark 覆写。产品采用其他主题选择器时只能改变挂载方式，不能改变值。
- Mode 值为 Alias 时保留 CSS `var(...)` 引用；不得在构建期扁平化为散落的十六进制颜色。
- 常规 UI、Primary、Hover、Pressed、Selected、Focus、Disabled、背景、文本、边框和 Overlay 全部使用 Neutral。
- Info、Success、Warning、Danger 仅在真实状态语义中使用。禁止品牌蓝、紫色 Accent、彩色主按钮和装饰性色块。

### 3.4 类型、尺寸与效果

- Text Styles 映射为命名 Typography recipe；组件引用 recipe，禁止在页面重复拼接字号、行高和字重。
- Effect Styles 映射为命名 Shadow / Overlay recipe；Dialog、Popover、Drawer、Card 等只消费对应 recipe。
- Dimensions 映射为 spacing、size、radius、border width 等 Token；不得为业务数据或任意文本值制造 Token。
- `neutral-alpha/black-56`、`neutral-alpha/black-72` 只服务 Neutral Overlay scrim，不构成新的色系。

## 4. Figma API 到 React API

### 4.1 映射规则

| Figma 定义 | React 定义 | 规则 |
|---|---|---|
| Variant axis | 有限 union prop 或内部 recipe | 仅暴露稳定、用户可选择的离散轴 |
| `TEXT` property | `string` 或语义明确的 `ReactNode` | Label 默认 `string`；富内容区域才用 `ReactNode` |
| `BOOLEAN` property | optional region / 显隐 prop | 优先由对应内容是否存在推导，避免重复布尔值 |
| `INSTANCE_SWAP` | icon / component prop | 使用受支持的图标或组件类型，不传 Figma Node ID |
| Slot / nested instance | `ReactNode` / compound component | 保持结构角色、布局约束和可访问性 |
| Figma visual State | CSS / ARIA / state machine | 不把所有交互图板状态变成任意业务 prop |

`Hover`、`Pressed`、`Focused` 由 CSS pseudo-class、`data-*`、ARIA 和真实交互产生。React 不提供 `state="hover"` 之类的生产 API。`Disabled`、`Loading`、`Error`、`Open`、`Selected`、`Checked` 等具有业务或行为语义的状态，按组件合同暴露。

### 4.2 公共尺寸和状态

- `Size=Sm|Md|Lg` 映射为 `size="sm" | "md" | "lg"`；只实现 Figma 中该组件真实存在的尺寸。
- `Default|Compact` 是密度或 Pattern 构图，不是把整个页面按比例缩放。
- `Tone=Neutral|Info|Success|Warning|Danger` 仅用于有 Tone 合同的状态组件。普通 Button 的 Primary 仍是 Neutral。
- Loading 状态必须保留控件尺寸、可访问名称和布局稳定性，并阻止重复提交。
- Error 必须包含文字或可访问说明，不能只依靠颜色。

### 4.3 关键组件合同

Button、Icon Button、Input、Textarea、Select、Combobox、Search Input、Date Input 和 Chip 的外层 Wrapper 只直接公开稳定的 Size 轴；嵌套 Base 的 Variant、State、Content、Tone、Label、Icon、Clear、Loading 等仍属于设计 API，采集基线与设计 React API 时必须一并读取，不能因为外层未直接暴露而遗漏。

- Button / Icon Button：公开 Size；嵌套合同含 `Variant=Primary|Secondary|Outline|Ghost|Destructive`、Label、Leading / Trailing Icon、显隐、Disabled 和 Loading。Hover / Focused / Pressed 由运行时驱动。
- Input / Textarea：公开 Size；支持 Placeholder / Value、Leading / Trailing、Clear、Loading、Disabled、Error。Textarea 保持顶部内容布局。
- Select / Combobox：公开 Size；支持 Placeholder / Value、Leading Icon、Clear、Chevron、Loading、Disabled、Error、Open。Chevron 使用正式本地图标方向；Combobox 另实现输入、过滤和选项列表语义。
- Field：负责 Label、Description、Error、Required 与控件 ID / `aria-describedby` 的组合，不让每个页面重写。
- Checkbox / Radio / Switch：Selection 与交互 State 分离；键盘和原生/ARIA 语义是实现门禁。
- Tabs：Selection、Disabled、徽标和内容面板必须可读；实现 roving focus、方向键和正确的 tab / tabpanel 关联。
- Chip：`Tone`、`State`、Label、Remove；Remove 是独立可访问操作。
- Table：Header Cell、Cell、Row、Toolbar 与 Table 组成同一族；桌面标题保持 Neutral 灰底和浅灰文字。排序、选择、批量操作和空态按真实数据合同实现。
- Pagination：Page Item 和 Pagination 协作；必须实现当前页、禁用边界、页大小、跳页和可访问标签，且保持 Figma 已校正的垂直基线。
- Alert / Toast / Progress / Loading / Empty / Error / Skeleton：Status Tone 只传达真实状态；动态反馈使用 `aria-live` 或等价机制；Progress 提供可读数值或不确定状态。
- Menu / Dropdown / Command Palette：实现 roving focus、键盘选择、Escape、类型搜索或过滤、禁用项和焦点返回。
- Tooltip / Popover / Dialog / AlertDialog / Drawer：使用 Portal 和统一 Overlay 层级；实现 focus-visible、初始焦点、焦点圈定、Escape、外部点击策略、关闭后焦点返回和 screen reader 名称/描述。AlertDialog 不允许静默关闭破坏性确认。
- Calendar / Date Picker / Date Range Picker：实现日期网格键盘导航、选中/范围/不可用状态、locale 格式和输入校验；静态 Figma 不替代日期引擎。
- Breadcrumb / Headers / Toolbars / Filter Bar：保留层级、landmark、标题级别和紧凑重排，禁止把所有操作塞入同一视觉权重。

## 5. Page Pattern 合同

五类 Page Pattern 是实现组合基线，不是可直接导入运行的 Figma 页面：

| Pattern | 主要协作组件 | 必须覆盖的业务状态 |
|---|---|---|
| Form / Settings | Page Header、Field、Input、Select、Textarea、Switch、Button、Alert | 初始、脏数据、校验错误、提交中、成功、失败、权限不足 |
| Data Management | Header、Tabs、Toolbar、Filter Bar、Table / mobile list、Pagination | Loading、Empty、Error、筛选无结果、选择、排序、分页、权限 |
| Detail / Drawer | Breadcrumb、Detail Header、Card、Status、Drawer | Loading、缺失、Error、只读、可编辑、权限、抽屉开关 |
| Dashboard / Feedback | Header、Metric Card、Card、Progress、Alert、Toast | Loading、Empty、Error、部分数据、状态反馈 |
| Overlay / Destructive | Menu、Popover、Dialog、AlertDialog、Command Palette | Open / Closed、Loading、Error、确认、取消、危险操作、权限 |

响应式必须分别验证 `1440 / 1024 / 390`：

- 1440 和 1024 使用各自可用宽度与合理密度，不做截图缩放。
- 390 使用原生 Compact 纵向构图；Data Pattern 使用列表/卡片表达，不压缩桌面 Table。
- 固定格式元素要有稳定尺寸、min/max、grid tracks 或 aspect ratio，动态内容不能推挤操作区或造成跳动。
- 页面局部 CSS override 不得掩盖共享组件缺陷；共享问题必须回到 Token 或组件源修复，并回归所有消费者。

## 6. 垂直切片实施顺序

每次只迁移一个能独立验证的垂直切片：

1. Token pipeline、Light/Dark theme、Typography 和 Effect recipes。
2. Button / Icon Button、Spinner、Separator 与基础 Icon。
3. Field + Input / Textarea / Select / Combobox / Search / Date Input。
4. Checkbox / Radio / Switch、Tabs、Badge / Status Badge / Chip / Avatar。
5. Card / Metric Card、Table family、Pagination。
6. Loading / Empty / Error / Skeleton、Alert / Toast / Progress。
7. Overlay、Menu、Calendar / Date Picker、Command Palette。
8. Headers、Toolbars、Filter Bar 与五类 Page Pattern。
9. 按真实路由逐页替换，删除该切片已无消费者的旧实现。

一个切片包含：Token、React API、行为、A11y、Story/fixture、单元/交互测试、三档视图、Light/Dark 截图和回滚证据。不得先全局替换 CSS 再补组件，也不得长期维护新旧两套视觉语义的双向适配层。

## 7. 视图验证与自动回修

每个切片必须执行闭环：

1. 按 `FORMAL-ASSET-API-MANIFEST.md` 的精确 allowlist 获取目标正式根、Variant、Properties、嵌套 Base、Variables 和参考截图；禁止名称前缀发现。
2. 对比 Node ID、完整名称和公共/嵌套 API 指纹。任何未分类 drift 立即停止该切片，不能以相近资产继续。
3. 建立确定性 Story 或测试 fixture，覆盖 Default、Compact、交互、Loading、Empty、Error、Permission。
4. Playwright 在 Light / Dark、1440 / 1024 / 390 截图；Overlay 另验证 viewport 边界和 Portal。
5. 同屏比较 Figma 基线与实现，按颜色、层级、状态、对齐、节奏、Typography、组件协调、视觉平衡、响应式、A11y 评分。
6. 任一 Critical 维度低于 4/5，或出现裁切、重叠、不可见内容、错误颜色语义、破坏键盘流程，判定 FAIL。
7. 先定位根因层级：Token -> shared component -> composition -> page。只在正确层修复，然后重跑受影响层和全部下游截图。
8. 同一症状连续三轮未解决，停止像素盲调，重新核对 Figma API、Auto Layout、字体、内容长度和运行时状态模型。
9. 结构、交互、A11y、视觉和回归均 PASS 后才允许该切片退出。

像素差异不是唯一判断：字体栅格化产生的小噪声可记录阈值，但布局位移、颜色错误、内容丢失和状态不清晰不能用阈值忽略。

## 8. 禁止项

- 禁止把 Figma Component 当作可直接导入运行的代码。
- 禁止只按名称或名称前缀发现正式资产；必须使用 Manifest 精确 allowlist。
- 禁止在 Node ID、完整名称或 API 指纹出现未分类 drift 时继续实现。
- 禁止消费 Legacy `Collection 1`、Remote Variables、Legacy Components 或旧显色 Token。
- 禁止用蓝、紫或其他 Accent 表达普通主操作。
- 禁止把所有 Figma State 暴露为可任意设置的 React prop。
- 禁止用页面局部 override、magic number 或截图专用条件掩盖共享错误。
- 禁止用桌面 Table 缩放模拟 390 页面。
- 禁止只验证单个组件截图而跳过同族组合和真实 Page Pattern。
- 禁止以“视觉接近”替代键盘、screen reader、Portal、焦点和业务状态验证。
- 禁止在没有消费者审计和回滚证据时删除旧实现。

## 9. 交付证据与回滚

每个垂直切片的交付记录至少包含：

- Figma file key、正式 Node ID、Variable / Style 清单和读取时间。
- React 组件 API、Token 映射和明确未实现项。
- Story / fixture 路径、测试命令与真实结果。
- Light / Dark × 1440 / 1024 / 390 基线图、实现图和差异结论。
- 键盘、focus-visible、screen reader、Portal、Loading / Empty / Error / Permission 证据。
- 受影响路由和共享消费者清单。
- 回滚边界：可恢复的旧入口、精确文件或提交范围、数据/接口不变声明。

回滚以一个垂直切片为单位：恢复旧路由/组件入口和 Token 产物，不能回滚其他已验证切片，也不能删除仍有消费者的旧资产。

## 10. P4.e 退出门禁

本合同只有在以下事实同时成立时才可作为前端重构入口：

- 实时 Figma 正式资产、变量和样式数量已记录。
- 61 个正式根已有 `FORMAL-ASSET-API-MANIFEST.md` 精确 allowlist、嵌套 API 与 drift 门禁。
- 176/176 正式 Variables 的 WEB Code Syntax 合法，缺失、非法和同集合重复均为 0。
- Token、React API、Variant / runtime state、Slot、响应、状态、A11y、视觉闭环、回滚和禁止项均有明确规则。
- 五类 Pattern、Default / Compact、1440 / 1024 / 390 和 Light / Dark 均纳入实施门禁。
- 存在可直接执行并可续跑的 `FRONTEND-REFACTOR-EXECUTION-PROMPT.md`。
