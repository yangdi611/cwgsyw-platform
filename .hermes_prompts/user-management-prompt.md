# TASK: 用户管理功能补全

你是 cwgsyw-platform 项目的实现工程师。项目根目录：`/Users/byron/Library/Mobile Documents/com~apple~CloudDocs/AI/cwgsyw-platform`

当前分支：`feature/user-management-completion`（已创建好，直接使用）

## 需求概述

根据 tech spec `specs/2026-06-10-user-management-completion-tech-spec.md` 实现 4 个功能维度：
1. **手机号字段** — 创建/编辑用户时支持输入手机号，详情展示手机号
2. **组织关联** — 创建/编辑用户时支持选择所属组织，详情展示组织名称
3. **搜索功能** — 用户列表支持按 keyword 搜索（username/real_name/email 三字段 LIKE 匹配）
4. **审计日志** — 用户创建/更新/删除操作写入 audit_log 表

## 需要修改的文件

### 后端 (6 files)

#### 1. `backend/src/main/java/com/cwgsyw/platform/module/user/dto/CreateUserRequest.java`
- **新增** `phone` 字段: `@Pattern(regexp="^$|^1[3-9]\\d{9}$") private String phone;`
- 需 import `jakarta.validation.constraints.Pattern`

#### 2. `backend/src/main/java/com/cwgsyw/platform/module/user/dto/UpdateUserRequest.java`
- **新增** `phone` 字段: `@Pattern(regexp="^$|^1[3-9]\\d{9}$") private String phone;`
- 需 import `jakarta.validation.constraints.Pattern`

#### 3. `backend/src/main/java/com/cwgsyw/platform/module/user/dto/UserDetailVO.java`
- **新增** `phone` 字段: `private String phone;`
- **新增** `groupName` 字段: `private String groupName;`

#### 4. `backend/src/main/java/com/cwgsyw/platform/module/user/UserService.java` (最大变更)
- **注入 GroupMapper**: `private final GroupMapper groupMapper;`
- **注入 AuditLogMapper**: `private final AuditLogMapper auditLogMapper;`
- **list() 方法**: 新增 `keyword` 参数，keyword 不为空时在 username/real_name/email 三字段做 OR + LIKE 查询
- **create() 方法**: ① `user.setPhone(req.getPhone())` ② 创建后写入审计日志 (action="create", beforeJson=null, afterJson=用户快照)
- **update() 方法**: ① 取操作前快照做 beforeJson ② `user.setPhone(req.getPhone())` ③ 更新后写入审计日志 (action="update")
- **delete() 方法**: 删除前取快照做 beforeJson, 删除后写入审计日志 (action="delete", afterJson=null)
- **getDetail() 方法**: ① `vo.setPhone(user.getPhone())` ② 如果 user.getGroupId() != null, 查 GroupMapper 获取 groupName
- 审计日志 JSON 格式: 手写 JSON 字符串（参考 GroupController 模式），含 id, username, real_name, email, phone, status, group_id, password(脱敏为"***")

#### 5. `backend/src/main/java/com/cwgsyw/platform/module/user/UserController.java`
- `list()` 方法: 新增 `@RequestParam(required = false) String keyword` 参数，传递给 `userService.list(page, size, tenantId, keyword)`
- `update()` 方法: 需要传递 `@AuthenticationPrincipal SecurityUser currentUser` 到 `userService.update(id, req, currentUser)`

#### 6. 新增测试文件
- 创建 `backend/src/test/java/com/cwgsyw/platform/module/user/UserServiceTest.java`
- 测试 create（含手机号、审计日志）、update（含审计日志）、delete（含审计日志）、search keyword、getDetail（含 groupName）

### 前端 (2 files)

#### 1. `frontend/src/components/user/UserDialog.tsx`
- **UserFormData**: + `phone: string`, + `group_id: number | null`
- **UserDialogProps.user**: + `phone?`, + `group_id?`
- **defaultValues**: + `phone: ''`, + `group_id: null`
- **新增 useQuery(['groups'], ...)**: 调用 `api.get('/groups')` 获取组织列表，用于下拉选择
  - 响应结构：`r.data.data` 是 `[{id: number, name: string, ...}]` 数组（GroupListVO）
