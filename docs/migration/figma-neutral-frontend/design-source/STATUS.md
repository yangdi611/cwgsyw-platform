# Figma Neutral Redesign 实施状态

> 本文是 `figma-neutral-frontend/design-source/` 下的 Figma 设计状态台账。

## 1. 当前状态

```yaml
runId: cwgsyw-figma-neutral-redesign-v1
fileKey: Z8EC6psFOj7KMfXapAFk24
status: P4_DELIVERED
currentPhase: P4
currentPointer: COMPLETE_FRONTEND_REFACTOR_NOT_STARTED
lastVerifiedAt: 2026-08-13 20:17 +0800
figmaMutationStarted: true
frontendMutationAllowed: false
```

## 2. 不可变边界

- Figma 是未来前端重构的唯一视觉、Token、组件 API 和布局设计源。
- 当前前端只提供功能和业务状态覆盖清单。
- 常规 UI 只使用 Neutral；Status 色只表达真实状态。
- 优先补全、调整和复用现有正式 Component，不创建同名重复资产。
- 任何组件必须通过 L0 / L1 / L2 / L3 才能标记 `VERIFIED`。

## 3. Phase 状态

| Phase | 状态 | 当前结论 | 退出证据 |
|---|---|---|---|
| P0 Foundations | VERIFIED | P0.a-P0.m 完成；Neutral/Status 边界、正式资产绑定、Integration Lab、Light/Dark 与 1440/1024/390 闭环均通过 | 6 个验证区、258 个链接实例、560 个文本节点；L0 审计全零缺口；最终截图 |
| P1 Core Components | VERIFIED | P1.a-P1.f 全部完成；高频基础组件、Light/Dark 与 1440/1024/390 组合闭环通过 | 18 个 P1.f 审计根、394 个节点；L0 全零缺口；6 张最终截图 |
| P2 Data & Feedback | VERIFIED | P2.a-P2.e 全部完成；Card、Table、Pagination、Supporting States 与 Alert / Toast / Progress 均通过组合闭环 | P2.a-P2.e L0–L3 PASS；Light/Dark 与 1440/1024/390 PASS |
| P3 Overlay & Complex Input | VERIFIED | P3.a-P3.d 全部 VERIFIED；Overlay、复杂输入与 Command Palette 闭环完成 | P3.a-P3.d L0–L3 PASS；Light/Dark 与 1440/1024/390 PASS |
| P4 Patterns, Final QA & Contract | VERIFIED | P4.a-P4.e 全部 VERIFIED；Global QA、Final QA、正式资产 Manifest、Implementation Contract 和未来 React 执行 Prompt 完成 | 90 个全局审计根；61 个正式公开 Component / Pattern 根；176 个正式 Variables；六组 Gallery PASS；Manifest、合同与 Prompt 覆盖审计 PASS |

## 4. 实时 Figma 交付基线

| 项目 | 当前证据 |
|---|---|
| 页面 | 26 |
| 组件相关页面 | 11 |
| 本地变量 | 201 |
| 正式集合 | 9 个 `CWGSYW / ...` |
| 正式变量 | 176，全部允许进入 Token 白名单 |
| Legacy 变量 | `Collection 1` 25 个，禁止导出和消费 |
| 正式公开 Component / Pattern 根 | 61 |
| Text Styles | 10 |
| Effect Styles | 5 |
| 正式 WEB Code Syntax | 176/176 合法；缺失 0；非法格式 0；同集合重复 0 |
| Legacy Code Syntax | 不属于导出合同，不得让 React 消费 |

实时 Figma 事实优先；`FORMAL-ASSET-API-MANIFEST.md` 以 Node ID + 完整名称 + API 指纹确定正式 allowlist。Node ID 只用于设计追溯和构建期校验，不得成为 React 运行时依赖。

## 5. 组件状态台账

| Phase | 组件族 | 状态 | L0 | L1 | L2 | L3 | Node ID / 备注 |
|---|---|---|---|---|---|---|---|
| P1 | Icon / Spinner / Separator | VERIFIED | PASS | PASS | PASS | PASS | Icon `573:54` 等；Spinner `575:5038`；Separator `391:145` |
| P1 | Button / Icon Button | VERIFIED | PASS | PASS | PASS | PASS | Button `606:19247`；Icon Button `610:19314`；两个 Base Set 各 30 个变体，含 5 类 `State=Focused`；Legacy `6:21409` 保留 |
| P1 | Input / Textarea | VERIFIED | PASS | PASS | PASS | PASS | Input `625:105`；Textarea `626:182`；Legacy `85:18396` / `255:73` 保留 |
| P1 | Select / Combobox / Search / Date Input | VERIFIED | PASS | PASS | PASS | PASS | Select `641:141`；Combobox `642:253`；Search `642:21431`；Date `642:21507`；Legacy 保留 |
| P1 | Field / Checkbox / Radio / Switch | VERIFIED | PASS | PASS | PASS | PASS | Field `665:432`；Checkbox `661:21997`；Radio `663:471`；Switch `663:542`；Legacy 保留 |
| P1 | Tabs / Badge / Chip / Avatar | VERIFIED | PASS | PASS | PASS | PASS | Tabs `114:2`；Tabs/List `677:63`；Badge `682:23779`；Chip `682:23930`；Avatar `682:24092`；Status Badge `121:2` |
| P2 | Card / Metric Card | VERIFIED | PASS | PASS | PASS | PASS | Card `704:363`；Metric Card `713:25370`；Trend Direction `713:25363`；Wide `713:25545`；Compact `714:407` |
| P2 | Table family | VERIFIED | PASS | PASS | PASS | PASS | Header Cell `730:166`；Cell `731:142`；Row `731:204`；Toolbar `731:26400`；Table `736:27003`；Wide `739:340`；Compact `739:770`；Legacy `144:2` 保留 |
| P2 | Pagination | VERIFIED | PASS | PASS | PASS | PASS | Page Item `779:305`；Pagination `791:365`；Wide `796:338`；Compact `796:777`；Legacy `260:51` 保留 |
| P2 | Empty / Loading / Error / Skeleton | VERIFIED | PASS | PASS | PASS | PASS | Skeleton `127:2`；Empty `814:976`；Error `815:13899`；Loading `816:1006`；Wide `827:55`；Compact `827:56` |
| P2 | Alert / Toast / Progress | VERIFIED | PASS | PASS | PASS | PASS | Alert `856:16960`；Toast `859:193`；Progress `860:141`；Wide `873:1708`；Compact `873:1709` |
| P3 | Menu / Dropdown | VERIFIED | PASS | PASS | PASS | PASS | Menu Item `900:32915`；Dropdown Menu `903:33021`；Wide `907:541`；Compact `907:33141`；Legacy `260:66` 保留 |
| P3 | Tooltip / Popover | VERIFIED | PASS | PASS | PASS | PASS | Tooltip `898:541`；Popover `898:528` |
| P3 | Dialog / AlertDialog / Drawer | VERIFIED | PASS | PASS | PASS | PASS | Dialog `894:1433`；AlertDialog `897:394`；Drawer `898:507`；Legacy `324:54` / `329:65` 保留 |
| P3 | Calendar / Date Picker | VERIFIED | PASS | PASS | PASS | PASS | Day `914:730`；Calendar `914:34402`；Date Picker `915:34881`；Range `915:34882`；Wide `915:35099`；Compact `915:35525` |
| P3 | Command Palette | VERIFIED | PASS | PASS | PASS | PASS | Item `925:1792`；Group `928:1777`；Palette `929:1990`；Wide `930:1977`；Compact `930:2059` |
| P4 | Breadcrumb / Page Header / Detail Header | VERIFIED | PASS | PASS | PASS | PASS | Breadcrumb `943:2063`；Page Header `947:2116`；Detail Header `947:22448`；Wide `949:2160`；Compact `949:2225` |
| P4 | Toolbar / Workspace Toolbar / Filter Bar | VERIFIED | PASS | PASS | PASS | PASS | Toolbar `959:38114`；Workspace Toolbar `959:38142`；Filter Bar `959:38267`；Wide `962:39341`；Compact `962:39342`；Legacy `255:83` 保留 |
| P4 | Representative Page Patterns | VERIFIED | PASS | PASS | PASS | PASS | Form `979:3728`；Data `980:4171`；Detail `981:4870`；Dashboard `981:41152`；Overlay `982:5760`；资产区 `978:3416` |

### 2026-08-13 20:17 +0800 · P4.i-P4.m FINAL COMPLETION AUDIT VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改两个正式 Compact Header Actions 槽、正式资产 Manifest、本文档和 `/tmp` 精确恢复账本，不修改 React、当前前端、配置、依赖、Git、Linear、Notion 或部署状态。
- P4.i 权威矩阵：PASS。以目标 Prompt、`FORMAL-ASSET-API-MANIFEST.md`、Implementation Contract、执行 Prompt 和状态台账建立显式门禁，覆盖 61 个正式根、9 个 Nested Base、176 个正式 Variables、10 个 Text Styles、5 个 Effect Styles、五类 Pattern、十个 Default / Compact 变体及六个 Gallery。
- P4.j 实时设计源：PASS。61/61 精确 Node ID、完整名称和节点类型无 drift；9/9 Nested Base 存在。正式资产共扫描 4,537 个唯一节点、1,312 个可见 Text、1,422 个 Instance；固定文字框风险 0、断链 0。3,142 个 Solid Paint 的硬编码、Remote、Legacy、Primitive 直绑和未解析绑定全部为 0。201 个本地 Variables 中正式集合 9、正式变量 176、Legacy 25；正式 WEB Code Syntax 缺失、非法、同集合重复均为 0。
- Manifest 校正：将 Table Toolbar、Empty / Error、Alert / Toast、Menu Item、Popover、Dialog、AlertDialog、Drawer、Command Palette、Select / Combobox Base 和 Chip Base 的 API 简称展开为实时 `TEXT` / `BOOLEAN` / `INSTANCE_SWAP` / `SLOT` 与固定子节点合同。分类为 `STALE_MANIFEST`，Figma API、节点和视觉均未改变。
- 缺陷复核：此前 `POST-P4 COMPACT HEADER AND COMPONENT-SET ALIGNMENT` 把 Compact Status / Actions 改为统一左边界，但 Status 槽宽 96px、Actions 槽宽 48px，导致内容视觉中心相差 24px。实时绝对包围盒证明 Default 两组中心已正确，Compact 两组仍为真实错位。
- 实际修正：Page Header Compact Actions `946:2102` 从 `x=0` 恢复为 `x=24`；Detail Header Compact Actions `947:22467` 从 `x=0` 恢复为 `x=24`。创建 0、删除 0；宽高、y、Button 实例、文字、Variables、Styles、Dimensions、Variant、Component Properties 和公共 API 均未改变。Detail Header Compact 变体 `947:22459` 继续保持 `x=1240`，不恢复旧的重叠排布。
- 中心线回读：Page Header Default / Compact 与 Detail Header Default / Compact 的 Status / Actions 绝对中心差均为 `0`；四组 PASS。Page Header `947:2116` 与 Detail Header `947:22448` 2x 截图通过。
- P4.k / P4.l：PASS。Form `979:3356` / `979:3584`、Data `980:3189` / `980:3929`、Detail `981:4153` / `981:4586`、Dashboard `981:40436` / `981:40881`、Overlay `982:5247` / `982:5524` 十个正式变体全部重渲染通过；文字、Button、文字框、Tabs、Table、Dialog / Drawer footer 无裁切、重叠或错位。
- L3 最终证据：六个 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 在 Light / Dark x 1440 / 1024 / 390 全部通过。最终机器回归覆盖 4,504 个唯一节点、1,242 个可见 Text、1,648 个 Instance、3,102 个 Solid Paint；文字风险、断链、硬编码、Remote、Legacy、Primitive 直绑和未解析绑定均为 0。
- 颜色语义：常规 UI、Primary、Selected、Focus、背景、文本、边框、图标与 Overlay 保持 Neutral；Info / Success / Warning / Danger 只出现在真实状态，Destructive 只在危险操作使用 Danger；桌面 Table 标题保持 Neutral 灰底与浅灰文字，390 使用原生列表/卡片而非压缩桌面 Table。
- P4.m 完成判定：PASS。每项目标均有实时直接证据；Figma 可作为未来 React 重构的唯一设计源。React 重构仍是独立流程，当前未授权开始。
- 回滚边界：只按 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `p4FinalCompletionAudit.rollback` 将 `946:2102.x` 和 `947:22467.x` 恢复为 `0`；这会重新引入已记录的 24px 中心线错位，仅用于精确技术回滚。禁止 Desktop Undo、名称前缀清理、删除、缩放或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（锁定范围和行为未变）；ADR `Not applicable`（Neutral / Status、Token 与 API 架构未变）；API 文档 `Update`（Manifest 已按实时 Figma 精确校正）；数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（最终设计与文档 drift 已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。

### 2026-08-13 · POST-P4 COMPACT HEADER AND COMPONENT-SET ALIGNMENT PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改正式 Compact Header 的 Actions 坐标、Detail Header Component Set 的变体展示坐标、本文档和 `/tmp` 精确恢复账本，不修改 React、当前前端、颜色、Variables、Styles、配置、依赖、Git、Linear、Notion 或部署状态。
- 缺陷定位：61 个正式根的源级几何审计确认 Button、Input、Textarea、Select、Combobox、Search / Date Input、Field 与 Table Header 的文字裁切和直接 Auto Layout 中心偏差均为 0。真实问题有两项：Page Header / Detail Header Compact 的 Actions 槽相对标题左边界偏移 24px；Detail Header Component Set 的 Default 变体宽 1180px，而 Compact 变体位于 `x=820`，在组件源画布横向重叠 360px。
- 实际修正：Page Header Compact Actions `946:2102` 从 `x=24` 改为 `x=0`；Detail Header Compact Actions `947:22467` 从 `x=24` 改为 `x=0`；Detail Header Compact 变体 `947:22459` 从 `x=820` 移至 `x=1240`；Component Set `947:22448` 保持 `1626 x 292`，仅因变体重新排布列入修改节点。创建 0、删除 0。
- 规则覆盖：本条只覆盖下方旧 `POST-P4 HEADER STATUS / ACTION CENTERLINE CORRECTION` 中 Compact Actions 的 `x=24` 决定；桌面 Default 的 Status / Actions 中心线规则保持不变。Compact 以页面内容左边界为准，不再以两个不同宽度 Slot 的视觉中心为准。
- L0：PASS。61/61 正式根存在；56 个正式 Component Set、1329 对变体重叠 0；受影响 Header / Pattern / Gallery 根断裂 Instance 0、零几何可见 Text 0。
- L1：PASS。Page Header `947:2116` 与 Detail Header `947:22448` 原尺寸截图通过；Default / Compact 变体不再叠放，Compact Status、Actions、标题与说明使用统一左边界。
- L2：PASS。Form `979:3728`、Data `980:4171`、Detail `981:4870`、Dashboard `981:41152`、Overlay `982:5760` 的 Default / Compact 截图通过；Button、Input、Textarea、Table、Dialog / Drawer footer 无新增错位、裁切或重叠。
- L3：PASS。六个正式 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 的 Light / Dark x 1440 / 1024 / 390 全部重新渲染；390 高分辨率回读无新增挤压或响应式回归。
- 回滚边界：只按 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `p4PostQaCompactHeaderAndSetAlignment.rollback`，先恢复 `947:22459.x=820`，再恢复 `946:2102.x=24`、`947:22467.x=24`；`947:22448` 尺寸本轮前后相同。禁止 Desktop Undo、名称前缀清理、删除、缩放或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（公共 API、行为和设计范围不变）；ADR `Not applicable`（Neutral / Status 与 Dimensions 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（本轮错位已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 · POST-P4 HEADER STATUS / ACTION CENTERLINE CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改正式 Page Header / Detail Header 的 Actions 槽坐标、本文档和 `/tmp` 精确恢复账本，不修改 React、当前前端视觉、配置、依赖、Git、Linear、Notion 或部署状态。
- 缺陷定位：Button、Input、Textarea、Select、Combobox、Search Input、Date Input、Field 与 Table Row 的高倍率源截图均无内部文字、图标或输入框错位。真实共享缺陷位于 Page Header / Detail Header：Status 槽宽 96px，Actions 槽宽 48px，但两者此前共用相同左边界，视觉中心相差 24px。
- 实际修正：Page Header Default Actions `945:2097` 从 `x=820` 改为 `x=844`，Compact Actions `946:2102` 从 `x=0` 改为 `x=24`；Detail Header Default Actions `947:22457` 从 `x=820` 改为 `x=844`，Compact Actions `947:22467` 从 `x=0` 改为 `x=24`。四个 Actions 槽的宽高、y、文字、Button 实例、Variable、Dimensions 绑定、Variant 与 Component Properties 均未改变。
- 中心回读：Page Header Default / Compact 与 Detail Header Default / Compact 的 Status / Actions 中心分别为 `868/868`、`48/48`、`868/868`、`48/48`，四组全部 PASS。
- L0：PASS。Page Header、Detail Header 和五组正式 Pattern 的 12 个审计根共 440 个可见 Text，裁切 0；567 个 Instance，断链 0。
- L1：PASS。Page Header `947:2116`、Detail Header `947:22448`、Wide `949:2160`、Compact `949:2225` 高分辨率截图通过；状态与操作列同轴，未改变标题、Metadata、Tabs 或响应式结构。
- L2：PASS。Form、Data、Detail、Dashboard、Overlay 的 Default / Compact 十个正式 Pattern 截图通过；Header Button 与状态文字对齐，输入框、Textarea、Table、Dialog / Drawer footer 无新增错位、裁切或重叠。
- L3：PASS。六个正式 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 在 Light / Dark × 1440 / 1024 / 390 下重新渲染通过。
- 回滚边界：只按 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `p4PostQaHeaderStatusActionCenterlineCorrection.rollback` 恢复四个精确节点的原 `x`；禁止 Desktop Undo、名称前缀清理、删除、缩放或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（公共 API、行为和设计范围不变）；ADR `Not applicable`（Neutral / Status 与 Dimensions 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（共享 Header 错位已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 · POST-P4 DIMENSIONS BINDING COMPLETION AND ALIGNMENT REGRESSION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改正式 Figma Component / Pattern 的 Dimensions 绑定、本文档和 `/tmp` 精确恢复账本，不修改 React、当前前端视觉、配置、依赖、Git、Linear、Notion 或部署状态。
- 审计口径：以 Manifest 的 61 个正式根为唯一范围；只遍历源节点，不递归 Instance 内部，不把 Component Set 画布排布计入组件几何。Space / Radius / Border Width 只统计非零且精确命中对应 `CWGSYW / Dimensions` 类别的属性；`0` padding / radius 是结构默认值，不作为缺失。
- Dimensions 收敛：此前四批已完成 796 次属性绑定；本轮补齐 44 个 `itemSpacing`、29 个标准控件 `height`，并对 146 个明确 Icon Instance 同时绑定 `width` / `height`，共新增或迁移 365 次属性绑定。所有数值保持不变；未创建或删除节点。
- 最终覆盖：Space / Radius / Border Width `1479/1479 = 100%`；标准 Control Height `29/29 = 100%`；明确 Icon Size `146/146 = 100%`。61/61 正式根存在，缺失绑定 0。
- 标准 Control Height 范围：Button、Icon Button、Input、Select、Combobox、Search Input、Date Input 的 Sm / Md / Lg，以及 Tabs 的 8 个 Sm 源变体。Switch 的 36px 是含 Label 的行高，Avatar 的 32px 是头像尺寸，Textarea、Table、Skeleton、Pagination 等高度属于各自组件几何或专用合同，不伪装为标准 Control Height。
- 固定几何例外：Badge Sm 与 Status Badge Md 的 6px 水平内边距共 20 项；Checkbox Indeterminate Dash 的 1px 圆角 5 项；Radio Marker 的 10px 圆角 10 项。共 35 项，均没有对应的批准 Token，且属于像素网格或组件专用几何；不新建全局变量。
- L0：PASS。61/61 正式根；Spacing / Radius / Stroke 缺失 0；Control Height 缺失 0；Icon Size 缺失 0；断裂 Instance 0。
- L1：PASS。Button `606:19247`、Input `625:105`、Tabs `114:2`、Table Header `730:166`、Dialog `894:1433`、Drawer `898:507` 高分辨率截图通过；文字、Button、文字框、Chevron 和 Close Icon 无错位或裁切。
- L2：PASS。420 个可见 Text 裁切 0；Horizontal Auto Layout 交叉轴中心偏差 0；绑定前后组件尺寸、文本内容、颜色、Variant、Component Properties 和 API 均未改变。
- L3：PASS。六个正式 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 均成功渲染；Light / Dark x 1440 / 1024 / 390 无新增错位、重叠、裁切或响应式回归。
- 回滚边界：只按 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `p4PostQaDimensionsBindingCompletion` 恢复精确字段绑定；禁止 Desktop Undo、名称前缀清理、删除、缩放或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（视觉数值、公共 API 和行为不变）；ADR `Not applicable`（Neutral / Status 与 Dimensions 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（Dimensions 门禁和错位回归已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 · P4.h COMPONENT SOURCE BOARD AND PREVIEW MODE ALIGNMENT PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改 Figma 的 Button / Input / Tabs 组件页、本文档和 `/tmp` 精确状态账本，不修改 React、配置、依赖、Git、Linear、Notion、部署或当前前端视觉。
- 时间说明：本机当前时间为 `19:13 +0800`，早于顶层已有的 `19:20 +0800`；因此不倒退 `lastVerifiedAt`，本条只按日期记录。
- 缺陷分类：Button、Input、Tabs 正式组件根的文字基线、Button 内容区和输入框内边距均无可复现错位；真实问题位于组件文档页右侧的顶层源资产区。资产此前散落在透明画布上，缺少统一边界和标题；Input Base `624:20498` 还因没有预览上下文而把部分 `bg/surface` 解析成 Dark，导致白色文档页右侧出现黑块和近黑文字。
- 实际修正：新增 Neutral Light 预览底板 `1119:7741`（Button）、`1120:7333`（Input）、`1121:7242`（Tabs）及标题 `1119:7742`、`1120:7334`、`1121:7243`。15 个既有源资产只改父级与底板内坐标；底板显式使用 `CWGSYW / Color` 的 Light 模式 `350:1`，组件源自身没有写入 Color 模式，因此未来实例仍可继承 Light / Dark。
- 组件合同保持：61 个正式公开 Component / Pattern 根、Nested Base Node ID、Variant 轴、Component Properties、尺寸、内部 Auto Layout、Text Styles、Variables、绑定和 API 均未改变。Input Base 12 个状态重新截图后全部清楚可读；Button、Input、Select、Combobox、Tabs 与 Tabs/List 精确截图保持原尺寸和对齐。
- L0：PASS。61/61 正式根存在；扫描 2,504 个正式根与三块资产底板节点；断裂实例 0、可见文字裁切 0、硬编码颜色 0、Primitive 直绑颜色 0。三个底板均绑定正式 `bg/surface` / `border/subtle` / `text/primary`，Color 模式均为 Light `350:1`。
- L1：PASS。Button、Input、Tabs 三张组件页不再出现无边界散落资产；Input Base 的 Default / Hover / Focused / Error / Disabled / Loading x Placeholder / Value 预览不再出现黑块，文字、边框和状态层级完整。
- L2：PASS。Button / Icon Button、Input / Select / Combobox / Search / Date Input、Tabs / Tabs List 组件族精确截图无裁切、基线漂移或尺寸变化。
- L3：PASS。六个正式 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 的 Light / Dark x 1440 / 1024 / 390 最终截图通过，无新增文字断行、按钮偏移、输入框错位或响应式回归。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 5/5；Typography 5/5；协调 5/5；平衡 5/5；响应 5/5；A11y 4/5。
- 回滚边界：严格按 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `p4hComponentSourceBoardAndPreviewModeAlignment.rollback`，先将 15 个资产恢复到原 Page 与原坐标，再删除 3 个精确底板和 3 个精确标题；禁止 Desktop Undo、名称前缀清理、批量删除或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（公共 API 和设计范围不变）；ADR `Not applicable`（Neutral / Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（本轮资产区与预览模式缺陷已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 · POST-P4 COMPONENT CANVAS ALIGNMENT CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改 Figma 顶层资产坐标、本状态台账和 `/tmp` 精确恢复账本，不修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 时间说明：本机时钟在本轮返回 `19:07 +0800`，早于已有的 `19:20 +0800` 记录；因此不倒退顶层 `lastVerifiedAt`，本条只按日期记录。
- 真实缺陷：正式 Button / Input 等源组件内部没有新的文字基线或控件中心偏差；实际错位来自组件文档画布的顶层叠层。修复前 Design System 1 处、Icons 2 处、Form & Filter 24 处、Actions & Feedback 2 处，资产覆盖说明区或彼此覆盖，造成文字、Button 和文字框看起来错位。
- 实际修正：只重新排布 33 个精确顶层节点。Form & Filter 的 Textarea、Form controls、Verification 与 Legacy 资产按真实宽高分列并保留 120px 纵向间距；旧 Table 说明区和示例整体下移；X / User 辅助图标移出 Lucide 参考 Frame；Spinner 与 Tabs/Badge/Chip/Avatar Verification 移入独立空白资产区。未删除、重建、缩放或修改任何组件内部节点。
- L0：PASS。10 个组件相关页面顶层几何复扫全部为 0 叠层；15 个重点正式根、119 个可见文字，裁切 0、Auto Layout 交叉轴中心偏差 0、断链实例 0。61/61 正式根源级审计仍存在，1,312 个 Text 中真实裁切、控件中心偏差和固定文字框冲突均为 0。
- L1：PASS。Button、Input、Textarea、Select、Combobox、Search Input、Date Input、Field、Checkbox、Radio、Switch、Tabs、Tabs/List、Page Item 和 Pagination 高分辨率截图通过；Textarea 顶对齐仍为多行输入合同，Tabs 与 Pagination 基线保持一致。
- L2：PASS。Form & Filter `251:51` 与 Actions & Feedback `258:51` 全画布截图显示资产分区清晰，无源组件覆盖文档、按钮覆盖文字或输入框互相叠层。
- L3：PASS。六个正式 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 重新截图；Light / Dark × 1440 / 1024 / 390 无新增裁切、重叠或错位。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 5/5；Typography 5/5；协调 5/5；平衡 5/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：只按 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `p4PostQaComponentCanvasAlignmentCorrection.rollback` 恢复 33 个精确节点原 `x/y`；禁止 Desktop Undo、名称前缀清理、删除或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（公共 API 与设计行为未改变）；ADR `Not applicable`（Neutral / Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（当前画布错位已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 · P4.g TABS TEXT BASELINE AND OVERRIDE RENDER CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改 Figma Tabs 源组件、本状态台账和 `/tmp` 精确恢复账本，不修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 时间说明：本机时钟在本轮返回 `18:40 +0800`，早于已有的 `19:20 +0800` 记录；因此不倒退顶层 `lastVerifiedAt`，本条只按日期记录。
- 真实缺陷：Tabs `114:2` 的 Underline Default / Hover / Disabled 状态文字位于 32px / 40px 控件顶部，而 Selected 状态还被 2px 指示条挤压；Segmented 状态混用父级居中和手工撑高。不同状态切换时存在 1-10px 基线跳动，属于结构错位，不是颜色或透明背景问题。
- 源层修正：16 个 Tabs 变体的 `Label Row` 统一占满控件高度，Sm 文本基线统一为 `y=8`，Md 统一为 `y=10`；Underline Selected 的指示条 `108:12` / `113:19` 改为底部绝对定位，保持 2px 高且不再参与文字布局。Tabs 尺寸、文字样式、颜色变量、Variant 轴、Component Properties、Node ID 和公共 API 均未改变。
- Override 渲染闭环：源层几何更新后，Tabs/List `677:63` 的三个嵌套实例一度只渲染 Label 尾字。对 `683:23692`、`683:23709`、`683:23725` 往返刷新原 `Label` Property 后，截图恢复完整“概览 / 活动 / 设置”；虚拟属性和截图事实重新一致。
- L0：PASS。61/61 正式根存在；扫描 4,537 个正式根节点；9 个正式集合、176 个正式 Variables；断裂实例 0、缺 Text Style 0、可见文字裁切 0、硬编码颜色 0、远程颜色 0、Primitive 直绑颜色 0。Textarea 顶对齐和 Figma Line 的 0 高几何为合同内预期项。
- L1：PASS。Tabs `114:2` 的 16 个状态截图可读；Sm / Md 各状态基线完全一致，Selected 指示条稳定在底部。Button、Input、Select、Combobox、Search / Date Input、Table Header、Dialog、AlertDialog、Drawer 的高分辨率截图无新增错位。
- L2：PASS。Tabs/List `677:63` 与 Detail Pattern `981:4870` 的两档布局完整显示“概览 / 活动 / 设置”，状态切换不再跳动，其他组件尺寸与节奏未变化。
- L3：PASS。六个正式 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 的 Light / Dark x 1440 / 1024 / 390 最终截图通过；有效展开扫描覆盖 1,254 个可见文字和 2,390 个控件容器候选，裁切 0、单行垂直偏移 0、异常小控件 0。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 5/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：只按 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `p4gTabsTextBaselineAndOverrideRenderCorrection.rollback` 恢复 16 个精确 `Label Row` 高度、两个 Selected 指示条布局和必要的实例 Property；禁止 Desktop Undo、名称前缀清理、删除或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（公共 API 和设计范围不变）；ADR `Not applicable`（Neutral / Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（当前错位已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 · P4.f FORMAL NAME RECONCILIATION AND CONTROL ALIGNMENT RECHECK

