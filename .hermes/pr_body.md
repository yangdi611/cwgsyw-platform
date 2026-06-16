## 修复内容

### 1. 侧边栏 NavGroup 补全
- 修复 active 高亮 bug：`pathname.startsWith(item.href)` 改为精确路径匹配
- CMDB 组新增「统计看板」子项

### 2. 关联属性管理 UI
- 实例详情关联面板显示条目的 rel.attrs key:value
- 添加关联对话框支持 key-value 属性编辑器，提交 body 带 attrs
- 关联管理表格新增关联属性列（key=value badge 显示）
- 新建关联确认步骤支持属性输入

### 3. 拓扑对比入口
- 实例详情操作栏添加「拓扑对比」按钮，权限守卫

## Changed Files (4)
- frontend/src/components/layout/Sidebar.tsx
- frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/page.tsx
- frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/associations/page.tsx
- frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/associations/new/page.tsx
