# CMDB 逐页夜间 Goal 执行手册

## 1. 用途

本资料包把已经验证有效的 CMDB 逐页改造方法固化为可恢复、可审计的夜间执行流程。它不替代实时 Figma，也不把“代码已接入 Neutral 组件”误报为“页面已完成”。

夜间 Goal 可以连续完成调查、修改、定向验证和状态记录；没有用户现场确认时，只能把页面推进到 `READY_FOR_USER_REVIEW`，不能写成 `CONFIRMED`。

## 2. 固定执行上下文

- 工作目录：`/Users/byron/AI/worktrees/YAN-71`
- 分支：`feat/YAN-71-figma-neutral-m7-workflow-design`
- 任务身份：`YAN-71`
- Ready：`READY WITH APPROVED EXCEPTION`
- 设计文件：`Z8EC6psFOj7KMfXapAFk24`
- 官方图标集合：`6:22411`（`CWGSYW / Icons`）
- 当前实例样本：`http://localhost/cmdb/instances/by-model/host/24`

批准例外仅允许继续 CMDB 逐页视觉与交互收敛。它不授权 commit、push、PR、merge、部署、Linear/Notion 更新，也不授权修改 API、RBAC、数据库或路由语义。

## 3. 权威顺序

1. 实时 Figma 正式节点与导出资产。
2. `design-source/FORMAL-ASSET-API-MANIFEST.md`。
3. `design-source/FIGMA-TO-REACT-IMPLEMENTATION-CONTRACT.md`。
4. `CMDB-OVERVIEW-IMPLEMENTATION-BASELINE.md`。
5. 本目录的 `CMDB-PAGE-STATUS.md`。
6. 当前页面，仅用于确认功能、数据、权限、状态和交互，不反向定义视觉。

发生冲突时按上面的顺序处理，并在状态账本记录冲突、选择和证据。

## 4. 文件职责

- `LONG-GOAL-PROMPT.md`：完整执行纪律、恢复算法、Figma 图标协议、验证和停机条件。
- `SHORT-GOAL-PROMPT.md`：启动或续跑 Goal 时粘贴的短 Prompt；每轮都强制重读长 Prompt、基线和状态账本。
- `CMDB-PAGE-STATUS.md`：唯一恢复指针和逐页状态源。
- `../CMDB-OVERVIEW-IMPLEMENTATION-BASELINE.md`：已确认的视觉规则与逐页评审结论。

## 5. 一页的真实完成定义

一页只有同时满足以下条件才可标为 `CONFIRMED`：

1. 已与 CMDB 基线逐项对照。
2. 布局、字体、密度、表格、Tabs、表单、Dialog、Drawer、图标、空/错/加载/权限状态及交互均已审查。
3. 必要修复已经落地，且未改变业务合同。
4. 定向测试和与风险匹配的回归检查通过。
5. 真实浏览器路由验证完成。
6. 用户明确确认该页。
7. CMDB 基线台账与本状态账本都已同步为 `CONFIRMED`。

缺少第 6 条时，最多标为 `READY_FOR_USER_REVIEW`。结构测试通过、HTTP 200、Neutral import 或 build 成功都不能单独替代页面确认。

## 6. 夜间运行节奏

1. 用 `SHORT-GOAL-PROMPT.md` 新建 Goal。
2. Goal 每次醒来先重读长 Prompt、CMDB 基线和状态账本。
3. 若存在 `IN_PROGRESS`，从该页恢复；否则取最早的 `TODO`。
4. 一次只处理一页，完成证据后写为 `READY_FOR_USER_REVIEW`，再推进下一条 `TODO`。
5. 已 `CONFIRMED` 页面不可重做；只有共享改动确实造成回归时才允许复查并记录原因。
6. 没有 `TODO` 后，列出待用户确认队列并停止，不循环修改同一页面。

## 7. 图标硬规则

任何新增或替换的 SVG icon 必须在 Figma `6:22411` 中定位合适节点，并对具体候选节点调用 `get_design_context`。使用返回的临时资产 URL 下载原始字节，保存到 `frontend/public/figma-icons/`；代码只能引用该耐久副本。

禁止手写 `<svg>`、`<path>` 或凭名称猜图形；禁止把临时 Figma URL直接提交到代码；禁止为了省事使用 emoji、文本符号或自制占位图标。复用项目现有资产前也必须确认 glyph 与目标 Figma 节点一致。

## 8. 回滚边界

每页的回滚单位是：该页入口、该页专用组件、必要的最小共享组件改动、对应 Figma 资产、定向测试以及两份状态文档。不得用 reset、clean 或整树覆盖回滚；工作树里的其他未提交修改均属于用户，必须保留。