- READY 状态：`READY WITH APPROVED EXCEPTION`。继续使用用户已授权的无任务号 Figma 例外；本轮只修改 Figma 文件、本状态台账和 `/tmp` 精确恢复账本，不修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 时间说明：本机时钟在本轮返回 `18:35 +0800`，早于上一条已记录的 `19:20 +0800`；因此不覆盖顶层 `lastVerifiedAt`，本条只按日期记录，避免制造倒排或虚假的更晚时间。
- 正式名称冲突修正：只重命名 4 个非 Manifest 历史资产。`260:75` `CWGSYW/Component/Tooltip` -> `Legacy/CWGSYW/Component/Tooltip`；`261:113` `CWGSYW/Component/Progress` -> `Legacy/CWGSYW/Component/Progress`；`882:1860` `CWGSYW/Component/Alert` -> `Legacy/CWGSYW/Component/Alert/4 Variants`；`887:32325` `CWGSYW/Component/Toast` -> `Legacy/CWGSYW/Component/Toast/5 Variants`。未删除、迁移或重建节点。
- 消费者保持：历史 Tooltip `260:75` 的直接实例 `296:100`、历史 Progress `261:113` 的直接实例 `296:18772` 保持链接；历史 Alert / Toast 直接消费者仍为 0。正式 Alert `856:16960`、Toast `859:193`、Progress `860:141`、Tooltip `898:541` 的 ID、Variant 数量、API 与视觉未改变。
- 唯一性回读：正式 Design System 页内 `CWGSYW/Component/Alert`、`Toast`、`Progress`、`Tooltip` 各精确匹配 1 个；61/61 Manifest 根按精确 Node ID 存在。非 Manifest 历史资产不再占用正式全名。
- 文字 / Button / 文字框复核：Button `606:19247`、Input `625:105`、Textarea `626:182`、Select `641:141`、Combobox `642:253`、Search Input `642:21431`、Date Input `642:21507`、Tabs/List `677:63` 的高分辨率截图 PASS。Input 系列三档文字无裁切且垂直居中；Textarea 按多行输入语义顶对齐；Button Lg 的半像素位置是 73px 奇数宽控件内 32px 标签的数学中心，截图完整，不属于错位。
- 六组 Gallery：Light `988:26261` / `991:27537` / `991:43491`，Dark `991:44294` / `991:46510` / `992:6664` 均保持 5 个正式 Pattern；可见文字裁切 0、控件文字中心偏差 0、根级越界 0、断链实例 0。Light / Dark x 1440 / 1024 / 390 长图 PASS。
- 文档页编排：Button `6:20310`、Input `78:2`、Tabs `101:2` 完整画布复核无源资产覆盖文档区、文字覆盖或控件互相重叠。本轮没有无依据调整尺寸、padding、Text Style 或 Auto Layout。
- 回滚边界：仅恢复 4 个精确节点原名：`260:75` -> `CWGSYW/Component/Tooltip`、`261:113` -> `CWGSYW/Component/Progress`、`882:1860` -> `CWGSYW/Component/Alert`、`887:32325` -> `CWGSYW/Component/Toast`。禁止 Desktop Undo、名称前缀批量清理、删除或重建组件。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（正式 API 和设计行为未改变）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（正式命名冲突与可见对齐复核均已关闭）。
- 新 `currentPointer`：`COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 19:20 +0800 · POST-P4 SEARCH / DATE INPUT RENDER ALIGNMENT CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。本轮继续使用用户已授权的无任务号 Figma 例外；仅修改 Figma 文件、本文档和 `/tmp` 状态账本，不修改 React、配置、依赖、Git 或外部任务状态。
- 可见缺陷：Search Input `642:21431` 的 Lg 截图只渲染占位文案尾字“态”且出现在输入框中部；Date Input `642:21507` 的 Lg 截图只显示“选择”。节点结构回读仍声称字符串完整，证明是嵌套 Input 实例的内容覆盖/渲染失配，不能以虚拟属性替代截图事实。
- 实际修正：对 Search Input 的 `642:21355`、`642:21385`、`642:21408` 和 Date Input 的 `642:21432`、`642:21457`、`642:21482` 先切换 `Content=Value`，再恢复 `Content=Placeholder` 并重写正式 Placeholder。未改 Size、State、Component Property 名称、变量、Text Style、颜色、Auto Layout 或公共 API。
- L0：PASS。61/61 正式根存在；1,608 个可见文本；断裂实例 0、缺 Text Style 0、硬编码颜色 0、远程颜色 0、Primitive 直绑颜色 0。六个修复实例仍为 240x32、280x36、320x44，`Content=Placeholder`；Search Placeholder 为“搜索名称、类型或状态”，Date Placeholder 为“选择日期”。
- L1：PASS。Search Input 和 Date Input 的 Sm / Md / Lg 精确截图均完整左对齐、垂直居中；Date Picker `915:34881` 与 Date Range Picker `915:34882` 无回归。
- L2：PASS。输入族 Wide `646:244` / Compact `646:21501`、日期 Wide `915:35099` / Compact `915:35525`、Menu Wide `907:541` / Compact `907:33141`、Command Palette `929:1990` 与 Filter Bar `959:38267` 均完整显示，间距和密度未变化。
- L3：PASS。六个正式 Gallery `988:26261`、`991:27537`、`991:43491`、`991:44294`、`991:46510`、`992:6664` 复验通过；展开检查共 1,254 个可见文本和 1,680 个小型控件候选，裁切 0、单行垂直偏移 0、异常小按钮 0。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 5/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：仅六个嵌套实例 `642:21355`、`642:21385`、`642:21408`、`642:21432`、`642:21457`、`642:21482`；若必须回滚，只能按这些精确 ID 重设此前已记录的相同属性，不使用 Desktop Undo、名称前缀清理或组件重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（不改变已锁定范围或 API）；ADR `Not applicable`（Neutral/Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与现有前端继续隔离）；Follow-up documentation `Not applicable`（缺陷已在本状态台账闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。

## 6. Integration Lab 状态

| 场景 | 状态 | Node ID | 最近受影响组件 | 视觉结果 |
|---|---|---|---|---|
| Form / Settings | VERIFIED | Pattern `979:3728`；Lab 实例 `988:26262` / `991:27538` / `991:43492` / `991:44295` / `991:46511` / `992:6665` | Header、Field、Checkbox、Radio、Switch、Button | Light/Dark 1440/1024/390 PASS；Dark 输入区继承修正已验证 |
| Data / Management | VERIFIED | Pattern `980:4171`；Lab 实例 `988:26398` / `991:27674` / `991:43589` / `991:44431` / `991:46647` / `992:6762` | Header、Toolbar、Filter Bar、Table、Compact List、Pagination | Light/Dark 1440/1024/390 PASS；桌面表头为 Neutral 灰底；390 使用原生列表卡片 |
| Detail / Drawer | VERIFIED | Pattern `981:4870`；Lab 实例 `988:26685` / `991:27961` / `991:43752` / `991:44718` / `991:46934` / `992:6925` | Detail Header、Tabs、Toolbar、Metric Card、Card、Drawer | Light/Dark 1440/1024/390 PASS |
| Dashboard / Feedback | VERIFIED | Pattern `981:41152`；Lab 实例 `988:26918` / `991:28194` / `991:43930` / `991:44951` / `991:47167` / `992:7103` | Header、Metric Card、Card、Alert、Toast、Progress、Empty | Light/Dark 1440/1024/390 PASS；Status 色仅用于真实反馈状态 |
| Overlay / Destructive | VERIFIED | Pattern `982:5760`；Lab 实例 `988:27146` / `991:28422` / `991:44095` / `991:45179` / `991:47395` / `992:7268` | Menu、Dropdown、Dialog、AlertDialog、Drawer、Popover、Tooltip | Light/Dark 1440/1024/390 PASS；Danger 仅用于破坏性操作 |

## 7. 变更记录模板

### 2026-08-13 19:06 +0800 · COMPONENT DOCUMENTATION OVERLAP CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。本轮只修改 Figma 组件文档页中的顶层资产位置与本状态账本；未修改 React、当前前端、配置、依赖、Git、Linear、Notion 或部署状态。
- 发现问题：正式 Button、Input、Select、Combobox、Tabs 及 Overlay 源组件的精确截图均未发现文字裁切或单行控件垂直偏移；但 Input、Select、Tabs 三个组件文档页把顶层源资产放在文档展示 Frame 上方，造成文字、Button 和文字框看起来错位或叠层。修复前顶层几何重叠共 4 处。
- 实际修正：只移动 10 个顶层源资产到文档 Frame 右侧的独立资产区：`624:20498`、`625:105`、`639:97`、`641:141`、`642:135`、`642:253`、`642:21431`、`642:21507`、`273:129`、`677:63`。Node ID、名称、组件 API、Variable / Style 绑定、尺寸、实例属性和正式/Legacy 身份均未改变。
- L0：PASS。61/61 正式 Manifest 根存在；1,312 个正式根可见文字的裁切、垂直偏移和零宽文本均为 0；三个受影响文档页修复后顶层重叠为 0。
- L1：PASS。Button、Input、Textarea、Select、Combobox、Field、Tabs、Table Header、Dialog、AlertDialog、Drawer 和 Command Palette 精确截图可读；Combobox 保持完整左对齐“搜索并选择”。
- L2：PASS。Input / Select / Tabs 文档页重新截图，无源资产压在文档展示区；正式组件自身视觉与公共 API 未变。
- L3：PASS。六个最终 Gallery 重新抽查；展开后覆盖 1,254 个可见文本，无裁切或单行控件垂直偏移。Light / Dark × 1440 / 1024 / 390 保持通过。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。
- 回滚边界：仅将上述 10 个节点恢复到 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 记录的 `before` 坐标；禁止 Desktop Undo、名称前缀清理或重建组件。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（未改变设计合同）；ADR `Not applicable`（Neutral / Status 架构未变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时变更）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（当前缺陷已闭环）。
- 新 `currentPointer`：保持 `COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。

每完成一个可验证增量，在本节顶部追加：

```text
日期：YYYY-MM-DD HH:mm
Phase / P-ID：
组件 / Node ID：
修改前基线：
实际修改：
Variables / Properties：
L0 结构：PASS / FAIL / NOT_RUN
L1 Component Matrix：PASS / FAIL / NOT_RUN
L2 Component Family：PASS / FAIL / NOT_RUN
L3 Representative Page：PASS / FAIL / NOT_RUN
Light / Dark：
视图宽度：1440 / 1024 / 390 / N/A
自适应调整次数与原因：
评分：颜色 / 层级 / 状态 / 对齐 / 节奏 / Typography / 协调 / 平衡 / 响应 / A11y
回滚节点：
遗留风险：
新 currentPointer：
```

## 8. 文档准备记录

