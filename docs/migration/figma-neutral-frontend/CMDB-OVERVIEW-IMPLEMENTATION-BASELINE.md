# CMDB 概览实现视觉基准

> 状态：持续维护中
> 最近整理：2026-08-17
> 基准路由：`/cmdb`
> 适用范围：CMDB 的 23 个路由及其共享组件；抽屉为明确例外。
> 任务：YAN-71 / YAN-91

> 最终验收：2026-08-17 用户确认 CMDB 全模块收口完成。生产页面与业务表面均为已确认状态；兼容 redirect 与内部 spike 继续按适用性标记为 `EXCLUDED`。
>
> 最终提交门禁：完整前端测试 291/291 PASS、typecheck PASS、lint 0 error / 26 existing warnings、production build PASS。GitNexus 对最终 staged 提交包评估为累计 CRITICAL（101 files / 170 symbols / 21 processes；文件数包含显式纳入的基线、Goal 文档与正式 Figma SVG）；该累计范围已按 YAN-71 用户批准的流程例外和本地提交授权记录，不代表放宽后续单符号影响分析规则。

## 1. 用途与权威顺序

这是一份**当前实现与逐页评审的工作基准**。它把 `/cmdb` 已确认的视觉决策、实现位置和核对方法集中到一处，供后续修改 CMDB 页面时使用；它不是第二套 Figma 设计源。

发生冲突时按下面顺序决策：

1. 实时 Figma 正式资产、Variables、Text Styles 与 Effect Styles。
2. `design-source/FORMAL-ASSET-API-MANIFEST.md` 和 `FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`。
3. 本文：已在 `/cmdb` 落地、且经逐轮人工评审确认的局部实现规则。
4. 当前页面：只用于盘点功能、数据、权限和状态，不能反向定义新视觉。

目标不是让每一页完全相同，而是让相同性质的元素保持同一密度、层级与反馈：表格、Tabs、输入框和筛选控件均以概览为准；**Drawer 使用专门的紧凑预览配方，不强行套内容页样式。**

## 2. 一句话设计方向

整体是收敛、紧凑、低强调的中性界面：白色内容面，浅灰用于结构与 hover，常规文字不加粗，阴影极轻或不用；不以彩色块、粗字体或大尺寸控件制造层级。

## 3. 基准页面的结构

```text
/cmdb
└─ 内容页（16px 内边距）
   ├─ 各类模型
   │  ├─ 标题 + 内联说明 > 文本 < + 概要统计
   │  ├─ 灰色 Tabs 轨道 + 白色运动指示器
   │  └─ 4 列模型卡片画布
   └─ 实例浏览（距上一区块 40px）
      ├─ 标题 + 内联说明 > 文本 <
      ├─ 模型 / 搜索 / 状态 / 重置筛选
      ├─ 表格
      └─ 点击行打开实例预览 Drawer
```

页面入口和实现责任：

| 区域 | 实现文件 | 主要 class / 组件 |
| --- | --- | --- |
| 概览、模型分组、模型卡片运动 | `frontend/src/app/(dashboard)/cmdb/page.tsx` | `cwgsyw-cmdb-overview` |
| 实例筛选、表格、行点击 | `frontend/src/components/cmdb/InstanceBrowserSection.tsx` | `cwgsyw-instance-browser` |
| 概览与 CMDB 通用局部样式 | `frontend/src/design-system/figma-neutral/components/patterns.css` | `cwgsyw-cmdb-*` |
| 共享 Tabs 的 CMDB variant | `frontend/src/design-system/figma-neutral/components/Tabs.tsx` | `style="cmdb"` |
| 实例预览抽屉 | `frontend/src/components/cmdb/CmdbInstancePreview.tsx` | `cwgsyw-cmdb-preview-drawer` |

## 4. 令牌与固定尺寸

优先使用下面的 Token，不在单页写相近的硬编码灰色、字号或间距。

| 用途 | Token | 当前 Light 值 / 含义 |
| --- | --- | --- |
| 字体 | `--cwgsyw-font-family-sans` | `Inter` |
| 正文与控件文字 | `--cwgsyw-font-size-label-sm` | 12px |
| 表头、Tab 文字 | `--cwgsyw-font-size-body-xs` | 12px |
| 普通字重 | `--cwgsyw-font-weight-regular` | 400 |
| 低强调标题、表头字重 | `--cwgsyw-font-weight-medium` | 500 |
| 小控件高度 | `--cwgsyw-control-height-sm` | 32px |
| 页内边距 | `--cwgsyw-pattern-padding` | 16px |
| 常用间距 | `--cwgsyw-space-1/2/3/4` | 4 / 8 / 12 / 16px |
| 两大区块间距 | `--cwgsyw-space-10` | 40px |
| 轻灰结构面 | `--cwgsyw-bg-surface-subtle` | Neutral 50 / `#f7f7f7` |
| hover 面 | `--cwgsyw-bg-surface-hover` | Neutral 100 / `#f0f0f0` |
| 正文次级 / 三级文字 | `--cwgsyw-text-secondary` / `--cwgsyw-text-tertiary` | Neutral 600 / 500 |
| 细边框 | `--cwgsyw-border-default` / `--cwgsyw-border-subtle` | Neutral 300 / 200 |
| 标准边框 | `--cwgsyw-border-width-default` | 1px |
| 内容卡圆角 | `--cwgsyw-radius-md` | 6px |

正文默认使用 12px / 400；只有页面或区块标题、表头可使用 500。不要用 600/700 替代层级，也不要把 14px、16px 的普通文字扩散到筛选、表格和辅助文案中。

## 5. 已确认的视觉规则

### 5.0 图标资产来源（强制规则）

- CMDB 页面凡出现可见的语义图标，包括操作按钮、菜单项、空状态、告警、提示、画布工具和状态说明，必须先到 Figma 正式图标库 `CWGSYW / Icons`（文件 `Z8EC6psFOj7KMfXapAFk24`，图标库节点 `6:22411`）按业务语义检索；不得等待人工 Review 再补做图标核对。
- 检索图标时先把中文业务语义翻译为英文，再以主词及同义词逐组搜索（例如“归档”使用 `archive / store / box`），不得只凭第一组中文直译或外观猜测；候选必须进入具体实例节点核对名称、glyph 与业务语义后才能选定。
- 选定图标后必须记录具体 Figma 节点 ID，通过设计上下文确认图形，并下载原始导出资产到 `frontend/public/figma-icons/`。禁止手写 SVG/path、AI 生成近似图形、用 CSS 几何拼图，或因共享组件有默认图标就直接沿用未经语义核对的 fallback。
- 只有项目现有图标资产与 Figma 节点的实际 glyph 明确一致时才可复用；名称相似不算确认。通过 CSS mask 使用正式导出 SVG 是允许的，但 mask 源必须指向已保存的 Figma 原始资产。
- 同一组件的不同业务状态应分别核对语义。例如“等待输入搜索”和“搜索无结果”不能因为都属于 EmptyState 就统一使用 inbox；页面应关闭不匹配的共享默认图标，再注入经过核对的 Figma `search`、`package-search` 等正式资产。
- 每次新增或替换图标，测试必须至少断言页面引用、资产文件存在和 SVG 基本结构；基线或变更记录必须写明图标名称、节点 ID、落盘路径及适用状态。
- 编辑器和画布工具栏同样遵守此规则：图标按钮的可见 glyph 统一收敛到 14–16px、按钮保持 32px 点击区、图标与文字垂直居中；不能因为画布类页面控件多就放宽 Lucide 或大图标作为最终资产。
- 纯图标动作使用 `IconButton`，必须提供对象化 `aria-label`；仅需要鼠标解释的短文案放在 `title`。工具栏中的图标加文字动作继续使用 small `Button`，不得用图标尺寸制造主次层级。
- 滑块和拖拽柄使用 4px 中性轨道与紧凑 Figma grip 资产，拖拽目标必须比 glyph 大且保持清晰 focus ring；不得沿用浏览器默认粗轨道或尺寸失控的原生 thumb。
- 机房编辑器已登记的 Figma 工具图标节点：`undo2 6:30468`、`redo_2 6:28955`、`rotate_ccw 6:29077`、`minus 6:28104`、`plus 6:28801`、`upload 6:30518`、`download 6:25366`、`copy 6:24960`、`align-left 6:23136`、`align-center-horizontal 6:23011`、`align-right 6:23145`、`align-start-vertical 6:23163`、`align-end-vertical 6:23040`、`distribute-horizontal 6:23061`、`distribute-vertical 6:23184`、`lock 6:27761`、`unlock 6:30503`、`layers 6:27473`、`wrench 6:30896`、`box 6:23904`、`grid 6:26890`、`move 6:28257`、`close 6:30927`。原始导出统一保存为 `frontend/public/figma-icons/cmdb-spatial-*.svg`，编辑器组件不得重新引入 `lucide-react`。

### 5.1 标题与说明

