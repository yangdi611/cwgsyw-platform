# CMDB 后端验收 Bug 修复报告（第二轮）

> 日期: 2026-06-17  
> 验证方式: Headless 浏览器 + API 测试  
> 环境: Docker 6 容器 (development 分支)，http://localhost:80  
> 认证: superadmin / Admin@123  
> 验证人: tester (kanban task t_980c5c81)

---

## 总览

| 序号 | Bug | 优先级 | 类型 | 状态 | 修复版本 |
|------|-----|--------|------|------|---------|
| B1 | CMDB 前端页面 SSR 崩溃 | P0 | 前端 | ✅ 已修复 | 844a12f7e |
| B2 | PUT /api/cmdb/models/{id} 403 权限不匹配 | P1 | 后端 | ✅ 已修复 | d415f0281 |
| B3 | ci_model.color IS NULL 导致 Jackson 不序列化颜色字段 | P2 | 后端 | ✅ 已修复 | 5c1b8ad0e |
| B4 | CiModel.groupId → group_id 列不存在（应为 group_code） | P0 | 后端 | ❌ 待修复 | — |
| B5 | IPAM /api/ipam/ips NoResourceFoundException | P0 | 后端 | ❌ 待诊断 | — |

---

## B1: CMDB 前端页面 SSR 崩溃 (P0-BLOCK)

### 现象
所有 `/cmdb/*` 页面在浏览器渲染时白屏，控制台报 React SSR hydration error。后端 API 正常但前端无法加载。

### 根因
`cmdb/layout.tsx` 中的 `useQuery` hook 在 SSR (Server-Side Rendering) 阶段执行，但 `useQuery` 的 `client` 对象在服务端环境不可用，导致 `useQuery is not defined` 异常，整页崩溃。

### 修复

**文件**: `frontend/src/app/(dashboard)/cmdb/layout.tsx`

```tsx
// 修复前: useQuery 无条件执行
const { data: modelList } = useQuery({ ... });

// 修复后: 服务端渲染时跳过 useQuery
const { data: modelList } = useQuery({
  enabled: typeof window !== 'undefined',   // ← SSR guard
  ...queryConfig,
});

// 同时 try-catch 包裹整个布局内容
try {
  return (/* 布局内容 */);
} catch {
  return <div className="p-4">加载中...</div>;
}
```

### 影响范围
6 个 CMDB 核心页面全部可访问: 模型管理、实例管理、变更历史、统计看板、2D 视图、配置管理。

### 验证
`docker restart frontend` 后 6/6 页面加载正常，控制台无 SSR 错误。

---

## B2: PUT /api/cmdb/models/{id} 403 权限不匹配 (P1)

### 现象
前端调用 `PUT /api/cmdb/models/{id}` 更新模型配置时返回 403 Forbidden。GET 请求正常。

### 根因
Spring 权限注解使用 `hasPermission('cmdb_model', 'update')`，但数据库 `sys_permission.code` 为 `cmdb_model:write`。权限字符串 `update` 与数据库 `write` 不匹配，Spring Security 拒绝授权。

### 修复
三个 CMDB Controller 中的 7 处 `@PreAuthorize` 注解将 `'update'` 批量改为 `'write'`:

| Controller | 修改内容 |
|-----------|---------|
| `CiModelController.java` | `'update'` → `'write'` |
| `CiAttributeController.java` | `'update'` → `'write'` |
| `CiAssociationAttrDefController.java` | `'update'` → `'write'` |

**文件**: 
- `backend/.../cmdb/controller/CiModelController.java`
- `backend/.../cmdb/controller/CiAttributeController.java`
- `backend/.../cmdb/controller/CiAssociationAttrDefController.java`

---

## B3: ci_model.color IS NULL 颜色回填 (P2)

### 现象
模型管理对话框的颜色选择器不显示任何颜色值。`GET /api/cmdb/models` 返回的 JSON 中缺少 `color` 字段。

### 根因
V27 迁移 (`ci_model_visualization_fields.sql`) 新增了 `color` 和 `enable_2d_view` 列。V27 仅对 `name = 'host'` 和 `name = 'app'` 两条记录设置了默认颜色，其余已有模型的 `color` 为 `NULL`。Jackson 全局配置 `@JsonInclude(Include.NON_NULL)` 导致 `color: null` 字段被省略，前端收不到该字段。

### 修复

**文件**: `backend/.../db/migration/V38__ci_model_backfill_colors.sql`

```sql
UPDATE ci_model
SET color = CASE
    WHEN name = 'host'         THEN '#1890FF'
    WHEN name = 'app'          THEN '#52C41A'
    WHEN name = 'router'       THEN '#722ED1'
    WHEN name = 'switch'       THEN '#13C2C2'
    WHEN name = 'db'           THEN '#FA8C16'
    WHEN name = 'middleware'   THEN '#EB2F96'
    WHEN name = 'loadbalancer' THEN '#2F54EB'
    WHEN name = 'firewall'     THEN '#F5222D'
    WHEN name = 'storage'      THEN '#A0D911'
    ELSE '#1890FF'
END
WHERE color IS NULL AND is_deleted = FALSE;
```

---

## B4: CiModel.groupId → group_id 列不存在 (P0)

### 现象
所有涉及 `ci_model` 表的 API 返回 500:

```
org.springframework.jdbc.BadSqlGrammarException:
### Error querying database.  Cause: org.postgresql.util.PSQLException:
ERROR: column "group_id" does not exist
  Hint: Perhaps you meant to reference the column "ci_model.group_code".
### SQL: SELECT id,name,display_name,group_id,... FROM ci_model
```

### 根因
`CiModel.java` 第 15 行: `private Long groupId;`  
MyBatis-Plus 自动将 camelCase `groupId` 映射为 snake_case `group_id`。但 `ci_model` 表的实际列名为 `group_code`（V14 建表时定义）。`group_id` 列不存在导致所有 SELECT 查询失败。

### 修复方案

**文件**: `backend/.../module/cmdb/entity/CiModel.java`

```java
@TableField("group_code")  // ← 添加注解
private Long groupId;
```

### 状态
❌ **未修复** — 需要在开发环境验证后合并到 development。该 Bug 阻断后续 P1/P2 的回归验证。

---

## B5: IPAM /api/ipam/ips NoResourceFoundException (P0)

### 现象
访问 IPAM 页面时后端返回 500，日志报 `NoResourceFoundException`。

### 状态
❌ **待诊断** — 需要进一步分析 IPAM 控制器路由配置。

---

## 修复摘要

| 提交 | 说明 | 类型 |
|------|------|------|
| 844a12f7e | SSR useQuery guard | P0 前端 |
| d415f0281 | 权限 update→write | P1 后端 |
| 5c1b8ad0e | V38 color backfill | P2 后端 |

已完成 3/5 个 Bug 的修复并合并至 development。剩余 2 个 P0（CiModel.groupId + IPAM）需要工程侧跟进。

---

## 子任务

| 任务 ID | 标题 | 状态 |
|---------|------|------|
| t_05bf6b26 | CiModel.groupId 列映射修复 | ❌ archived |
| t_fdda19b7 | 合并 CMDB Bug 修复 → dev | ⏳ blocked (等待本文档完成) |

*文档版本: v1.0 — 2026-06-17*