### 2026-08-13 17:48 +0800 · P4 POST-QA COMBOBOX RENDER ALIGNMENT CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户已批准的无任务号 Figma 例外；只修改 Figma 正式 Combobox 的三个精确嵌套实例、本状态台账和 `/tmp` 账本；未修改 React、配置、依赖、Git、Linear、Notion、部署或当前前端视觉。
- 真实缺陷：Combobox `642:253` 的 Sm/Md/Lg 外层实例属性回读为 Placeholder=`搜索并选择`、文本 `LEFT`，但精确单变体截图仍渲染陈旧的居中“选择”。Select `641:141` 同尺寸截图是正确左对齐，确认问题为 Combobox 外层嵌套实例的陈旧渲染/override 状态，而非 Base `642:135` 文本 API。
- 精确修复：对 `642:220`、`642:233`、`642:243` 分别执行 `Content=Value -> Placeholder` 往返，并重新写入原 Placeholder `搜索并选择`。写入返回 `createdNodeIds=[]`、`mutatedNodeIds=[642:220,642:233,642:243]`、`deletedNodeIds=[]`。
- 几何与 API：修复前后尺寸保持 `240x32`、`280x36`、`320x44`；State、Content、Value、Icon、Chevron、Clear、Loading 等 Component Properties 保持不变。正式根 `642:253`、Base `642:135` 和 Manifest 指纹均未改变。
- 视觉回归：Combobox 三尺寸截图均为完整“搜索并选择”且左对齐；Select `641:141` 与 Button Lg `606:408` 对照截图 PASS；Light/Dark × 1440/1024/390 六个 Gallery 已重新生成，无新增裁切、重叠或错位。
- 回滚边界：如需恢复，只对 `642:220` / `642:233` / `642:243` 执行相同 Content 往返并恢复记录中的原 Property 值；禁止 Desktop Undo、名称前缀清理或重建 Base/Set。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（不改变 Combobox API，只清除陈旧实例渲染）；ADR `Not applicable`（Neutral/Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4.e 与 Manifest 保持 `VERIFIED`）。
- 新 `currentPointer`：`COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 17:45 +0800 · P4.e FORMAL ASSET MANIFEST RECONCILIATION VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户已批准的无任务号例外；本增量只修改 `figma-neutral-redesign` 文档和 `/tmp` 台账，并对 Figma 做只读 Plugin API 回读；未修改 React、配置、依赖、Git、Linear、Notion、部署或当前前端视觉。
- 实时回读：精确查询 61 个正式根，61/61 存在。正式完整名称均为 `CWGSYW/Component/...` 或 `CWGSYW/Pattern/...`；Button、Icon Button、Input、Textarea、Select、Combobox、Search Input、Date Input、Chip 等 Wrapper 的外层和嵌套 Base API 均已读取。只读脚本未创建、修改或删除 Figma 节点/变量。
- 新增 `FORMAL-ASSET-API-MANIFEST.md`：记录 61 个精确 Node ID、完整名称、公共轴/Property、嵌套 API、Runtime 边界、五类 Pattern 组合合同和 drift 分类门禁。正式资产发现必须同时匹配 ID + 名称 + API 指纹；禁止只按名称前缀发现。
- 合同与 Prompt：`FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md` 和 `FRONTEND-REFACTOR-EXECUTION-PROMPT.md` 已要求每个未来切片先回读 Manifest、建立机器可读 baseline、在未分类 drift 时停止；README 与 START-HERE 索引同步。
- 对齐结论更新：Button `606:408` / `606:409` 当前 `73x44`，“确认”完整显示；Input `625:105` 通过。Combobox `642:253` 的陈旧居中渲染在 17:48 的后续精确截图中被确认并已按下一条记录修正；六组 Gallery 与递归对齐审计继续 PASS。P4.e 保持 `VERIFIED`，不重新打开。
- 回滚边界：只删除新 Manifest 并恢复本轮对 README、START-HERE、合同、Prompt、STATUS 与 `/tmp` 账本的精确文档增量；Figma 无本轮写入，不存在画布回滚。禁止 Desktop Undo 或名称前缀清理。
- Documentation Impact Assessment：PRD/功能需求 `Update`（Manifest 补足未来 React 重构的正式资产 allowlist 与 drift 门禁）；ADR `Not applicable`（Neutral/Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（未来实现由独立任务启动）。
- 新 `currentPointer`：`COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 17:12 +0800 · P4.e IMPLEMENTATION CONTRACT VERIFIED · FIGMA DELIVERY COMPLETE

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已确认 P0 写入并授权无任务号例外；本增量仅修改 Figma Variable Code Syntax 与 `figma-neutral-redesign` 文档/本地账本，不修改 React、配置、依赖、Git、Linear、Notion 或部署。
- 实时资产：201 个本地 Variables；9 个正式 `CWGSYW / ...` 集合共 176 个正式 Variables；Legacy `Collection 1` 25 个；61 个正式公开 Component / Pattern 根；10 个 Text Styles；5 个 Effect Styles。
- Code Syntax 精确修正：`VariableID:509:51` -> `var(--cwgsyw-neutral-alpha-black-56)`；`VariableID:509:52` -> `var(--cwgsyw-neutral-alpha-black-72)`；`VariableID:408:3596` -> `var(--cwgsyw-font-size-body-xs)`；`VariableID:408:3597` -> `var(--cwgsyw-font-line-height-body-xs)`；`VariableID:408:3598` -> `var(--cwgsyw-font-weight-slim)`。Variable value、Alias、Scope、Mode 和画布节点均未改变。
- 写入返回：`createdNodeIds=[]`、`mutatedNodeIds=[]`、`deletedNodeIds=[]`；`mutatedVariableIds` 为上述 5 个精确 Variable ID。
- 只读回读：176/176 正式 Variables 均有合法 WEB Code Syntax；`missingWeb=[]`、`nonVarSyntax=[]`、`duplicateWithinCollection=[]`；5 个修正值全部匹配。
- 实施合同：创建 `FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`，覆盖设计源优先级、Token 白名单、Light/Dark、Text/Effect、React API、Variant/runtime state、Slot、五类 Pattern、Default/Compact、1440/1024/390、业务状态、Overlay/A11y、垂直切片、视觉闭环、禁止项、证据与回滚。
- 执行 Prompt：创建 `FRONTEND-REFACTOR-EXECUTION-PROMPT.md`，包含主执行、续跑、单组件、单页面和只读审计 Prompt；强制 Playwright 六档截图、Critical 门禁、根因分层自动回修和组件整体协调。
- 覆盖审计：PASS。61 个公开根全部纳入合同族清单；五类 Pattern、Loading/Empty/Error/Permission、focus-visible/keyboard/Portal/screen reader、Light/Dark、1440/1024/390 和回滚均有明确出口。
- 回滚边界：Variable 只恢复上述 5 个 ID 的原 Code Syntax；文档只删除两份新增文件并恢复 `README.md`、`START-HERE.md`、`STATUS.md` 和 `/tmp` 账本。本次不依赖 Desktop Undo。
- Documentation Impact Assessment：PRD/功能需求 `Create`（本合同成为未来 React 重构的权威实施要求）；ADR `Not applicable`（未改变已锁定 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（尚未修改运行时代码）；Current System Baseline `Not applicable`（新设计继续与当前前端割裂）；Follow-up documentation `Not applicable`（未来实现由独立任务及本执行 Prompt 接管）。
- 新 `currentPointer`：`COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。

### 2026-08-13 17:12 +0800 · P4 POST-QA TEXT / BUTTON / FIELD ALIGNMENT RECHECK PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户已批准的无任务号 Figma 例外；本轮只修改正式 Figma Button 源组件、本状态台账和 `/tmp` 精确恢复账本，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 真实缺陷与修正：正式 Button `Size=Lg` `606:408` 和嵌套 `Button Base` `606:409` 从 `74x44` 恢复为 `73x44`。74px 固定宽度下虚拟标签框回读为 33px，真实 4x 截图会裁掉首字；恢复 73px 后虚拟标签框稳定为 32px，“确认”完整显示且无越界。最终标签仍由 Auto Layout 数学居中在 `x=20.5`，因此本次通过依据是完整渲染、中心关系和消费者无越界，而不是强制整数坐标。
- 输入族复核：Input `625:105`、Textarea `626:182`、Select `641:141`、Search Input `642:21431`、Date Input `642:21507` 与 Field `665:432` 的源节点几何、文本样式和 Auto Layout 通过。Combobox `642:253` 当时结构回读为左对齐，但后续精确单变体截图证明可见渲染仍是陈旧居中“选择”；该判断已被 17:48 条目推翻并完成修正，以新条目为准。
- 递归结构审计：正式源 34 个顶层 Component / Pattern 根、1032 个去重 Text；可见文本裁切 `0`、Auto Layout 交叉轴居中偏差 `0`、固定宽度与文本自然宽度冲突 `0`。排除 Calendar / Metric 等有意数学居中后，只剩 Pagination 单个奇数宽数字落在偶数宽按钮中的正常半像素数学居中，不属于裁切或错位。
- 页面回归：Light `988:26261` / `991:27537` / `991:43491` 与 Dark `991:44294` / `991:46510` / `992:6664` 六个 Gallery 各包含 5 个正式页面 Pattern；控件文本越界 `0`，Light / Dark x 1440 / 1024 / 390 PASS。
- 回滚边界：只把 `606:408` 与 `606:409` 恢复为 `74x44`；禁止 Desktop Undo、名称前缀清理或批量重建。此前 2026-08-13 15:55 条目中“74px 消除半像素”的判断已被本轮真实 4x 截图推翻，以本条结论为准。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（不改变 Button API，只修复源组件可见裁字）；ADR `Not applicable`（Neutral / Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4.e 保持 `VERIFIED`，无需重新打开）。
- 新 `currentPointer`：`COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 16:47 +0800 · P4 POST-QA ALIGNMENT CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户已批准的无任务号 Figma 例外；本轮只修改 Figma 正式源、P4 页面 Pattern、本状态台账和 `/tmp` 精确恢复账本，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 定位结论：Button、Input、Search Input、Date Input 的正式源 Auto Layout 中心审计为 0 缺陷，未做无依据的批量尺寸修改。实际问题集中在 Pagination 的 1px 边框参与居中后产生半像素基线，以及 Detail Header 同时显示 Status 与 Metadata 导致 Compact 页面重复“生产”。
- Pagination：正式 Default `787:309` 高度从 `52→53`，Compact `787:28035` 从 `48→49`；对应 Table + Pagination Verification `796:741` 从 `52→53`、`796:825` 从 `48→49`。内部 20px 文本的纵坐标从 `16.5 / 14.5` 回到整数 `17 / 15`；P4 Data Default / Compact 中 19 个半像素 Pagination 文字降为 0。
- Detail Header：P4 Detail / Drawer 的 Default 实例 `981:4155` 与 Compact 实例 `981:4588` 将 `Show Status#953:18` 从 `true` 改为 `false`，保留 Metadata 的 Neutral “生产”和 Actions；每个 Header 的“生产”从 2 个收敛为 1 个，不改变正式 Detail Header API 或 Status / Neutral 颜色边界。
- 视觉与结构：Data `980:3189` / `980:3929`、Detail `981:4153` / `981:4586` 放大截图 PASS；六个 Gallery 根 Light `988:26261` / `991:27537` / `991:43491`、Dark `991:44294` / `991:46510` / `992:6664` 均 PASS。断链实例、根越界、Pagination 半像素文字和重复“生产”均为 0。
- 最终截图：`/tmp/cwgsyw-p4d-alignment/data-default-final.png`、`data-compact-final.png`、`detail-default-final.png`、`detail-compact-final.png`，以及六个 `light-*` / `dark-*` Gallery 截图。
- 回滚边界：只恢复 `787:309` 高度 52、`787:28035` 高度 48、`796:741` 高度 52、`796:825` 高度 48，并把 `981:4155` / `981:4588` 的 `Show Status#953:18` 恢复为 `true`。禁止 Desktop Undo、名称前缀清理或批量重建。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（组件 API 与页面行为未改变）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4.e 后续已完成并保持 `VERIFIED`）。
- 新 `currentPointer`：`COMPLETE_FRONTEND_REFACTOR_NOT_STARTED`。React 重构仍未授权，不开始实现。

### 2026-08-13 16:44 +0800 · P4.d GLOBAL QA VERIFIED · P4 FINAL QA PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户再次确认“P0 写入”；P0 已为 `VERIFIED`，因此不倒退执行指针。本轮沿用既有无任务号 Figma 例外，只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion、部署或迁移文档。
- P4.d.a-c：全局资产与边界、Variables / Styles / 颜色语义、正式命名 / Variant / Component Property / Instance Link 门禁全部 PASS。普通 UI 与 Primary 只消费 Neutral，Status 色只表达真实 Info / Success / Warning / Danger；未重新引入 Blue 或装饰性色。
- Focus 合同：Button Base `605:494` 和 Icon Button Base `610:19295` 均从 25 扩展为 30 个变体，状态顺序锁定为 `Default / Hover / Focused / Pressed / Disabled / Loading`。新增 Button Focused `1036:7734` / `1036:7739` / `1036:7744` / `1036:7749` / `1036:7754`；新增 Icon Button Focused `1036:7759` / `1036:7762` / `1036:7765` / `1036:7768` / `1036:7771`。全部使用 `focus/ring` `VariableID:404:17873`、2px、`INSIDE`，Light / Dark 可读。
- API 与结构：Button Base 宽度 `700→848`，Icon Button Base 宽度 `396→480`；两组均为 5 Variant × 6 State，无缺失或重复组合。外层 Button `606:19247` 与 Icon Button `610:19314` 的 6 个 Size 实例均能选择 `Focused`；Component Property 引用、实例链和直接溢出均为 0。两个 Base Set 的临时 Dark 显式模式已恢复为空对象 `{}`。
- 恢复记录：首次 `clone()` 生成的 10 个 Focused Component 落到 Page，而不是自动加入原 Component Set；随后按上述精确 ID 分别 `appendChild` 回 `605:494` 和 `610:19295`，并重排状态矩阵。最终回读两个 Set 各 30 个 Component；不得删除或重建这些节点。
- P4.d.e：六个最终 Gallery 根为 Light `988:26261` / `991:27537` / `991:43491`，Dark `991:44294` / `991:46510` / `992:6664`。五类页面在 1440 / 1024 / 390 均保持原生构图；桌面 Table 表头继续为 Neutral 灰底和可读浅灰文字；390 不缩放桌面表格；无裁切、重叠或不可见内容。
- 最终 L0：PASS。审计 90 个正式根、5392 个唯一节点、3665 个可见 Solid Paint、1433 个 Text、1816 个 Instance 和 3046 个 Component Property 引用；硬编码颜色、远程或缺失颜色、Primitive 直绑、旧 `Collection 1`、缺 Text Style、非 Inter、断链 Instance、placeholder、非预期零尺寸、可见文本裁切、属性断链和根直接溢出均为 0。六个 Gallery 直接溢出均为 0。
- 最终截图：`/tmp/cwgsyw-figma-p4d/button-base-focused-light.png`、`icon-button-base-focused-light.png`、`pages-light-1440-final.png`、`pages-light-1024-final.png`、`pages-light-390-final.png`、`pages-dark-1440-final.png`、`pages-dark-1024-final.png`、`pages-dark-390-final.png`。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 5/5。Critical 维度均不低于 4/5，P4 Final QA PASS。
- 精确回滚边界：两个 Base Set、10 个新增 Focused Component、Pressed / Disabled / Loading 的 30 个被后移节点和两个 Set 的宽度调整为一个回滚单元。Button Base 旧宽 700，Icon Button Base 旧宽 396；回滚时删除 10 个精确新节点、恢复 30 个精确旧节点坐标和两个旧宽度。禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 只定义 Focused 视觉合同，不表达 `:focus-visible` 触发条件、键盘焦点流转、焦点陷阱与返回、Portal、异步状态、真实断点切换和屏幕阅读器语义；这些必须在未来 React 重构中按 P4.e 合同实现并做真实视图闭环。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（完成已锁定 Figma Final QA）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（下一步 P4.e 将产出实现合同）。
- 新 `currentPointer`：`P4.e` Implementation Contract。React 重构仍未授权，不开始实现。

### 2026-08-13 15:55 +0800 · P4.c POST-VERIFY TEXT / BUTTON / FIELD ALIGNMENT CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户已批准的无任务号 Figma 例外；本轮只修改 Figma 正式源组件、本状态台账和 `/tmp` 精确恢复账本，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- Button：正式 `Size=Lg` `606:408` 与嵌套 `Button Base` `606:409` 从 `73×44` 调整为 `74×44`。原奇数宽度会让 32px 中文标签在水平居中时落到半像素；新尺寸保持 20px 侧间距方向并消除文字半像素渲染。
- Search / Date Input：Search Input 的 Sm / Md / Lg 文字节点 `I642:21355;624:20343`、`I642:21385;624:20343`、`I642:21408;624:20343`，Date Input 的 `I642:21432;624:20343`、`I642:21457;624:20343`、`I642:21482;624:20343`，已统一复用 Input 的正式 Text Styles：Sm `14/20`、Md `16/24`、Lg `18/28`。最终上下内边距分别为 `6/6`、`6/6`、`8/8`。
- Pagination：正式 Default 变体中的 `Page Size` `787:330` 与 `Jump` `787:369` 改为交叉轴居中；辅助文字 `787:331`、`787:370`、`787:404` 改为纵向 Fill 并 `textAlignVertical=CENTER`，三个文字框均稳定占满 32px 控件行，不再贴上缘。
- 排除项：Textarea 的正文顶对齐、Alert / Toast 关闭符号顶对齐、Metric 单位底部基线对齐均为既定语义，未误改。Date Input 内 `Header Divider` 是 14px 宽的 Line，0 高度属于正常线段几何，不是零尺寸控件。
- L0：PASS。最终审计覆盖 2934 个去重节点；硬编码 Solid、远程颜色、Primitive 颜色直绑、未解析绑定、缺 Text Style、非 Inter、断链 Instance、placeholder、非预期零尺寸、几何溢出和五个正式 Pattern 同名重复均为 0。
- L1 / L2 / L3：PASS。正式 Button、Search Input、Date Input、Pagination 源截图和 P4.c Form / Data / Detail / Dashboard / Overlay 的 Default / Compact 放大视图通过；Light / Dark 与 1440 / 1024 / 390 Gallery 复验无新增裁切、重叠或错位。
- 回滚边界：只使用精确节点 `606:408`、`606:409`、六个 Search / Date 文字节点、`787:330`、`787:369`、`787:331`、`787:370`、`787:404`。Button 旧尺寸为 `73×44`；Search / Date Sm / Lg 旧样式为 `16/24`；Pagination 旧辅助文字为纵向 HUG / TOP。禁止依赖 Desktop Undo。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（组件 API 与页面行为未改变）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4.d Global QA 仍由同一台账追踪）。
- 新 `currentPointer`：保持 `P4.d` Global QA。

### 2026-08-13 15:45 +0800 · P4.c REPRESENTATIVE PAGE PATTERNS VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户再次确认 P0 写入授权；本轮延续既有无任务号 Figma 例外，只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion、部署或迁移文档。
- 正式资产：资产区 `978:3416`；Form / Settings Set `979:3728`（Default `979:3356`、Compact `979:3584`）；Data / Management `980:4171`（`980:3189`、`980:3929`）；Detail / Drawer `981:4870`（`981:4153`、`981:4586`）；Dashboard / Feedback `981:41152`（`981:40436`、`981:40881`）；Overlay / Destructive `982:5760`（`982:5247`、`982:5524`）。资产区最终 `placeholder=false`。
- 六组 Gallery：Light 1440 section `988:26261`、Light 1024 `991:27537`、Light 390 `991:43491`；Dark 1440 `991:44294`、Dark 1024 `991:46510`、Dark 390 `992:6664`。每组 5 个正式 Pattern 实例，无 Section 子项溢出；Gallery 根 `716:7966` / `716:8191` / `716:8416` / `716:8531` / `716:8756` / `716:8981` 均保留 40px 底部安全区。
- 主题修正：Form / Settings 的 Wide Verification 实例 `979:3439` 和 Compact Verification 实例 `979:3665` 原本显式锁定 Light，导致 Dark 输入区仍为白色；已清除两者的 `CWGSYW / Color` 显式模式，回读均为 `null`，Light 无回归。
- 中文文本诊断：只读审计 `979:3356` 与 `979:3584` 的全部 Text。正式 `characters` 和实例 TEXT 属性均为完整中文；`textTruncation=DISABLED`，无 `maxLines` 限制，无文本越出裁切祖先。先前长图中“只显示一个字”属于缩放渲染观感，不修改正式文本框。
- L0：PASS。最终正式源审计覆盖 1444 个去重节点；硬编码 Solid、远程或未解析颜色、Primitive 颜色直绑、缺 Text Style、非 Inter、断链 Instance、placeholder 子节点和零尺寸均为 0。7 个内部几何命中为 Chevron 矢量笔画、Progress 指示条厚度和 Popover / Tooltip 箭头等有意装饰，不是 Set 或页面布局溢出；六组 Section 直接溢出均为 0。Default / Compact 变体在五个不同 Set 内允许同名，五个 Set 名称和资产各唯一。
- L1 / L2 / L3：PASS。五类 Pattern 的 Default / Compact、组件族配合、Light/Dark 和 1440/1024/390 均通过。Detail、Dashboard、Overlay 共 12 个局部高分辨率视图通过；Data 补验确认桌面 Table 表头保持 Neutral 灰底与可读浅灰文字，390 使用原生列表卡片和简化分页，不压缩桌面表格。
- 最终长图：`/tmp/cwgsyw-figma-p4c/light-1440-final.png`、`light-1024-final.png`、`light-390-final.png`、`dark-1440-final.png`、`dark-1024-final.png`、`dark-390-final.png`。局部证据同目录下以 `*-form-*`、`*-data`、`*-detail`、`*-dashboard`、`*-overlay` 命名。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：资产区、五个正式 Set、十个变体、六组 Lab section、30 个顶层 Pattern 实例、两个 Form 主题继承修正和六个 Gallery 根高度作为一个回滚单元；只按本条和 `/tmp` 台账的精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达运行时响应切换、焦点陷阱与返回、键盘导航、菜单定位、异步加载/筛选、表格排序与选择、分页数据合同、Toast 队列、屏幕阅读器 announcement 和 Portal 层级；未来 React 重构必须实现并做真实视图闭环。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 P4.c Figma API）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4.d Global QA 继续由同一台账追踪）。
- 新 `currentPointer`：`P4.d` Global QA。

### 2026-08-13 15:10 +0800 · P4.c PRE-FLIGHT CONTROL ALIGNMENT CORRECTION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。本轮响应用户指出的文字、Button 与文字框错位，只修改正式 Figma 源组件和本地状态账本；未创建 P4.c 页面资产，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- Button：`Size=Lg` 变体 `606:408` 与内部 `Button Base` `606:409` 从 `72×44` 修正为 `73×44`。修正前 33px 标签加左右各 20px Padding 需要 73px，存在 1px 裁切；修正后“确认”完整显示。
- Select / Combobox：Select `641:141`、Combobox `642:253` 的 Sm/Md/Lg Placeholder 文本统一复用 Input `625:105` 的正式 Text Styles：Sm `14/20`、Md `16/24`、Lg `18/28`。修改节点为 `I641:111;639:100`、`I641:121;639:100`、`I641:131;639:100`、`I642:220;642:138`、`I642:233;642:138`、`I642:243;642:138`。
- Field：三个状态的 Label `665:364`、`665:377`、`665:409` 从横向 Fill/Grow 改为 HUG/0；Required `665:365`、`665:378`、`665:410` 现在固定跟随标签并保持 4px 间距，不再被推到行末。
- L0：PASS。Button / Input / Select / Combobox / Field 源资产与 P4.b Wide/Compact Verification 的文字裁切和横向内容溢出均为 0；相关 Main Component 可解析，未增加颜色、变量或远程绑定。
- L1：PASS。Button、Select、Combobox、Field 源截图通过；最终 Field 截图 `/tmp/fix-field-final.png`，Button / Select / Combobox 截图 `/tmp/fix-button.png`、`/tmp/fix-select.png`、`/tmp/fix-combobox.png`。
- L2：PASS。Input / Select / Combobox 三档字号、行高和 Text Style ID 完全一致；Field Label 与 Required 的几何关系为 `x=0,width=56` 与 `x=60,width=8`。
- L3：PASS。P4.b Compact Verification `962:39342`、Light 390 `965:21649`、Dark 390 `965:22070` 回读无裁切或重叠；截图 `/tmp/fix-compact.png`、`/tmp/fix-light390.png`、`/tmp/fix-dark390.png`。
- 回滚边界：只回滚上述精确节点。Button 旧尺寸为 `72×44`；Select/Combobox Sm/Md/Lg 旧文本分别为 `16/24`、`16/24`、`16/24`；Field Label 旧约束为 `layoutSizingHorizontal=FILL`、`layoutGrow=1`、宽 `340`。不依赖 Desktop Undo。
- 遗留风险：这是 P4.c 代表页面 Pattern 创建前的正式源组件纠偏，不代表 P4.c 完成。仍需创建五类页面模式并完成 Light/Dark × 1440/1024/390 闭环。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（不改变已锁定组件 API）；ADR `Not applicable`（Neutral/Status 架构不变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P4.c 继续由本台账追踪）。
- 新 `currentPointer`：`P4.c` 代表页面 Pattern。