- **reset() edit 模式**: + `phone: userDetail?.phone ?? ''`, + `group_id: userDetail?.group_id ?? null`
- **onSubmit create**: 请求体中 + `phone: data.phone`, + `group_id: data.group_id`
- **onSubmit edit**: 请求体中 + `phone: data.phone`, + `group_id: data.group_id`
- **UI**: 邮箱下方新增手机号输入框（含 pattern 校验 `^1[3-9]\\d{9}$`）
- **UI**: 手机号下方新增组织下拉选择框（原生 `<select>` 或 shadcn Select，遍历 groups 数据）

#### 2. `frontend/src/app/(dashboard)/users/page.tsx`
- **User interface**: + `phone?: string`, + `group_id?: number`, + `group_name?: string`
- **搜索防抖 300ms**: 新增 `debouncedKeyword` state，用 `useEffect + setTimeout` 实现 300ms 防抖
  - `keyword` state 绑定到 input onChange
  - API 调用和 queryKey 使用 `debouncedKeyword`
- **API 调用 params**: + `keyword: debouncedKeyword || undefined`
- **table `<thead>`**: + `<th>手机号</th>`, + `<th>所属组织</th>`
- **table `<tbody>`**: + `<td>{user.phone || '-'}</td>`, + `<td>{user.group_name || '-'}</td>`

## 关键约束

1. **手机号校验**: 前端 `pattern` + 后端 `@Pattern` 双保险。正则: `^$|^1[3-9]\\d{9}$`（允许空）
2. **审计日志模式**: 完全沿用 GroupController 的手写 JSON 方式（见 `backend/src/main/java/com/cwgsyw/platform/module/org/GroupController.java`），不引入 Jackson 序列化
3. **组织下拉动态加载**: 从 `GET /api/groups` 获取列表（GroupListVO 有 id 和 name 字段），不缓存
4. **密码脱敏**: 审计日志中 password → "***"
5. **搜索 SQL 安全**: 使用 MyBatis-Plus LambdaQueryWrapper 的 like()，自动参数化
6. **租户隔离**: 搜索时保留 `.eq(User::getTenantId, tenantId)` 条件
7. **GroupMapper 引用**: `com.cwgsyw.platform.module.org.GroupMapper`
8. **AuditLogMapper 引用**: `com.cwgsyw.platform.common.AuditLogMapper`
9. **AuditLog 构建**: 用 `AuditLog.builder()`（lombok @Builder）
10. **SecurityUser**: `com.cwgsyw.platform.security.SecurityUser`，有 `getUserId()`, `getTenantId()`, `getGroupId()`

## 测试要求

1. **必须先写失败测试（RED）→ 然后实现代码使之通过（GREEN）**
2. 测试使用 JUnit 5 + Mockito
3. 至少覆盖: create 含 phone/审计日志, update 含审计日志, delete 含审计日志, keyword 搜索, getDetail 含 groupName

## 验收标准

- [ ] CreateUserRequest 新增 phone 字段并带 @Pattern 校验
- [ ] UpdateUserRequest 新增 phone 字段并带 @Pattern 校验
- [ ] UserDetailVO 新增 phone 和 groupName 字段
- [ ] POST /api/users 创建时可以传入 phone 和 group_id
- [ ] PUT /api/users/{id} 更新时可以修改 phone 和 group_id
- [ ] GET /api/users?keyword=xxx 可在三字段搜索
- [ ] GET /api/users/{id} 返回 phone 和 groupName
- [ ] 创建用户写入审计日志（action="create"）
- [ ] 更新用户写入审计日志（action="update"）
- [ ] 删除用户写入审计日志（action="delete"）
- [ ] 审计日志密码脱敏
- [ ] 前端 UserDialog 支持手机号和组织选择
- [ ] 前端 users 列表展示手机号和所属组织列
- [ ] 前端搜索防抖 300ms
- [ ] 所有测试通过

## 输出格式

完成后输出 JSON:
```json
{"status": "done", "summary": "...做了什么...", "files_changed": ["file1.java", "file2.tsx", ...]}
```