- 概览不再显示“概览”标题，直接从“各类模型”开始，避免无效留白。
- 一级区块标题为 16px / 22px / 500；模型卡标题为 13px / 18px / 500；其余说明为 12px / 16px / 400。
- “各类模型”和“实例浏览”的说明放在标题右侧，不另起一行。
- 说明以 SVG `>` 与 `<`（`chevron-next` / `chevron-previous`）包裹：`> 说明 <`；使用次级文字色，不能加粗。
- 不增加横线分隔两个大区块，只保留 40px 留白。
- 说明文字、实例数和字段数都用普通字重，颜色比标题浅一级。

### 5.2 模型分组 Tabs

Tabs 代表轻量筛选，不是主操作：

- 轨道：浅灰底、6px 圆角、40px 总高、内边距 6px；宽度随内容自适应，过宽时横向滚动。
- Tab：最小宽度 64px、固定高度 28px、`padding: 4px 10px`、4px 圆角、12px / 16px / 400、次级文字色。使用共享 `Button size="sm"` 的页面必须显式覆盖其 32px 高度，避免 40px 轨道产生纵向溢出。
- 轨道只有横向内容超过可用宽度时才允许左右滚动；必须显式设置 `overflow-y: hidden`，防止 `overflow-x: auto` 把纵向 overflow 计算成 `auto` 后生成右侧滚动条。
- 选中项：白色运动指示器，和灰轨道四周保持 6px 空隙；文字不加粗、不改为深黑。
- 非选中 hover：浅灰 hover 面；概览分组额外允许极轻的 `translateY(-1px)`，不能出现明显跳动或阴影。
- 指示器阴影仅 `0 1px 2px rgb(0 0 0 / 0.05)`；不使用大白色 pill、不增加粗边框。
- 必须保留 `role="tab"`、`aria-selected`、`tabpanel` 与键盘左右切换。

共享实现请优先使用：

```tsx
<Tabs style="cmdb" size="sm" items={items} />
```

当前共享 `Tabs` 的弹簧为 `stiffness: 180`、`damping: 26`、`bounce: 0`。概览的**卡片画布**也使用这组参数。`page.tsx` 内分组白色指示器仍有历史值 `360 / 32 / mass 0.6`，与统一规则不一致；后续再动 Tabs 时应优先归一为 `180 / 26 / 0`，不要复制这个较快的历史值。

### 5.3 模型卡片与卡片画布

- 桌面固定 4 列，卡片不因数量少而横向放大；超过 4 张时自然进入下一行，不隐藏为“更多”。
- 卡片最小高 76px、内边距 12px、6px 圆角、1px subtle border、白底，默认无阴影。
- 卡片标题 13px / 18px / 500；“x 实例 · x 字段”12px / 16px / 400 / 三级文字色。
- hover 只把卡片底色变成与表头相同的浅灰，并把边框提到 default；不加彩色，不加重阴影。
- 分组切换使用横向轨道，画布本身固定为当前容器宽度；这样卡片数量变化不会把后续实例浏览区向下挤动。
- 响应式：≤860px 两列；≤520px 一列。移动端 Tabs 轨道可占满可用宽度。

#### `/cmdb/admin` 模型目录分类

- 分类行不显示“展开 / 收起”文字，使用 Figma `Arrows / chevron-down` 节点 `6:31216` 的正式 SVG；原始资产保存为 `frontend/public/figma-icons/cmdb-admin-chevron-down.svg`，通过 CSS mask 继承 Neutral 状态色。
- 折叠图标为 16px 容器，图形保持 Figma 的 9.6 × 5.07px 比例；展开时旋转 180 度。按钮保留包含分类名称的动态 `aria-label` 与 `aria-expanded`。
- 分类采用单开 accordion：`expandedGroupCode` 只保存当前分类，`pendingGroupCode` 只保存切换目标；再次点击当前分类则收起。新建、复制或移动模型后也走同一切换流程。
- 分类内容使用 220ms 的高度与透明度下拉动画，面板必须 `overflow: hidden`。切换另一个分类时必须两阶段执行：旧面板先完成 exit，再通过 `onExitComplete` 打开目标面板；禁止让两个高度动画同时运行，也不叠加 `LayoutGroup` 的额外布局测量。
- 分类名称、模型名称、计数、按钮和表单辅助文字统一为常规字重 400；不能用 500/600 制造层级。
- 分类行的编辑与删除复用其他 Admin Tab 的 Figma 图标操作规则：透明底、编辑 Neutral、删除 Danger、禁用 Neutral 400，并提供对象化 `aria-label` 与禁用原因 `title`。
- 分类条目本身没有 mouse hover 底色或边框变化；它只负责组织结构。展开后的模型卡继续保留与表头一致的浅灰 hover，以表达卡片可点击。
- 模型卡不显示“操作”文字，使用 Figma `more-horizontal` 节点 `6:28154`；原始 18×4px SVG 保存为 `frontend/public/figma-icons/cmdb-admin-more-horizontal.svg`，放入 16px 图标容器并保持透明按钮背景。
- 模型菜单必须使用共享 `MenuItem`，不能把普通 `Button` 直接塞入 Menu Popup。模型菜单采用一般下拉菜单配方：固定 220px 宽、4px 内边距、6px 圆角、12px/400 菜单项、32px 最小项高、浅灰 hover、细分隔线和受控阴影；长分类名在项内换行，不能横向撑大 Popup。
- 模型菜单使用非对称双向 motion：打开 140ms / ease-out，关闭 110ms / ease-in；透明度配合 `scale(0.98)`，向下弹出时从 `translateY(-4px)` 进入、向上弹出时方向相反；transform-origin 靠近触发按钮，禁止 bounce 和大幅位移。通过 Base UI 的 `data-starting-style` / `data-ending-style` 实现，并在 reduced motion 下取消过渡。
- 共享 `DropdownMenu` 同时服务 Header 与运维日历，影响分析为 HIGH；模型菜单的视觉收敛必须限定在 `cwgsyw-cmdb-admin__model-menu` 作用域，不修改共享 API 或其他菜单。

### 5.4 搜索、输入框、Select

- 一律用 `size="sm"`：32px 高、左右 12px padding、12px / 16px 字。
- Select 必须开启 `overlay`，弹层浮在页面上方，不能把后面的表格或卡片顶开。
- 搜索框和 Select 菜单项同为 12px；placeholder 用三级文字色。
- Select 打开后，选择选项、按 Escape 或点击组件外部都必须收起；切换到另一个 Select 时，前一个菜单也必须先关闭。
- 外部点击行为应由共享 `Select.tsx` 处理：根节点持有 ref，仅在菜单打开时监听 `document.pointerdown`，点击目标不在根节点内时关闭，并在 effect 清理监听。禁止每个页面重复绑定 document 事件。
- Listbox 选项必须使用 `box-sizing: border-box`。`width: 100%` 与左右 padding 同时存在时，如果沿用默认 content-box，会让选项实际宽度超过菜单并产生横向滚动，这是本次错位的根因。
- 较长选项允许自然换行，并使用 `overflow-wrap: anywhere` 兜底；不要通过扩大内容宽度或横向滚动隐藏问题。
- 实例浏览桌面筛选格：模型 144px、搜索 `180–260px`、状态 124px、剩余空间、重置按钮。控件间距 8px。
- `/cmdb/admin` 的“属性分组”模型选择器不显示独立的“模型”标签，使用 `aria-label="选择模型"` 保留可访问名称；宽度为 280px，右侧紧邻“新建分组”按钮。
- 响应式：≤860px 两列；≤520px 单列。不要用页面专属 font-size 覆盖共享控件。

#### Select 浏览器验收

1. 打开菜单，确认菜单覆盖后续内容，而不是把内容向下推。
2. 检查菜单 `scrollWidth <= clientWidth`；若大于，优先检查选项的 box-sizing 与 padding。
3. 点击菜单内部空白或选项不能被外部点击监听误判；选择选项后菜单正常关闭。
4. 再次打开菜单，点击标题、说明文字、表格或页面空白处，菜单必须关闭。
5. 分别在 `/cmdb` 实例筛选和 `/cmdb/admin` 属性分组验证，避免只修复单个页面组合。

### 5.5 表格