### 2026-08-13 14:59 +0800 · P4.b TOOLBAR / WORKSPACE TOOLBAR / FILTER BAR VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 接管与 Legacy 边界：旧 Filter Bar `255:83` 已重命名为 `Legacy/CWGSYW/Pattern/Filter Bar`。`getInstancesAsync()` 权威回读确认 6 个消费者 `255:108` / `535:1969` / `513:18451` / `270:180` / `538:1213` / `502:416` 均保持连接，未删除或迁移。正式同名 Pattern 各唯一一份，没有覆盖已消费旧资产。
- 正式资产：资产区 `958:2411`；Toolbar Set `959:38114`（Default `959:2411`、Compact `959:38107`）；Workspace Toolbar Set `959:38142`（Default `959:38143`、Compact `959:38150`）；Filter Bar Set `959:38267`（Default `959:38211`、Compact `959:38249`）；Wide Verification `962:39341`；Compact Verification `962:39342`。
- Component API：Toolbar / Workspace Toolbar 为 `Layout=Default|Compact`，公开 Leading、Filters、Actions 三个 Slot 及对应 Show 开关；Filter Bar 为 `Layout=Default|Compact`，公开 Search、Filter Items、Reset、Actions 四个 Slot 及对应 Show 开关。示例内容分别为 `已筛选 / 导出`、`当前空间 / 切换`、`全部类型 / 已启用 / 重置 / 应用`。
- Variables：新增 `CWGSYW / Pattern Layout` `VariableCollectionId:960:38659`，含 `pattern/toolbar-height` `VariableID:960:38660`、`pattern/filter-bar-height` `VariableID:960:38661`、`pattern/padding` `VariableID:960:38662`、`pattern/gap` `VariableID:960:38663`，均有精确 Scope、Default / Compact 模式和 WEB Code Syntax。创建后未使用的 `pattern/stack-content-width` `VariableID:960:38664` 已按精确 ID 删除并确认不在本地清单中。
- 颜色和语义：三个 Pattern 的常规背景、文本、边框、图标、Primary、Hover 和 Disabled 全部使用 Neutral；未新增颜色族。Search / Select 内嵌图标绑定 `icon/secondary`，无品牌蓝、装饰色或非状态 Status 色。
- L0：PASS。最终权威审计覆盖 317 个正式源与 Verification 唯一节点；硬编码 Solid、远程颜色、Primitive 颜色直绑、未解析颜色绑定、缺 Text Style、非 Inter 字体、断链 Instance、placeholder 和几何越界全部为 0。三个 Set 的公开 Component Property 定义均可实时回读；五个正式名称各唯一一份。
- L1：PASS。Toolbar / Workspace Toolbar / Filter Bar 的 Default 与 Compact Matrix 均在 Wide `962:39341`、Compact `962:39342` 中可读；Tabs、Chip、Search、Select、次要重置和主操作层级清晰，Compact Filter Bar 的 Select 收敛为 214px 后完整落在 294px 内容宽度内。
- L2 / L3：PASS。六个 Integration Lab section 为 Light `960:38517` / `960:38665` / `962:39055`、Dark `961:20826` / `962:20962` / `962:39198`；Data / Management 组合 Page Header + Toolbar + Filter Bar，Detail / Drawer 组合 Workspace Toolbar。Light/Dark 与 1440/1024/390 全部通过。
- 自适应修正：三个 Set 从绝对定位改为受 Pattern Variables 控制的原生 Auto Layout；Compact Filter Bar 内 Select 改为 214px，避免 Select + Chip 溢出；新增 Actions 行 `961:38919` 并清除其默认白 Fill，修复 Dark 白条；默认示例明确为 `已筛选 / 导出`、`当前空间 / 切换`、`重置 / 应用`；桌面 Lab section 调整为 540px、移动为 828px；最终把延迟写成 390px 的移动消费者 `965:21649` / `965:22070` 精确恢复为 366x780，并在上下各保留 24px 安全边界。两次属性写入因虚拟嵌套 Instance 不可跨调用修改而原子失败，均无部分残留；随后以可直接配置的正式 Chip Base / Button Base Slot 实例完成修正。
- 最终截图：`/tmp/cwgsyw-figma-p4b/matrix-final.png`、`/tmp/cwgsyw-figma-p4b/formal-wide.png`、`/tmp/cwgsyw-figma-p4b/formal-compact.png`、`/tmp/cwgsyw-figma-p4b/light-1024-final.png`、`/tmp/cwgsyw-figma-p4b/dark-390-final.png`；1440 / 1024 / 390 Light / Dark 复核截图来自六个 Lab section 的最终渲染。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：资产区 `958:2411`、三个正式 Set、两个 Verification、六个 Lab section、六个顶层 Pattern 实例与移动消费者 `965:21649` / `965:22070` 作为一个回滚单元；只按本条和 `/tmp` 台账中的精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达 Toolbar 命令可用性、筛选状态同步、搜索 debounce、Select 菜单、Reset / Apply 回调、响应式切换、键盘顺序和屏幕阅读器 announcement；未来 React 实现必须补齐并验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 P4.b Figma API）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4.c 继续由同一台账追踪）。
- 新 `currentPointer`：`P4.c` 代表页面 Pattern。

### P4.c Phase Checklist

- P4.c.1 代表页面信息架构：只从功能清单确认必须覆盖的场景，使用正式 Component 重新设计 Data / Management、Detail / Drawer、Dashboard / Feedback、Form / Settings 和 Overlay / Destructive 页面，不沿用当前前端布局或显色。
- P4.c.2 页面壳与组合：复用 P4.a Header / Breadcrumb 与 P4.b Toolbar / Filter Pattern，结合 P1-P3 正式组件建立 Default / Compact 原生响应式页面。
- P4.c.3 Light / Dark 与 1440 / 1024 / 390：高影响代表页面覆盖两个以上业务场景；移动端使用原生 Compact 构图，不缩放桌面 Pattern。
- P4.c.4 L0-L3 与自适应视觉闭环：颜色、层级、状态、对齐、节奏、Typography、协调、平衡、响应和 A11y 的 Critical 维度均不得低于 4/5；所有硬编码色、断链、裁切、重叠和不可见文字必须为 0。
- P4.c 退出条件：至少五类正式代表页面均有可复用 Pattern 或明确组合合同；Light/Dark 与适用的 1440/1024/390 全部通过；共享问题在 Variables / 基础组件修正，不以页面实例覆盖掩盖；节点、截图、回滚单元和新指针完整入账。

### P4.d Global QA Checklist

- P4.d.a 全局资产清单与边界对账：回读本地 Variables、Styles、正式 Component / Pattern、Legacy 资产与验证场景；状态与实时 Figma 冲突时以实时树为准并修正台账。
- P4.d.b Variables / Styles / 颜色语义门禁：验证常规 UI 仅消费 Neutral，Status 只用于真实状态；检查 scope、code syntax、alias、未解析/远程/Primitive 直绑、硬编码颜色、缺 Text / Effect Style。
- P4.d.c 正式组件结构门禁：审计命名唯一性、Variant 轴、Component Properties、属性引用、实例连接、placeholder、零尺寸、裁切、溢出与正式/Legacy 边界。
- P4.d.d 可访问性与组件协同：检查可读对比、Focus 可见性、最小触控尺寸、非颜色状态表达、Typography、图标、圆角、阴影、密度与五类页面中的整体协调。
- P4.d.e 六档页面回归：复验 Form / Settings、Data / Management、Detail / Drawer、Dashboard / Feedback、Overlay / Destructive 在 Light / Dark 与 1440 / 1024 / 390 下的原生构图，不以缩放或实例覆盖掩盖共享问题。
- P4.d.f 全局证据与恢复账本：记录全部实际修改 ID、L0-L3、评分、截图、例外、风险和精确回滚边界；只在所有门禁通过后推进实施合同。
- P4.d 退出条件：P4.d.a-P4.d.f 全部 PASS；正式设计源无硬编码/远程/Primitive 颜色直绑、未解析绑定、断链实例、无解释零尺寸、不可见文字、裁切、重叠、颜色越界、命名冲突或属性断链；Light / Dark × 1440 / 1024 / 390 全部通过；颜色、层级、状态、对齐、Typography、协调、响应和 A11y 等 Critical 维度均不低于 4/5。

### 2026-08-13 13:52 +0800 · P4.a BREADCRUMB / PAGE HEADER / DETAIL HEADER VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 接管结论：实时审计没有 Breadcrumb、Page Header 或 Detail Header 正式资产和消费者；库搜索只命中现有 Tabs，API 不匹配，因此在本文件创建正式 Pattern。最终七个正式名称各唯一一份，没有覆盖或删除既有消费者。
- 正式资产：资产区 `941:2062`；Breadcrumb Item `942:2061`、Current `942:2063`、Separator `942:2252`、Overflow `942:2256`、Pattern `943:2063`；Page Header `947:2116`；Detail Header `947:22448`；Wide Verification `949:2160`；Compact Verification `949:2225`。
- Component API：Breadcrumb 通过 `Items Slot` 组合 Item / Separator / Overflow / Current。Page Header 为 `Layout=Default|Compact`，公开 Breadcrumb、Eyebrow、Title、Subtitle、Status、Actions 与对应 Show 开关。Detail Header 同样提供 Default / Compact，并追加 Breadcrumb、Identity、Metadata、Tabs Slots 及显示开关，适配 Detail / Drawer 的身份、元数据和分区导航。
- 颜色和语义：Breadcrumb、标题、操作、背景、边框和普通 Badge 全部使用 Neutral；只有 Status Slot 内真实 `Status Badge` 使用 `Success / 运行中`。未新增颜色变量或颜色族，未消费品牌蓝或装饰色。
- L0：PASS。七个正式资产同名计数均为 1；正式资产与六个 Lab 场景的硬编码实体色、缺 Text Style、非 Inter、断链 Instance、零尺寸和裁切均为 0。Breadcrumb 五类资产均有真实消费者。
- L1：PASS。Page Header 与 Detail Header 的 Default / Compact 两态在 Wide `949:2160` 与 Compact `949:2225` 验证区可读，标题、说明、状态、操作、Identity、Metadata 和 Tabs 层级清晰。
- L2 / L3：PASS。六个 Integration Lab section 为 Light `952:19425` / `952:37464` / `952:37737`、Dark `952:37605` / `952:37671` / `952:37803`；每块均使用正式 Page Header 与 Detail Header 实例。Light/Dark 与 1440/1024/390 全部通过，父根均保留 40px 底部空间。
- 自适应修正：修复 Slot 只能作为 Component 直接子层的结构限制；修复 `resize()` 导致 Verification 高度锁为 1px；删除无属性定义且零消费者的错误 Detail clone `947:2117`；接管延迟写入的 Header 扩展 Slots；将 Compact Detail 副标题改为两行并把后续 Status / Metadata / Actions / Tabs 下移；Metadata 默认语义从重复“状态”改为“生产”；Page / Detail 操作分别改为“新建实例”与“编辑”。
- 最终响应复核：Detail Header Set `947:22448` 扩展为 1626x292；Default `947:22449` 校正为原生 1180x228 并把 Status / Actions 右对齐；Wide Verification `949:2160` 校正为 1440x480、其中 Detail Header `949:2193` 为 1360x228。四个宽屏 Lab Detail Header `952:19458` / `952:37497` / `952:37639` / `952:37705` 从旧 132px 修为 228px，对应 section 改为 456px；390 Light/Dark 保持原生 326px Compact 与自然 272px 高度。最终六个 section 的溢出、硬编码颜色和远程颜色均为 0。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：资产区 `941:2062`、七个正式资产根、两个 Verification、六个 Lab section、12 个 Header 实例及六个 Lab 根高度变化作为一个回滚单元；只按本条和 `/tmp` 台账中的精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达 Breadcrumb 链接导航、Overflow 菜单、标题语义层级、响应式切换逻辑、Slot 数据合同、键盘焦点和屏幕阅读器 landmark；未来 React 实现必须补齐并验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 P4.a Figma API）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4.b 继续由同一台账追踪）。
- 新 `currentPointer`：`P4.b` Toolbar / Workspace Toolbar / Filter Bar。

### 2026-08-13 13:27 +0800 · P3.d COMMAND PALETTE VERIFIED · P3 EXIT PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 接管结论：初始 live 文件没有 Command Palette 正式资产或消费者；并行链随后写入 Command Item `925:1792` 与 Command Group `928:1777`。本轮接管并保留这两个正式根，没有创建同名重复资产；全文件同名正式资产最终各唯一 1 份。
- 正式资产：Command Item `925:1792`；Command Group `928:1777`；Command Palette Pattern `929:1990`；Wide Verification `930:1977`；Compact Verification `930:2059`。
- Component API：Command Item 为 `State=Default|Hover|Selected|Disabled`，公开 Label、Shortcut、Show Shortcut、Leading Icon 与 Show Leading Icon；Command Group 公开 Title 与 Items Slot；Command Palette 为 `Layout=Default|Compact × State=Results|Empty|Loading` 共 6 个变体，公开 Search Field 与 Content 两个真实 Slot。
- 复用关系：Palette 默认内容只使用正式 Search Input、Command Group、Empty State 与 Loading State；Command Group 默认由正式 Command Item 实例组成。业务命令、过滤结果和分组数据不做 Figma 变体，未来 React 通过数据与 Slot 组合实现。
- 颜色和层级：Search、Hover、Selected、Disabled、背景、文本、边框、图标、Overlay 与 Focus 合同全部使用 Neutral；未新增颜色族或 Status 消费。Palette 使用 `CWGSYW/Elevation/Sm`，验证区使用正式 `overlay/scrim`。
- L0：PASS。最终审计 11 个正式/验证/Lab 根、322 个去重节点、64 个 Text、96 个 Instance 与 241 个颜色绑定；硬编码颜色、远程颜色、Primitive 直绑、未解析绑定、缺 Text Style、非 Inter、placeholder、断链实例、174 个 Component Property 引用中的失效引用、几何裁切与 Lab 溢出均为 0。
- 实时复核：属性引用按最近祖先 Instance 归属，并在主组件为 Variant 时回溯其父 Component Set；修正算法后 `174 checked / 0 bad`。Palette 全文件同名正式资产仅 `929:1990` 一份，6 个 Variant 合计 21 个消费者，全部位于 Wide / Compact Verification 与六个 Lab 场景，因此保留 `CWGSYW/Pattern/Command Palette`、`Layout=Default|Compact` 和 Slot API。六个 Variant 均使用 `CWGSYW/Elevation/Sm`，符合轻量命令浮层层级，不提升为 Md。
- L1：PASS。Command Item 四状态可辨；Command Group 的分组标题、Selected / Default / Disabled 行、快捷键和 Icon 对齐清晰；Palette 的 Results / Empty / Loading 与 Default / Compact 六态完整，Empty 文案为“未找到命令”且隐藏通用创建按钮，Loading 文案为“正在搜索命令”。
- L2：PASS。Wide `930:1977` 在 Neutral scrim 内纵向验证 Results、Empty、Loading；Compact `930:2059` 验证 Results 与 Empty。Search、Group、Command Item、Empty、Loading 和 Overlay 形成完整同族组合。
- L3：PASS。六个 Integration Lab section 为 Light `930:36780` / `930:36863` / `930:36946`、Dark `930:37010` / `930:37093` / `930:37176`；对应实例 `930:36781` / `930:36864` / `930:36947` / `930:37011` / `930:37094` / `930:37177`。Light/Dark 与 1440/1024/390 全部通过，无不可见文本、裁切或重叠。
- 截图限制：Compact Verification 根 `930:2059` 的 Figma 独立截图接口只返回 326x32 条带，和实时元数据 326x720 不一致；其真实消费者在 Light `930:36946` 与 Dark `930:37176` 的 390px Lab 截图均完整渲染，Results / Empty 可读且无重叠，因此以消费者场景完成视觉闭环，不把服务端截图异常误判为组件失败。
- 自适应修正：把并行链的 `Highlighted` 拆成明确 `Hover` 与 `Selected`；Empty 隐藏不相关 Action 并改为命令语义文案；Loading 改为搜索语义文案；Command Group 的 Title / Items 改为 Fill；Compact Palette 正式宽度从 360px 收敛为 326px，适配 390 视口并把 5 个裁切告警降为 0。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- P3 退出评估：PASS。P3.a-P3.d 全部 VERIFIED；Overlay、Elevation、Placement、内部滚动、焦点与操作层级的静态设计合同均已记录并通过 Light/Dark、1440/1024/390 组合验证。
- 回滚边界：正式根 `925:1792` / `928:1777` / `929:1990`，Verification `930:1977` / `930:2059`，六个 Lab section 与六个实例，以及资产框 `894:201` 高度变化作为一个回滚单元；只按精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达模态焦点锁、roving selection、上下键/Enter/Escape、快捷键冲突、异步过滤、内部滚动定位、screen reader announcement、Portal 和焦点返回；这些由未来 React 实现并验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 P3.d Figma API）；ADR `Not applicable`（Neutral / Status 与 Overlay 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P4 继续由同一台账追踪）。
- 新 `currentPointer`：`P4.a` Breadcrumb / Page Header / Detail Header。

### 2026-08-13 13:02 +0800 · P3.c CALENDAR / DATE PICKER / DATE RANGE PICKER VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 接管边界：正式 Date Input `642:21507` 继续作为输入触发器；旧单输入 Date Picker `255:79` 已是 `Legacy/CWGSYW/Component/Date Picker/Single`，有 1 个文档实例，保留且不迁移。未从旧前端或 Legacy 资产继承颜色、尺寸、间距或组件 API。
- 正式资产：Calendar Day `914:730`；Calendar `914:34402`；Date Picker `915:34881`；Date Range Picker `915:34882`；Wide Verification `915:35099`；Compact Verification `915:35525`。四类正式同名资产各唯一 1 份。
- Component API：Calendar Day 为 `State=Default|Hover|Today|Selected|Range Start|Range Middle|Range End|Disabled|Outside|Unavailable`，并暴露 `Day`；Calendar 为 `Selection=Single|Range|None` 并暴露 `Month`；Date Picker 与 Date Range Picker 均为 `State=Closed|Open|Disabled|Error`。日期算术、locale、首周日、min/max、不可选规则、解析、排序、焦点、键盘网格导航和 announcement 均是未来 React 运行时合同，不用 Figma 变体伪造。
- 颜色和状态：常规日历、Today、Selected、Range、Hover、Disabled 与 Outside 全部使用 Neutral；Error 只在输入验证边框使用 Danger。21 个星期标题容器已绑定 `bg/surface`，Dark 模式不再出现硬编码白块；未新增颜色族或错误语义变量。
- L0：PASS。最终统一审计覆盖 6 个正式/验证根与 6 个 Lab section，共 12 个根、1266 个去重节点、531 个 Text、506 个 Instance 与 809 个颜色绑定；硬编码颜色、远程颜色、Primitive 颜色直绑、未解析绑定、缺 Text Style、非 Inter、placeholder、未解析实例、491 个 Component Property 引用中的失效引用和几何裁切均为 0。
- L1：PASS。Day 的 10 个有限状态可辨；Calendar 的 Single / Range / None 可辨；两个 Picker 的 Closed / Open / Disabled / Error 可辨。Single Open 为原生 284px 单月，Range Open 为原生 580px 双月。
- L2：PASS。Wide `915:35099` 以三列组合 Single 与双月 Range；Compact `915:35525` 把起止 Date Input 纵向排列并使用单月 Range，不缩放桌面双月 Pattern。输入、月份导航、Today、Selected 和 Range 连续区协调。
- L3：PASS。六个 Integration Lab section 为 Light `917:17108` / `917:17471` / `917:17834`、Dark `917:17967` / `917:18330` / `917:18693`；对应实例 `917:17109` / `917:17472` / `917:17835` / `917:17968` / `917:18331` / `917:18694`。六个 section 已从会与早期内容重叠的 Auto 定位改为真实底部 + 16px 的 Absolute 定位，父 Lab 保留 40px 底部空间；Light/Dark 与 1440/1024/390 全部通过，无裁切、重叠或不可见文本。
- 最终截图：`/tmp/cwgsyw-figma-p3c/lab-light-1440.png`、`lab-light-1024.png`、`lab-light-390.png`、`lab-dark-1440.png`、`lab-dark-1024.png`、`lab-dark-390.png`。
- 并发对账：实时树发现 4 个延迟提交的封闭 P3.b 重复 section `907:33772` / `907:33855` / `907:33945` / `907:34035`。其内容与正式 section 相同且无独立消费者，已按精确 ID 删除；正式 P3.b section 保留为 `907:33246` / `907:33336` / `907:33426` / `907:33509` / `907:33599` / `907:33689`。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：四个正式组件根、两个 Verification、资产框 `894:201`、六个 Lab section 与六个 Pattern 实例作为一个回滚单元。仅按本条和 `/tmp` 台账中的精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达日期运算、时区、locale、输入解析、双月翻页同步、键盘网格导航、焦点返回、屏幕阅读器公告和 Popover 碰撞；这些由未来 React 实现与验证。当前没有待删除的 P3.b 正式 section。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 P3.c Figma API）；ADR `Not applicable`（Neutral / Status 与 Overlay 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P3.d 继续由同一台账追踪）。
- 新 `currentPointer`：`P3.d` Command Palette。

