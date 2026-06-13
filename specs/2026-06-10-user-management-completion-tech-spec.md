# 技术 Spec: 用户管理功能补全

> 基于 PRD: `specs/2026-06-10-user-management-completion-prd.md`
> 日期: 2026-06-10
> 作者: Architect
> 状态: Draft — 等待工程审查

---

## 1. 架构决策

### AD-1: 最小侵入原则

不改动现有 API 路径、权限注解、响应结构（`R<T>` 包裹不变）。所有变更均为字段级增量添加，已有的 `groupId` 处理逻辑保留不动。

### AD-2: 审计日志遵循现有模式

`module/org/GroupController` 已定义了审计日志的使用范式：直接通过 `AuditLogMapper.insert()` 同步写入，`beforeJson`/`afterJson` 使用 hand-rolled JSON 字符串（非 Jackson 序列化）。本次完全沿用此模式，不引入 AOP 切面或事件机制。

**依据**: 保持一致性与 GroupController 中的做法，避免引入额外抽象层。

### AD-3: 搜索使用数据库 LIKE

当前数据量不足以引入 Elasticsearch。使用 MyBatis-Plus LambdaQueryWrapper 的 OR 条件构建 `LIKE` 查询。搜索范围限定为 `username`、`real_name`、`email` 三个字段。

**注意**: 当用户量超过 10000 或查询响应时间超过 500ms，需升级为全文索引或 ES（已在技术债务中记录）。

### AD-4: 前端下拉选择器动态加载

组织选择器从 `GET /api/groups` 动态加载列表，不缓存。GroupListVO 已有 `id` 和 `name` 字段，可直接用于 `<select>` 的 value/label。

### AD-5: 手机号校验策略

仅前端格式校验 + 后端 `@Pattern` 校验双保险。不引入 SMS 验证码。

正则: `^$|^1[3-9]\d{9}$` (允许空字符串，非空时必须是 11 位 1 开头的中国大陆手机号)

---

## 2. API 契约

### 2.1 POST /api/users — 不变，仅 DTO 字段扩展

```
POST /api/users
Permission: hasPermission('user', 'create')

Request (CreateUserRequest):
  username:  string        @NotBlank
  password:  string        @NotBlank @Size(min=6)
  realName:  string?       
  email:     string?       
  phone:     string?       NEW @Pattern(regexp="^$|^1[3-9]\\d{9}$")
  groupId:   Long?         
  roleIds:   List<Long>?   

Response: R<User>
  — 返回完整 User 实体，已包含 phone 和 groupId
```

### 2.2 PUT /api/users/{id} — 不变，仅 DTO 字段扩展

```
PUT /api/users/{id}
Permission: hasPermission('user', 'update')

Request (UpdateUserRequest):
  realName:  string?
  email:     string?
  phone:     string?       NEW @Pattern(regexp="^$|^1[3-9]\\d{9}$")
  password:  string?
  groupId:   Long?
  status:    Integer?
  roleIds:   List<Long>?

Response: R<Void>
```

### 2.3 GET /api/users — keyword 参数扩展

```
GET /api/users?page=1&size=20&keyword=xxx
Permission: hasPermission('user', 'read')

Query Params:
  page:     int    (default=1)
  size:     int    (default=20)
  keyword:  string (NEW, optional)

Response: R<PageResult<User>>
  — User 实体已含 phone、groupId
  — 搜索时在 username / real_name / email 三字段做 LIKE 匹配 (OR)
  — keyword 为空时行为不变（返回全量分页）
```

### 2.4 GET /api/users/{id} — DTO 字段扩展

```
GET /api/users/{id}
Permission: hasPermission('user', 'read')

Response: R<UserDetailVO>
  id:        Long
  username:  string
  realName:  string
  email:     string
  phone:     string        NEW
  status:    Integer
  groupId:   Long
  groupName: string?       NEW (从 GroupMapper 查询 name)
  roleIds:   List<Long>
```

