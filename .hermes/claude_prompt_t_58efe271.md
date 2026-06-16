你是 cwgsyw-platform 项目的实现工程师。TASK: t_58efe271

## 绝对约束（违反即失败）

1. 不创建任何新文件
2. 不修改非 TARGET 的文件
3. 不做重构 — 只做最小幅度定向编辑
4. 完成时运行 npx tsc --noEmit 检查类型（在 frontend/ 目录下）
5. 完成后 git add + git commit -m "fix: sidebar navgroup + asso attr UI + topo compare entry"

## TARGET 文件（只改这 4 个）

1. frontend/src/components/layout/Sidebar.tsx
2. frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/page.tsx
3. frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/associations/page.tsx
4. frontend/src/app/(dashboard)/cmdb/instances/by-model/[modelId]/[id]/associations/new/page.tsx

## 修复 1: 侧边栏 NavGroup 补全 (Sidebar.tsx)

修复 active 高亮 bug：当前 `pathname.startsWith(item.href)` 导致 /cmdb/instances/2d-view 时也高亮 /cmdb/instances。改为:
```
const isActive = pathname === item.href || pathname.startsWith(item.href + '/') || pathname.startsWith(item.href + '?')
```
（NavGroupItem 内的 isAnyChildActive 和 NavItem 的 isActive 都用此逻辑）

新增子项到 CMDB NavGroup 的 children 数组:
- 在"变更历史"后插入: { href: '/cmdb/changes/stats', label: '统计看板', icon: BarChart2, resource: 'cmdb_instance', action: 'read' }

BarChart2 已导入，无需新增 import。

## 修复 2: 关联属性管理 UI

### 文件 2: instance detail page (by-model/[modelId]/[id]/page.tsx)

a) 在关联关系面板的每个 relation 条目中，在 peer_name 下方添加 attrs 显示:
```
{rel.attrs && Object.keys(rel.attrs).length > 0 && (
  <div className="mt-1 space-y-0.5">
    {Object.entries(rel.attrs).map(([k, v]) => (
      <span key={k} className="text-[11px] text-muted-foreground inline-block mr-2">
        {k}: {String(v ?? '')}
      </span>
    ))}
  </div>
)}
```
放在 peer_name 所在 div 内、`({rel.peer_model_name})` 下方。

b) 在"添加关联"对话框（addDialogOpen），选择目标实例后添加关联属性输入:
- 在 selectedDef 显示区域之后、DialogFooter 之前
- 条件渲染: 只有 selectedPeerId 非空时显示
- 一个简单的键值对编辑器: 
  - 两个 Input 框并排（attrKey, attrValue）
  - "添加"按钮
  - 已添加的显示为标签列表，每个可删除
  - 使用 useState<Record<string, string>> 存储 newRelAttrs
  - 提交时传给 API body: { def_id, ... 原有的其他字段, attrs: newRelAttrs }

### 文件 3: associations page (by-model/[modelId]/[id]/associations/page.tsx)

在表格中添加"关联属性"列:
- 在"创建时间"列后面加一列 `<th>关联属性</th>`
- 在每个 filter tbody 行中，在 created_at td 后面加:
```
<td className="px-4 py-3">
  {rel.attrs && Object.keys(rel.attrs).length > 0 ? (
    <div className="flex flex-wrap gap-1">
      {Object.entries(rel.attrs).map(([k, v]) => (
        <span key={k} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
          {k}={String(v ?? '')}
        </span>
      ))}
    </div>
  ) : (
    <span className="text-xs text-muted-foreground">—</span>
  )}
</td>
```
注意 colSpan 要从 6 改为 7。

### 文件 4: new association page (associations/new/page.tsx)

在 step === 2 的确认区域（div 底部、error 上方）添加关联属性编辑器:
- 使用 useState<Record<string, string>> 管理 assocAttrs
- 两个 Input: attrKey/attrValue + "添加"按钮
- 已添加的显示为 rounded badge 列表，每个有 X 按钮删除
- createMutation.mutationFn 中: body 增加 attrs: assocAttrs

## 修复 3: 拓扑对比入口

### 文件 2: instance detail page (by-model/[modelId]/[id]/page.tsx)

在操作栏"影响分析"按钮旁边添加"拓扑对比"按钮:
```
{hasPermission('cmdb_instance', 'read') && (
  <Link href={`/cmdb/topology/${id}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
    <GitCompare className="h-4 w-4 mr-1" />拓扑对比
  </Link>
)}
```

GitCompare 已在 import 中（来自 'lucide-react'），无需修改 import。

## 输出

完成后输出 JSON: {"status": "done", "summary": "side navgroup fix + asso attr ui + topo compare entry"}