### 2026-08-13 15:05 +0800 · P3.b MENU ITEM / DROPDOWN MENU VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- Legacy 边界：旧固定四项 Dropdown `260:66` 有 4 个实例，已精确改名为 `Legacy/CWGSYW/Component/Dropdown Menu/Fixed Items`，不删除、不迁移旧消费者。正式 Menu Item 与 Dropdown Menu 同名资产各唯一 1 份。
- 正式资产：沿用 P3 资产框 `894:201`；Chevron Right `897:32470`；Menu Checkbox Set `898:32621`；Menu Radio Set `898:32626`；Trash `897:32481`；Menu Item Set `900:32915`；Dropdown Menu `903:33021`；Wide Verification `907:541`；Compact Verification `907:33141`。
- Component API：Menu Item 为 `Type=Default|Checkbox|Radio|Submenu|Destructive × State=Default|Hover|Selected|Disabled` 共 20 个合法变体，公开 Label、Shortcut、Show Shortcut、Leading / Trailing Icon Swap 与显隐属性。Dropdown Menu 使用 `Items Slot`，默认内容由 4 个正式 Menu Item 实例组成；设计最小宽度 288px，运行时可随内容增长。
- 颜色和视觉合同：Default / Hover / Selected / Disabled、背景、文本、边框、图标与 Focus 全部使用 Neutral；Danger 仅用于 Destructive。Dropdown 使用 `CWGSYW/Elevation/Sm`，没有新增颜色族或错误语义变量。
- 自适应修复：两次失败脚本均原子失败且无残留。把 Checkbox / Radio 从单一已选图形升级为 `Selection=Unchecked|Checked`；修复 combineAsVariants 统一 Instance Swap 默认值导致的类型图标错误；隐藏 Submenu 错误 Leading Search 并固定 Chevron Right；资产框扩展到容纳 Dropdown；Compact Verification 从 680px 固定高度收紧为 576px 内容节奏；六个 Lab section 使用真实底部 + 16px 的绝对定位，避免混合 Auto / Absolute Lab 根发生重叠。
- L0：PASS。最终统一审计覆盖 6 个正式/验证根、6 个 Lab section、326 个去重节点与 254 个可见 Solid Paint；硬编码颜色、远程颜色、Primitive 颜色直绑、未解析绑定、缺 Text Style、非 Inter、placeholder、未解析实例和几何越界均为 0。按正式源定义审计 117 个 Component Property 引用，失效引用为 0；嵌套 Instance 虚拟节点不作为外层组件属性断链。
- L1：PASS。20 个 Type × State Matrix 清晰；Checkbox / Radio 的 Selected 使用明确选择图形；Submenu 只显示右箭头；Destructive 使用 Danger，Disabled 回到 Neutral 弱态。Dropdown 单体无裁切、重叠或不可见内容。
- L2：PASS。Wide `907:541` 组合 Table Toolbar、Button 与 Dropdown；Compact `907:33141` 组合 Search Input、Button 与 Dropdown。Data / Management 与 Overlay / Destructive 的密度、层级和操作关系协调。
- L3：PASS。六个 Integration Lab section 为 Light `907:33246` / `907:33336` / `907:33426`、Dark `907:33509` / `907:33599` / `907:33689`；对应实例 `907:33247` / `907:33337` / `907:33427` / `907:33510` / `907:33600` / `907:33690`。1440 和 1024 使用原生 1000px Wide，390 使用原生 326px Compact 并置于 366px section，均不缩放。
- 最终截图：`/tmp/cwgsyw-figma-p3b/menu-item.png`、`dropdown.png`、`wide.png`、`compact.png`、`lab-light-1440.png`、`lab-light-1024.png`、`lab-light-390.png`、`lab-dark-1440.png`、`lab-dark-1024.png`、`lab-dark-390.png`。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 5/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：正式辅助图标、Menu Item Set、Dropdown Menu、两个 Verification、旧 Dropdown 精确重命名、资产框高度、六个 Lab 根、六个 P3.b section 与六个 Pattern 实例作为一个回滚单元。只允许按本条和 `/tmp` 台账中的精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达 roving focus、键盘上下导航、typeahead、Escape、点击外部关闭、Portal、碰撞翻转、Submenu 延迟、焦点返回和屏幕阅读器菜单语义；未来 React 重构必须实现并验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 P3.b Figma API）；ADR `Not applicable`（Neutral / Status 与 Overlay 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P3.c 继续由同一台账追踪）。
- 新 `currentPointer`：`P3.c` Calendar / Date Picker / Date Range Picker。

### 2026-08-13 14:10 +0800 · P3.a DIALOG / ALERTDIALOG / DRAWER / POPOVER / TOOLTIP VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- Legacy 边界：旧 Dialog `324:54` 有 25 个实例，旧 AlertDialog Set `329:65` 有 11 个实例；两者已分别重命名为 `Legacy/CWGSYW/Component/Dialog` 和 `Legacy/CWGSYW/Component/AlertDialog`，不删除、不迁移旧消费者。正式同名资产各唯一 1 份。
- 正式资产：P3.a 资产框 `894:201`；Dialog Set `894:1433`（Sm `894:202` / Md `894:854` / Lg `894:1399`）；AlertDialog Set `897:394`（四个 Size × Intent 变体 `897:238` / `897:283` / `897:324` / `897:357`）；Drawer Set `898:507`（6 个 Side × Size）；Popover Set `898:528`（4 个 Placement）；Tooltip Set `898:541`（4 个 Placement）；Wide Verification `900:32662`；Compact Verification `900:32769`。
- Component API：Dialog 提供 Size、Title、Description、Show Description / Close / Footer、Body Slot、Secondary / Primary Action Swap；AlertDialog 提供 `Size=Sm|Default × Intent=Default|Destructive`、Title、Description、Media Icon 与两项 Action Swap；Drawer 提供 `Side=Left|Right × Size=Sm|Md|Lg`、Header / Body Slot / Footer、Close 与两项 Action Swap；Popover 提供 Placement、Title、Content Slot、Show Arrow；Tooltip 提供 Placement、Content、Show Arrow，并在说明中记录 240px 推荐最大宽度。
- 依赖与颜色：所有正式资产复用新 Button `606:19247`、Close Icon `573:60`、Check Icon `573:57`、本地 Neutral / Status semantic variables、`overlay/scrim` `VariableID:404:17874` 与 Elevation Sm/Md/Lg；未新增颜色族。Danger 只用于 AlertDialog 的真实 Destructive Intent。
- 自适应修复：AlertDialog 四个变体从 220px 固定高度改为 148px 内容 Hug，清除操作区上方空白；资产框 `894:201` 从 3200px 扩展到 5362px，解除 Verification 被父级裁切导致的 1×1 截图；Wide Popover `900:32761` 下移至 `y=600`，不再覆盖 AlertDialog 操作区。Popover / Tooltip 箭头允许按 Placement 有意越出组件边界，其余几何越界为 0。
- L0：PASS。审计 7 个正式根、343 个源节点和 6 个 Lab section；硬编码颜色、远程颜色、Primitive 颜色直绑、未解析绑定、缺 Text Style、非 Inter、placeholder、未解析实例、属性断链和非预期几何越界均为 0；五类正式同名资产各唯一 1 份。
- L1：PASS。Dialog 三种 Size、AlertDialog 四种 Size × Intent、Drawer 六种 Side × Size、Popover / Tooltip 四向 Placement 均可辨。Light / Dark 下表面、正文、边框、阴影与 Status Danger 对比清晰。
- L2：PASS。Wide `900:32662` 在 Overlay Scrim 中组合 Dialog、Destructive AlertDialog、Right Drawer、Popover 与 Tooltip；Compact `900:32769` 组合 Sm Dialog、Sm Destructive AlertDialog、贴底 Right Drawer 与 Tooltip。叠层关系、操作区、关闭提示和移动 Sheet 语义协调。
- L3：PASS。六个 Integration Lab section 为 Light `903:32599` / `903:32675` / `903:32751`、Dark `903:32810` / `903:32886` / `903:32962`；对应实例 `903:32600` / `903:32676` / `903:32752` / `903:32811` / `903:32887` / `903:32963`。1440 居中使用 1000px Wide，1024 使用原生 1000px Wide 与 12px 边距，390 使用原生 366px Compact 与 12px 边距。
- 最终截图：`/tmp/cwgsyw-figma-p3a/dialog-formal.png`、`alertdialog-formal.png`、`drawer-formal.png`、`popover-formal.png`、`tooltip-formal.png`、`verification-wide.png`、`verification-compact.png`、`lab-light-1440.png`、`lab-light-1024.png`、`lab-light-390.png`、`lab-dark-1440.png`、`lab-dark-1024.png`、`lab-dark-390.png`。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：资产框 `894:201`、五个正式 Set、两个 Verification、两项 Legacy 重命名、六个 Lab 根、六个 P3.a section 与六个 Pattern 实例作为一个回滚单元。只允许按本条和 `/tmp` 台账中的精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达焦点锁定、Esc、点击外部关闭、Portal、z-index、滚动锁、碰撞翻转、延迟、hover/focus 联动、Drawer body 真实滚动和屏幕阅读器语义；未来 React 重构必须实现并验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 P3.a Figma API）；ADR `Not applicable`（Neutral / Status 和 Overlay 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P3.b 继续由本台账追踪）。
- 新 `currentPointer`：`P3.b` Menu Item / Dropdown Menu。

### 2026-08-13 12:55 +0800 · P2.e ALERT / TOAST / PROGRESS VERIFIED · P2 EXIT PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 正式资产：资产框 `855:13464`；Feedback Icon Set `855:13490`；Alert Set `856:16960`（8 个 Tone × Layout 变体）；Toast Set `859:193`（10 个 Tone × Layout 变体）；Linear Base `859:31908` 与 Circular Base `859:31984`（各 25 个 Tone × Value 变体）；公开 Progress `860:141`（Sm / Md / Lg）；Wide Verification `873:1708`；Compact Verification `873:1709`。旧 Alert `261:101`、Toast `261:102`、Progress `261:113` 及 12 个旧消费者均保留，不迁移、不删除。
- Component API：Alert 为 `Tone=Info|Success|Warning|Danger × Layout=Default|Compact`，Toast 为 `Tone=Neutral|Info|Success|Warning|Danger × Layout=Default|Compact`，两者暴露 Title、Description、Icon、Action Slot 与 Icon / Description / Action / Dismiss 显隐。Progress 公开 Size、Label、Percentage、显隐与 Base Swap；Base 提供 Linear / Circular、Tone 与 `Value=0|25|50|75|100`，任意百分比留给未来 React 运行时。
- 自适应修复：公开 Progress 三个 Size 的内部 Base `860:127` / `860:133` / `860:139` 从固定 360px 改为横向 Fill，Compact 326px 实例不再溢出；Wide Card `873:1730` 的 Body Slot 从默认占位替换为 Progress/Md。创建返回 ID 为 `878:23050`，Slot 当前物化 ID 为 `I873:1730;704:289;878:23056`，任务进度可见且随 440px 内容宽度伸缩。
- L0：PASS。审计 8 个正式根、432 个正式节点与 6 个 Lab section；硬编码颜色、远程颜色、Primitive 颜色直绑、未解析绑定、缺 Text Style、非 Inter、placeholder、未解析实例和几何越界均为 0。正式源组件 159 个 Component Property 引用全部有效；实例虚拟节点不归入源定义审计。
- L1：PASS。Alert、Toast、Linear / Circular Progress 与公开 Size API 的 Matrix 可辨；普通反馈使用 Neutral，Info / Success / Warning / Danger 只表达真实状态。Feedback Icon 默认值受 Figma Component Set 同名 Instance Swap 约束保持稳定 Info / Neutral，可继续手动替换。
- L2：PASS。Wide `873:1708` 将 Alert、Toast、Progress 与 Card 组合；Compact `873:1709` 将 Alert、Progress、三种 Toast 与 Metric Card 组合。修复后无裁切、重叠或不可见内容，移动端不缩放桌面 Pattern。
- L3：PASS。沿用六个 Integration Lab 根；新增 P2.e section Light `881:13952` / `881:14016` / `881:14080`、Dark `881:14136` / `881:14200` / `881:14264`，对应实例 `881:13953` / `881:14017` / `881:14081` / `881:14137` / `881:14201` / `881:14265`。1440 居中使用原生 1000px Wide；1024 使用原生 1000px Wide 与 12px 边距；390 使用原生 366px Compact 与 12px 边距。
- 最终截图：`/tmp/cwgsyw-figma-p2e/verification-wide-fixed.png`、`verification-compact-fixed.png`、`lab-light-1440.png`、`lab-light-1024.png`、`lab-light-390.png`、`lab-dark-1440.png`、`lab-dark-1024.png`、`lab-dark-390.png`。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- P2 退出评估：PASS。P2.a-P2.e 全部 `VERIFIED`；Data、Loading、Empty、Error、Selected、Disabled 与反馈状态均有正式资产和组合证据；Light/Dark 与 1440/1024/390 均通过。
- 回滚边界：正式 P2.e 资产根、Verification、Progress 修复节点、Wide Card slot 新实例、六个 Lab 根、六个 P2.e section 与六个 Pattern 实例作为一个回滚单元。只允许按本条和 `/tmp` 台账中的精确 ID 操作，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达 Toast 队列、自动消失、进度动画、任意百分比、异步状态、焦点迁移与屏幕阅读器 live announcement；未来 React 重构必须实现并验证。Figma 同名 Instance Swap 默认值限制使 Alert / Toast 默认图标不能按 Tone 自动切换，Tone 仍由 status surface / border 明确表达。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma API）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P3.a 继续由本台账追踪）。
- 新 `currentPointer`：`P3.a` Dialog / AlertDialog / Drawer / Popover / Tooltip。

### 2026-08-13 11:40 +0800 · P2.d EMPTY / LOADING / ERROR / SKELETON VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。沿用用户明确授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本；未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 正式资产：资产框 `812:930`；Skeleton Set `127:2`；Empty State Set `814:976`；Error State Set `815:13899`；Loading State Set `816:1006`。旧 Empty `261:107` 保留为 Legacy，既有消费者 `296:18763` 未迁移或删除。
- Component API：Skeleton 保持 `Type=Text|Avatar|Card|Table Row|List Item × State=Static|Loading`。Empty 暴露 Layout、Title、Description、Icon、Action Slot 及三项显隐；Error 暴露 Layout、Title、Description、Error Icon、Retry Slot 及三项显隐；Loading 暴露 `Type=Spinner|Skeleton × Layout=Default|Compact`、Content Slot、Label、Show Label。Spinner 继续复用 `575:5038`，普通 Loading 固定 Neutral。
- Verification：Data Wide `827:51`、Data Compact `827:52`、Dashboard Wide `827:53`、Dashboard Compact `827:54`、总 Wide `827:55`、总 Compact `827:56`。Data 与 Table / Button / Spinner 组合；Dashboard 与 Card / Metric Card / Button / Spinner 组合。
- L0：PASS。权威审计覆盖 13 个正式根、694 个正式源节点与 12 个 Lab 消费实例；按 Paint 级 `boundVariables` 读取后，硬编码颜色、远程颜色、未解析绑定、缺 Text Style、非 Inter、placeholder、失效属性引用和 Lab section 溢出均为 0。Skeleton 10 个变体；Empty / Error 各 2 个 Layout；Loading 4 个 Type × Layout 组合；九类同名正式资产各唯一 1 份。
- L1：PASS。Empty、Error、Loading 和 Skeleton 完整 Matrix 均可辨。Compact Loading Skeleton 从缩放的 480px List Item 改为原生 280px Text Loading 变体 `125:2`；新实例 `821:53`，旧裁切实例 `816:1002` 已删除并确认不可回读。
- L2：PASS。六个正式 Verification Component 为 Data Wide `827:51`、Data Compact `827:52`、Dashboard Wide `827:53`、Dashboard Compact `827:54`、总 Wide `827:55`、总 Compact `827:56`。Table 标题保持 Neutral 灰底和浅灰文字，Empty / Loading / Error 与 Card、Metric Card、Button、Spinner 的层级、密度和操作关系协调。常规 UI 只用 Neutral，Danger 只用于真实 Error 图标；Metric Card 的 Success / Warning 仍只表达真实状态。
- L3：PASS。沿用六个 Integration Lab 根 Light `716:7966` / `716:8191` / `716:8416`、Dark `716:8531` / `716:8756` / `716:8981`；新增 P2.d section `849:12654` / `850:12884` / `852:13114` / `854:13233` / `855:13491` / `856:13693`，并挂载 12 个正式 Data / Dashboard Verification 实例。1440 保持居中留白，1024 使用原生 1000px Pattern 与 12px 边距，390 使用原生 366px Pattern 与 12px 边距。
- 自适应修复：清除布局脚手架默认白 Fill；把 Data 三态从压缩横排改为原生尺寸换行；裁切旧 Table Verification 泄漏的 Supporting States；以正式 Toolbar + Data Table 替换被压缩的整套 Table Verification；恢复 Compact Metric Card 原生 180px 高度；把 Compact Dashboard 的 Empty / Error 从 159px 压缩横排改为两个 326px 正式实例纵向排列；为六个 Lab section 补足底部安全边界。两次写入因实时结构变化或 API 顺序错误原子失败，均无残留；最终 20 秒静默复核稳定。
- 最终截图：`/tmp/cwgsyw-figma-p2d/loading-matrix-fixed.png`、`verification-wide-final.png`、`verification-compact-final.png`、`lab-light-1440.png`、`lab-light-1024.png`、`lab-light-390.png`、`lab-dark-1440.png`、`lab-dark-1024.png`、`lab-dark-390.png`。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：正式资产框 `812:930`、正式 Set `127:2` / `814:976` / `815:13899` / `816:1006`、Verification `827:51`–`827:56`、六个 Lab 根、六个 P2.d section 和 12 个 Pattern 实例作为一个回滚单元。P2.d section 为 `849:12654` / `850:12884` / `852:13114` / `854:13233` / `855:13491` / `856:13693`；实例为 `849:12655` / `849:12801` / `850:12885` / `850:13031` / `852:13115` / `852:13187` / `854:13234` / `854:13380` / `855:13492` / `855:13638` / `856:13694` / `856:13766`。保留先前精确删除证据 `816:1002`、`827:28745`、`828:51`、`830:69`；禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达 Skeleton shimmer、异步阶段切换、retry 回调、超时、取消、焦点迁移和屏幕阅读器 live announcement；未来 React 重构必须实现并验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma API）；ADR `Not applicable`（Neutral / Status 架构未改变）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与当前前端继续隔离）；Follow-up documentation `Not applicable`（P2.e 继续由本台账追踪）。
- 新 `currentPointer`：`P2.e` Alert / Toast / Progress。

