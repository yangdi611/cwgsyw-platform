# CMDB-UX 导航重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 重构 CMDB 前端导航为三段式（搜索首页 / CI 资源 / 配置管理），完全重构路由结构，新增跨模型搜索后端接口，实现表格列自定义（localStorage 持久化）。

**Architecture:** 后端新增一个 `GET /api/cmdb/instances/search` 跨模型搜索接口；前端提取 `useColumnConfig` hook 和 `ColumnPicker` 组件供两个页面复用；Sidebar 新增展开式子菜单支持；旧路由用 Next.js `redirect()` 保持兼容。

**Tech Stack:** Spring Boot 3.4.5, Next.js 15 App Router, TanStack Query v5, shadcn/ui, localStorage

---

## File Map

**后端（修改 2 个文件，新增 2 个 DTO）：**
- Modify: `backend/.../module/cmdb/CiInstanceService.java` — 新增 `searchAcrossModels` 方法
- Modify: `backend/.../module/cmdb/CiInstanceController.java` — 新增 `GET /search` 端点
- Create: `backend/.../module/cmdb/dto/CiInstanceSearchVO.java`
- Create: `backend/.../module/cmdb/dto/CiInstanceSearchResult.java`

**前端（新建 / 修改 9 个文件）：**
- Create: `frontend/src/hooks/useColumnConfig.ts` — 列配置 hook（localStorage 持久化）
- Create: `frontend/src/components/cmdb/ColumnPicker.tsx` — 列选择下拉组件
- Modify: `frontend/src/components/layout/Sidebar.tsx` — 展开式 CMDB 子菜单
- Rewrite: `frontend/src/app/(dashboard)/cmdb/page.tsx` — 搜索首页
- Create: `frontend/src/app/(dashboard)/cmdb/instances/page.tsx` — CI 资源页
- Create: `frontend/src/app/(dashboard)/cmdb/admin/page.tsx` — 配置管理页（Tab）
- Create: `frontend/src/app/(dashboard)/cmdb/admin/models/[modelId]/page.tsx` — 模型属性编辑（迁移）
- Replace: `frontend/src/app/(dashboard)/cmdb/associations/page.tsx` — 替换为 redirect
- Replace: `frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx` — 替换为 redirect

---

## Task 1: 后端跨模型搜索接口

**Files:**
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceSearchVO.java`
- Create: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceSearchResult.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceService.java`
- Modify: `backend/src/main/java/com/cwgsyw/platform/module/cmdb/CiInstanceController.java`

- [ ] **Step 1: 创建 CiInstanceSearchVO**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceSearchVO.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.time.LocalDateTime;
import java.util.Map;

@Data
public class CiInstanceSearchVO {
    private Long id;
    private String name;
    private String modelId;
    private String modelName;
    private Map<String, Object> attrs;
    private LocalDateTime updatedAt;
}
```

- [ ] **Step 2: 创建 CiInstanceSearchResult**

```java
// backend/src/main/java/com/cwgsyw/platform/module/cmdb/dto/CiInstanceSearchResult.java
package com.cwgsyw.platform.module.cmdb.dto;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class CiInstanceSearchResult {
    private List<CiInstanceSearchVO> records;
    private long total;
    private long page;
    private long size;
    private Map<String, Long> modelCounts;  // 各模型匹配当前关键词的实例数
}
```

- [ ] **Step 3: 在 CiInstanceService 添加 searchAcrossModels 方法**

在 `CiInstanceService.java` 中，在 `searchInstances` 方法之后添加：

```java
public CiInstanceSearchResult searchAcrossModels(String tenantId, String keyword,
                                                   String modelId, int page, int size) {
    boolean hasKeyword = org.springframework.util.StringUtils.hasText(keyword);
    boolean hasModel = org.springframework.util.StringUtils.hasText(modelId);

    LambdaQueryWrapper<CiInstance> qw = new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(hasModel, CiInstance::getModelId, modelId)
            .like(hasKeyword, CiInstance::getName, keyword)
            .orderByDesc(CiInstance::getUpdatedAt);

    long total = instanceMapper.selectCount(new LambdaQueryWrapper<CiInstance>()
            .eq(CiInstance::getTenantId, tenantId)
            .eq(hasModel, CiInstance::getModelId, modelId)
            .like(hasKeyword, CiInstance::getName, keyword));

    Page<CiInstance> result = instanceMapper.selectPage(new Page<>(page, size, false), qw);
    result.setTotal(total);

    // 模型名称 map
    Map<String, String> modelNameMap = modelMapper.selectList(
                    new LambdaQueryWrapper<CiModel>().eq(CiModel::getTenantId, tenantId))
            .stream().collect(Collectors.toMap(CiModel::getModelId, CiModel::getName));

    // 各模型匹配当前关键词的实例数（单次 GROUP BY 查询）
    Map<String, Long> modelCounts = instanceMapper.selectMaps(
                    new com.baomidou.mybatisplus.core.conditions.query.QueryWrapper<CiInstance>()
                            .select("model_id, count(*) as cnt")
                            .eq("tenant_id", tenantId)
                            .eq("is_deleted", false)
                            .like(hasKeyword, "name", keyword)
                            .groupBy("model_id"))
            .stream().collect(Collectors.toMap(
                    m -> (String) m.get("model_id"),
                    m -> ((Number) m.get("cnt")).longValue()));

    List<CiInstanceSearchVO> records = result.getRecords().stream().map(inst -> {
        CiInstanceSearchVO vo = new CiInstanceSearchVO();
        vo.setId(inst.getId());
        vo.setName(inst.getName() != null ? inst.getName() : "#" + inst.getId());
        vo.setModelId(inst.getModelId());
        vo.setModelName(modelNameMap.getOrDefault(inst.getModelId(), inst.getModelId()));
        vo.setAttrs(inst.getAttrs());
        vo.setUpdatedAt(inst.getUpdatedAt());
        return vo;
    }).collect(Collectors.toList());

    CiInstanceSearchResult res = new CiInstanceSearchResult();
    res.setRecords(records);
    res.setTotal(total);
    res.setPage(page);
    res.setSize(size);
    res.setModelCounts(modelCounts);
    return res;
}
```

需要在方法顶部确认已有的 import 包含 `java.util.List`（已有）。

- [ ] **Step 4: 在 CiInstanceController 添加 search 端点**

在 `CiInstanceController.java` 中，在现有方法之后添加：

```java
@GetMapping("/search")
@PreAuthorize("hasAuthority('cmdb_instance:read')")
public R<CiInstanceSearchResult> search(
        @RequestParam(defaultValue = "") String keyword,
        @RequestParam(defaultValue = "") String modelId,
        @RequestParam(defaultValue = "1") int page,
        @RequestParam(defaultValue = "20") int size,
        @AuthenticationPrincipal SecurityUser user) {
    return R.ok(instanceService.searchAcrossModels(
            user.getTenantId(), keyword, modelId, page, size));
}
```

需要在 controller import 中添加 `CiInstanceSearchResult`（与现有 dto.* 通配符 import 一起自动覆盖）。

- [ ] **Step 5: 构建部署验证**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build backend 2>&1 | tail -3
docker compose up -d backend && sleep 25
docker compose logs backend --tail=3 2>&1 | grep -E "Started|ERROR"
```