- 外框：1px default border、6px 圆角、`overflow: hidden`。
- 表头：34px 高、浅灰（`surface-subtle`）底、次级文字、12px / 500、1px 下边框。
- 单元格：12px；普通行白底，末行不额外留底边。
- 文字型“操作”列默认左对齐；当操作被收敛为固定数量的纯图标按钮时，可使用固定宽度的右对齐操作栏。表头和内容必须保持相同方向，不能一个右对齐、一个左对齐。
- `/cmdb/admin` 的图标操作栏固定为 92px，恰好容纳两个 32px 图标按钮、4px 间距和单元格左右 padding；不得随表格剩余空间拉伸。
- `/cmdb/admin` 的纯图标操作栏不显示“操作”表头文案；保留空白表头和固定列宽，避免为图标重复命名。
- 实例列表的批量选择使用第一列 16×16px Checkbox；表头 Checkbox 只选择当前分页内全部实例，并通过 indeterminate 表达部分选择。行内不再显示“选择 / 取消选择”文字按钮。
- 实例列表最后一列只保留正式 Figma `trash-2` 红色图标，表头不显示“操作”；删除确认复用顶部居中的 Featured Alert Icon、16px / 500 标题和 12px / 400 说明与按钮配方。
- 编辑使用 Figma `edit` 节点 `6:25457` 的 `edit_outline` SVG；删除使用 Figma `trash-2` 节点 `6:30321` 的 `Union` SVG。原始导出资产固定保存为 `frontend/public/figma-icons/cmdb-admin-edit-outline.svg` 与 `frontend/public/figma-icons/cmdb-admin-trash-2.svg`，禁止用手写 path 近似替代。
- 两个 Figma SVG 通过 `CmdbAdminActionIcon` 的 CSS mask 使用 `currentColor`：编辑保持中性色；删除可用时图标为 Danger 红色；正常行与行 hover 下按钮背景始终透明，hover 仅加深图标并提高不透明度，按下时缩放到 `0.92`。不可删除时同样保持透明底，但图标固定使用更浅的 Neutral 400（并降至 72% 不透明度）与不可点击光标，必须能与可用编辑的 Neutral 600 明确区分；不以隐藏按钮代替权限或约束反馈。
- 纯图标操作必须使用 `IconButton` 并提供随对象变化的 `aria-label`；可用 `title` 补充鼠标提示。编辑态的保存与取消也使用 check / close 图标，避免文字按钮重新撑宽固定操作栏。
- 操作按钮容器必须 `flex-wrap: nowrap`，92px 列宽内的两个 32px 图标按钮始终同排，不通过扩大列宽掩盖换行。
- 可交互行 hover：表头同款浅灰底，120ms `background-color` 过渡；表格视觉应平静，不加阴影。
- 概览中的实例表隐藏通用 Table toolbar；筛选已在表格上方独立出现。
- 所有 CMDB 内容页应通过 `cwgsyw-cmdb-page` 或 `cwgsyw-cmdb-table` 获得同一配方。Drawer 内的定义列表不应伪装成表格。

#### `/cmdb/admin/models/:modelCode` 模型设置详情

- 内容区不重复渲染全套面包屑，沿用应用外壳生成的 CMDB / 模型管理 / 当前模型路径；页面自身从模型标题开始。
- 模型编码作为标题右侧的低强调内联说明，使用与概览一致的 `chevron-next / chevron-previous` 包裹，不另起一行制造留白。
- 属性按分组展示，但每组使用统一紧凑表格，不再为每个属性渲染独立大卡片。列固定为属性名称、字段标识、类型、配置和纯图标操作栏。
- 属性名称、字段标识和配置说明均为 12px / 400；分组标题为 13px / 400。配置状态使用中点分隔的低强调文字，避免连续 Chip 形成过多视觉噪音。
- 编辑、删除复用 Admin 表格的 Figma 图标与 92px 右对齐操作栏；内置属性的删除图标保留但禁用，以 Neutral 400 明确表达不可删除状态。
- 新建、编辑属性继续使用 Neutral Dialog；输入框和 Select 均为 32px / 12px，弹层 Select 使用 overlay，复选项允许紧凑换行，弹窗底部按钮使用 small 尺寸。
- 属性 Dialog 使用白色内容面，不在表单主体叠加浅灰大容器；标题为 16px / 22px / 500，字段标签、帮助文字、复选项和底部按钮均为常规字重 400。两列字段必须 `align-items: start`，带帮助文字的一侧不能把另一侧字段垂直居中或向下推移。必填星号必须跟随标签使用 12px / 16px，不能以默认 16px / 24px 撑高标签行；Checkbox 固定为 16×16px，与文字间距 8px。

#### `/cmdb/instances/by-model/:modelCode/:id` 实例详情

- 只保留应用外壳生成的一套面包屑；页面自身从实例标题开始。模型编码与实例 ID 使用标题右侧的 `> model · #id <` 低强调说明，创建时间和创建人放在下一行的 12px / 400 三级文字中。
- 影响分析、拓扑对比和属性编辑使用 small 按钮，按钮文字保持常规字重；不得用大按钮或粗体与实例名称争夺层级。
- 基线完整度、维保状态等顶部状态 Badge 保留状态色和既有尺寸语义，但文字统一为 12px / 16px / 400；该规则限定在实例详情状态区，不修改共享 Badge 或其他页面。
- Tabs 必须使用 `style="cmdb"` 与现有 motion 配方。Tab 面板和轨道之间保留 12px，不另加横线或大标题卡。
- 禁止把通用 `cwgsyw-stack-list` 当普通 Grid 容器。该组件自带边框和圆角，错误嵌套会形成页面、分组、字段三层边框。
- 基本信息使用“属性信息标题 → 分组容器 → 三列字段网格”：分组仅保留 1px 外框和 34px 浅灰标题行，字段内部不再单独画卡片；字段标签与值均为 12px / 400，标签使用三级文字色，值使用正文色。
- 多行文本和 table 字段横跨整行；≤860px 改为两列，≤520px 改为单列。编辑态继续使用 32px / 12px Input、Select 和 Textarea，不改变保存协议。
- 所在机柜、端口连接等辅助模块复用同一 34px 浅灰标题行与白色内容面，标题 13px / 400；空状态、列表和操作按钮不使用 Tailwind `font-bold` 或 uppercase 样式。
- 关联关系、拓扑图、变更历史、告警、关联资源和机柜视图的内容必须与基本信息使用同一轻量模块配方：1px 外框、6px 圆角、34px 浅灰标题行、12px / 400 正文。禁止 Card 套 Card，也不能用带完整外框的 `cwgsyw-stack-list` 再包分组或列表。
- 关联关系继续使用概览同款紧凑表格；变更与告警改为细分隔行，行 hover 使用表头浅灰；拓扑画布保留必要高度但不增加 Card 内边框；关联资源使用两组紧凑列表。状态 Badge 保留语义色，文字统一 12px / 400。
- 变更记录的箭头、状态、操作人和日期之间保持 8px 间距。共享 Button 会生成内部 `span` 包装层，横向排列与 gap 必须作用到该内部层，不能只给按钮根节点设置 `inline-controls`，否则操作人与日期会粘连。
- 资源池容量摘要保持桌面四列、平板两列、窄屏一列；数值仅使用 18px / 500，标签和说明保持 12px / 400，卡片 hover 与表头浅灰一致，避免大号粗体指标卡。
- 机柜视图保留 SVG 设备画布和状态颜色，但页面标题、统计、告警、悬浮信息和未定位设备列表统一为常规字重；未定位设备使用 34px 紧凑行与浅灰 hover，不能出现旧 `font-semibold`。
- 实例详情的空状态标题使用 13px / 400，说明使用 12px / 400；禁止 EmptyState 的默认 title recipe 在内容区形成粗体。详情页所有 Button 的文字保持 400，包括组件生成的内部 `span` 包装层。
- 添加、建立、编辑、保存、装入、新建连接等内容主操作使用黑底 Primary，并保持自然内容宽度；取消、查看、管理全部、对比等辅助操作继续使用 Secondary 或 Ghost。不能把 Grid 中的主按钮拉伸为整行宽度。
- 空状态下的居中主操作继续保持自然宽度，并与空状态内容水平居中；标题栏中的管理、对比和全屏等辅助按钮使用带 1px 边框的 Secondary，不能使用无边框 Ghost 混入标题文字。
- 变更记录行和展开按钮不使用 mouse hover 底色，交互仅通过箭头状态、键盘焦点和展开内容表达。
- 全站分页统一使用共享 `Pagination`：默认隐藏“共 N 条”，容器占满可用宽度并整体右对齐；页码与 previous / next 固定 22×22px、4px 间距、12px / 400，箭头 Icon 固定 12×12px。`.cwgsyw-page-item` 必须使用 `inline-flex` 双轴居中、零 padding 和 border-box，箭头中心 X/Y 偏差必须为 0。只有明确的产品例外才可显式启用 `showTotal`，禁止页面重新定义另一套分页尺寸或对齐方式。

#### 图标操作列浏览器验收

1. 操作列实测宽度为 92px；两个 32px 按钮横向同排，间距 4px，容器的 `flex-wrap` 必须为 `nowrap`。
2. 表头不显示“操作”文字，但操作列仍保持固定宽度和右对齐；三个 Admin 表必须一致。
3. 可用编辑在 Light 主题下使用 Neutral 600（当前 `#525252`），可用删除使用 Danger（当前 `#912018`）；两者背景均为透明。
4. 禁用编辑或删除使用 Neutral 400（当前 `#a3a3a3`）和 72% 不透明度，背景仍为透明；必须能肉眼区别于可用编辑，且按钮保持 `disabled` 与不可点击光标。
5. 行 hover 变为浅灰时，图标按钮不得出现白色、灰色或浅红色方块；按钮 hover 仅提高图标不透明度，按下反馈为 `scale(0.92)`，键盘焦点继续使用共享 focus ring。
6. 每个按钮必须通过 `aria-label` 包含动作和对象名称；禁用原因通过 `title` 提供，不以颜色作为唯一说明。