### 2026-08-13 10:33 +0800 · P2.c PAGINATION VERIFIED · LABEL CONTRACT RECOVERY

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户再次确认 P0 写入；沿用先前授权的无任务号 Figma 例外。本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确恢复账本，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 正式资产：资产根 `758:10565`；Chevron Previous `758:10566`；Chevron Next `758:10569`；Page Item Set `779:305`（14 个合法组合）；Items Default `785:295`；Items Compact `785:312`；Pagination Set `791:365`（Default / Compact）；Page Size Control `792:27989`；Jump Control `792:27993`；Wide Verification `796:338`（960×720）；Compact Verification `796:777`（326×400）。旧 Pagination `260:51` 保留为 Legacy，不迁移旧消费者。
- Variables：`pagination/item-size` `VariableID:776:290` 使用 Default / Compact 模式别名到 `control/height-md` / `control/height-sm`；`pagination/gap` `VariableID:776:291` 别名到 `space/2` / `space/1`。两者均有精确 Scope 与 WEB Code Syntax。常规分页、Current、Hover、Focused、Disabled 全部只使用 Neutral。
- Component API：Page Item 提供 `Type=Number|Previous|Next|Ellipsis` 与 `State=Default|Hover|Focused|Current|Disabled`；其中 Current 只适用于 Number，Ellipsis 只提供 Default，避免无业务意义组合。Number 暴露 `Label#799:0`。Pagination 提供 `Density=Default|Compact`、`Total Count`、`Show Total`、`Items Slot`、`Show Page Size`、`Show Jump`、`Current Page`、`Total Pages`。Previous / Next 使用正式 Chevron 图标，不再使用文本 `‹/›`。
- L0：PASS。资产根共 334 个节点；硬编码颜色、远程颜色、未解析变量、缺 Text Style、非 Inter、placeholder、页面级 loose variant、失效 Label 引用均为 0；有效可见非 Vector 几何溢出为 0。正式 Page Item 与 Pagination 同名 Set 各唯一 1 份。
- L1：PASS。Page Item 的 Default / Hover / Focused / Current / Disabled 可辨；Current 使用深 Neutral，Disabled 保持可读弱态。Default Pagination 正确渲染 `1 / 2 / 3 / … / 12`，Compact 正确渲染当前页 `3` 与“第 3 / 12 页”。
- L2：PASS。Pagination 与 Table、Toolbar、Search、Empty、Loading、Page Size、Jump 在 Light / Dark 下协调；Default 信息完整，Compact 只保留当前页信息与前后导航，不缩放桌面控件。
- L3：PASS。沿用六个 Lab 根 `716:7966` / `716:8191` / `716:8416` / `716:8531` / `716:8756` / `716:8981`。Data / Management 六场景为 `745:13084` / `745:13229` / `745:13374` / `745:13410` / `745:13555` / `745:13700`；Detail / Related Records 六场景为 `754:11128` / `754:11274` / `754:11420` / `754:11457` / `754:11603` / `754:11749`。两场景 × 三视口 × 两模式共 12 个正式 Verification 消费者；1440/1024 使用 960px Wide，390 使用 326px Compact。
- 自适应修复：live 页面树发现延迟写入的完整 P2.c 资产后停止重复创建并接管。一次完整矩阵尝试产生 6 个页面级孤儿，已按精确 ID `797:28212` / `797:28214` / `797:28216` / `797:28218` / `797:28220` / `797:28222` 删除；页面树 loose variant 为 0，直接 ID 查询仍可能返回 tombstone，禁止重新挂载。随后修复失败尝试造成的 Label 引用回落：在原 Set 上把失效 `Label#779:0` 重建为 `Label#799:0`，并恢复 Items 源的 `1/2/3/12` 与 Compact `3` 覆盖。
- 修改 Node IDs：`779:305`、`777:290`、`777:292`、`777:294`、`777:296`、`777:298`、`785:299`、`785:301`、`785:303`、`785:307`、`785:316`、`791:359`；精确删除/tombstone IDs：`797:28212`、`797:28214`、`797:28216`、`797:28218`、`797:28220`、`797:28222`。
- 最终截图：`/tmp/cwgsyw-figma-p2c/page-item.png`、`pagination-set-final.png`、`wide.png`、`compact.png`、`data-light-1024-final.png`、`data-dark-390-final.png`、`detail-dark-1024.png`、`detail-light-390.png`。颜色、层级、状态、对齐、Typography、协调、平衡、响应与 A11y 均不低于 4/5。
- 回滚边界：正式资产根 `758:10565` 及其 10 个顶层资产、六个 Lab 根、12 个场景和 12 个 Verification 消费者作为一个回滚单元；Label 合同当前唯一有效键为 `Label#799:0`。只允许使用台账中的精确 ID，禁止名称前缀清理和 Desktop Undo。
- 遗留风险：静态 Figma 不表达真实分页计算、边界禁用逻辑、键盘导航、焦点转移、页码输入校验、异步加载和屏幕阅读器 announcement；未来 React 重构必须实现并验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma Pagination API）；ADR `Not applicable`（未改变 Neutral / Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P2.d 继续由本台账追踪）。
- 新 `currentPointer`：`P2.d` Empty / Loading / Error / Skeleton。

### 2026-08-13 10:13 +0800 · P2.b TABLE FAMILY VERIFIED · AUTHORITATIVE RECONCILIATION

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已授权本次无任务号直接修改 Figma；本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确回滚账本，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- 正式资产：资产根 `729:102`；Header Cell Set `730:166`（9 variants）；Cell Set `731:142`（3 variants）；Row Set `731:204`（4 variants）；Toolbar `731:26400`；Table Set `736:27003`（6 variants）；Wide Verification `739:340`（960×648）；Compact Verification `739:770`（326×322）。旧 Table `144:2` 保留消费者并改名为 `Legacy/CWGSYW/Component/Table/6 Variants`，未删除。
- Variables：`table/row-height-compact` `VariableID:729:100` = 36；`table/row-height-default` `VariableID:729:101` = 44。常规 Table 表面、文字和交互只使用 Neutral；本轮没有把 Status 色用于非状态内容。
- Component API：Header Cell 暴露 Align / Sort / Label / Show Checkbox；Cell 暴露 Align / Content Slot；Row 暴露 State / Show Checkbox / Cells Slot；Toolbar 暴露 Show Search / Show Filters / Show Actions / Filters Slot / Actions Slot；Table 使用 `Density=Compact|Default × State=Data|Empty|Loading`，并暴露 Header / Rows / State Content Slots。
- 复用资产：Search `642:21431`、Checkbox `661:21997`。Row 四个状态统一为四列、960px；Empty / Loading 先使用 Table 的中性 State Content Slot 占位，不冒充后续 P2.d 的正式 Empty / Skeleton 家族。
- L0：PASS。最终正式 Set + Wide + Compact 共 370 个节点；硬编码颜色、远程颜色、Primitive 颜色直绑、缺 Text Style、非 Inter、未解析 Instance、placeholder 均为 0。
- L1：PASS。Header Cell 9 variants、Cell 3 variants、Row 4 variants、Table 6 variants 的矩阵和属性可辨；灰色 Header、偏白灰标题、Header Checkbox 与排序箭头均清晰可见。
- L2：PASS。Table、Header、Row、Cell、Toolbar、Search、Filter、Create、Empty 与 Loading 在 Light / Dark 下协调；Data / Empty / Loading 以及 Row Default / Hover / Selected / Disabled 均可辨。
- L3：PASS。沿用 P2.a 的六个 Integration Lab 根。Data / Management Light 场景为 `745:13084` / `745:13229` / `745:13374`，Dark 为 `745:13410` / `745:13555` / `745:13700`；Detail / Drawer 的 Related Records Light 场景为 `754:11128` / `754:11274` / `754:11420`，Dark 为 `754:11457` / `754:11603` / `754:11749`。12 个 Verification 实例均引用正式 Wide / Compact；1440/1024 使用 960px Wide，390 使用 326px Compact；Light 根模式 `350:1`，Dark 根模式 `350:2`。
- 响应策略：390 使用独立 Compact 移动列表 Pattern，不把 960px 桌面 Table 按比例压缩。最终截图未发现裁字、缺列或重叠。
- 几何审计：PASS。Compact Row 的 Cells Slot 已改为随实例高度 FILL，Header Checkbox 恢复 36px 组件高度；资产和 12 个 Lab 消费根的真实几何溢出均为 0。1024 根使用 32px 页面边距形成原生 960px 内容区，390 不缩放桌面 Table。
- 权威对账：外部延迟写入曾重组早期 Table Set 并并发产生第二套 `743:*` Lab。页面树唯一正式 Table Set 稳定为 `736:27003`；早期 Set `736:168` 当前 `parent=null`、页面消费者为 0。六个重复 `743:*` Lab 根已按精确 ID 删除，最终只保留 P2.a 六根上的 12 个正式消费者；不得重新挂载 tombstone 或依赖 Desktop Undo。
- 回滚边界：正式资产 `729:102` / `730:166` / `731:142` / `731:204` / `731:26400` / `736:27003` / `739:340` / `739:770`，Data 六场景与 Related Records 六场景及其 12 个 Verification 实例作为一个回滚单元；只允许按精确 ID 处理，禁止名称前缀清理和 Desktop Undo。
- 最终截图：`/tmp/cwgsyw-figma-p2b/formal-table-4col.png`、`verification-wide-final.png`、`verification-compact-final.png`、`merged-light-1024.png`、`merged-light-390.png`、`merged-dark-1024.png`、`merged-dark-390.png`。颜色、层级、状态、对齐、Typography、协调和响应均不低于 4/5。
- 遗留风险：静态 Figma 不表达真实排序、分页、行选择回调、键盘导航、异步加载和屏幕阅读器 announcement；这些由未来 React 重构实现。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma Table API）；ADR `Not applicable`（未改变 Neutral / Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P2.c 继续由本台账追踪）。
- 新 `currentPointer`：`P2.c` Pagination。

### 2026-08-13 04:18 +0800 · P2.a CARD / METRIC CARD VERIFIED · AUTHORITATIVE RECONCILIATION

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已授权本次无任务号直接修改 Figma；本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确回滚账本，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- Card：正式 Component Set `704:363`，9 个 `Variant=Static|Interactive|Selected × Padding=Sm|Md|Lg` 变体；连接 Title、Description、Header Action、Body/Footer Slot 及显隐属性。旧 Card `141:2` 保留消费者。
- Metric Card：正式 Component Set `713:25370`，10 个 `Tone=Neutral|Info|Success|Warning|Danger × State=Default|Hover` 变体；Trend Direction 使用独立 Component Set `713:25363` 的 Up / Down / Flat Instance Swap，不扩张第三个 Variant 轴。连接 Label、Value、Unit、Description、Trend Label、Icon、Show Icon、Show Trend、Trend Direction。常规表面和交互全部为 Neutral，Status 色只作用于真实趋势语义。
- Variables：`CWGSYW / Metric Context` `VariableCollectionId:707:163` 提供 Neutral / Info / Success / Warning / Danger 五个模式；`metric/icon-bg` `VariableID:707:164` 与 `metric/accent-fg` `VariableID:707:165` 分别映射到本地语义色。10 个 Metric 变体均显式选择对应模式，无 Primitive 颜色直绑。
- 资产对账：外部延迟写入曾反复把 30 变体重复 Set `713:25544`、旧 Wide `717:406`、旧 Compact `717:468` 重新挂载并把正确资产改名为 Legacy。经 30 秒静默窗口、两轮消费者 gate 和最终原子切换，正确 `713:25370` / `713:25545` / `714:407` 已恢复正式名称；六个 Lab 根全部切回正式 Verification；重复三根按精确 ID 删除。最终 Card、Metric Card、Trend Direction 同名正式 Set 各 1 个。
- L0：PASS。正式资产审计 7 个根、629 个节点、180 个 Text、199 个 Instance、357 个颜色绑定；硬编码颜色、远程颜色、Primitive 颜色直绑、未解析变量/实例、缺 Text Style、非 Inter、placeholder、真实裁切和 tombstone 引用均为 0。Card 9 变体、Metric Card 10 变体、Trend Direction 3 变体；10 个嵌套 Trend Direction 实例全部指向正式 Set `713:25363`。
- L1：PASS。Card 9 变体、Metric Card 10 变体和 Trend Direction 3 变体 Matrix 可读；Default/Hover、Up/Down/Flat 与五种 Tone 无重叠、白条或不可见内容。Wide `713:25545`、Compact `714:407` 均由正式组件实例组成。
- L2 / L3：PASS。六个 Lab 根为 Light `716:7966` / `716:8191` / `716:8416` 与 Dark `716:8531` / `716:8756` / `716:8981`，覆盖 Dashboard / Feedback 与 Detail / Drawer、1440/1024/390。1440/1024 使用 Wide，390 使用 Compact；最终共审计 1260 个节点、346 个 Text、470 个 Instance、714 个颜色绑定，全部门禁为 0；正式引用为 Wide 8、Compact 4、Card 32、Metric 32、Trend 30。
- 最终截图：`/tmp/p2a-wide-final.png`、`/tmp/p2a-compact-final.png`、`/tmp/p2a-light-1440-final-v2.png`、`/tmp/p2a-light-1024-final-v2.png`、`/tmp/p2a-light-390-final-v2.png`、`/tmp/p2a-dark-1440-final-v2.png`、`/tmp/p2a-dark-1024-final-v2.png`、`/tmp/p2a-dark-390-final-v2.png`。
- 自适应调整：清除正式 Wide Verification 两个默认白色结构 Fill；删除零外部消费者的并发重复资产；把旧 30 变体消费者迁移到 10 变体 + Trend Direction Instance Swap API；检测到外部延迟提交后采用静默窗口和原子消费者 gate，最终恢复六个 Lab 的正式 Wide / Compact 链接。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：正式资产 `704:363` / `713:25363` / `713:25370`、Verification `713:25545` / `714:407`、六个 Lab 根与最终 12 个 `725:*` 链接实例均已写入 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`；精确删除根为 `713:25544` / `717:406` / `717:468`，另含前序零消费者重复根 `708:597` / `712:163`。禁止名称前缀清理，不依赖 Figma Desktop Undo。
- 遗留风险：静态 Figma 不表达点击、键盘 Focus、异步指标刷新和屏幕阅读器 announcement；这些由未来 React 重构实现。Figma 外部协作者若再次执行旧 P2.a 脚本，可能重新挂载 30 变体重复资产；后续恢复必须先以页面树和消费者 gate 为准，不可仅信缓存对象。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma 组件 API）；ADR `Not applicable`（未改变 Neutral / Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P2.b 继续由本台账追踪）。
- 新 `currentPointer`：`P2.b` Table / Header Cell / Row / Cell / Toolbar。

### 2026-08-13 02:54 +0800 · P1.f TABS / BADGE / CHIP / AVATAR VERIFIED · P1 EXIT PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已授权本次无任务号直接修改 Figma；本轮范围仅为 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确回滚账本，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- Tabs：保留正式 Component Set `114:2` 的 16 个变体并改为动态 Hug 内容；Label Row 不再裁切，Indicator 填满可用宽度；16 个嵌套 Badge 实例迁移到正式 Badge。Tabs/List `677:63` 保留 SLOT，默认内容覆盖 Selected / Default / Disabled。
- Badge 与 Status Badge：新增正式 Badge `682:23779`，10 个 `Tone × Size` 变体，连接 `Label`、`Show Icon`、`Icon`；Status Badge `121:2` 保留 `Status` 业务语义轴。旧 Badge `391:135` 保留为 Legacy。
- Chip：新增 Chip Base `682:23911`，20 个 `Tone × State` 变体；公开 Chip `682:23930` 使用 2 个 Size 变体并暴露 Base。旧 Chip `390:155` 保留为 Legacy。
- Avatar：新增 Avatar Status `682:23937`；Avatar `682:24092` 为 9 个 `Type=Initials|Icon|Image × Size=Sm|Md|Lg` 变体，连接 `Initials`、`Icon`、`Image`、`Show Status`，并暴露嵌套 Status Tone。辅助资产为 X `682:23795`、User `683:13600`、Image Placeholder `682:23931`；旧 Avatar `391:142` 保留为 Legacy。
- 并发资产对账：live 页面树发现另一执行链遗留同名 Badge `680:188`、Chip Base `682:23758`、Chip `682:23790`、Avatar `682:24028`、Avatar Status `682:23810` 及其 User / Image helper。全文件消费者审计确认这些消费者为 0 或完全封闭在旧重复子树；已按精确根 ID 删除 `680:188`、`682:23758`、`682:23790`、`682:23798`、`682:23801`、`682:23810`、`682:24028`。删除后 Badge、Chip Base、Chip、Avatar、Avatar Status 同名正式 Set 各只剩 1 个，六个 Lab 根未解析实例仍为 0。
- L0：PASS。最终审计 18 个根、394 个节点、101 个 Text、135 个 Instance、334 个颜色绑定、32 个公共属性定义；硬编码颜色、远程颜色、Primitive 颜色直绑、未解析实例、缺 Text Style、非 Inter、placeholder、实际裁切均为 0。几何门禁仅把 `clipsContent=true` 父层下的越界视为真实裁切，允许非裁切 Badge 文本与 Icon 路径合法外展。
- L1：PASS。Wide `684:179` 与 Compact `684:326` 显示 Tabs、Badge、Status Badge、Chip、Avatar 的关键状态；Selected / Disabled、Neutral 与真实 Status 色清晰，无不可见文字、裁切或重叠。
- L2 / L3：PASS。六个 Lab 根为 Light `686:6414` / `686:6707` / `686:6903` 与 Dark `686:7152` / `686:7348` / `686:7544`，覆盖 1440/1024/390；每个根包含 Data / Management 与 Detail / Drawer，均由正式资产实例组成。
- 最终截图：`/tmp/p1f-light-1440-final.png`、`/tmp/p1f-light-1024-final.png`、`/tmp/p1f-light-390-final.png`、`/tmp/p1f-dark-1440-final.png`、`/tmp/p1f-dark-1024-final.png`、`/tmp/p1f-dark-390-final.png`。
- 自适应调整：4 类。Tabs 全变体改为 Hug 并修复 Indicator / Label Row；Tabs 内 16 个 Badge 迁移正式资产；清除 Dark 验证框 10 个默认白 Fill（`684:181`、`684:235`、`684:257`、`684:274`、`684:310`、`684:328`、`684:350`、`684:371`、`684:388`、`684:418`）；重新提交六个 Lab 根的 460 个 TEXT / BOOLEAN 属性值，消除 Figma Clone Cache 导致的中文标签截断。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 5/5；Typography 5/5；协调 5/5；平衡 5/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- P1 退出评估：PASS。P1.a-P1.f 全部 `VERIFIED`，依赖顺序、组件 API、Neutral / Status 边界、L0-L3、Light / Dark、1440/1024/390 证据齐全；P2 可以开始。
- 回滚边界：精确创建根为 Badge `682:23779`、X `682:23795`、Chip Base `682:23911`、Chip `682:23930`、Avatar Image Placeholder `682:23931`、Avatar Status `682:23937`、Avatar `682:24092`、User `683:13600`、Verification `684:179` / `684:326`、六个 Lab 根；精确修改根为 Tabs `114:2`、Tabs/List `677:63`、Status Badge `121:2` 与上述 10 个验证框；精确删除的无消费者重复根为 `680:188`、`682:23758`、`682:23790`、`682:23798`、`682:23801`、`682:23810`、`682:24028`。不得依赖名称前缀清理或 Figma Desktop Undo。
- 遗留风险：静态 Figma 不表达 Tabs 键盘导航、Chip 删除事件、Avatar 图片加载失败和 Status announcement；这些由未来 React 重构实现。Figma 组件 API 与视觉合同已完整。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma 组件 API）；ADR `Not applicable`（未改变 Neutral / Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P2 继续由本台账追踪）。
- P2 Checklist：`P2.a` Card / Metric Card -> `P2.b` Table / Header Cell / Row / Cell / Toolbar -> `P2.c` Pagination -> `P2.d` Skeleton / Loading / Empty / Error -> `P2.e` Alert / Toast / Progress。每项继续执行 L0-L3、Light/Dark 与 1440/1024/390 闭环。
- P2 退出条件：Data、Loading、Empty、Error、Selected、Disabled 等组合状态在 Data / Management、Dashboard / Feedback 与相关代表页面中协调；常规 UI 仍只使用 Neutral，真实状态才使用 Status；所有资产无硬编码/远程/Primitive 颜色直绑、断链实例、缺 Style、裁切或 placeholder。
- 新 `currentPointer`：`P2.a` Card / Metric Card。

### 2026-08-13 02:26 +0800 · P1.e FIELD / CHECKBOX / RADIO / SWITCH AUTHORITATIVE RECONCILIATION VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已授权本次无任务号直接修改 Figma；本轮只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 与本地状态/回滚台账，未修改 React、配置、依赖、Git、Linear、Notion 或部署状态。
- Legacy 边界：旧 Field `336:209`、Checkbox `252:61`、Radio `252:71`、Switch `252:84` 均保留，不迁移旧消费者。旧 Radio / Switch 精确改名为 `Legacy/CWGSYW/Component/Radio/3 Variants`、`Legacy/CWGSYW/Component/Switch/3 Variants`；Selection 与交互 State 不再混在同一轴。
- 权威资产对账：live Figma 页面树确认正式 Checkbox 为 `661:21997`、Radio 为 `663:471`。早期草稿根 `658:422`、`663:425` 的外部实例消费者均为 0，已按精确 ID 删除；删除后页面树 ID 命中 0，同名正式 Component Set 各仅 1 个。直接 ID 查询可能返回 tombstone，不作为资产仍挂载的证据。
- Checkbox：正式 Component Set `661:21997`，15 个 `Selection=Unchecked|Checked|Indeterminate × State=Default|Hover|Focused|Error|Disabled` 变体；公共属性 `Label`、`Show Label`，显隐与文字属性分别连接 Wrapper/Text 子层。
- Radio：正式 Component Set `663:471`，10 个 `Selection=Unchecked|Checked × State=Default|Hover|Focused|Error|Disabled` 变体；公共属性 `Label`、`Show Label`，圆形 Indicator、Checked 中心圆点、Neutral Focus ring、Danger 仅用于 Error。
- Switch：正式 Component Set `663:542`，16 个 `Selection=Off|On × Size=Sm|Md × State=Default|Hover|Focused|Disabled` 变体；Disabled 保留 On/Off 位置语义，Neutral track / thumb 与明确 Focus ring。
- Field：正式 Component Set `665:432`，`State=Default|Error|Disabled`；公共属性 `Label`、`Required`、`Helper Text`、`Show Helper`、`Error Text`、`Show Error`、`Control`。默认 Control 为正式 Input Md `625:75`，Error / Disabled 精确驱动嵌套 Input Base；Error Text 与 Helper Text 分离，Field 不复制 Focused / Open。
- L0：PASS。正式四组件共 208 个节点；连同 Wide/Compact 与 Overlay Wide/Compact Verification 共 476 个节点。硬编码颜色、远程颜色、Primitive 颜色直绑、未解析实例、缺 Text Style、非 Inter、placeholder、几何越界全部为 0。
- L1：PASS。Checkbox、Radio、Switch、Field 的完整 Matrix 均可见；Selection、Focused、Error、Disabled 和 Sm / Md 比例清楚，无裁切或重叠。
- L2：PASS。正式 Wide `668:22490`、Compact `668:22647`、Overlay Wide `669:22942`、Overlay Compact `669:23045` 全部由正式资产实例构成；326px Compact 保持单列节奏，Dialog 与底层控件在 Neutral scrim 下层级清晰。
- L3：PASS。六个 Lab 根为 Light `671:5181` / `671:5548` / `671:5746` 与 Dark `671:5958` / `671:6156` / `671:6354`，覆盖 1440/1024/390；每个根包含 Form / Settings 与 Overlay / Dialog 两类场景，均无裁切、溢出或未解析实例。
- 最终截图：`/tmp/cwgsyw-figma-p1e/1440-light-final.png`、`1024-light-final.png`、`390-light-final.png`、`1440-dark-final.png`、`1024-dark-final.png`、`390-dark-final.png`；源 Matrix 与 Verification 截图为 `/tmp/p1e-checkbox.png`、`/tmp/p1e-radio.png`、`/tmp/p1e-switch.png`、`/tmp/p1e-field.png`、`/tmp/p1e-wide.png`、`/tmp/p1e-compact.png`。
- 自适应调整：3 次。清除 8 个 Verification 结构 Auto Layout 的默认白色 Fill，消除 Dark 白块；把 12 个场景说明改为容器宽度自动换行，修复 390 裁切；桌面实例居中并恢复 Scene 标题全宽左对齐，改善 1440/1024 页面平衡。未新增普通 UI 色系，Danger 仍只用于真实 Error。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 5/5；Typography 5/5；协调 5/5；平衡 5/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：本轮新增四个 Verification Component、六个 Lab 根及其子树，删除两个无消费者草稿根，并修改 8 个结构 Fill 与 24 个场景文本/容器节点；全部精确 ID 已写入 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`。禁止名称前缀清理，不依赖 Figma Desktop Undo。
- 遗留风险：静态 Figma 不表达键盘导航、真实 focus-visible 触发、Radio Group 互斥、Switch announcement 和 Field aria-describedby；这些由未来 React 重构实现并验证。当前 Figma API 与视觉合同已完整。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma 组件 API）；ADR `Not applicable`（未改变 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P1.f 继续由本台账追踪）。
- 新 `currentPointer`：`P1.f` Tabs / Badge / Chip / Avatar。