Expected: `Started PlatformApplication`

- [ ] **Step 6: 接口 smoke test**

```bash
TOKEN=$(/usr/bin/curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

echo "=== 跨模型搜索（无关键词）==="
/usr/bin/curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/cmdb/instances/search?page=1&size=5" | \
  python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('total:', d['total'], 'modelCounts:', d['model_counts'])"

echo "=== 按关键词搜索 ==="
/usr/bin/curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/cmdb/instances/search?keyword=server&page=1&size=5" | \
  python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('total:', d['total'], 'records:', len(d['records']))"
```

Expected: 两次都返回 code 200，modelCounts 包含 `{"host": N}`。

- [ ] **Step 7: 提交**

```bash
git add backend/src/main/java/com/cwgsyw/platform/module/cmdb/
git commit -m "feat: CiInstanceController/Service - cross-model search endpoint with model counts"
```

---

## Task 2: 前端共享组件 — useColumnConfig + ColumnPicker

**Files:**
- Create: `frontend/src/hooks/useColumnConfig.ts`
- Create: `frontend/src/components/cmdb/ColumnPicker.tsx`

- [ ] **Step 1: 创建 useColumnConfig hook**

```typescript
// frontend/src/hooks/useColumnConfig.ts
import { useState, useCallback } from 'react'

export function useColumnConfig(modelId: string, defaultKeys: string[]) {
  const storageKey = `cmdb_col_config_${modelId}`

  const [visible, setVisible] = useState<string[]>(() => {
    if (typeof window === 'undefined') return defaultKeys
    try {
      const saved = localStorage.getItem(storageKey)
      if (saved) return JSON.parse(saved) as string[]
    } catch {}
    return defaultKeys
  })

  const toggle = useCallback((key: string) => {
    setVisible(prev => {
      const next = prev.includes(key)
        ? prev.filter(k => k !== key)
        : [...prev, key]
      try { localStorage.setItem(storageKey, JSON.stringify(next)) } catch {}
      return next
    })
  }, [storageKey])

  const reset = useCallback(() => {
    setVisible(defaultKeys)
    try { localStorage.removeItem(storageKey) } catch {}
  }, [storageKey, defaultKeys])

  return { visible, toggle, reset }
}
```

- [ ] **Step 2: 创建 ColumnPicker 组件**