### 5.6 实例预览 Drawer（明确例外）

Drawer 用于快速确认，不复制内容页的卡片布局：

- 宽 `min(360px, 100vw)`，内边距 16px，区块间距 12px。
- 标题 14px / 20px / 500；元信息、描述和字段 12px / 16px / 400。
- 字段使用两列 definition list：标签列 88px，值列自适应，行上下 8px，细分割线。
- 不用卡片套卡片；操作区置底、右对齐，以细上边框分隔。
- 所有 Drawer 统一使用 shadcn/Vaul 的 Root、Portal、Overlay、Content、Title、Description 与 Close；`NeutralDrawer` 仅保留兼容 API，不再以 Base UI Dialog 模拟 Drawer。
- 右侧 Drawer 使用 `direction="right"`，由 Vaul 统一驱动右侧进入、反向退出、拖拽进度和遮罩过渡；默认 500ms、`cubic-bezier(.32, .72, 0, 1)`，不再叠加页面级 transform 动画。
- `side="left"` 等价映射为 Vaul `direction="left"`；系统启用 reduced motion 时把 Drawer 与 Overlay 动画压缩到 1ms。
- 需要在 Drawer 内继续展开详情时，使用 shadcn/ui 对应的 Vaul `NestedRoot`：母 Drawer 保持挂载并退到后方，子 Drawer 位于最前；点击子层遮罩或执行关闭时只收起子 Drawer，重新显示母 Drawer，关闭母 Drawer 才清空整组选择状态。不得用两个互不关联的普通 Drawer 模拟嵌套层级。
- 仅图标操作需要补充悬浮说明时，优先使用 Neutral Tooltip 而非原生 `title`。短说明可使用白色胶囊配方：内容宽度、999px 圆角、6px × 10px 内距、12px/400、轻边框与柔和阴影；鼠标悬浮时可在 80ms 后跟随指针，默认显示在指针下方并与指针热点保持约 18px 间距，避免小手轮廓遮挡胶囊；通过碰撞检测在视口边缘自动翻转或位移，入场 motion 建议控制在 90ms。键盘聚焦时仍以触发按钮为锚点，并提供 reduced-motion 回退。图标按钮本身保持透明底，hover/active 仅调整图标颜色，focus ring 继续保留。`aria-label` 继续描述完整操作，Tooltip 可使用更短的可见文案。

### 5.7 全站遮罩与背景模糊

- Dialog、Drawer、命令面板、Wiki 图片 / 图表全屏层与移动端侧栏统一使用共享遮罩配方，页面不得单独发明不同的黑色蒙层。
- 支持 `backdrop-filter` 时，遮罩背景取 `--cwgsyw-overlay-scrim` 的 58% 强度，并使用 `blur(6px) saturate(0.9)`；目标是降低背景干扰，而不是让页面显著变暗。
- Safari 同步提供 `-webkit-backdrop-filter`；不支持背景模糊时回退到原始 `--cwgsyw-overlay-scrim`，确保弹层与背景仍有足够分离度。
- 系统启用 `prefers-reduced-transparency` 时取消模糊并恢复原始遮罩 token，避免强制透明效果。

### 5.8 全站 Dialog 与 AlertDialog

- 所有普通弹窗统一经由 `NeutralDialog` 使用 Radix / shadcn Dialog 的 Root、Portal、Overlay、Content、Title、Description 与 Close；业务页面不得直接引入 Base UI Dialog，也不得为单页复制一套 Portal、焦点圈定或遮罩实现。
- `NeutralDialog` 只保留现有 `open`、`onOpenChange`、`title`、`description`、`size`、`intent`、`children` 与 `footer` 兼容 API，内部不同时渲染新旧两套组件，因此兼容层不产生双重 DOM、双重遮罩或双重事件监听。
- 删除、覆盖、恢复等确认操作统一经由 `NeutralAlertDialog` 使用独立的 Radix Alert Dialog 原语，不再用普通 Dialog 模拟；点击遮罩不得静默关闭，取消和确认必须是可辨识的语义操作。
- `/cmdb/admin/models/:modelCode` 的属性删除确认框使用局部 `cwgsyw-cmdb-model-detail__delete-dialog` 作用域：宽度 400px，顶部居中放置 Figma Featured Icon `6:39605`（56px Danger 圆形，内部 28px exclamation-triangle）；标题 16px / 22px / 500，说明与按钮 12px / 400，按钮高 32px。图标资产保存为 `frontend/public/figma-icons/cmdb-model-alert.svg`。只通过 `NeutralAlertDialog` 的可选 `className` 与 `icon` 插槽注入，不改变其他确认框默认视觉。
- Dialog 内容打开使用 `opacity 0 → 1` 与 `scale 0.95 → 1`，时长 200ms、`ease`；关闭反向执行。Overlay 淡入淡出为 150ms。系统启用 reduced motion 时，Dialog 与 Overlay 动画压缩到 1ms。
- 受控弹窗没有显式 Trigger 时，兼容层记录打开前焦点，并在关闭后将焦点返回仍存在的触发元素；无 Description 时显式取消 `aria-describedby`，避免错误的辅助技术关联。
- AlertDialog 的确认动作保持受控：先执行业务 `onConfirm`，由业务成功回调或既有状态更新关闭弹窗；异步删除、归档、恢复期间不得因点击确认而提前卸载错误或加载状态。
- Wiki Mermaid 全屏查看器属于沉浸式全屏例外，保留专用 `role="dialog"` 与全屏布局，但必须复用共享遮罩配方、键盘关闭和可访问名称。

#### CMDB 业务 Dialog 内容配方

- 装入机柜、添加关联等表单型 Dialog 使用白色内容面，不在主体叠加大面积浅灰 Card 或 `cwgsyw-stack-list`；字段之间用 12px 间距，关联密切的两列字段可使用紧凑 Grid。
- 标题为 16px / 22px / 500；说明、Field 标签、帮助文字、候选项、错误信息与按钮均为 12px / 16px / 400。表单层级优先依靠间距和文字颜色，不用 600/700 粗体。
- Input、SearchInput、Select 与按钮统一 `size="sm"`（32px）；Select 必须使用 `overlay`。有可见 Field 标签时由 Field 提供可访问名称，没有可见标签时必须补 `aria-label`。
- Footer 只承载提交路径，右对齐且按钮保持自然宽度：取消使用 Secondary，确认或建立使用 Primary；选择某个候选对象不等同于提交，候选行使用 Neutral hover / selected 面，不使用黑底 Primary 冒充最终操作。
- 候选列表使用 1px subtle border、6px 圆角、白底和不超过视口的纵向滚动；每行最小高 32px、12px / 400，hover 使用 `surface-subtle`。空结果在列表内以低强调文字呈现，不制造第二个 EmptyState 大区块。
- Dialog 内需要展示完整选项的 Select 使用 `cwgsyw-cmdb-dialog__flow-select` 流式展开配方，不与 Dialog 叠加两层滚动；弹窗随列表高度自然扩展，列表自身最多显示五行。展开使用 180ms 淡入与轻微上移复位，并配合 `motion/react` layout spring；reduced motion 下压缩到 1ms。一个 Dialog 有多个 Select 时，每个 Select 独立受控，关闭 Dialog 必须同时清理所有展开状态。
- macOS / Chromium 的覆盖式滚动条默认只在滚动时显示，不能依赖系统行为提示“下面还有选项”。流式 Select 必须保留稳定 scrollbar gutter，并绘制 8px 轨道中的细 Neutral thumb；同时使用 `overscroll-behavior: contain`，避免列表滚到边界后把滚动继续传给 Dialog。
- Dialog 关闭后不得保留上一次的错误、候选选择或动态属性；异步提交期间禁用确认按钮，成功后沿用既有 query invalidation 与关闭流程。
- `/cmdb/instances/by-model/:modelCode/:id/associations` 继续采用 Data Management 配方：只保留 App Shell Breadcrumb，页头与筛选分区，compact Table，真实 Empty / Error 分离；方向使用“出向 / 入向”文本，不用裸箭头承担语义。

## 6. 已形成的实现约束