### 2026-08-13 · POST-P1.d DUPLICATE VERIFICATION CLEANUP PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。本增量只清理误建验证资产并更新本地台账；未修改正式 Component、Variables、React、Git、Linear、Notion 或部署状态。
- 删除前回读确认验证 Component `654:96` 位于 `CWGSYW / Component / Select` 页面，其五个直接子实例 `654:97`、`654:129`、`654:150`、`654:183`、`654:203` 仅引用已删除重复资产。
- 已按精确根 ID 删除 `654:96`，并记录工具返回的全部派生删除 Node ID；未按名称或前缀批量删除，不依赖 Figma Desktop Undo。
- 删除后页面树回读：`654:96` 与同名 `CWGSYW/Verification/Select Combobox Behavior` 命中 0。Figma 的直接 ID 查询仍可返回 `parent=null` tombstone，不能视为页面或 Assets 中的可用节点。
- 正式 P1.d 资产保持挂载：Select Base `639:97`、Select `641:141`、Combobox Base `642:135`、Combobox `642:253`、Search `642:21431`、Date Input `642:21507`。
- 误建重复根 `648:188`、`642:21508`、`650:7300`、`650:138` 均保持 `parent=null`，没有重新挂载。
- 验证结论：清理 `PASS`；`P1.d` 保持 `VERIFIED`，既有 L0-L3 与 Light/Dark、1440/1024/390 证据不变。
- 回滚边界：本轮只删除 `654:96` 及其派生子树；不恢复该验证资产，因为其消费者目标是误建重复资产。
- Documentation Impact Assessment：PRD/功能需求、ADR、API/数据模型/迁移/安全/运维文档、Current System Baseline 均 `Not applicable`（仅清理非正式验证资产）；Follow-up documentation `Not applicable`（继续由本台账跟踪）。
- 新 `currentPointer`：保持 `P1.e` Field / Checkbox / Radio / Switch。