### 2.5 DELETE /api/users/{id} — 不变

```
DELETE /api/users/{id}
Permission: hasPermission('user', 'delete')

Response: R<Void>
  — 操作逻辑不变，新增审计日志记录（见 4 节）
```

---

## 3. 数据模型

### 3.1 User 实体 — 不变

`sys_user` 表已有 `phone VARCHAR` 和 `group_id BIGINT` 列，无需 DDL 变更。

```java
// User.java — 现有字段完整，无需修改
@TableName("sys_user")
public class User extends BaseEntity {
    private Long groupId;
    private String username;
    private String password;
    private String realName;
    private String email;
    private String phone;       // 已存在
    private String avatarUrl;
    private Integer status;
}
```

### 3.2 DTO 变更清单

| 类 | 变更 | 说明 |
|---|------|------|
| `CreateUserRequest` | + `phone` (String, @Pattern) | 创建时可选输入手机号 |
| `UpdateUserRequest` | + `phone` (String, @Pattern) | 编辑时可修改手机号 |
| `UserDetailVO` | + `phone` (String) | 详情返回手机号 |
| `UserDetailVO` | + `groupName` (String) | 详情返回组织名称 |

### 3.3 数据库 — 无变更

`sys_user.phone` 和 `sys_user.group_id` 列已存在。`audit_log` 表结构完整。无需 migration。

---

## 4. 数据流

### 4.1 创建用户（含新字段）

```
┌──────────────┐    POST /api/users              ┌──────────────┐
│  Frontend    │ ───────────────────────────────> │  Backend     │
│  UserDialog  │   { username, password,          │  UserController.create()
│              │     realName, email, phone,      │       │
│              │     groupId, roleIds }           │       ▼
└──────────────┘                                  │  UserService.create()
                                                  │   1. 校验 username 唯一
                                                  │   2. new User(), set all fields
                                                  │      — user.setPhone(req.getPhone())  ★ NEW
                                                  │      — user.setGroupId(req.getGroupId()) (已有)
                                                  │   3. userMapper.insert(user)
                                                  │   4. rbacService.assignRolesToUser()
                                                  │   5. 记录审计日志 (see 4.4)  ★ NEW
                                                  │   6. return user
                                                  └──────────────┘
```

### 4.2 搜索用户

```
┌──────────────┐  GET /api/users?keyword=张&page=1   ┌──────────────┐
│  Frontend    │ ──────────────────────────────────> │  Backend     │
│  users/page  │  (防抖 300ms)                        │  UserController.list(page, size, keyword, user)
│              │                                       │       │
│   keyword ───┤                                       │       ▼
│   useEffect   │                                       │  UserService.list(page, size, tenantId, keyword)
│   debounce   │                                       │   1. LambdaQueryWrapper<User>
│              │                                       │   2. .eq(tenantId)
│              │                                       │   3. IF keyword != null:
│              │                                       │      .and(w -> w
│              │                                       │        .like(username, keyword)
│              │                                       │        .or().like(realName, keyword)
│              │                                       │        .or().like(email, keyword))
│              │                                       │   4. userMapper.selectPage()
│              │                                       │   5. return PageResult
└──────────────┘                                       └──────────────┘
```

### 4.3 查询用户详情（含 groupName）

```
┌──────────────┐  GET /api/users/{id}                    ┌──────────────┐
│  Frontend    │ ──────────────────────────────────────> │  Backend     │
│  UserDialog  │                                         │  UserService.getDetail(id, tenantId)
│  (edit mode) │                                         │   1. userMapper.selectOne(id + tenantId)
│              │                                         │   2. new UserDetailVO(), set all fields
│              │                                         │      ★ NEW: vo.setPhone(user.getPhone())
│              │                                         │   3. IF user.getGroupId() != null:
│              │ <── R<UserDetailVO> ──────────────────  │        groupMapper.selectById(groupId)
│              │   { ..., phone, groupId, groupName }   │        vo.setGroupName(group.getName())
│              │                                         │      ★ NEW: vo.setGroupName(...)
│              │                                         │   4. vo.setRoleIds(rbacService...)
│              │                                         │   5. return vo
└──────────────┘                                         └──────────────┘
```

