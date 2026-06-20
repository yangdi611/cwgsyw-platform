# Issue #62 — P0 回归复现定位报告

> 复现+定位时间：2026-06-18 11:59
> 复现方式：nginx:80 真实访问 + 源码静态分析 + 编译 chunk 确认
> 定位目标：只定位不改代码

---

## 问题 1: `/api/notifications/unread-count` 403

### 复现

```
GET /api/notifications/unread-count → 403 (Content-Length: 0)
```

后端日志：**没有任何日志** — 请求在 Spring Security filter 链被拒绝，未到达 Controller。

### 根因

`NotificationController.java` 所有 endpoint 都标注了：

```java
@PreAuthorize("hasAuthority('notification:read')")
```

当前登录用户**没有** `notification:read` 这个 RBAC 权限，Spring Security 直接返回 403 空体。

### 前端降级情况

`NotificationBell.tsx` 有 `.catch(() => 0)`，所以 **403 本身不会导致页面崩溃**。但 axios interceptor (`api.ts` line 22–24) 会在 catch 之前先打印 `[API 403] Forbidden: /notifications/unread-count`，这是 Issue 中 console 日志的来源。

结论：403 **已降级**，不导致崩溃。Console 的 warning 是 axios 拦截器的正常输出。

### 修复点

两个方案（任选一）：

**方案 A**（推荐）：给用户/角色添加 `notification:read` 权限（从 RBAC 层面解决）。

**方案 B**（防御性）：将 `@PreAuthorize("hasAuthority('notification:read')")` 改为 `@PreAuthorize("isAuthenticated()")`，允许任何已登录用户查看未读通知数。

---

## 问题 2: `m.reduce is not a function` — Layout 崩溃

### 复现

访问任意 CMDB 页面（如 `/cmdb/models`），控制台报错：

```
layout-8af7b753a1402dfd.js:1 Uncaught TypeError: m.reduce is not a function
    at f (layout-8af7b753a1402dfd.js:1:2813)
```

### 根因

**文件**: `frontend/src/app/(dashboard)/cmdb/layout.tsx` 第 44–45 行

```typescript
const r = await api.get('/cmdb/models')
return r.data.data  // ← 这返回的是 PageResult 对象，不是数组
```

实际 API 响应结构（`R<PageResult<CiModelVO>>`）：

```json
{
  "code": 200,
  "message": "success",
  "data": {
    "records": [...],   // ← 真正的数组在这里
    "total": 10,
    "page": 1,
    "size": 20
  }
}
```

所以 `r.data.data` 是 `{ records, total, page, size }` — 一个对象，不是数组。

然后第 55 行 `models.reduce(...)` 在非数组对象上调用 `.reduce()`，抛出 `TypeError: m.reduce is not a function`。

**证据**:
- 编译后的 `layout-8af7b753a1402dfd.js` 确认包含 `m.reduce((e, t) => { ... })`，`m` 即 `models`
- `models/page.tsx` 同类 API 调用正确使用了 `data?.records ?? []`（第 65 行），证明相同 API 的正确处理方式
- `CiModelController.list()` 返回 `R<PageResult<CiModelVO>>`，不是裸列表
- `R<T>` 结构: `{ code, message, data }`；`PageResult<T>` 结构: `{ records, total, page, size }`

### 影响

**CMDB 所有页面全局崩溃** — 因为 `cmdb/layout.tsx` 是所有 CMDB 子页面的父布局，它一旦抛异常，Next.js 会卸载整个布局树。用户看到白屏或空白。

### 修复点

`frontend/src/app/(dashboard)/cmdb/layout.tsx` 第 45 行：

```typescript
// 改前
return r.data.data
// 改后
return r.data.data?.records ?? []
```

---

## 问题 3: `/cmdb/models/1` 和 `/cmdb/models/2` 的 RSC 404

### 复现

从 CMDB 模型列表页点击模型名称链接，浏览器触发 RSC 请求：

```
GET /cmdb/models/1?_rsc=1x9ev → 404 (278 bytes, HTML 错误页)
GET /cmdb/models/2?_rsc=1x9ev → 404 (278 bytes, HTML 错误页)
```

### 根因

**文件**: `frontend/src/app/(dashboard)/cmdb/models/page.tsx` 第 194 行

```typescript
<Link href={`/cmdb/models/${m.id}`} className="font-medium hover:underline">{m.name}</Link>
```

链接目标是 `/cmdb/models/{modelId}`，但 **这个 Next.js 路由不存在**。

模型详情页的实际路由是 `/cmdb/admin/models/[modelId]`，对应文件路径：
`frontend/src/app/(dashboard)/cmdb/admin/models/[modelId]/page.tsx`

路由目录结构确认：
```
cmdb/
├── models/
│   └── page.tsx          ← 模型列表（存在）
│   └── [modelId]/        ← 不存在！
├── admin/
│   └── models/
│       └── [modelId]/
│           └── page.tsx  ← 模型详情（在这里）
```

### 影响

用户点击模型名称链接后导航到 404 页面，严重影响 CMDB 模型管理体验。但这个 404 不会导致 layout 崩溃 — 它只是路由层面的 404。

### 修复点

`frontend/src/app/(dashboard)/cmdb/models/page.tsx` 第 194 行：

```typescript
// 改前
<Link href={`/cmdb/models/${m.id}`}>
// 改后
<Link href={`/cmdb/admin/models/${m.id}`}>
```

---

## 崩溃链总结

```
1. 用户登录 → 访问任意 CMDB 页面
2. (dashboard)/layout.tsx 渲染 Header → NotificationBell → API 403（已降级，不崩溃）
3. cmdb/layout.tsx 调用 api.get('/cmdb/models') → r.data.data 返回 PageResult 对象
4. models.reduce() 在 PageResult 对象上调用 → TypeError: m.reduce is not a function
5. Next.js 卸载整个 cmdb layout 树 → 页面白屏/空白
6. 用户在模型列表页点击模型名 → /cmdb/models/1 → 路由 404（叠加问题）
```

**三个问题独立存在，但崩溃（问题 2）是 P0 的罪魁祸首。修复优先级：问题 2 > 问题 3 > 问题 1。**

---

## 修复任务拆分

| # | 文件 | 改什么 | 难度 |
|---|------|--------|------|
| 1 | `cmdb/layout.tsx` L45 | `r.data.data` → `r.data.data?.records ?? []` | 1行 |
| 2 | `cmdb/models/page.tsx` L194 | `/cmdb/models/${m.id}` → `/cmdb/admin/models/${m.id}` | 1行 |
| 3 | `NotificationController.java` L28 | 决定权限策略（加权限 or 改 isAuthenticated） | 决策 |