### 2026-08-13 02:15 +0800 · P1.d SELECT / COMBOBOX / SEARCH / DATE INPUT VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。本轮仅修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确回滚账本；未修改 React、配置、依赖、Git、部署、Linear 或 Notion。
- Legacy 边界：原 Select `95:66`、Combobox `273:129`、Search Input `255:75`、Date Picker `255:79` 保留消费者并改名到 `Legacy/CWGSYW/...`；不删除、不批量迁移。
- 正式图标：新增 Chevron Up `638:51` 与 Calendar `638:53`，均绑定正式 `icon/context`；Closed 使用 Chevron Down `573:67`，Open 固定使用 Chevron Up，28 个 Select / Combobox 变体方向回读全部匹配。
- 正式 Select：Base `639:97` 为 14 个 `State=Default|Hover|Focused|Open|Error|Disabled|Loading × Content=Placeholder|Value` 变体；公开资产 `641:141` 仅保留 3 个 `Size=Sm|Md|Lg`。支持 Placeholder、Value、Leading Icon、Clear、Loading、Chevron 显隐；Loading 固定复用正式 Spinner。
- 正式 Combobox：Base `642:135` 与公开资产 `642:253` 使用相同状态、内容和 Size 合同；默认文案调整为可搜索选择语义，Open/Loading/Error 在 Light/Dark 下可辨。
- Search / Date Input：`642:21431`、`642:21507` 直接嵌套正式 Input Base，分别固定正式 Search `573:54` 与 Calendar `638:53`，不再使用 `⌕` 文字符号或私有图标。
- L0：PASS。审计 640 个节点、453 个可见 Solid Paint；硬编码颜色、远程颜色、Primitive 直绑、未解析实例、缺 Text Style、非 Inter、placeholder 和几何越界均为 0。
- L1：PASS。四个组件均覆盖 Sm/Md/Lg；Select / Combobox 覆盖 7 State × 2 Content；Value 与 Placeholder 互斥；Closed/Open Chevron、Clear 与 Spinner 状态回读通过。
- L2：PASS。Wide Verification `646:244` 与 Compact `646:21501` 全部由正式资产实例构成，覆盖 Form / Settings、Data / Management 和 Supporting States 三组组合。
- L3：PASS。12 个 Lab 实例进入 Form / Settings 与 Detail / Drawer 两个场景族，覆盖 Light/Dark 和 1440/1024/390；所有实例位于父场景边界内，无裁切或重叠。
- 自适应修正：视觉闭环发现 Select / Combobox 的 `Show Loading` 默认值被克隆为 true，导致普通状态出现 Spinner；已改为 false，`State=Loading` 仍固定显示 Spinner。Compact 暗色截图确认 Search、Date、Open、Error 均清晰。
- 并发对账：发现另一执行链创建隔离的重复 Select `642:21508` / `648:188` 与 Combobox `650:138` / `650:7300`。删除前外部消费者均为 0，已从所有页面树和 Assets 遍历中移除；Figma 直接 ID 查询仍返回 `parent=null` 的不可见对象，重复 `remove()` 不改变该状态。四个对象不是可放置的正式资产，不得依赖名称前缀或 Desktop Undo 继续清理。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：正式图标、四个组件资产、两个 Verification、12 个 Lab 实例及四个 Legacy 重命名的精确 ID 已写入 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`；不依赖 Desktop Undo。
- 遗留风险：下拉面板、Option、Empty 和多选组合归入后续 Menu / Dropdown；Date Picker 面板归入 P3 Calendar / Date Picker。本步只锁定输入触发器 API。并发对账产生的四个 `parent=null` 对象仅能通过直接 ID 查询，不在页面/Assets 中；后续不得把它们重新挂回页面。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma API）；ADR `Not applicable`（未改变 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P1.e 继续由本台账追踪）。
- 新 `currentPointer`：`P1.e` Field / Checkbox / Radio / Switch。

### 2026-08-13 01:26 +0800 · P1.b AUTHORITATIVE ASSET RECONCILIATION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。本轮仅对 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 和本地状态/回滚台账做对账与精确清理；未修改 React、配置、依赖、Git、部署、Linear 或 Notion。
- 事实冲突处理：磁盘台账已确认 P1.b / P1.c `VERIFIED` 且 `currentPointer=P1.d`，但文件中另有未入账的 `P1.b / Button Workbench` `611:19291`，内含第二套同名 Button / Icon Button 和 Public Matrix。按“STATUS 为状态源、不得重做 VERIFIED、不得保留同名重复资产”处理。
- 删除门禁：Workbench 相关 138 个实例消费者全部封闭在 `611:19291` 内；18 个试验变量的 141 个绑定也全部位于 Workbench 内；两项审计的外部消费者均为 0。正式 Button / Icon Button、12 个 Lab 链接和 `CWGSYW / Icon Context` 均未引用试验资产。
- 精确清理：删除 Workbench 根 `611:19291` 及其全部子节点，包括重复 Button Base `620:659`、Button `624:597`、Icon Button `624:20424`、Public Matrix `625:20581`。删除 18 个仅供该 Workbench 使用的 `button/*`、`text/context`、`button/context-*` 变量，以及 `CWGSYW / Text Context` `VariableCollectionId:613:51`、`CWGSYW / Button Size Context` `VariableCollectionId:614:20598`。
- 保留并复核：正式 Button Base `605:494` 仍为 25 变体；Button `606:19247` 仍为 3 个 Size；Icon Button Base `610:19295` 仍为 25 变体；Icon Button `610:19314` 仍为 3 个 Size；Legacy `6:21409` 保留 400 变体。`CWGSYW / Icon Context` `VariableCollectionId:612:51` 及 `VariableID:612:52` 保留。
- 删除后 L0：PASS。精确 Node ID 回读不存在；本地变量/集合清单中已删除变量和集合命中 0；同名正式 Button / Icon Button Component Set 各 1 个；全文件未解析实例 0。本地变量真实数量恢复为 188，集合 6。
- L1 / L2 / L3：既有 P1.b VERIFIED 证据继续有效。被删除资产从未进入正式 Matrix、Verification Component 或 Lab；正式资产与所有既有 Lab 链接未受影响，因此不重跑无关截图。
- 自适应修正记录：未入账 Workbench 的 Loading Icon Button 曾暴露普通 Icon + Spinner；已在隔离区验证根因，但最终按权威状态清理整组重复资产，不把试验 API 合并进正式库。
- 回滚边界：本轮清理是删除无外部消费者的未入账重复资产；不依赖 Figma Desktop Undo。恢复它们需要按本条精确变量和节点定义重建，不能覆盖正式资产。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（未改变锁定设计合同）；ADR `Not applicable`（未改变 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（只恢复权威 Figma 状态）；Follow-up documentation `Not applicable`（P1.d 继续由本台账追踪）。
- 新 `currentPointer`：保持 `P1.d` Select / Combobox / Search / Date Input。

### 2026-08-13 01:20 +0800 · P1.c INPUT / TEXTAREA VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。授权边界仍只覆盖 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确回滚账本；未修改 React、配置、依赖、Git、部署、Linear 或 Notion。
- Legacy 边界：原 Input `85:18396` 保留 18 个变体并改名为 `Legacy/CWGSYW/Component/Input/18 Variants`；原 Textarea `255:73` 改名为 `Legacy/CWGSYW/Component/Textarea/Single`。已知 4 个 Input / Field 消费与 1 个 Textarea 文档实例保持链接，不删除、不批量迁移。
- 正式 Input：Base Component Set `624:20498`，12 个 `State=Default|Hover|Focused|Error|Disabled|Loading × Content=Placeholder|Value` 变体；公开 Component Set `625:105` 仅有 3 个 `Size=Sm|Md|Lg` 变体。公开实例暴露嵌套 Base，提供 Placeholder、Value、前后 Icon 显隐与 Instance Swap、Clear、Loading、State 和 Content。
- 正式 Textarea：Base Component Set `625:21935`，同样 12 个 State × Content 变体；公开 Component Set `626:182` 为 3 个 Size 变体。Sm/Md/Lg 最小高度绑定 `textarea/min-height-sm|md|lg`：`VariableID:622:54`、`VariableID:622:55`、`VariableID:622:56`，值为 80/96/120。Resize 合同为 None / Vertical，仅写入 Description，不用 Figma 变体模拟浏览器自由缩放。
- 状态语义：Default 使用 `bg/surface` + `border/default`；Hover 使用 Neutral hover surface + strong border；Focused 使用 Neutral `focus/ring` 2px；Error 使用 `status/danger/border` 2px，错误文案仍由 Field 承载；Disabled 使用 Neutral subtle surface / border / text；Loading 复用正式 Spinner。
- L0：PASS。审计 573 个节点、424 个可见 Solid Paint；硬编码颜色、远程颜色、Primitive 颜色直绑、未解析实例、缺 Text Style、非 Inter 字体和 placeholder 均为 0。两套 Base 均为 12 变体、10 个公开定义（8 内容属性 + State + Content），每个可见/隐藏子层属性引用均连接。
- L1：PASS。Value 与 Placeholder 互斥；Leading / Trailing / Clear / Loading 属性回读通过；Focus、Error、Disabled、Loading 在 Light/Dark 下均可辨；Sm/Md/Lg 与 Button 的 32/36/44 高度和 Typography 密度协调。
- L2：PASS。创建 Wide `628:146` 与 Compact `628:449` Verification Component，全部由正式公开 Input / Textarea 实例构成。视觉闭环发现验证实例误把 `Show Loading` 设为 true，已只修验证配置；最终 Spinner 仅在 State=Loading 时出现。
- L3：PASS。12 个 Lab 实例进入 Form / Settings 与 Detail / Drawer 两个场景族，覆盖 Light/Dark 和 1440/1024/390；所有实例均在父场景边界内。390 Compact 宽 326px，场景宽 390px，保留 24px 左边距与 40px 右余量，无裁切或重叠。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：正式资产、Base 变体、3 个新 Variables、2 个 Verification Component、12 个 Lab 实例与 Legacy 重命名精确 ID 已写入 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`；不依赖 Desktop Undo。
- 遗留风险：Field 当前仍消费 Legacy Input，按 P1.e 的 Control Slot 与状态合同一起迁移；新 Input / Textarea 已是未来前端重构的唯一设计源。键盘焦点行为、输入法、自动填充和 Textarea 真实 resize 由未来 React 实现验证。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma API）；ADR `Not applicable`（未改变 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P1.d 继续由本台账追踪）。
- 新 `currentPointer`：`P1.d` Select / Combobox / Search / Date Input。

### 2026-08-13 01:00 +0800 · P1.b BUTTON / ICON BUTTON VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已确认 P0 写入且先前明确授权无任务号例外直接修改 Figma；本增量只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24`、本状态台账和 `/tmp` 精确回滚账本，未修改 React、配置、依赖、Git、部署、Linear 或 Notion。
- Legacy 审计：原 Button Component Set `6:21409` 已重命名为 `Legacy/CWGSYW/Component/Button/400 Variants`，保留 400 变体及 39 个既有实例，不删除、不在 P1.b 批量迁移。所有 Legacy 实例 Main Component 可解析。
- 正式 Button：Base Component Set `605:494`，25 个 `Variant=Primary|Secondary|Outline|Ghost|Destructive × State=Default|Hover|Pressed|Disabled|Loading` 变体；公开 Component Set `606:19247` 仅有 3 个 `Size=Sm|Md|Lg` 外层变体。公开实例通过暴露嵌套 Base 提供 Label、前后 Icon 显隐、前后 Icon Instance Swap、Variant 和 State。
- 正式 Icon Button：Base Component Set `610:19295`，同样 25 个 Variant × State 变体；公开 Component Set `610:19314` 仅有 3 个 Size 变体。公开实例暴露 Icon Instance Swap、Variant、State 与 `Accessible Label` 合同。
- 新语义与样式：`action/destructive-foreground` `VariableID:594:203`；`CWGSYW/Type/Label Lg` `S:8c1b53a609ce6172415c50642eb42f5c7dab4c19,`。新增 `CWGSYW / Icon Context` 集合 `VariableCollectionId:612:51` 和 `icon/context` `VariableID:612:52`，以 Default / Inverse / Disabled / Danger 四个模式让可交换 Icon 与 Spinner 跟随按钮前景语义。
- 自适应调整：视觉闭环发现 Primary 与 Destructive 上的可交换 Icon 仍回退到默认深色。根因是 50 个 Base 变体未显式设置 `Icon Context` 模式；现已统一为 Primary→Inverse、Destructive→Danger、Disabled→Disabled、其余→Default，Spinner 同步继承。修复后 Light/Dark 图标与 Loading Spinner 对比 PASS。
- L0：PASS。审计 386 个节点、226 个可见 Solid Paint；硬编码颜色 0、远程颜色 0、Primitive 颜色直绑 0、未解析实例 0、缺失 Text Style 0、非 Inter 字体 0、placeholder 0。正式变体数量为 Button Base 25、Button 3、Icon Button Base 25、Icon Button 3。
- L1：PASS。Primary、Secondary、Outline、Ghost、Destructive、Loading、Leading/Trailing Icon、Icon Button 与 Accessible Label 均完成属性回读和 Light/Dark 放大截图；Size 高度为 Sm 32、Md 36、Lg 44。
- L2：PASS。创建 Wide `614:447` 与 Compact `614:696` 两个正式 Verification Component，全部由公开 Button / Icon Button 实例构成；公开属性和嵌套暴露属性均可编辑，无页面覆写。
- L3：PASS。12 个 Lab 实例写入 Form / Settings 与 Overlay / Destructive 两个场景族，覆盖 Light/Dark 和 1440/1024/390。所有实例位于父场景边界内；390 使用 Compact 组合并保留 24px 边距，无裁切、重叠或不可见内容。
- 评分：颜色 5/5；层级 5/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：正式资产、所有变体、验证组件、12 个 Lab 实例、Icon Context 模式映射与 Legacy 重命名的精确 ID 已写入 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`；不依赖 Figma Desktop Undo。
- 后续补充（P4.d）：原 P1.b 锁定的五种 State 已扩展为六种；正式 Button Base 与 Icon Button Base 均新增 `State=Focused`，使用 `focus/ring` 的 2px INSIDE 描边。未来 React 仍必须按 `:focus-visible` 语义实现，而不是把 Focused 当作持续状态。Legacy 39 个实例在后续页面重构时按场景迁移，不在组件定义阶段强制替换。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实已锁定 Figma API）；ADR `Not applicable`（未改变 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（全新 Figma 与旧前端继续隔离）；Follow-up documentation `Not applicable`（P1.c 继续由本台账追踪）。
- 新 `currentPointer`：`P1.c` Input / Textarea。

### 2026-08-13 00:29 +0800 · P0 / P1.a RECONCILIATION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已确认 P0 写入；本轮授权边界仍仅覆盖 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 与本地执行台账，未修改 React、配置、依赖、Git、部署或外部任务状态。
- 只读对账确认正式 Icon `573:54`、`573:57`、`573:60`、`573:64`、`573:67`、`573:70`，Spinner `575:5038`，Separator `391:145` 及 P1.a Verification / Lab 资产均存在。
- 发现空的同名重复 Spinner Component Set `578:320` 仍位于 `CWGSYW / Component / Actions & Feedback` 页面。删除前确认其无子节点，且正式组件 `INSTANCE_SWAP`、嵌套实例和 8 个 Lab Spinner 实例均未引用它；随后按精确 Node ID 删除 `578:320`。
- 删除后复核：重复候选存在数 0；正式资产缺失数 0；指向已删除资产的引用数 0；未解析 Main Component 数 0；8 个 Lab Spinner 均继续指向正式 `Md/Neutral` 变体 `574:20001`。结构结果 `PASS`。
- P0 保持 `VERIFIED`，P1.a 保持 `VERIFIED`；本轮未改变 Variables、Component Properties、视觉样式或响应式构图，因此既有 L0-L3 与 Light/Dark 1440/1024/390 截图证据继续有效。
- 回滚边界：仅删除空重复节点 `578:320`；正式 Spinner `575:5038` 未改动。不依赖 Figma Desktop Undo。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（仅清理重复资产）；ADR `Not applicable`（未改变 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（P0/P1.a 结论未改变）；Follow-up documentation `Not applicable`（P1.b 继续由本台账追踪）。
- 新 `currentPointer`：`P1.b` Button / Icon Button。

### 2026-08-13 00:15 +0800 · P1.a ICON / SPINNER / SEPARATOR VERIFIED

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已授权本次无任务号直接修改 Figma；本轮仍只修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 与本地状态/回滚台账，未修改 React、配置、依赖、Git 或外部任务状态。
- Icon：创建 6 个本地可交换源资产：Search `573:54`、Check `573:57`、Close `573:60`、Eye `573:64`、Chevron Down `573:67`、Loader `573:70`。统一 24px 视口、2px 圆角描边、`icon/primary` 语义颜色；图标名称不做 Variant 轴，供后续 `INSTANCE_SWAP` 使用。
- Dimensions：新增可绑定语义尺寸 `size/icon-sm` `VariableID:572:51`、`size/icon-md` `VariableID:572:52`、`size/icon-lg` `VariableID:572:53`，分别别名到现有 Primitives，并限定 `WIDTH_HEIGHT` scope。Status 前景 `352:148`、`352:151`、`352:154`、`352:157` 扩展为 Text / Shape / Stroke scope，数值与 Status 语义未改变。
- Spinner：正式 Component Set `575:5038`，15 个 `Size=Sm|Md|Lg × Tone=Neutral|Info|Success|Warning|Danger` 变体；公共属性 `Label`、`Show Label` 已连接。Neutral 为默认；Status Tone 只用于真实状态上下文。旧文本源保留为 Legacy `261:117`，示例实例 `296:18779` 已精确迁移到正式 `Md/Neutral` 变体 `574:20001`。
- Separator：Component Set `391:145` 保留 `Orientation=Horizontal|Vertical`；变体 `391:143`、`391:144` 清除隐藏白色 Fill，颜色绑定 `border/subtle`，厚度绑定 `border/width-default`，Matrix 展示不再重叠。
- L0：PASS。最终审计覆盖 217 个节点和 80 个链接实例；未解析 Main Component、硬编码颜色、远程颜色、Primitive 颜色直绑、非 Inter 字体和缺失 Text Style 均为 0。
- L1：PASS。Icon 轮廓、Spinner 三档尺寸与五种 Tone、Separator 两种方向均完成源资产截图验证；无裁切、重叠或不可见内容。
- L2：PASS。创建 Wide `579:158` 与 Compact `579:182` 验证组件；图标、水平/垂直 Separator、带 Label Neutral Spinner 和无 Label Status Spinner 组合协调。
- L3：PASS。六个 Lab 链接实例 `580:20091`、`580:20115`、`580:20139`、`580:20159`、`580:20183`、`580:20207` 在 Light/Dark 与 1440/1024/390 均通过；390 使用 Compact 组合，无裁切。
- 最终截图：`/tmp/cwgsyw-figma-p1a/lab-1440-light.png`、`lab-1024-light.png`、`lab-390-light.png`、`lab-1440-dark.png`、`lab-1024-dark.png`、`lab-390-dark.png`；源 Matrix 为 `/tmp/p1a-spinner-matrix.png`、`/tmp/p1a-verification-wide.png`、`/tmp/p1a-verification-compact.png`。
- 自适应调整：2 次。先把 Spinner 从裁切文本改为真实圆弧 Indicator；再把 Wide 组合重排为 Compact 390 组合。未新增普通 UI 色系，Status 色边界未扩大。
- 评分：颜色 5/5；层级 4/5；状态 5/5；对齐 5/5；节奏 4/5；Typography 5/5；协调 5/5；平衡 4/5；响应 5/5；A11y 4/5。Critical 维度均不低于 4/5。
- 回滚边界：新 Variable、Icon、Spinner、Verification Component、六个 Lab 实例与 Separator/示例实例精确 ID 已写入 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`；不依赖 Desktop Undo。
- 遗留风险：现有 Button/Input/Tabs 仍消费远程社区 Icon，按依赖顺序在 P1.b-P1.f 通过 `INSTANCE_SWAP` 迁移；本轮不跨组件族改 API。Spinner 动效和无障碍 announcement 由未来 React 实现，不在静态 Figma 中伪造。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（落实既有组件计划）；ADR `Not applicable`（未改变 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无运行时代码）；Current System Baseline `Not applicable`（新 Figma 与旧前端隔离）；Follow-up documentation `Not applicable`（P1.b 继续由本状态台账追踪）。
- 新 `currentPointer`：`P1.b` Button / Icon Button。

### 2026-08-12 23:51 +0800 · P0.l RESPONSIVE SUPPLEMENTAL VERIFICATION PASS

- 在既有 P0 VERIFIED 证据之外，完成同页响应式补充 Lab：1024 根 `543:1568`，场景 `543:1570`、`543:1572`、`543:1574`、`543:1576`、`543:1578`；390 根 `543:1580`，场景 `543:1582`、`543:1584`、`543:1586`、`543:1588`、`543:1590`。
- 390 Form 使用 Field / Input / Select / Textarea / Switch / Alert / Button 单列组合；Data 使用 Tabs / Search / Card List / 简化 Pagination，明确不缩放桌面 Table；Detail、Dashboard、Overlay 均使用正式 Component 实例纵向重排。
- 1024 Detail 从超宽横排改为原生宽度纵向堆叠，Key-value Detail、Timeline 与 Dialog 不再裁切；Form、Dashboard 的窄屏 Alert / Toast 使用无内联 Action 或无 Description 的现有属性组合，消除固定高度下的文字相撞。
- Light 1024 / 390：PASS。Dark 1024 / 390：PASS。Table 标题保持 Neutral 灰底和可见浅灰文字；Tabs 弱态、Key-value、Timeline、Dialog、AlertDialog 与 Destructive Button 均可辨。
- 全 Paint 审计：1024 根 297 个节点、256 个 Solid Paint；390 根 198 个节点、180 个 Solid Paint。两根均为硬编码 0、远程变量 0、Primitive / 旧 Collection 0、未解析变量 0、placeholder 0。
- 两个补充根的 `CWGSYW / Color` 显式 Dark mode 已清除，最终恢复继承默认 Light；P0 状态保持 `VERIFIED`，新 `currentPointer` 仍为 `P1.a`。
- 回滚边界：仅限本条列出的 `543:*` 响应根、场景及本轮返回的新增/修改子节点；不依赖 Desktop Undo。

### 2026-08-12 23:43 +0800 · P0.a-P0.m VERIFIED / P1 READY

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户在本次任务中明确授权“无任务号例外直接修改 Figma”并确认 P0 写入；例外只覆盖 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 与本地执行台账。未修改 React、配置、依赖、Git 分支、提交、推送、部署或外部任务状态。
- P0.h-P0.i：四个 Primary/Selected 语义变量已直接别名到 `neutral/*`；7 个无消费者 `blue/*` 已按精确 Variable ID 删除，删除后本地消费者与名称命中均为 0。
- P0.j：Input / Select Loading Icon、Chevron、Tabs Badge、AlertDialog、CMDB Pattern、Skeleton 与 Disabled 对比均完成本地语义变量绑定修复；正式目标资产远程颜色与可见硬编码 Solid Paint 均为 0。
- P0.k：Integration Lab 页面 `489:17889`；1440 Light 根 `496:171`，场景 `500:335`、`502:369`、`503:456`、`504:502`、`505:543`。
- P0.l：1024 Light 根 `512:584`，场景 `513:584`、`513:18444`、`514:697`、`514:18577`、`515:784`；390 Light 根 `522:814`，场景 `523:18630`、`524:844`、`524:18724`、`524:18783`。
- P0.l Dark：1440 根 `535:1947`，场景 `535:1948`、`535:1962`、`535:1974`、`535:1992`、`535:2010`；1024 根 `538:1191`，场景 `538:1192`、`538:1206`、`538:1218`、`538:1236`、`538:1254`；390 根 `539:19237`，场景 `539:19238`、`539:19252`、`539:19270`、`539:19290`。
- Overlay 自适应修正：新增 `neutral-alpha/black-56`（`VariableID:509:51`）与 `neutral-alpha/black-72`（`VariableID:509:52`），`overlay/scrim`（`VariableID:404:17874`）Light/Dark 分别别名到这两枚 Neutral alpha 原语。Dialog/AlertDialog 可读，Danger 仍只用于删除动作。
- Typography 自适应修正：新增 `CWGSYW/Type/Label Xs`（`S:f34d85a6e77da6da159c4305a09f7a715cb8bc7e,`）与 `CWGSYW/Type/Label Md`（`S:7c826e63a0fec4ddb9636cb83744949d61a606ea,`）；Tabs 16 个正式变体、Status Badge Info/Success/Warning/Danger/Neutral 与 Combobox 已绑定本地 Inter Text Styles。
- Light/Dark 自适应修正：清理 84 个 Integration Lab 结构 Frame 的无绑定白色填充；修复 1024 Form/Detail 容器裁切；390 Form/Detail/Dashboard/Overlay 改为内容自适应纵向布局；Status Summary 用 `530:961`、`530:962` 两行承载原 Badge 实例；克隆实例 TEXT/BOOLEAN 属性重新提交以修复 Figma 克隆缓存导致的中文分段。
- L0 最终审计：PASS。6 个验证区、258 个正式实例、560 个文本节点；未解析 Main Component 0、结构 Frame 硬编码颜色 0、远程颜色 0、非 Inter 字体 0、缺 Text Style 0。
- L1：PASS。Tabs、Badge、Combobox、Dialog、AlertDialog、Button、Input、Select 等正式组件在最终视图中可见且状态清晰。
- L2：PASS。Form、Data、Detail、Dashboard、Overlay 五类组合场景内部无裁切、重叠、颜色越界或组件割裂。
- L3：PASS。Light/Dark 与 1440/1024/390 代表视图均通过；Data/Table 明确为桌面 Pattern，390 记录为 N/A，不伪造缩小表格。
- 最终截图：`/tmp/cwgsyw-figma-p0-post/lab-1440-light-final.png`、`lab-1024-light-final.png`、`lab-390-light-final.png`、`lab-1440-dark-v2.png`、`lab-1024-dark-v2.png`、`lab-390-dark-v2.png`。
- 评分：颜色 5/5；层级 4/5；状态 5/5；对齐 4/5；节奏 4/5；Typography 5/5；协调 4/5；平衡 4/5；响应 4/5；A11y 4/5。Critical 维度均不低于 4/5。
- 遗留风险：Table 正式实例外层可伸至 1376px，但 Header/Row 内部仍固定 840px；在 P2 Table family 中做正式结构拆分与列宽策略，不在 Integration Lab 使用实例覆盖掩盖。Data/Table 的移动 Pattern 需在 P2 单独设计，当前 390 明确 N/A。
- 回滚边界：精确 Variable、Style、Wrapper、Scene、结构容器与字体绑定 ID 记录在 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`。不依赖 Desktop Undo。
- Documentation Impact Assessment：PRD/功能需求 `Not applicable`（本轮只落实既有新 Figma 设计合同）；ADR `Not applicable`（未改变已锁定 Neutral/Status 架构）；API/数据模型/迁移/安全/运维文档 `Not applicable`（无代码或运行时变更）；Current System Baseline `Not applicable`（新 Figma 与旧前端显式割裂）；Follow-up documentation `Not applicable`（P1/P2 工作继续由本状态台账追踪）。
- 新 currentPointer：`P1.a`。

### P1 Phase Checklist

- P1.a Icon / Spinner / Separator：回读源资产与完整 Matrix；统一本地 `icon/*`、尺寸、笔画、Loading 动效表达与 Separator 方向；完成 L0-L3。
- P1.b Button / Icon Button：审计 400 变体爆炸，锁定公共 API、拆分或合并策略；验证 Primary Neutral、Hover/Pressed/Focus/Disabled/Loading 与触控尺寸；完成 L0-L3。
- P1.c Input / Textarea：统一 Size、State、Prefix/Suffix、Clear、Loading、Disabled、Error 与文本属性；完成 L0-L3。
- P1.d Select / Combobox / Search / Date Input：统一 Chevron、搜索、选项状态、Empty/Loading/Error 与移动宽度；完成 L0-L3。
- P1.e Field / Checkbox / Radio / Switch：建立 Label/Description/Error/Required 合同与控件状态协作；完成 L0-L3。
- P1.f Tabs / Badge / Chip / Avatar：复核本轮 Typography 修复，补全 Variant/Property API 与组合状态；完成 L0-L3。
- P1 退出条件：所有 P1 组件正式资产无远程颜色、无可见硬编码颜色、Variables/Styles/Properties 完整；Light/Dark 与 1440/1024/390 适用视图通过；高影响组件至少进入两个 Integration Lab 场景；无不可见文字、裁切、重叠或颜色越界。

### 2026-08-12 22:55 +0800 · P0.k COMPLETE / P0.l VISUAL GATES IN PROGRESS

- 新建页面 `CWGSYW / Integration Lab`（`489:17889`），根节点 `Integration Lab / P0`（`489:17890`）；五个场景节点为 `489:17891`–`489:17895`。
- 所有场景均使用正式 Component 实例；结构验证共 45 个实例（含嵌套实例），未解析 Main Component 为 0，placeholder / shimmer 残留为 0。
- 为 Lab 增加总标题、说明和五个场景标题；组合 Row 清除 Figma 默认白色 fills，避免脚手架在 Dark 模式制造假白块。
- Light 1440：五个场景完成基线截图，颜色边界与基本组合关系可读；P0.k PASS。
- Light 1024：FAIL。Table、Detail、Dashboard 的宽内容出现裁切，组件缺少响应式变体或可收缩布局。
- Light 390：FAIL。标题、表单、多列数据、Detail、Dashboard、Overlay 均裁切；当前资产不能作为移动端完成态。
- Dark 1440：FAIL。解除 Lab 脚手架白底后仍存在正式资产 Light 表面；已确认 Table Header 直接消费 Primitive `neutral/200`，Key-value Detail 仍消费旧 `CWGSYW/Color/Neutral/0`，部分复杂组件尚未完整切换语义表面变量。
- Button Dark 修复：清除源变体 `6:21410`、`6:21610`、`6:22210` 的显式 Light 模式覆盖；对应 Lab 实例现在继承上级模式。
- AlertDialog 剩余远程消费者：嵌套图标 Vector `I383:17874;6:39510;6923:60274` 仍绑定远程变量；需在 P3 AlertDialog/Icon 资产回修中替换为本地语义 Icon 资产。
- 恢复验证：Lab 根节点已恢复 1440 宽且清除显式 Dark override，最终默认状态为 Light 1440。
- P0.l 判定：`IN_PROGRESS`。不可把当前截图标记为 VERIFIED；响应式与 Dark FAIL 分别进入 P1 Input/Tabs/Button、P2 Table/Card/Feedback、P3 Dialog/AlertDialog 逐组件回修闭环。
- 新 currentPointer：`P0.l`，按组件依赖顺序消除已确认失败并重跑 Light / Dark、1440 / 1024 / 390。

### 2026-08-12 22:35 +0800 · P0.j FORMAL COMPONENT COLOR BINDINGS PASS

- 远程绑定迁移：Tabs 内 16 个 Badge 的远程 Success 背景全部改为本地 `status/success/bg`（`VariableID:352:150`），逐节点 readback 16/16 PASS。
- 共享资产：Chevron 源节点 `90:4` 的硬编码描边改为本地 `icon/secondary`（`VariableID:475:52`），Select / Combobox 实例继承正常，箭头方向与对比截图 PASS。
- Skeleton：`125:11`、`125:18` 的白色硬编码表面改为本地 `bg/surface`（`VariableID:352:128`），Matrix 截图无视觉回归。
- Disabled 对比回修：审计确认 `text/disabled` 只有 Select 3 个和 Tabs 4 个正式消费者；Light / Dark 均从原 Neutral 400 / 600 改为 Neutral 500（`VariableID:352:58`）。Tabs 弱态由几乎不可见提升为清晰弱态，Select Disabled 仍与 Default 可区分。
- AlertDialog：live readback 显示 Media Icon 已绑定本地 `bg/surface-subtle`，Media 容器绑定 `bg/surface`；没有新增 on-danger 色或重复写入。
- CMDB Pattern：Key-value Detail 与 Timeline Activity 的 7 个表面 live 读回已绑定 `bg/surface`；本轮幂等重写未改变视觉。
- 最终结构复扫：Input、Select、Combobox、Tabs、Skeleton、AlertDialog、Chevron、Search Input、Date Picker、Separator、Key-value Detail、Timeline Activity 共 12 个目标资产，远程颜色绑定 0、硬编码 Solid Paint 0。
- 修改 Node IDs：`108:10`、`113:6`、`113:12`、`113:18`、`113:24`、`113:30`、`113:36`、`113:42`、`113:48`、`113:54`、`113:60`、`113:66`、`113:72`、`113:78`、`113:84`、`113:90`、`90:4`、`125:11`、`125:18`、`270:60`、`270:69`、`270:78`、`270:87`、`270:99`、`270:105`、`270:111`；修改 Variable ID：`352:135`。
- L0：PASS。L1：Tabs / Select / Skeleton / AlertDialog Light Matrix PASS。Dark、L2、L3：NOT_RUN，进入 P0.k / P0.l。
- 新 currentPointer：`P0.k`，创建五类 Integration Lab。

### 2026-08-12 22:23 +0800 · P0.h-P0.i WRITE AND LIVE VERIFICATION PASS

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已明确“确认 P0 写入”；例外边界保持为仅修改 Figma 文件 `Z8EC6psFOj7KMfXapAFk24` 和本地执行台账。
- P0.h：PASS。`bg/surface-selected`、`action/primary`、`action/primary-hover`、`action/primary-pressed` 已从 `blue/*` 中间别名改为直接指向对应 `neutral/*`；Light / Dark live readback 与计划一致。
- P0.i 消费门禁：PASS。25 页直接绑定扫描为 0，变量别名消费者为 0。
- P0.i 删除：PASS。已按精确 ID 删除 `blue/25`、`blue/50`、`blue/200`、`blue/300`、`blue/700`、`blue/800`、`blue/900`。
- 删除验证：`CWGSYW / Primitives.variableIds` 命中 0；`getLocalVariablesAsync()` 命中 0；本地 COLOR 清单命中 0；`blue/*` 名称命中 0。`getVariableByIdAsync(旧ID)` 的旧对象响应按 tombstone/cache 记录，不作为变量仍存在的证据，禁止重复 `remove()`。
- 修改对象：Variables `352:131`、`352:140`、`352:141`、`352:142`；删除 Variables `413:80`、`413:51`、`413:53`、`413:54`、`413:58`、`413:59`、`413:60`；无画布节点变更。
- L0：PASS（变量别名、消费者、集合索引和本地变量清单）。L1 / L2 / L3：NOT_RUN，等待 P0.j 组件绑定修复和 P0.k Integration Lab。
- 回滚边界：语义别名原值与 7 个已删除变量的精确定义保存在 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json` 的 `semanticRollback` / `blueRollback`。
- 新 currentPointer：`P0.j`，修复正式组件的外部颜色绑定和硬编码颜色。

### 2026-08-12 · P0.a-P0.f READ-ONLY AUDIT COMPLETE

- READY 状态：`READY WITH APPROVED EXCEPTION`。用户已授权本次无任务号直接修改 Figma；例外仅覆盖文件 `Z8EC6psFOj7KMfXapAFk24`，不覆盖前端、Git 或外部任务状态。
- P0.a 文档与台账：PASS。权威工作包、执行边界、视觉门禁和恢复入口已回读。
- P0.b 资源接管：PASS。当前文件有 25 页、177 个本地 Variables（其中 COLOR 86）、7 个 Text Styles、5 个 Effect Styles；正式组件、Legacy 和外部社区资产已区分。
- P0.c 基线视图：PASS。已采集 Foundations、Buttons、Input、Select、Tabs、Status Badge、Skeleton、Card、Table、Form & Filter、Actions & Feedback、Dialog，以及 5 个代表 CMDB 视图。
- P0.d 颜色消费者：PASS。`bg/surface-selected`、`action/primary`、`action/primary-hover`、`action/primary-pressed` 仍经 `blue/*` 间接指向 Neutral；正式页面无 `blue/*` 直接消费者。Status 语义变量独立指向 `status/*` primitives，保留。
- P0.e 绑定缺口：PASS。Tabs 弱态文字对比不足；Input Loading 图标和 Select Loading 图标仍绑定远程 `tokens/foreground`；Tabs 的 16 个 Badge 实例仍绑定远程 `CWGSYW/Color/Status/Success/Bg`；AlertDialog 媒体图标 `383:17874`、`383:17881` 仍绑定远程 `tokens/primary-foreground`；Select/Combobox Chevron 源 `90:2` 及实例存在白色硬编码；Skeleton、Search Input `255:75`、Date Picker `255:79`、Separator `391:143` / `391:144`、Key-value Detail `270:57`、Timeline Activity `270:96` 存在硬编码；Button 尺寸绑定和 400 变体结构需要在 P1 处理。
- 旧代表页面边界：页面大量消费外部库变量并含硬编码，仅作为功能和业务状态覆盖证据，不作为新 Neutral Design System 的颜色、Token、尺寸、布局或层级参考；P0 不批量改造旧页面。
- Table 视觉结论：参考节点 `227:182` 确认标题灰底方向正确；后续保持 Neutral 灰底、偏灰标题文字和白色数据行，并通过语义文本变量保证稳定对比，不引入彩色强调。
- Tabs 视觉结论：当前 Disabled/弱态与浅背景对比过低，P0 变量重建后必须重截 Matrix；不可见或接近不可见即 FAIL。
- 删除门禁：不得直接删除 `blue/*`。先把四个语义变量改为直接指向 `neutral/*`，再逐页复扫所有直接/间接消费者；仅在消费者为 0 时按精确 Variable ID 删除。Legacy Component 同理，未证明无消费者前不删除。
- 串行写入顺序：P0.g 保存精确状态账本和回滚快照 → P0.h 修正 Color semantic aliases / scopes / code syntax → P0.i 迁移并条件删除 `blue/*` → P0.j 修正式组件的外部颜色绑定与硬编码 → P0.k 建立五类 Integration Lab → P0.l 执行 Light/Dark 与 L0-L3 视觉闭环 → P0.m 更新台账并进入 P1。
- P0 首次写入范围：只修改本地 Variables、正式 Component 资产及新建 Integration Lab；不修改旧代表页面、外部库组件、React、配置、依赖、Git 分支、提交、推送或部署。
- 回滚边界：写入前记录四个语义变量和 7 个 `blue/*` 的 mode values、scopes、code syntax；每次脚本返回全部 mutated/created Node ID 和 Variable ID；反向脚本只使用这些精确 ID，禁止依赖 Desktop Undo 或名称前缀删除。
- P0.g 只读前置已完成：已从 live Figma 重新读取并持久化精确回滚账本 `/tmp/design-system-state-cwgsyw-figma-neutral-redesign-v1.json`；包含四个语义变量、7 个 `blue/*`、7 个 Neutral 迁移目标的 ID、mode、scope、code syntax 和原始 alias。
- 首次写入门：用户已于 2026-08-12 明确确认 P0 写入；后续仅在真实设计分叉、扩大破坏性删除或需要 Neutral / Status 之外颜色时暂停。

### 2026-08-12 · DOCUMENTATION_READY

- 创建全新 Figma 设计与旧前端显色设计的隔离合同。
- 明确 Neutral / Status 颜色白名单。
- 创建组件 API 和变量补充计划。
- 创建主 Goal Prompt、续跑 Prompt、自适应视觉 QA Prompt、运行手册和状态台账。
- 当前尚未根据本工作包修改 Figma，P0 从只读接管开始。