**依赖注入新增**: `UserService` 需注入 `GroupMapper`。

### 4.4 审计日志记录

```
UserService.create() / update() / delete()
  │
  ├─ 业务操作完成
  │
  └─ ★ NEW: 审计日志写入
       │
       ├─ 构建 beforeJson (create 时为 null，update/delete 时为操作前快照)
       ├─ 构建 afterJson  (delete 时为 null，create/update 时为操作后快照)
       ├─ 密码脱敏: password → "***"
       │
       └─ auditLogMapper.insert(AuditLog.builder()
            .tenantId(tenantId)
            .module("user")
            .action("create" | "update" | "delete")
            .targetId(user.getId())
            .targetType("user")
            .operatorId(operatorId)
            .operatorIp(null)      // 当前 SecurityUser 无 IP，留空
            .beforeJson(jsonBefore)
            .afterJson(jsonAfter)
            .remark("创建用户: " + user.getUsername())
            .build())
```

**审计日志事件矩阵**:

| 操作 | action | beforeJson | afterJson |
|------|--------|------------|-----------|
| 创建 | "create" | null | 完整用户信息（密码脱敏） |
| 更新 | "update" | 变更前用户快照 | 变更后用户快照 |
| 删除 | "delete" | 软删除前用户快照 | null |

**beforeJson/afterJson 格式**（JSON 字符串，与 GroupController 保持一致的手写方式）:

```json
{
  "id": 1,
  "username": "zhangsan",
  "real_name": "张三",
  "email": "zhangsan@example.com",
  "phone": "13800138000",
  "status": 1,
  "group_id": 5,
  "password": "***"
}
```

---

## 5. 前端变更

### 5.1 UserDialog.tsx 变更

| 位置 | 变更 |
|------|------|
| `UserFormData` interface | + `phone: string`, + `group_id: number \| null` |
| `UserDialogProps.user` | + `phone?`, + `group_id?` |
| `defaultValues` | + `phone: ''`, + `group_id: null` |
| `useQuery` roles | 新增 `useQuery(['groups'], ...)` 调 `GET /api/groups` |
| `reset()` (edit) | + `phone: userDetail.phone ?? ''`, + `group_id: userDetail.group_id ?? null` |
| `onSubmit` (create) | + `phone: data.phone`, + `group_id: data.group_id` |
| `onSubmit` (edit) | + `phone: data.phone`, + `group_id: data.group_id` |
| JSX — 邮箱下方 | 新增手机号输入框 `<Input {...register('phone', { pattern: ... })} />` |
| JSX — 邮箱下方 | 新增组织下拉框 `<select {...register('group_id')}>` 遍历 groups 数据 |
| JSX — import | + `Select` 组件 (如果使用 shadcn/ui Select) 或原生 `<select>` |

### 5.2 users/page.tsx 变更

| 位置 | 变更 |
|------|------|
| `User` interface | + `phone?: string`, + `group_id?: number`, + `group_name?: string` |
| 搜索 input | + `onChange` 加防抖 300ms (useEffect + setTimeout) |
| API 调用 | `params: { page, size: 20, keyword }` (keyword 空时传 undefined) |
| table `<thead>` | + `<th>` 手机号, + `<th>` 所属组织 |
| table `<tbody>` | + `<td>{user.phone \|\| '-'}</td>`, + `<td>{user.group_name \|\| '-'}</td>` |

### 5.3 防抖实现