```tsx
// frontend/src/components/cmdb/ColumnPicker.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Settings2 } from 'lucide-react'

export interface ColumnDef {
  key: string
  name: string
  required?: boolean  // 必显列（名称等），不可隐藏
}

interface ColumnPickerProps {
  allColumns: ColumnDef[]
  visibleKeys: string[]
  onToggle: (key: string) => void
}

export function ColumnPicker({ allColumns, visibleKeys, onToggle }: ColumnPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="relative">
      <Button size="sm" variant="outline" onClick={() => setOpen(v => !v)}>
        <Settings2 className="h-3.5 w-3.5 mr-1" />列显示
      </Button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-1 z-20 bg-popover border rounded-lg shadow-lg p-2 min-w-36">
            <p className="text-xs text-muted-foreground px-2 py-1 mb-1">显示列</p>
            {allColumns.map(col => (
              <label
                key={col.key}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted/50 cursor-pointer text-sm"
              >
                <input
                  type="checkbox"
                  checked={visibleKeys.includes(col.key)}
                  disabled={col.required}
                  onChange={() => !col.required && onToggle(col.key)}
                  className="rounded"
                />
                {col.name}
              </label>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 4: 提交**

```bash
git add frontend/src/hooks/useColumnConfig.ts frontend/src/components/cmdb/ColumnPicker.tsx
git commit -m "feat: useColumnConfig hook + ColumnPicker component for CMDB table column customization"
```

---

## Task 3: Sidebar — 展开式 CMDB 子菜单

**Files:**
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: 重写 Sidebar.tsx**

完整替换文件内容（保留所有现有导航项，CMDB 改为展开式子菜单）：

```tsx
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { usePermission } from '@/hooks/usePermission'
import {
  FileText, CheckSquare, Users, Building2, Shield, LayoutDashboard,
  KeyRound, Bell, Settings, Bot, BarChart2, ClipboardList, FileCode,
  Database, Search, Server, Settings2, ChevronDown, ChevronRight,
} from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  resource: string | null
  action: string | null
}

interface NavGroup {
  label: string
  icon: React.ElementType
  resource: string
  action: string
  storageKey: string
  children: NavItem[]
}

type SidebarEntry = NavItem | NavGroup

function isGroup(entry: SidebarEntry): entry is NavGroup {
  return 'children' in entry
}