1. 任何 CMDB 内容页的外壳都传 `className="cwgsyw-cmdb-page"` 给 `DataManagementPage`、`FormSettingsPage`、`DetailDrawerPage` 或 `DashboardFeedbackPage`。
2. 不能使用上述 Pattern 的空间画布 / 编辑器，要在其真实根节点显式加 `cwgsyw-cmdb-page`。
3. 新增表格先使用共享 `<Table>`，再用 `cwgsyw-cmdb-table` 或页面外壳获得概览密度；禁止单独重写表头颜色、字号和 hover。
4. 新增 Tabs 先使用 `style="cmdb"`，不要回退到 underline、默认 segmented 或手写白色大 pill。
5. 只在真实状态上使用 success / warning / danger 色；常规结构、筛选、卡片与主操作保持 Neutral。
6. 遇到“看起来没变”的页面，先检查该页面是否实际接入 `cwgsyw-cmdb-page`，再查共享 Pattern 是否透传 `className`；不要先堆页面级 CSS override。
7. Select 的打开/关闭、键盘与外部点击属于共享组件行为；页面只负责宽度、排列和业务值。共享问题不得用页面级遮罩、全局 click handler 或强制失焦绕过。
8. 当共享组件影响面较大时，先静态扫描消费者和受控状态用法，再修改兼容 API；至少完成组件测试、全套 Neutral 回归、TypeScript 检查与两个真实消费者的浏览器验证。

## 7. 后续逐页评审流程

每一页按以下顺序处理：

1. 先在浏览器打开路由，记录用户感受和可复现位置。
2. 对照第 5 节只判断同类元素：标题、Tabs、筛选、表格、卡片、Drawer。
3. 定位到 `Token → 共享组件 → Pattern → 页面组合` 的最小正确层；优先修共享层，避免复制造成下一页不一致。
4. 修改后至少核对：默认、hover、选中、弹层不顶开内容、点击外部收起、无横向滚动、窄屏折行。
5. 在下面台账补充实际决策；若规则改变，同时修改本文相应章节，而不是只写日志。

### 评审台账