```tsx
// 在 users/page.tsx 中
const [keyword, setKeyword] = useState('')
const [debouncedKeyword, setDebouncedKeyword] = useState('')

useEffect(() => {
  const timer = setTimeout(() => setDebouncedKeyword(keyword), 300)
  return () => clearTimeout(timer)
}, [keyword])

// queryKey 使用 debouncedKeyword, setKeyword 绑定到 input onChange
```

---

## 6. 实现影响范围

### 后端文件 (6 files)

| 文件 | 操作 | 行数估计 |
|------|------|---------|
| `module/user/dto/CreateUserRequest.java` | +phone 字段 + import @Pattern | +3 |
| `module/user/dto/UpdateUserRequest.java` | +phone 字段 + import @Pattern | +3 |
| `module/user/dto/UserDetailVO.java` | +phone +groupName 字段 | +2 |
| `module/user/UserService.java` | +phone 设置 +keyword 搜索 +GroupMapper 注入 +审计日志 (create/update/delete/getDetail) | +60 |
| `module/user/UserController.java` | +keyword 参数 | +3 |
| `module/user/UserMapper.java` | — 无需修改 | 0 |

### 前端文件 (2 files)

| 文件 | 操作 | 行数估计 |
|------|------|---------|
| `components/user/UserDialog.tsx` | +phone +groupId 字段 +groups fetch +UI | +40 |
| `app/(dashboard)/users/page.tsx` | +phone/group columns +keyword 传递 +防抖 | +25 |

### 不需要修改的文件

| 文件 | 原因 |
|------|------|
| `module/user/entity/User.java` | phone、groupId 字段已存在 |
| `module/org/GroupController.java` | GET /api/groups 已有，前端直接调用 |
| `common/entity/AuditLog.java` | 实体完整 |
| `common/AuditLogMapper.java` | insert、queryPage 已实现 |
| `module/audit/AuditLogController.java` | 查询接口已可按 module 筛选 |
| `module/audit/dto/AuditLogVO.java` | beforeJson/afterJson 不在列表 VO 中暴露（前端审计页暂不展示 diff，但数据已写入可通过展开查看） |

---

## 7. 审计日志前端查看

前端 `/admin/audit` 页面已可按 `module=user` 筛选。`AuditLogVO` 当前不返回 `beforeJson`/`afterJson`，如需在列表页展开查看 diff，属于后续增强——PRD 中"点击展开查看详细变更"的验收条件标记为 TODO:

- **不在本次范围**: 前端审计页展开 beforeJson/afterJson 功能
- **数据库层**: 已完整记录 beforeJson/afterJson，可后续对接前端

---

## 8. 技术债务更新

| # | 债务项 | 触发条件 | 解决方案 |
|---|--------|---------|---------|
| 1 | LIKE 搜索性能 | 用户量 > 10000 或 P99 > 500ms | Elasticsearch 或 PostgreSQL full-text search |
| 2 | 审计日志表膨胀 | audit_log 表 > 100万行 | 分区表 + 归档策略 (如 6 个月归档) |
| 3 | 单组织限制 | 需要多组织 | 引入 user_group 多对多关联表 |
| 4 | 审计日志 JSON 手写 | — | 统一用 Jackson ObjectMapper 序列化，替换 GroupController 中的手写 JSON |
| 5 | beforeJson/afterJson 前端展示 | 需要前端审计页展示 diff | AuditLogVO 增加 beforeJson/afterJson，前端增加展开组件 |

---

## 9. 安全检查点

- [ ] 手机号格式校验在前后端同时执行 (`@Pattern` + 前端 `pattern` 属性)
- [ ] 审计日志中 password 字段必须脱敏为 `"***"`
- [ ] 搜索无 SQL 注入风险（使用 MyBatis-Plus `like()` 自动参数化）
- [ ] groupId 不校验是否存在（宽松策略：允许指向不存在的组，与现有行为一致）
- [ ] 用户只能搜索自己租户的数据（`LambdaQueryWrapper.eq(tenantId)` 不变）