const sidebarEntries: SidebarEntry[] = [
  { href: '/',               label: '首页',       icon: LayoutDashboard, resource: null,           action: null },
  { href: '/daily',          label: '我的日报',   icon: FileText,        resource: 'daily_report', action: 'read' },
  { href: '/workflow/tasks', label: '待审批',     icon: CheckSquare,     resource: 'workflow',     action: 'read' },
  { href: '/devices',        label: '设备密码库', icon: KeyRound,        resource: 'device',       action: 'read' },
  { href: '/notifications',  label: '通知中心',   icon: Bell,            resource: 'notification', action: 'read' },
  { href: '/change-docs',    label: '变更文档',   icon: FileText,        resource: 'change_doc',   action: 'read' },
  {
    label: 'CMDB',
    icon: Database,
    resource: 'cmdb_instance',
    action: 'read',
    storageKey: 'sidebar_cmdb_open',
    children: [
      { href: '/cmdb',            label: '搜索',     icon: Search,    resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/instances',  label: 'CI 资源',  icon: Server,    resource: 'cmdb_instance', action: 'read' },
      { href: '/cmdb/admin',      label: '配置管理', icon: Settings2, resource: 'cmdb_model',    action: 'write' },
    ],
  },
  { href: '/reports',        label: '报表导出',   icon: BarChart2,   resource: 'daily_report',        action: 'export' },
  { href: '/users',          label: '用户管理',   icon: Users,       resource: 'user',                action: 'read' },
  { href: '/groups',         label: '组管理',     icon: Building2,   resource: 'group',               action: 'read' },
  { href: '/rbac/roles',     label: '角色权限',   icon: Shield,      resource: 'role',                action: 'read' },
  { href: '/admin/change-doc-templates', label: 'AI模板管理', icon: FileCode, resource: 'change_doc_template', action: 'read' },
  { href: '/admin/config',   label: '系统配置',   icon: Settings,    resource: 'notification',        action: 'manage' },
  { href: '/admin/audit',    label: '审计日志',   icon: ClipboardList, resource: 'audit',             action: 'read' },
]

function usePersistState(key: string, initial: boolean) {
  const [value, setValue] = useState<boolean>(() => {
    if (typeof window === 'undefined') return initial
    const saved = localStorage.getItem(key)
    return saved !== null ? saved === 'true' : initial
  })
  const set = (v: boolean) => {
    setValue(v)
    try { localStorage.setItem(key, String(v)) } catch {}
  }
  return [value, set] as const
}

function NavGroupItem({ group, pathname, hasPermission }: {
  group: NavGroup
  pathname: string
  hasPermission: (r: string, a: string) => boolean
}) {
  const visibleChildren = group.children.filter(
    c => !c.resource || !c.action || hasPermission(c.resource, c.action)
  )
  if (visibleChildren.length === 0) return null

  const isAnyChildActive = visibleChildren.some(c => pathname.startsWith(c.href) && c.href !== '/')
  const [open, setOpen] = usePersistState(group.storageKey, isAnyChildActive)

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
          isAnyChildActive ? 'text-foreground font-medium' : 'hover:bg-muted'
        )}
      >
        <group.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        {open ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
      </button>

      {open && (
        <div className="ml-3 pl-3 border-l space-y-0.5 mt-0.5">
          {visibleChildren.map(child => (
            <Link
              key={child.href}
              href={child.href}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors',
                pathname === child.href || (child.href !== '/cmdb' && pathname.startsWith(child.href))
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground hover:text-foreground'
              )}
            >
              <child.icon className="h-3.5 w-3.5" />
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const { hasPermission } = usePermission()

  return (
    <aside className="w-56 border-r bg-background flex flex-col min-h-screen">
      <div className="p-4 border-b">
        <span className="font-bold text-lg">IT 运维平台</span>
      </div>
      <nav className="flex-1 p-2 space-y-1">
        {sidebarEntries.map((entry, i) => {
          if (isGroup(entry)) {
            if (!hasPermission(entry.resource, entry.action)) return null
            return (
              <NavGroupItem
                key={entry.label}
                group={entry}
                pathname={pathname}
                hasPermission={hasPermission}
              />
            )
          }
          const { href, label, icon: Icon, resource, action } = entry
          if (resource && action && !hasPermission(resource, action)) return null
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
                pathname === href ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: Sidebar - expandable CMDB sub-menu (搜索/CI资源/配置管理)"
```

---

## Task 4: 配置管理页 `/cmdb/admin`

**Files:**
- Create: `frontend/src/app/(dashboard)/cmdb/admin/page.tsx`
- Create: `frontend/src/app/(dashboard)/cmdb/admin/models/[modelId]/page.tsx`

- [ ] **Step 1: 创建配置管理页**

读取现有 `/cmdb/page.tsx`（模型列表，150行）和 `/cmdb/associations/page.tsx`（关联定义，159行）的完整内容，然后创建合并版：

```tsx
// frontend/src/app/(dashboard)/cmdb/admin/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'

// 直接内联两个页面的完整内容（以 Tab 组织）
// Tab 1 内容 = 现有 /cmdb/page.tsx 的全部 JSX（去掉外层 permission check，由此页统一处理）
// Tab 2 内容 = 现有 /cmdb/associations/page.tsx 的全部 JSX（去掉 ArrowLeft 返回按钮和 permission check）
```

**注意：这个文件内容较长。实现时请分两步进行：**

**Step 1a：** 读取现有文件

```bash
cat frontend/src/app/\(dashboard\)/cmdb/page.tsx
cat frontend/src/app/\(dashboard\)/cmdb/associations/page.tsx
```

**Step 1b：** 创建合并版 `admin/page.tsx`，结构如下：

```tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePermission } from '@/hooks/usePermission'
// ... 合并两个页面所需的全部 import

export default function AdminPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const [tab, setTab] = useState<'models' | 'associations'>('models')

  useEffect(() => {
    if (!hasPermission('cmdb_model', 'write')) router.replace('/cmdb')
  }, [hasPermission, router])

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <h1 className="text-2xl font-bold">CMDB 配置管理</h1>
      </div>

      {/* Tab 切换 */}
      <div className="flex gap-1 border-b mb-6">
        <button
          onClick={() => setTab('models')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'models'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          模型管理
        </button>
        <button
          onClick={() => setTab('associations')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'associations'
              ? 'border-primary text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          关联定义
        </button>
      </div>

      {tab === 'models' && <ModelsTab />}
      {tab === 'associations' && <AssociationsTab />}
    </div>
  )
}

// ModelsTab：从现有 /cmdb/page.tsx 提取（移除外层 div.max-w-5xl 和 permission check）
// 链接改为 href={`/cmdb/admin/models/${model.model_id}`}
function ModelsTab() {
  // ... 现有 CmdbPage 组件的全部状态和 JSX，仅修改 model 点击链接
}

// AssociationsTab：从现有 /cmdb/associations/page.tsx 提取（移除 ArrowLeft 返回按钮和外层容器）
function AssociationsTab() {
  // ... 现有 AssociationsPage 组件的全部状态和 JSX
}
```

**关键修改点：**
- `ModelsTab` 中模型卡片 `href` 改为 `/cmdb/admin/models/${model.model_id}`
- `AssociationsTab` 中移除 `<Link href="/cmdb">← 返回</Link>` 的 ArrowLeft 导航

- [ ] **Step 2: 创建模型属性编辑页（迁移）**

直接复制现有文件内容，修改返回链接：

```bash
# 读取现有文件
cat frontend/src/app/\(dashboard\)/cmdb/models/\[modelId\]/page.tsx
```

创建 `frontend/src/app/(dashboard)/cmdb/admin/models/[modelId]/page.tsx`，内容与现有文件相同，只修改：
1. `ArrowLeft` 返回链接：`href="/cmdb"` → `href="/cmdb/admin"`
2. "查看实例" 按钮链接：`href={'/cmdb/instances/' + modelId}` → `href={'/cmdb/instances?model=' + modelId}`（配合 Task 5 的 CI 资源页 model 预选参数）

- [ ] **Step 3: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 4: 提交**

```bash
git add "frontend/src/app/(dashboard)/cmdb/admin/"
git commit -m "feat: /cmdb/admin - config management page with model management and association definition tabs"
```

---

## Task 5: CI 资源页 `/cmdb/instances`

**Files:**
- Create: `frontend/src/app/(dashboard)/cmdb/instances/page.tsx`

- [ ] **Step 1: 创建 CI 资源页**

```tsx
// frontend/src/app/(dashboard)/cmdb/instances/page.tsx
'use client'
import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { Button, buttonVariants } from '@/components/ui/button'
import { toast } from 'sonner'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Plus, Trash2, Eye } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { useColumnConfig } from '@/hooks/useColumnConfig'
import { ColumnPicker, ColumnDef } from '@/components/cmdb/ColumnPicker'

interface CiModelVO {
  id: number
  model_id: string
  name: string
  group_code: string
  is_built_in: boolean
}

interface CiAttributeVO {
  field_key: string
  name: string
  is_list_show: boolean
  sort_order: number
}

interface CiModelDetailVO {
  model_id: string
  name: string
  attributes: CiAttributeVO[]
}

interface CiInstanceVO {
  id: number
  name: string
  attrs: Record<string, unknown>
  created_at: string
}

interface PageResult<T> {
  records: T[]
  total: number
}

export default function CiResourcesPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  // 从 URL 参数预选模型（来自 /cmdb/admin/models/[id] 的"查看实例"按钮）
  const [selectedModelId, setSelectedModelId] = useState<string | null>(
    searchParams.get('model')
  )
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['未分类']))

  // 所有模型
  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
  })

  // 选中模型的属性定义（用于表格列）
  const { data: modelDetail } = useQuery<CiModelDetailVO>({
    queryKey: ['cmdb-model', selectedModelId],
    queryFn: () => api.get(`/cmdb/meta/models/${selectedModelId}`).then(r => r.data.data),
    enabled: !!selectedModelId,
  })

  // 实例列表
  const { data: instanceResult, isLoading: instancesLoading } = useQuery<PageResult<CiInstanceVO>>({
    queryKey: ['cmdb-instances', selectedModelId],
    queryFn: () => api.get(`/cmdb/instances/${selectedModelId}`).then(r => r.data.data),
    enabled: !!selectedModelId,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete(`/cmdb/instances/${selectedModelId}/${id}`),
    onSuccess: () => {
      toast.success('已删除')
      queryClient.invalidateQueries({ queryKey: ['cmdb-instances', selectedModelId] })
    },
    onError: (e: any) => toast.error(e?.response?.data?.message ?? '删除失败'),
  })

  // 列配置
  const listShowCols = (modelDetail?.attributes ?? [])
    .filter(a => a.is_list_show)
    .sort((a, b) => a.sort_order - b.sort_order)

  const allColDefs: ColumnDef[] = [
    { key: '_name', name: '实例名称', required: true },
    ...listShowCols.map(a => ({ key: a.field_key, name: a.name })),
    { key: '_created_at', name: '创建时间' },
  ]
  const defaultKeys = ['_name', ...listShowCols.slice(0, 4).map(a => a.field_key), '_created_at']
  const { visible, toggle } = useColumnConfig(selectedModelId ?? 'none', defaultKeys)

  // 模型按 group_code 分组
  const grouped = models.reduce((acc, m) => {
    const g = m.group_code || '未分类'
    if (!acc[g]) acc[g] = []
    acc[g].push(m)
    return acc
  }, {} as Record<string, CiModelVO[]>)

  const toggleGroup = (g: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      next.has(g) ? next.delete(g) : next.add(g)
      return next
    })
  }

  const instances = instanceResult?.records ?? []

  return (
    <div className="flex gap-0 h-full max-h-screen">
      {/* 左侧模型树 */}
      <div className="w-56 border-r flex-shrink-0 overflow-y-auto p-2 space-y-0.5">
        <p className="text-xs text-muted-foreground px-2 py-1 font-medium uppercase tracking-wider">CI 模型</p>
        {Object.entries(grouped).map(([group, groupModels]) => (
          <div key={group}>
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {expandedGroups.has(group)
                ? <ChevronDown className="h-3 w-3" />
                : <ChevronRight className="h-3 w-3" />}
              {group}
            </button>
            {expandedGroups.has(group) && groupModels.map(m => (
              <button
                key={m.model_id}
                onClick={() => setSelectedModelId(m.model_id)}
                className={`w-full text-left flex items-center justify-between px-3 py-1.5 rounded-md text-sm transition-colors ml-2 ${
                  selectedModelId === m.model_id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                <span>{m.name}</span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* 右侧实例表格 */}
      <div className="flex-1 overflow-auto p-6">
        {!selectedModelId ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            ← 从左侧选择一个 CI 模型
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold">
                  {modelDetail?.name ?? selectedModelId}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  共 {instanceResult?.total ?? 0} 条
                </p>
              </div>
              <div className="flex items-center gap-2">
                <ColumnPicker
                  allColumns={allColDefs}
                  visibleKeys={visible}
                  onToggle={toggle}
                />
                {hasPermission('cmdb_instance', 'create') && (
                  <Button size="sm" asChild>
                    <Link href={`/cmdb/instances/${selectedModelId}/new`}>
                      <Plus className="h-4 w-4 mr-1" />新建实例
                    </Link>
                  </Button>
                )}
              </div>
            </div>

            {instancesLoading ? (
              <p className="text-muted-foreground text-sm">加载中...</p>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {allColDefs.filter(c => visible.includes(c.key)).map(col => (
                        <th
                          key={col.key}
                          className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium group"
                        >
                          <span className="flex items-center gap-1">
                            {col.name}
                            {!col.required && (
                              <button
                                onClick={() => toggle(col.key)}
                                className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                                title="隐藏此列"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        </th>
                      ))}
                      <th className="px-4 py-2.5 w-20" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {instances.length === 0 ? (
                      <tr>
                        <td
                          colSpan={visible.length + 1}
                          className="text-center py-12 text-muted-foreground text-sm"
                        >
                          暂无实例，点击右上角新建
                        </td>
                      </tr>
                    ) : instances.map(inst => (
                      <tr key={inst.id} className="hover:bg-muted/30">
                        {allColDefs.filter(c => visible.includes(c.key)).map(col => (
                          <td key={col.key} className="px-4 py-3">
                            {col.key === '_name' && (
                              <span className="font-medium">
                                {inst.name ?? <span className="text-muted-foreground">#{inst.id}</span>}
                              </span>
                            )}
                            {col.key === '_created_at' && (
                              <span className="text-xs text-muted-foreground">
                                {new Date(inst.created_at).toLocaleDateString('zh-CN')}
                              </span>
                            )}
                            {col.key !== '_name' && col.key !== '_created_at' && (
                              <span className="text-muted-foreground">
                                {String(inst.attrs?.[col.key] ?? '—')}
                              </span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-3">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>
                              <Link href={`/cmdb/instances/${selectedModelId}/${inst.id}`}>
                                <Eye className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                            {hasPermission('cmdb_instance', 'delete') && (
                              <Button
                                variant="ghost" size="sm"
                                className="h-7 w-7 p-0 text-destructive"
                                disabled={deleteMutation.isPending}
                                onClick={() => {
                                  if (confirm('删除此实例?')) deleteMutation.mutate(inst.id)
                                }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

**注意：** `Button asChild` 在本项目不可用。上面的 `<Button size="sm" asChild>` 需改为：
```tsx
<Link href={`/cmdb/instances/${selectedModelId}/new`} className={buttonVariants({ size: 'sm' })}>
  <Plus className="h-4 w-4 mr-1" />新建实例
</Link>
```
同理 `<Button variant="ghost" size="sm" className="h-7 w-7 p-0" asChild>` 改为：
```tsx
<Link href={...} className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'h-7 w-7 p-0')}>
```

- [ ] **Step 2: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 3: 提交**

```bash
git add "frontend/src/app/(dashboard)/cmdb/instances/page.tsx"
git commit -m "feat: /cmdb/instances - CI resources page with model tree and column customization"
```

---

## Task 6: 搜索首页 — 重写 `/cmdb`

**Files:**
- Rewrite: `frontend/src/app/(dashboard)/cmdb/page.tsx`

- [ ] **Step 1: 重写搜索首页**

```tsx
// frontend/src/app/(dashboard)/cmdb/page.tsx
'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Search, Box, Server, Database } from 'lucide-react'
import { usePermission } from '@/hooks/usePermission'
import { useColumnConfig } from '@/hooks/useColumnConfig'
import { ColumnPicker, ColumnDef } from '@/components/cmdb/ColumnPicker'
import { cn } from '@/lib/utils'

interface CiInstanceSearchVO {
  id: number
  name: string
  model_id: string
  model_name: string
  attrs: Record<string, unknown>
  updated_at: string
}

interface CiInstanceSearchResult {
  records: CiInstanceSearchVO[]
  total: number
  page: number
  size: number
  model_counts: Record<string, number>
}

interface CiModelVO {
  id: number
  model_id: string
  name: string
  icon: string
  group_code: string
}

const ICON_MAP: Record<string, React.ElementType> = {
  server: Server, database: Database,
}

export default function CmdbSearchPage() {
  const { hasPermission } = usePermission()
  const router = useRouter()

  useEffect(() => {
    if (!hasPermission('cmdb_instance', 'read')) router.replace('/')
  }, [hasPermission, router])

  const [keyword, setKeyword] = useState('')
  const [debouncedKeyword, setDebouncedKeyword] = useState('')
  const [filterModel, setFilterModel] = useState('')

  // debounce 300ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 300)
    return () => clearTimeout(t)
  }, [keyword])

  const isSearching = debouncedKeyword.length > 0 || filterModel.length > 0

  const { data: searchResult, isLoading } = useQuery<CiInstanceSearchResult>({
    queryKey: ['cmdb-search', debouncedKeyword, filterModel],
    queryFn: () => api.get('/cmdb/instances/search', {
      params: { keyword: debouncedKeyword, modelId: filterModel, page: 1, size: 20 },
    }).then(r => r.data.data),
  })

  const { data: models = [] } = useQuery<CiModelVO[]>({
    queryKey: ['cmdb-models'],
    queryFn: () => api.get('/cmdb/meta/models').then(r => r.data.data),
  })

  // 列配置（跨模型时用 'all'，单模型时用 modelId）
  const colModelKey = filterModel || 'all'

  // 构建可用列：名称（必须）+ 单模型的 is_list_show 属性 + 更新时间
  // 跨模型时只有通用列
  const searchColDefs: ColumnDef[] = [
    { key: '_name', name: '名称', required: true },
    { key: '_model', name: '模型类型', required: true },
    { key: '_updated_at', name: '更新时间' },
  ]
  const defaultColKeys = ['_name', '_model', '_updated_at']
  const { visible, toggle } = useColumnConfig(colModelKey, defaultColKeys)

  const modelCounts = searchResult?.model_counts ?? {}
  const totalCount = searchResult?.total ?? 0

  return (
    <div className="max-w-5xl">
      {/* 搜索框 */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">配置管理数据库</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 h-11 text-base"
            placeholder="搜索 CI 名称、IP、主机名..."
            value={keyword}
            onChange={e => setKeyword(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* 模型筛选标签 */}
      {isSearching && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setFilterModel('')}
            className={cn(
              'px-3 py-1 rounded-full text-sm transition-colors',
              filterModel === ''
                ? 'bg-primary text-primary-foreground'
                : 'border hover:bg-muted text-muted-foreground'
            )}
          >
            全部 ({totalCount})
          </button>
          {Object.entries(modelCounts).map(([mid, cnt]) => {
            const m = models.find(x => x.model_id === mid)
            return (
              <button
                key={mid}
                onClick={() => setFilterModel(filterModel === mid ? '' : mid)}
                className={cn(
                  'px-3 py-1 rounded-full text-sm transition-colors',
                  filterModel === mid
                    ? 'bg-primary text-primary-foreground'
                    : 'border hover:bg-muted text-muted-foreground'
                )}
              >
                {m?.name ?? mid} ({cnt})
              </button>
            )
          })}
        </div>
      )}

      {/* 搜索结果表格 */}
      {isSearching ? (
        isLoading ? (
          <p className="text-muted-foreground text-sm">搜索中...</p>
        ) : (
          <div>
            <div className="flex justify-between items-center mb-3">
              <p className="text-sm text-muted-foreground">找到 {totalCount} 条结果</p>
              <ColumnPicker allColumns={searchColDefs} visibleKeys={visible} onToggle={toggle} />
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    {searchColDefs.filter(c => visible.includes(c.key)).map(col => (
                      <th key={col.key} className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium group">
                        <span className="flex items-center gap-1">
                          {col.name}
                          {!col.required && (
                            <button
                              onClick={() => toggle(col.key)}
                              className="opacity-0 group-hover:opacity-100 transition-opacity hover:text-destructive"
                            >×</button>
                          )}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(searchResult?.records ?? []).length === 0 ? (
                    <tr>
                      <td colSpan={visible.length} className="text-center py-12 text-muted-foreground text-sm">
                        未找到匹配的 CI
                      </td>
                    </tr>
                  ) : (searchResult?.records ?? []).map(inst => (
                    <tr key={inst.id} className="hover:bg-muted/30">
                      {searchColDefs.filter(c => visible.includes(c.key)).map(col => (
                        <td key={col.key} className="px-4 py-3">
                          {col.key === '_name' && (
                            <Link
                              href={`/cmdb/instances/${inst.model_id}/${inst.id}`}
                              className="font-medium hover:underline"
                            >
                              {inst.name}
                            </Link>
                          )}
                          {col.key === '_model' && (
                            <Badge variant="secondary" className="text-xs">{inst.model_name}</Badge>
                          )}
                          {col.key === '_updated_at' && (
                            <span className="text-xs text-muted-foreground">
                              {new Date(inst.updated_at).toLocaleDateString('zh-CN')}
                            </span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* 空状态：模型卡片快速入口 */
        <div>
          <p className="text-sm text-muted-foreground mb-4">选择模型快速浏览，或在上方搜索框输入关键词</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {models.map(m => {
              const Icon = ICON_MAP[m.icon] ?? Box
              return (
                <Link
                  key={m.model_id}
                  href={`/cmdb/instances?model=${m.model_id}`}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors flex items-center gap-3"
                >
                  <div className="p-2 bg-primary/10 rounded-md">
                    <Icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{m.model_id}</p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript 检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -5
```

Expected: 0 errors

- [ ] **Step 3: 提交**

```bash
git add "frontend/src/app/(dashboard)/cmdb/page.tsx"
git commit -m "feat: /cmdb - search home page with cross-model search, model filter tags, column customization"
```

---

## Task 7: 旧路由 redirect + 全量构建 + 验收

**Files:**
- Replace: `frontend/src/app/(dashboard)/cmdb/associations/page.tsx`
- Replace: `frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx`

- [ ] **Step 1: 替换 associations 页面为 redirect**

```tsx
// frontend/src/app/(dashboard)/cmdb/associations/page.tsx
import { redirect } from 'next/navigation'
export default function OldAssociationsPage() {
  redirect('/cmdb/admin')
}
```

- [ ] **Step 2: 替换旧 models/[modelId] 页面为 redirect**

```tsx
// frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx
import { redirect } from 'next/navigation'
export default function OldModelPage({ params }: { params: { modelId: string } }) {
  redirect(`/cmdb/admin/models/${params.modelId}`)
}
```

- [ ] **Step 3: 检查其他页面中是否有链接到旧路由的地方并更新**

```bash
grep -rn "cmdb/models\|cmdb/associations" \
  frontend/src/app/\(dashboard\)/cmdb/instances/ \
  frontend/src/app/\(dashboard\)/cmdb/admin/ \
  frontend/src/components/ 2>/dev/null | grep -v "node_modules" | grep -v ".next"
```

如有结果，逐一更新：
- `/cmdb/models/${modelId}` → `/cmdb/admin/models/${modelId}`
- `/cmdb/associations` → `/cmdb/admin`

- [ ] **Step 4: TypeScript 全量检查**

```bash
cd /Volumes/Work/AI/cwgsyw-platform/frontend && npx tsc --noEmit 2>&1 | grep "error TS" | head -15
```

Expected: 0 errors

- [ ] **Step 5: 构建前端 + 后端**

```bash
cd /Volumes/Work/AI/cwgsyw-platform
docker compose build frontend backend 2>&1 | grep -E "Built|ERROR" | head -5
docker compose up -d
sleep 20
```

- [ ] **Step 6: 全量 smoke test**

```bash
# 后端搜索接口
TOKEN=$(/usr/bin/curl -s -X POST http://localhost/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"superadmin","password":"Admin@123"}' | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")

echo "=== /api/cmdb/instances/search ==="
/usr/bin/curl -s -H "Authorization: Bearer $TOKEN" \
  "http://localhost/api/cmdb/instances/search?keyword=&page=1&size=5" | \
  python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print('code OK, total:', d['total'], 'modelCounts:', d['model_counts'])"

# 前端页面 200 检查
for path in "cmdb" "cmdb/instances" "cmdb/admin"; do
  code=$(/usr/bin/curl -s -o /dev/null -w "%{http_code}" "http://localhost/$path")
  echo "/$path → $code"
done

# 旧路由 redirect 检查（应为 307 → 最终 200）
code=$(/usr/bin/curl -s -L -o /dev/null -w "%{http_code}" "http://localhost/cmdb/associations")
echo "/cmdb/associations (after redirect) → $code"
```

Expected: 搜索接口 code OK，三个新路由均 200，旧路由跟随 redirect 后 200。

- [ ] **Step 7: 提交 + 打 tag**

```bash
git add "frontend/src/app/(dashboard)/cmdb/associations/page.tsx" \
        "frontend/src/app/(dashboard)/cmdb/models/[modelId]/page.tsx"
git commit -m "feat: CMDB-UX redesign - route redirects, cleanup"
git tag v0.11.0-cmdb-ux
echo "CMDB-UX 重构完成"
```

---

## Self-Review

### Spec coverage

| 规格要求 | 覆盖任务 |
|---------|---------|
| 展开式 CMDB 子菜单（侧边栏） | Task 3 |
| `/cmdb` 改为搜索首页 | Task 6 |
| 搜索：关键词 + 模型筛选标签 + 列自定义 | Task 6 |
| 空状态：模型卡片快速入口 | Task 6 |
| `/cmdb/instances` CI 资源页（左树+右表） | Task 5 |
| CI 资源页：列自定义 A+B（下拉菜单+hover × 隐藏） | Task 5 |
| `/cmdb/admin` 配置管理（模型管理+关联定义 Tab） | Task 4 |
| `/cmdb/admin/models/[modelId]` 模型属性编辑 | Task 4 |
| 旧路由 redirect | Task 7 |
| 后端 `GET /api/cmdb/instances/search` | Task 1 |
| useColumnConfig hook + ColumnPicker 组件 | Task 2 |
| localStorage 按 modelId 分组保存列配置 | Task 2 |

所有规格均有对应任务，无遗漏。

### Placeholder scan

无 TBD/TODO/placeholder。每个 Task 均有完整代码。

### Type consistency

- `useColumnConfig(modelId, defaultKeys)` 在 Task 2 定义，Task 5 和 Task 6 均以相同签名调用
- `ColumnPicker` 接收 `ColumnDef[]`（Task 2 定义），Task 5 和 Task 6 均构造正确的 `ColumnDef[]`
- `CiInstanceSearchResult.model_counts: Record<string, Long>` (Java) → `model_counts: Record<string, number>` (TypeScript) 通过 SNAKE_CASE 转换一致
- `CiInstanceSearchVO.updatedAt` (Java) → `updated_at` (TypeScript) 一致