| 日期 | 路由 | 观察 / 决策 | 实现位置 | 状态 |
| --- | --- | --- | --- | --- |
| 2026-08-15 | `/cmdb` | 建立本页为 CMDB 视觉实现基准；确认 4 列卡片、40px 区块留白、紧凑 Tabs、12px 表单与表格配方。 | `cmdb/page.tsx`、`InstanceBrowserSection.tsx`、`patterns.css` | 已确认 |
| 2026-08-15 | `/cmdb/instances/2d-view`、`/cmdb/changes/stats`、`/cmdb/impact/:id`、`/cmdb/spatial/spike` | 发现独立页面没有进入 CMDB 外壳；已补作用域，避免默认 Pattern 样式绕过概览基准。 | `Patterns.tsx` 与各入口 | 已修正 |
| 2026-08-15 | `/cmdb/admin` | 去掉内容区重复面包屑；标题说明改为概览同款内联结构；分类与模型标题降为 13px/500，模型卡固定 4 列，说明、Chip、空状态和 hover 收敛到概览密度。 | `cmdb/admin/*`、`patterns.css` | 用户已确认 |
| 2026-08-15 | `/cmdb`、`/cmdb/admin` | Select 增加外部点击收起；选项采用 border-box，消除横向滚动错位；属性分组移除“模型”标签，选择框宽度调整为 280px。 | `Select.tsx`、`fields.css`、`AttributeGroupsTab.tsx` | 用户已确认 |
| 2026-08-15 | `/cmdb/admin` | 曾将三张表的文字“操作”表头和按钮统一左对齐；后续根据图标化需求改为固定宽度右对齐操作栏。 | `AttributeGroupsTab.tsx`、`AssociationDefsSection.tsx`、`AssociationsTab.tsx` | 已被后续规则替代 |
| 2026-08-16 | `/cmdb/admin` | 三张表改用 Figma `edit`（`6:25457`）与 `trash-2`（`6:30321`）正式 SVG；操作栏固定 92px、右对齐且禁止换行；移除“操作”表头；可用和禁用按钮均为透明底，可用编辑为 Neutral 600、删除为 Danger，禁用图标为更浅的 Neutral 400；保存/取消同步图标化。 | `CmdbAdminActionIcon.tsx`、`public/figma-icons/*`、`cmdb/admin/*`、`patterns.css` | 已确认 |
| 2026-08-16 | `/cmdb/admin` 模型目录 | 分类展开文字替换为 Figma chevron-down（`6:31216`）；分类改为单开 accordion，切换时先收旧面板、再开新面板，避免并发高度动画卡顿；分类和模型目录文字统一常规字重；分类编辑删除复用透明 Figma 图标操作。 | `ModelCatalogTab.tsx`、`CmdbAdminDisclosureIcon.tsx`、`public/figma-icons/cmdb-admin-chevron-down.svg`、`patterns.css` | 用户已确认 |
| 2026-08-16 | `/cmdb/admin` 模型卡 | 分类条目取消 hover 灰底，模型卡保留浅灰 hover；“操作”文字替换为 Figma more-horizontal（`6:28154`）；弹出内容改用共享 `MenuItem` 与紧凑的一般下拉菜单样式，删除项使用 Danger，并增加 140ms 双向进入/退出 motion。 | `ModelCard.tsx`、`CmdbAdminModelMenuIcon.tsx`、`public/figma-icons/cmdb-admin-more-horizontal.svg`、`patterns.css` | 用户已确认 |
| 2026-08-16 | `/cmdb/admin` 模型卡菜单 | “打开设置”前增加 Figma settings-2（`6:29346`），“移动到分类”前增加 Figma move（`6:28256`）；图标固定 16px，并继承菜单项文字颜色，保持紧凑菜单密度。 | `ModelCard.tsx`、`CmdbAdminModelMenuItemIcon.tsx`、`public/figma-icons/cmdb-admin-settings-2.svg`、`public/figma-icons/cmdb-admin-move*.svg`、`patterns.css` | 用户已确认 |
| 2026-08-16 | `/cmdb/admin/models/:modelCode` | 移除内容区重复面包屑；模型编码改为标题内联说明；属性卡片改为分组紧凑表格；操作复用 Figma edit / trash 图标；新建与编辑弹窗统一 small 控件和紧凑复选项布局。 | `models/[modelCode]/page.tsx`、`components/AttributeList.tsx`、`AddAttributeDialog.tsx`、`EditAttributeDialog.tsx`、`patterns.css` | 已确认 |
| 2026-08-16 | `/cmdb/admin/models/:modelCode` 属性 Dialog | 修正两列 Field 被帮助文字行高影响而错位的问题；表单改为白底；标题缩为 16px/500；标签、帮助文字、复选项和底部按钮取消粗体。 | `patterns.css`、`figma-neutral-m7-cmdb-model-detail.test.cjs` | 已确认 |
| 2026-08-16 | `/cmdb/admin/models/:modelCode` 属性 Dialog | 进一步定位到必填星号沿用 16px/24px，导致必填 Select 比非必填 Select 下移 8px；星号统一为 12px/16px，Checkbox 从 20px 缩为 16px。 | `patterns.css`、`figma-neutral-m7-cmdb-model-detail.test.cjs` | 已确认 |
| 2026-08-16 | `/cmdb/instances/by-model/:modelCode/:id` | 移除内容区重复面包屑；标题、操作和 Tabs 收敛到概览密度；基本信息从嵌套 StackList/Card 改为分组三列字段网格；机柜与端口模块统一为轻量分组结构。 | `instances/by-model/[modelCode]/[id]/page.tsx`、`InstanceBasicInfoTab.tsx`、`RackAssignmentCard.tsx`、`EndpointLinksCard.tsx`、`patterns.css` | 用户已确认 |
| 2026-08-16 | `/cmdb/instances/by-model/:modelCode/:id` 顶部状态 | “基线完整度”等状态 Badge 字体从继承的 16px 收敛为 12px / 16px / 400；仅作用于实例详情状态区，保留状态色与 Badge 尺寸。 | `patterns.css`、`figma-neutral-m7-cmdb-instance-detail.test.cjs` | 用户已确认 |
| 2026-08-16 | `/cmdb/instances/by-model/:modelCode/:id` 全部 Tabs | 关联关系、拓扑、变更、告警、关联资源和机柜视图统一为 34px 浅灰标题行、12px/400、轻量分隔列表或紧凑表格；移除内容 Tab 的 Card 嵌套和错误 StackList 外框；资源池摘要同步收敛。 | `Instance*Tab.tsx`、`RackElevationView.tsx`、`ResourcePoolCapacityCard.tsx`、`patterns.css`、定向测试 | 用户已确认 |
| 2026-08-16 | `/cmdb/instances/by-model/:modelCode/:id` 变更历史 | 修复共享 Button 内部包装层吞掉横向间距的问题；箭头、状态、操作人和日期统一保持 8px 间距，避免姓名与日期连续。 | `patterns.css`、`figma-neutral-m7-cmdb-instance-detail.test.cjs` | 用户已确认 |
| 2026-08-16 | `/cmdb/instances/by-model/:modelCode/:id` 主操作与空状态 | 空状态标题、辅助按钮和主按钮文字统一为 400；“添加关联”恢复自然宽度并改为黑底 Primary；编辑、装入机柜、新建连接等内容主操作同步使用 Primary，辅助导航保持 Ghost。 | `InstanceAssociationsTab.tsx`、`InstanceBasicInfoTab.tsx`、`RackAssignmentCard.tsx`、`EndpointLinksCard.tsx`、`patterns.css`、定向测试 | 用户已确认 |
| 2026-08-16 | `/cmdb/instances/by-model/:modelCode/:id` 关联、拓扑与变更历史 | “添加关联”改为居中；管理全部、对比模式和全屏展开改为带边框 Secondary；变更记录取消行与按钮 hover 底色；分页文字降为 400，控件缩为 22×22px。 | `InstanceAssociationsTab.tsx`、`InstanceTopologyTab.tsx`、`patterns.css`、定向测试 | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id` 拓扑 Tab | 移除只读 `preview` 模式，直接使用与拓扑对比一致的完整 `CiTopologyGraph`：支持画布拖拽、滚轮/触控缩放、Controls、MiniMap、节点折叠和 `NodeToolbar` hover 详情。初始 `fitView` 保持 padding 0.35、maxZoom 1，避免单节点初始过大。 | `CiTopologyGraph.tsx`、`InstanceTopologyTab.tsx`、拓扑/对比/实例详情定向测试 | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id` 拓扑 hover 数据 | 实例 Tab 不再直接透传后端 payload，补齐与拓扑页/对比页一致的 camelCase/snake_case DTO 归一化：`model_id/name/color`、`is_root`、`key_attrs` 均映射到共享 `TopologyNode`。基础 hover 字段一致；对比页只额外显示差异状态。 | `InstanceTopologyTab.tsx`、`figma-neutral-m7-cmdb-instance-detail.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id` 关联关系空态 | 修正先前图标替换遗漏：实例详情“暂无关联”不再使用共享 inbox，改为与独立关联页一致的 Figma `link-2` 节点 `6:27582`；原始 22×12 SVG 放入既有 24×24 空态图标槽，未重新绘制。 | `InstanceAssociationsTab.tsx`、`public/figma-icons/cmdb-association-link-2.svg`、`figma-neutral-m7-cmdb-instance-detail.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id` 告警空态 | 修正同类遗漏：实例详情“该实例暂无告警”不再使用共享 inbox，改为与告警中心一致的 Figma `alert-circle` 节点 `6:22984`；原始 22×22 SVG 放入既有 24×24 空态图标槽。 | `InstanceAlertsTab.tsx`、`public/figma-icons/cmdb-alert-circle.svg`、`figma-neutral-m7-cmdb-instance-detail.test.cjs` | 用户已确认 |
| 2026-08-16 | 全站共享 Pagination | 确认 14 个使用点复用同一 Pagination；统一隐藏总数、整体右对齐、22×22px 页码与按钮、12×12px 箭头、4px 间距和 12px/400；修复双轴居中并删除实例页重复覆盖。 | `Pagination.tsx`、`display.css`、`patterns.css`、`figma-neutral-m3-display.test.cjs`、实例详情定向测试 | 用户已确认 |
| 2026-08-16 | 全站共享 Drawer、`/cmdb` 实例预览 Drawer | 共享 `NeutralDrawer` 的底层从 Base UI Dialog 全量替换为 shadcn/Vaul Drawer；保留原调用 API，全部消费者统一获得 direction、手势驱动进入/退出、遮罩 motion、焦点管理和 reduced-motion 兼容。Vaul 原语归入 Neutral 设计系统，CMDB 删除页面级 transform，避免覆盖拖拽。 | `figma-neutral/components/Drawer.tsx`、`Overlay.tsx`、`overlay.css`、`patterns.css`、Overlay 与 CMDB 定向测试 | 用户已确认 |
| 2026-08-16 | 全站共享遮罩 | Dialog、Drawer、命令面板、Wiki 全屏预览和移动侧栏遮罩统一为浅化 scrim + 6px 背景模糊；支持 Safari 前缀，不支持时回退原 token。 | `overlay.css`、`figma-neutral-m5-overlay.test.cjs` | 用户已确认 |
| 2026-08-16 | 全站共享 Dialog / AlertDialog | 保留 `NeutralDialog` / `NeutralAlertDialog` 兼容 API，底层从 Base UI Dialog 全量替换为独立的 Radix / shadcn Dialog 与 Alert Dialog；统一 Portal、焦点圈定与返回、正确确认语义、200ms 内容 motion、150ms 遮罩 motion 和 reduced-motion。39 个普通 Dialog 与 37 个 AlertDialog 无需逐页改写即可自动迁移。 | `figma-neutral/components/Dialog.tsx`、`AlertDialog.tsx`、`Overlay.tsx`、`overlay.css`、`figma-neutral-m5-overlay.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/admin/models/:modelCode` 删除属性 AlertDialog | 参考同页编辑 Dialog 收敛字体与按钮密度；加入 Figma Featured Icon `6:39605` 并置顶居中；共享 AlertDialog 只增加向后兼容的可选 class/icon 插槽，其他 37 个消费者不变。 | `AttributeList.tsx`、`Overlay.tsx`、`patterns.css`、`public/figma-icons/cmdb-model-alert.svg`、Overlay 与模型详情定向测试 | 已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id` 关联资源空状态 | 按用户视觉 Review 将两个空态都绑定正式 Figma 资产：设备凭证使用纯 `key`（`6:27336`），避免把凭证误读为文件；关联变更文档使用 `file-diff`（`6:25779`），直接表达文档变更。两者固定 24×24，共用实例详情空态密度，不改变其他 EmptyState 消费者。 | `InstanceResourcesTab.tsx`、`patterns.css`、`public/figma-icons/cmdb-resource-key.svg`、`public/figma-icons/cmdb-resource-file-diff.svg`、实例详情定向测试 | 用户已确认 |
| 2026-08-17 | `/cmdb/models` | 兼容入口仅服务端重定向到已确认的 `/cmdb/admin`，不渲染独立页面；源码、页面矩阵、YAN-88 审计、GitNexus LOW 影响与真实浏览器跳转一致。 | `cmdb/models/page.tsx`、`PAGE-MIGRATION-MATRIX.md`、`evidence/YAN-88/page-audit.md`、page coverage test | EXCLUDED |
| 2026-08-17 | `/cmdb/instances` | 兼容入口仅服务端重定向到已确认的 `/cmdb`，不渲染独立页面；跨模型实例浏览继续由概览页承载，保留旧入口兼容性。源码、页面矩阵、YAN-88 审计、GitNexus LOW 影响与真实浏览器跳转一致。 | `cmdb/instances/page.tsx`、`PAGE-MIGRATION-MATRIX.md`、`evidence/YAN-88/page-audit.md`、page coverage test | EXCLUDED |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode` | 移除内容区重复面包屑；页头按钮统一 small/400；桌面表格第一列使用行选择与当前页全选 Checkbox，最后一列缩为 56px Figma 红色 trash 图标；删除确认复用已确认的顶部 Featured Alert Icon 配方。390 保持双列紧凑卡片；使用既有 1-based API 合同按 20 条分页并复用共享 Pagination，query-key 保留 `['cmdb-instances', modelCode]` 前缀兼容。 | `instances/by-model/[modelCode]/page.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-instance-list.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/new` | 移除内容区重复面包屑和动态属性大 Card；实例信息与动态分组统一为 Neutral 模块框体：1px 中性边框、6px 圆角、34px 浅灰标题行、白色 12px 内边距内容面，标题使用 13px/400；字段网格按实际内容宽度响应式切换 1 / 2 / 3 / 4 列，最大四列，长文本继续横跨整行，控件保持 small；多选项 Checkbox 固定 16px、文字 12px/400。必填校验继续使用共享 Field error 并聚焦首错，模型加载失败使用共享 ErrorState；保留创建 API payload、权限和路由。 | `instances/by-model/[modelCode]/new/page.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-instance-new.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id/associations` | 移除内容区重复面包屑；Error 与 Empty 分离，空态使用 Figma `link-2`（`6:27582`）正式资产；关联方向以可读“出向/入向”Chip 呈现；筛选补可访问名称，桌面固定表格列宽、390 使用双列紧凑卡片。 | `instances/by-model/[modelCode]/[id]/associations/page.tsx`、`patterns.css`、`public/figma-icons/cmdb-association-link-2.svg`、`figma-neutral-m7-cmdb-instance-associations.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id` 装入机柜 / 添加关联 Dialog | 建立 CMDB 业务 Dialog 内容配方：白色表单面、small 控件、12px/400 标签与按钮、自然宽度 footer；移除把普通表单与候选区包装成 `stack-list` 的做法。目标候选使用可滚动 Neutral 列表，选中态不冒充 Primary，只有确认提交使用 Primary。“关联定义”“关联类型”和“机柜选择”统一改为流式展开，Dialog 随列表自动扩展并加入 layout spring，消除 Dialog 与下拉菜单的双层滚动。 | `RackAssignmentCard.tsx`、`InstanceAssociationsTab.tsx`、`patterns.css`、实例详情定向测试 | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/by-model/:modelCode/:id/associations/new` | 移除内容区重复 Breadcrumb；三步向导使用 22px 编号节点、细连接轨道和 complete/current/upcoming 语义，不再用三枚普通 Chip 模拟步骤；每步提供 14px/500 标题与 12px/400 说明。关联定义使用 76px Neutral 选择卡，复用 Figma `link-2`（`6:27582`）展示关系，源/目标模型和关系类型分层呈现，并以 14px radio indicator 表达选中；目标候选沿用同一选择语义。三个空状态全部关闭共享 inbox：暂无定义使用 `link-2`（`6:27582`），待输入关键词使用 Figma `search`（实例 `6:29270`，源组件 `2:5500`），无匹配实例使用 `package-search`（实例 `6:28469`）；资产分别保存为 `cmdb-association-link-2.svg`、`cmdb-search.svg`、`cmdb-package-search.svg`，标题统一 13px/400。桌面为紧凑网格、390 单列；实例、定义与搜索查询均呈现真实 loading/error/retry，搜索区分初始、无结果与候选；确认页使用紧凑 definition list 和原生 `fieldset` 属性编辑，保留创建合同但不制造数据。 | `instances/by-model/[modelCode]/[id]/associations/new/page.tsx`、`patterns.css`、`public/figma-icons/cmdb-association-link-2.svg`、`public/figma-icons/cmdb-search.svg`、`public/figma-icons/cmdb-package-search.svg`、`figma-neutral-m7-cmdb-instance-associations-new.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/associations` | 兼容入口仅服务端重定向到已确认的 `/cmdb/admin`，不渲染独立页面；关联定义继续由模型管理页承载。源码、迁移矩阵、YAN-88 审计、GitNexus LOW 影响、覆盖测试与真实浏览器跳转一致。 | `cmdb/associations/page.tsx`、`PAGE-MIGRATION-MATRIX.md`、`evidence/YAN-88/page-audit.md`、page coverage tests | EXCLUDED |
| 2026-08-17 | `/cmdb/impact/:instanceId` | 移除内容区重复 Breadcrumb；方向与深度使用 small overlay Select；补齐 hydration 与 permission 状态；根节点、影响层级和无下游节点空态使用轻量语义 section。点击“第 X 层”在原位置向下展开页内详情，不改变页面左右结构；使用 `AnimatePresence`、`height: 0 → auto`、opacity 与 220ms Material easing，并由 `MotionConfig reducedMotion="user"` 处理减弱动画。根节点与层级模型优先显示 `modelName`，模型 ID 仅作 fallback；同类状态、模型、业务等级和关联关系 Badge 保持在同一元信息行，窄屏再换行。节点只归入紧邻上一层的关系边，跨层边不混入；同名真实边聚合为单个“关系 ×数量”Badge。保留 API、query key、RBAC 与路由行为；本页无新增图标。 | `impact/[instanceId]/page.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-impact.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/topology/:instanceId` | 移除内容区重复 Breadcrumb；页头动作组固定靠右，按钮局部收敛为 28px 高、8px 横向 padding、12px/400，窄屏再整组换行。查看深度 1/2/3 直接复用 `PaginationPageItem` 的 22×22 数字按钮与 current 语义，不再用普通 Chip 模拟分页控件。页面边界适配后端蛇形 DTO，查询错误与空态分离，画布使用 520/440/360px 稳定高度并支持全屏。全部共享 React Flow 使用 Token 灰色点阵；fitView 初始缩放不超过 1，节点为 96–132px Neutral Card；hover 详情通过 `NodeToolbar` 保持 184px 屏幕尺寸、自然高度和可交互 hover。筛选侧栏的分组与选项统一 12px/16px/400，Checkbox 为 16×16px、8px 间距和 28px 行高；行为合同不变。 | `topology/[instanceId]/page.tsx`、`CiTopologyGraph.tsx`、`patterns.css`、拓扑/对比/实例详情定向测试 | 用户已确认 |
| 2026-08-17 | `/cmdb/topology/:instanceId/compare` | 起止时间和深度使用紧凑 Field，时间倒置显示错误并禁用提交；差异摘要和真实状态图例独立于 520/440/360px 对比画布。共享图谱按用户明确授权解决此前 HIGH DEFERRED：浅灰点阵、fitView 初始 maxZoom 1、96–132px Neutral Card 节点、2px 状态条、184px `NodeToolbar` hover Popover、28px controls 与 120×72 minimap；四个图例 Badge 局部收敛为 18px/11px，不修改共享 Badge；比较算法与协议不变。 | `topology/[instanceId]/compare/page.tsx`、`CiTopologyGraph.tsx`、`patterns.css`、拓扑/对比/实例详情定向测试 | 用户已确认 |
| 2026-08-17 | `/cmdb/instances/2d-view` | 移除重复 Breadcrumb；模型和分组字段使用 small overlay Select 与可访问名称；模型、属性、视图查询和权限状态分离，默认分组值与控件同步。2D 分组板使用轻量 section，桌面四列、平板两列、390 单列；实例行为 12px/400，保留状态 Badge、焦点与详情导航。`host` 未启用为真实错误态，`rack` 数据态可用；本页无新增图标。 | `instances/2d-view/page.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-2d-view.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/spatial` | 移除重复 Breadcrumb；工具栏保持搜索在最左、活动/已归档 Tabs 在最右。状态切换直接复用 `/cmdb/admin` 同一个共享 `Tabs style="cmdb" size="sm"`，不得在页面内复制或近似重画 Tabs：40px 无边框浅灰轨道、6px 内距、28px Tab、12px/400 与白色 motion 指示器，键盘方向键、tablist/tab/tabpanel 语义和 reduced-motion 均由共享组件提供；搜索清除行为保持可用。列表加载、查询错误、筛选无结果和 permission 状态分离。真实布局卡使用桌面四列、平板两列、390 单列，标题 13px/500、正文与操作 12px/400；状态 Badge 局部收敛为 18px 高、10px regular。“打开布局”为 32px secondary 按钮；归档使用 Figma `archive`（`6:23304`）完整原始 SVG，按 22:18 原始比例缩放为 17×14px glyph，置于 32px 透明 IconButton，并使用白色跟随鼠标胶囊 Tooltip。“新建布局”作为 Page Header 操作在桌面靠右、520px 以下全宽；Dialog 使用 400px small 配方、白色内容面、16px/500 标题，说明、字段标签、Select 触发器/占位文字、下拉项与按钮全部统一为 12px/400，控件高 32px并使用紧凑 footer；关闭时清理机房选择与上次创建错误。新建、归档、恢复业务合同不变。 | `cmdb/spatial/page.tsx`、`SpatialLayoutIndex.tsx`、`patterns.css`、`public/figma-icons/cmdb-spatial-archive.svg`、`figma-neutral-m7-cmdb-spatial.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/spatial/rooms/:roomId` | 已发布机房查看器使用 Detail/Drawer Pattern：Page Header 只承担标题与返回/版本/编辑导航，搜索和五个图层放入独立工作区工具栏。图层属于互斥视图切换，使用与 CMDB 概览一致的紧凑 Tabs：40px Neutral 轨道、6px 内距、64×28px Tab、12px/400、白色 `layoutId` motion 指示器，并提供 tablist/tab/tabpanel 语义与 reduced-motion；不再使用五个普通 Chip。发布、运行和定位查询分别呈现 loading/empty/error/retry。画布以局部 520/440/360px 配方稳定尺寸，缩放控件固定在画布内，详情栏在 1024/390 下自然下移；常规文字与操作保持 12px/400。机柜状态图例与画布共享同一组 palette，状态文字使用对应图形的描边色，图例标题和分隔符保持中性灰；不得复制另一套近似色。本页无新增图标。 | `spatial/rooms/[roomId]/page.tsx`、`SpatialRoomViewer.tsx`、`SpatialCanvasStage.tsx`、`SpatialViewerCanvas.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-spatial-rooms.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/spatial/rooms/:roomId` 选择详情与机柜视图 | 画布选中对象不再占用固定右栏，改为 360px 右侧母 Drawer，并复用紧凑 definition list 预览配方；“机柜视图”使用 shadcn/ui / Vaul `NestedRoot` 打开 680px 右侧子 Drawer。该入口作为特殊主操作允许使用由 Figma 状态变量组成的蓝/绿/橙/红动态渐变按钮，保持 12px/400、清晰焦点环和 reduced-motion；同组其他操作仍使用 Neutral secondary。机柜设备 hover 浮卡使用视口级 Portal，默认锚定整个机柜 SVG 右侧并跟随当前 U 位的纵向位置，右侧空间不足时自动翻到左侧，不得覆盖机柜主体。设备与浮卡之间提供 180ms 鼠标跨越缓冲，进入浮卡即取消关闭；“查看详情”必须是可聚焦、可点击的真实链接，不得使用只读提示伪装操作。子层遮罩关闭仅返回母层，母层关闭才清空选择；两层均保留 Vaul motion、拖拽与 reduced-motion。 | `SpatialRoomViewer.tsx`、`SpatialSelectionPanel.tsx`、`RackElevationView.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-spatial-rooms.test.cjs`、`figma-neutral-m8-leftover-hover-cards.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/spatial/rooms/:roomId/edit` | 编辑器入口和草稿查询分别呈现 hydration/permission/loading/empty/error/retry；桌面保留组件库、画布、属性栏三栏工作区，面板可独立滚动。1024 将 440px 画布置顶、组件库与属性栏下置双列；390 使用 360px 画布和下置单列面板，不再隐藏编辑能力。标题 13px/400，状态、控件与操作 12px/400。画布顶部中央固定显示真实机房名称，使用 12px/400 Neutral 胶囊标识；它位于 Konva 画布上层，不参与平移、缩放、编辑文档或导出。组件库保持两列但单项收敛为 32px 横向按钮：14px Figma 图标固定在左、文字在右并左对齐，不得使用 64px 纵向图文卡片。校验、保存、发布分别使用 Figma `check-circle`（`6:24261`）、`save`（`6:29154`）、`send`（`6:29273`）正式 SVG，glyph 固定 14px 且同轴对齐；参考图与区域透明度滑块使用 4px Neutral 轨道和 Figma `grip-horizontal`（`6:26901`）拖拽柄。保存、校验、发布及草稿写入合同保持不变。 | `spatial/rooms/[roomId]/edit/page.tsx`、`SpatialEditor.tsx`、`patterns.css`、`public/figma-icons/cmdb-spatial-*.svg`、`figma-neutral-m7-cmdb-spatial-rooms.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/spatial/rooms/:roomId/versions` | 移除内容区重复 Breadcrumb；Page Header 标题保持左对齐，“返回查看器”作为桌面右侧操作，520px 以下回到全宽响应式按钮。入口、布局查询与版本查询分别呈现 permission/loading/empty/error/retry。版本表使用 compact 密度、760px 可滚动最小宽度和真实“已发布”状态；390 使用版本/操作整行、发布时间/说明/对象数/校验码两列的紧凑卡片。恢复操作改为 32px 透明 `IconButton`，使用 Figma `archive_restore`（`6:23301`）正式 SVG，隐藏“操作”表头文案并收窄操作列；按钮以对象化 `aria-label` 命名，mouse hover 使用跟随指针、边界避让的白色胶囊 Tooltip。恢复 AlertDialog 进行中不可误关闭或重复提交，恢复协议保持不变。 | `spatial/rooms/[roomId]/versions/page.tsx`、`SpatialVersionHistory.tsx`、`patterns.css`、`public/figma-icons/cmdb-spatial-archive-restore.svg`、`figma-neutral-m7-cmdb-spatial-rooms.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/spatial/spike` | `PAGE-MIGRATION-MATRIX.md` 明确为内部 spike；页面只渲染 500 个合成 Canvas 节点并验证平移/缩放，无 API、RBAC、业务数据或写入合同，且无业务导航入口，因此排除生产 CMDB 逐页视觉验收。直链仍可在已登录 App Shell 中访问，保留/移除/门禁需要后续产品与安全决策。 | `spatial/spike/*`、`breadcrumb-config.ts`、`PAGE-MIGRATION-MATRIX.md`、空间定向测试 | EXCLUDED |
| 2026-08-17 | `/cmdb/changes` | 移除内容区重复 Breadcrumb；搜索、模型、日期、操作人、动作和页大小筛选全部具备可访问名称，日期倒置、权限、模型查询、主查询、真实空态和筛选无结果均有独立反馈。1440/1024/390 使用五/二/一列筛选重排；桌面为固定关键列的紧凑表格，390 为两列信息卡；分页、刷新提示和只读变更对比保持同一轻量页面配方。本页无新增图标。 | `cmdb/changes/page.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-changes.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/changes/stats` | Dashboard / Feedback 页面只保留 App Shell Breadcrumb；日期范围位于指标之前并使用 small Date Input 与明确语义；指标值 18px/500、标签与说明 12px/400。每日趋势使用原生 `progress` 和 table 语义，新增/删除仅以真实 success/danger 表达，修改保持 Neutral；Top 10 桌面表格、390 双列紧凑卡片。hydration、permission、日期倒置、query error/retry 及两个空态均可辨识；本页无新增图标。 | `cmdb/changes/stats/page.tsx`、`patterns.css`、`figma-neutral-m7-cmdb-changes-stats.test.cjs` | 用户已确认 |
| 2026-08-17 | `/cmdb/alerts` | Data Management 页面只保留 App Shell Breadcrumb；级别/状态筛选具备 small overlay、可访问名称及两列/单列响应式。真实空态与筛选无结果分离；桌面使用 920px 固定紧凑表格和局部滚动，390 使用双列告警卡；分页仅在多页显示，刷新与确认反馈保持原协议。severity/status 只使用真实 info/success/warning/danger，已确认状态保持 Neutral。空态使用 Figma 正式 `alert-circle` 节点 `6:22984` 的 22×22 原始资产；标题 13px/400、说明与正文 12px/400。 | `cmdb/alerts/page.tsx`、`patterns.css`、`figma-icons/cmdb-alert-circle.svg`、`figma-neutral-m7-cmdb-alerts.test.cjs` | 用户已确认 |

## 8. 快速核对清单

- [ ] 常规文字是否为 12px / 400，而不是大量粗体？
- [ ] Tabs 是否为 40px 灰轨道、6px 内距、28px 白色指示器，而非大白按钮？
- [ ] 所有 Select 是否 `size="sm"` 且 `overlay`？搜索文字是否同为 12px？
- [ ] Select 是否可通过选择、Escape 和外部点击收起？从一个 Select 切到另一个时是否只保留一个菜单？
- [ ] 菜单是否满足 `scrollWidth <= clientWidth`，没有由 `width: 100% + padding` 造成的横向滚动？
- [ ] 无可见 Field 标签的 Select 是否仍提供 `aria-label`？页面专用宽度是否只写在页面作用域内？
- [ ] 表头是否 34px、浅灰、12px / 500、1px 边线？行 hover 是否同款浅灰？
- [ ] 文字操作列是否统一左对齐？纯图标操作栏是否固定宽度、统一右对齐且不显示“操作”表头？
- [ ] 编辑是否为 Figma 笔图标、删除是否为 Figma 红色垃圾桶？启用与禁用按钮背景是否都透明？
- [ ] 禁用图标是否为明显更浅的 Neutral 400，并与可用编辑的 Neutral 600 肉眼可区分？
- [ ] 两个操作按钮是否保持同排、4px 间距，且不会被通用 `cwgsyw-inline-controls` 的 wrap / gap 覆盖？
- [ ] 所有图标操作是否有明确 `aria-label`，保存/取消是否不会撑宽操作栏？
- [ ] 卡片是否 4 列、无重阴影、hover 与表头同色、计数文字低强调？
- [ ] 模型目录分类是否只显示 Figma chevron 而无“展开 / 收起”文字？是否始终只展开一个分类并带平滑下拉动画？
- [ ] 模型目录的分类、模型、计数与按钮文字是否全部使用常规字重？分类编辑删除是否复用统一透明图标状态？
- [ ] 分类条目 hover 是否保持白底不变，而模型卡 hover 是否仍变为与表头一致的浅灰？
- [ ] 模型卡是否只显示 Figma more-horizontal 图标而无“操作”文字？菜单是否使用紧凑 MenuItem 配方且不影响其他 DropdownMenu？
- [ ] 模型区和实例浏览之间是否仅保留 40px 留白、没有多余横线？
- [ ] Drawer 是否走紧凑 definition list 配方，而非内容页卡片配方？
- [ ] 所有 Drawer 是否统一走 shadcn/Vaul；右侧平滑滑入、反向滑出并可向右拖拽关闭，且 reduced motion 下近乎无过渡？
- [ ] 所有全屏遮罩是否统一使用 6px 背景模糊和软化 scrim，并在不支持 `backdrop-filter` 时保持可读回退？
- [ ] 业务 Dialog 是否为白色内容面、small 控件、12px/400 字段与按钮，并将 Secondary 取消与 Primary 提交放在独立 footer？
- [ ] Dialog 候选列表是否使用轻边框 Neutral 选中态而非 `stack-list` 大框或黑底 Primary？关闭后是否清理动态状态？
- [ ] 这个页面的真实根节点是否接入 `cwgsyw-cmdb-page`？

## 9. 关联资料

- 视觉设计源入口：`docs/migration/figma-neutral-frontend/design-source/README.md`
- Figma-to-React 合同：`docs/migration/figma-neutral-frontend/design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`
- 全路由对照表：`docs/migration/figma-neutral-frontend/PAGE-COMPARISON-REGISTER.md`
- 当前交接与活树说明：`docs/migration/figma-neutral-frontend/HANDOFF.md`
