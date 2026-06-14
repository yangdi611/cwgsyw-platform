# CMDB T2 补全：影响分析 + 关联创建页

## 1. 影响分析页面

**路由**: `/cmdb/impact/[instanceId]`
**API**: `POST /api/cmdb/instances/{id}/impact`
**Backend 已实现**: ImpactAnalysisController, ImpactAnalysisService, ImpactAnalysisResultVO, ImpactAnalysisRequest, ImpactLayerVO, ImpactEdgeVO, ImpactNodeVO

### 需求

1. 新建 `frontend/src/app/(dashboard)/cmdb/impact/[instanceId]/page.tsx`
2. 参考 `frontend/src/app/(dashboard)/cmdb/topology/[instanceId]/page.tsx` 的布局
3. 调用 POST `/api/cmdb/instances/{id}/impact` 获取数据
4. 可视化展示影响分析结果：
   - 顶部工具栏：返回按钮、根实例名称、方向选择器（upstream/downstream/bidirectional）、深度选择器（1-5）
   - 主体区域：分层展示（layer by layer），每层显示该深度的节点列表
   - 每个节点显示：名称、模型、业务等级（businessLevel）、状态（status）
   - 边线显示关联种类标签
   - 节点可点击跳转到实例详情页
   - 如果 truncated=true，显示提示信息
5. 在实例详情页 `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx` 添加"影响分析"链接按钮

### 影响分析可视化方式

由于现有前端没有专门的影响分析图谱组件，使用分层列表布局（impact tree）：
- 根节点在第 0 层，居中突出显示
- 第 1 层显示所有直接关联的节点
- 更多层级向下展开
- 每条边显示关联种类标签
- 支持展开/收起子层

## 2. 关联创建页面

**路由**: `/cmdb/instances/[modelId]/[id]/associations/new`
**API**: 
- `GET /cmdb/meta/association-defs` — 获取关联定义列表
- `GET /cmdb/rel/search` — 搜索目标实例
- `POST /api/cmdb/instances/{id}/relations` — 创建关联

### 需求

1. 新建 `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/associations/new/page.tsx`
2. 独立的关联创建表单页，支持：
   - Step 1: 选择关联定义（从当前模型适用的定义中筛选）
   - Step 2: 搜索并选择目标实例
   - Step 3: 确认并提交
3. 成功后跳转到关联管理页
4. 在实例关联管理页 `/cmdb/instances/[modelId]/[id]/associations/page.tsx` 添加"新建关联"按钮

## 文件变更清单

### 新建文件
- `frontend/src/app/(dashboard)/cmdb/impact/[instanceId]/page.tsx` — 影响分析页面
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/associations/new/page.tsx` — 关联创建页面

### 修改文件
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/page.tsx` — 添加影响分析入口
- `frontend/src/app/(dashboard)/cmdb/instances/[modelId]/[id]/associations/page.tsx` — 添加新建关联按钮

## 约束

- 使用 `use client` 模式
- 使用现有组件库（Button, Select, Input, Label, toast, Dialog 等）
- 使用 `@tanstack/react-query` 进行数据获取
- 使用 `usePermission` hook 进行权限控制
- 只修改上面列出的文件
