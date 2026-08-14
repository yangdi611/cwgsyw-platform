# 页面迁移矩阵

## 1. 使用规则

当前基线包含 81 个 `page.tsx` 入口。这里先按路由域建立完整覆盖框架；每个实现 Issue 必须把所选域展开为逐路由记录，不能只凭域级 `PASS` 宣称页面完成。

每页仍需修改或确认页面组合，但不重复实现 Button、Input、Table 等共享组件。共享层先完成，页面工作主要负责真实数据、权限、状态、内容层级、Pattern 组合和视觉验收。

状态值统一使用：

- `NOT_STARTED`：尚未建立实现 Issue。
- `BASELINED`：功能、权限、状态和 Figma Pattern 已盘点。
- `IN_PROGRESS`：切片实现中。
- `BLOCKED`：存在明确阻塞及负责人。
- `VERIFYING`：实现完成，验证闭环中。
- `PASS`：本页全部适用门禁通过。
- `EXCLUDED`：经批准不迁移，并链接原因和替代方案。

## 2. 路由域基线

| 路由域 | 页面数 | 主要 Page Pattern | 必查能力 | 当前状态 |
|---|---:|---|---|---|
| `/login` | 1 | Form / Settings | 登录错误、提交中、密码可见性、键盘、匿名态 | VERIFYING |
| `/account/*` | 3 | Form / Settings | profile/setup/password、校验、dirty、成功/失败 | VERIFYING |
| `/admin/*` | 6 | Form / Settings; Data / Management; Overlay / Destructive | AI/config/backup/audit/templates、管理员权限、危险操作 | VERIFYING |
| `/change-docs/*` | 3 | Data / Management; Form / Settings; Detail / Drawer | 列表、新建、详情、动态字段、审批状态 | VERIFYING |
| `/cmdb/*` | 23 | 全五类 Pattern | 模型、实例、关联、空间、拓扑、变更、告警、复杂 Drawer/Dialog | VERIFYING |
| `/` dashboard | 1 | Dashboard / Feedback | 指标、部分数据、Loading/Empty/Error、导航入口 | VERIFYING |
| `/devices/*` | 3 | Data / Management; Form / Settings; Detail / Drawer | 列表、新建、详情、凭据和权限 | VERIFYING |
| `/files/*` | 2 | Data / Management; Detail / Drawer | 上传、列表、预览、错误文件、权限 | VERIFYING |
| `/groups` | 1 | Data / Management; Overlay / Destructive | 成员、生命周期、Dialog、权限 | VERIFYING |
| `/ipam/*` | 2 | Data / Management; Detail / Drawer | 地址列表、详情、状态与冲突 | VERIFYING |
| `/notifications/*` | 3 | Data / Management; Detail / Drawer | 未读/已读、目标解析、空态、跳转 | VERIFYING |
| `/ops-calendar/*` | 3 | Dashboard / Feedback; Data / Management; Overlay / Destructive | 月/周/列表、排班、节假日、日期和 Dialog | VERIFYING |
| `/rbac/*` | 2 | Data / Management; Overlay / Destructive | 角色、权限、禁用/继承/危险变更 | VERIFYING |
| `/tasks/*` | 13 | 全五类 Pattern | 列表、详情、计划、模板、分析、指标、自动化、动态表单 | VERIFYING |
| `/users` | 1 | Data / Management; Overlay / Destructive | 用户 CRUD、授权、状态和权限 | VERIFYING |
| `/wiki/*` | 6 | Data / Management; Detail / Drawer; Form / Settings | 空间、页面、编辑、搜索、图谱、评论/版本 Drawer | VERIFYING |
| `/work` | 1 | Data / Management; Detail / Drawer | 待办、审批 Drawer、权限和状态更新 | VERIFYING |
| `/workflow/*` | 7 | Data / Management; Form / Settings; Detail / Drawer | 设计画布、实例、模板、绑定、统计、BPMN；七页已本地 Neutral | VERIFYING |
| **合计** | **81** |  |  | **VERIFYING**（78 Neutral + 3 EXCLUDED redirect；视觉审计 WAIVED，故不写视觉 PASS） |

## 3. Pattern 选择规则

| Pattern | 适用页面 | 页面必须补足的运行时状态 |
|---|---|---|
| Form / Settings | 新建、编辑、账户、配置、设计表单 | 初始、dirty、校验错误、提交中、成功、失败、权限不足 |
| Data / Management | 列表、管理后台、搜索结果 | Loading、Empty、Error、筛选无结果、排序、选择、分页、权限 |
| Detail / Drawer | 详情、只读信息、侧边上下文 | Loading、缺失、Error、只读、可编辑、Drawer 开关、权限 |
| Dashboard / Feedback | 总览、统计、分析、日历概览 | Loading、Empty、Error、部分数据、状态反馈 |
| Overlay / Destructive | 删除、覆盖、批量操作、命令和复杂选择 | Open/Closed、Loading、Error、确认、取消、危险操作、权限 |

一个页面可以组合多个 Pattern，但必须指定一个负责主布局的 Primary Pattern。

## 4. 逐路由记录模板

每个实现 Issue 在本文件追加或更新如下记录：

| 字段 | 内容 |
|---|---|
| Linear Issue | 真实任务号与链接 |
| Route | 精确 Next.js 路由和对应 `page.tsx` |
| Owner / role | 受影响角色、访问权限和 permission-denied 行为 |
| Primary Pattern | 五类 Pattern 之一 |
| Supporting components | 正式组件和复合组件清单 |
| Data / API | Query key、API client、表单提交和缓存行为 |
| Required states | Loading、Empty、Error、Permission 及业务特定状态 |
| Responsive | 1440、1024、390 的内容顺序与替代视图 |
| Figma baseline | 文件 key、Node ID、API 指纹和读取时间 |
| Test fixture | 确定性数据、角色和状态入口 |
| Evidence | 六张基础截图、交互/A11y、消费者回归链接 |
| Legacy consumers | 已替换和剩余的旧组件入口 |
| Rollback | 旧入口、精确文件/提交范围、数据和 API 不变声明 |
| Status | `NOT_STARTED` 到 `PASS` |

## 5. 页面验收清单

- [ ] 页面功能、数据、路由和权限行为与迁移前一致，或变更由独立 Issue 授权。
- [ ] Loading、Empty、Error、Permission 和该页业务状态均可确定性触发。
- [ ] 主布局使用正式 Pattern，组件只消费正式 Token 和 React API。
- [ ] 常规 UI 仅使用 Neutral；Status 色只用于真实状态并有文字或图标辅助。
- [ ] Light / Dark x 1440 / 1024 / 390 均通过视觉门禁。
- [ ] 键盘、focus-visible、ARIA、screen reader 和 Overlay 行为通过。
- [ ] 文本无裁切或错位，按钮、输入框、表格和动态内容不造成布局跳动。
- [ ] 同页组件层级、密度、间距与整体美观协调，不出现孤立或突兀控件。
- [ ] 发现的共享问题已在正确层修复并回归其他消费者。
- [ ] 旧入口剩余消费者和回滚路径已记录。

## 6. 逐路由记录

### `/account/profile`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-19](https://linear.app/yangdi/issue/YAN-19/实施-figma-neutral-m7接入第一个真实路由消费者) |
| Route | `/account/profile` · `frontend/src/app/(dashboard)/account/profile/page.tsx` |
| Owner / role | 已登录且不在首次 setup 强制流中的用户。`ROUTE_PERMISSIONS` 无额外权限；无权限时 dashboard layout 回首页。 |
| Primary Pattern | Form / Settings。Figma Set `979:3728`（Default `979:3356`，Compact `979:3584`） |
| Supporting components | Page Header、Breadcrumb、Card、Field、Input、Button、Loading、Error |
| Data / API | `getAccountProfile()` GET `/account/profile`；`updateAccountProfile()` PUT `/account/profile`。未改 payload。`realName` 只读。 |
| Required states | Loading、Error+Retry、只读用户名/姓名、可编辑邮箱/手机/头像、提交中、成功 toast + `router.back()`、失败 toast |
| Responsive | 430px 及以下 Pattern 网格改为单列；不缩放桌面表单 |
| Figma baseline | File `Z8EC6psFOj7KMfXapAFk24`；Form / Settings 已在 design-source STATUS 验证。本切片未重做设计文件。 |
| Test fixture | `frontend/test/figma-neutral-m7-account-profile.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-19/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用 `@/components/design-system` 或 `@/components/shared`。Header / 其他 80 页仍走旧入口。 |
| Rollback | 丢弃 YAN-19 worktree/branch；API 与权限未改 |
| Status | `VERIFYING`（实现与行为单测完成；视觉审计 WAIVED，故不能写视觉 PASS） |

### `/account/password`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-20](https://linear.app/yangdi/issue/YAN-20/实施-figma-neutral-m7迁移-accountpassword) |
| Route | `/account/password` · `frontend/src/app/(dashboard)/account/password/page.tsx` |
| Owner / role | 已登录且不在首次 setup 强制流中的用户。无额外 route permission。 |
| Primary Pattern | Form / Settings |
| Supporting components | Page Header、Breadcrumb、Card、Field、Input、Button |
| Data / API | `changeAccountPassword()` POST `/account/password`。未改 payload。 |
| Required states | 当前密码必填错误、新密码策略提示、确认不一致、提交中、成功 toast + reset、失败 toast |
| Responsive | 430px 单列；策略提示 640px 以下单列 |
| Figma baseline | File `Z8EC6psFOj7KMfXapAFk24`；Form / Settings `979:3728` |
| Test fixture | `frontend/test/figma-neutral-m7-account-password.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-20/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。`PasswordStrengthHints` 仍给 `/account/setup` 使用。 |
| Rollback | 丢弃 YAN-20 worktree/branch；API 未改 |
| Status | `VERIFYING` |

### `/account/setup`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-21](https://linear.app/yangdi/issue/YAN-21/实施-figma-neutral-m7迁移-accountsetup) |
| Route | `/account/setup` · `frontend/src/app/(dashboard)/account/setup/page.tsx` |
| Owner / role | `requiredActions` 非空的首次登录用户。Dashboard layout 强制进入此页。 |
| Primary Pattern | Form / Settings |
| Supporting components | Page Header、Card、Field、Input、Button、Loading、Error、NeutralPasswordHints |
| Data / API | `getAccountProfile()`；`submitAccountSetup()` POST `/account/setup`。成功后 `setRequiredActions` + `router.push('/')`。 |
| Required states | Loading、Error+Retry、mustChangePassword on/off、策略失败 toast、确认不一致、PASSWORD_REUSED、提交中、成功 |
| Responsive | 430px 单列 |
| Figma baseline | File `Z8EC6psFOj7KMfXapAFk24`；Form / Settings `979:3728` |
| Test fixture | `frontend/test/figma-neutral-m7-account-setup.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-21/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再使用 `bg-v2-bg` / 旧 Card。旧 `PasswordStrengthHints` 现已无 Neutral 消费者，留给 M8。 |
| Rollback | 丢弃 YAN-21 worktree/branch；API 未改 |
| Status | `VERIFYING` |

### `/users`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-22](https://linear.app/yangdi/issue/YAN-22/实施-figma-neutral-m7迁移-users) |
| Route | `/users` · `frontend/src/app/(dashboard)/users/page.tsx` |
| Owner / role | `user:read` 可见；create/update/delete 控制新建、编辑/授权、删除。无读权限返回 null。 |
| Primary Pattern | Data / Management。Figma `980:4171` |
| Supporting components | Page Header、Filter Bar、Table、Pagination、Status Badge、Dialog、AlertDialog、Field、Input、Checkbox、Switch |
| Data / API | `GET /users?page&size`；`POST/PUT/DELETE /users`；`POST /users/:id/reset-password`；memberships / role-assignments。queryKey `['users', page, keyword]` 未改。keyword 仍不进请求参数。 |
| Required states | 无权限隐藏、Loading、Empty、Error+Retry、启用/禁用、创建/编辑/删除/授权、提交中、成功/失败 toast |
| Responsive | 430px 隐藏桌面 Table，改用卡片列表 |
| Figma baseline | File `Z8EC6psFOj7KMfXapAFk24` |
| Test fixture | `frontend/test/figma-neutral-m7-users.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-22/`。视觉审计 WAIVED |
| Legacy consumers | 本页与其专用 Dialog 不再引用旧 design-system / shared |
| Rollback | 丢弃 YAN-22 worktree/branch |
| Status | `VERIFYING` |

### `/groups`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-23](https://linear.app/yangdi/issue/YAN-23/实施-figma-neutral-m7迁移-groups) |
| Route | `/groups` · `frontend/src/app/(dashboard)/groups/page.tsx` |
| Owner / role | `group:create/update/delete`；`group:purge` 仅 platform；归档列表 tenant/platform |
| Primary Pattern | Data / Management + Overlay / Destructive |
| Supporting components | Page Header、Filter Bar、Table、Dialog、AlertDialog、Alert、Field、Input、Textarea、Checkbox |
| Data / API | `GET /groups?state=`；create/update；members；lifecycle-preflight 与 archive/restore/purge。queryKey `['groups', listState]` 未改。 |
| Required states | Loading、Empty、Error、builtin 禁用、归档/恢复/清除预检、409 冲突刷新、提交锁 |
| Responsive | 430px Table 卡片替代；成员 Dialog 单列 |
| Test fixture | `frontend/test/figma-neutral-m7-groups.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-23/` |
| Status | `VERIFYING` |

### `/rbac/roles`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-24](https://linear.app/yangdi/issue/YAN-24/实施-figma-neutral-m7迁移-rbacroles) |
| Route | `/rbac/roles` |
| Owner / role | `role:create/update/delete`；配置权限需 `resource:assign` |
| Primary Pattern | Data / Management |
| Data / API | `GET /rbac/roles`；POST/PUT/DELETE `/rbac/roles`；GET permissions 与 role permissions。queryKey `['roles']` 未改。 |
| Required states | Loading、Empty、Error、内置只读、兼容角色 warning、删除确认 |
| Responsive | 430px Table 卡片替代 |
| Test fixture | `frontend/test/figma-neutral-m7-rbac-roles.test.cjs` |
| Status | `VERIFYING` |

### `/rbac/permissions`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-25](https://linear.app/yangdi/issue/YAN-25/实施-figma-neutral-m7迁移-rbacpermissions) |
| Route | `/rbac/permissions` |
| Owner / role | 从角色页 `resource:assign` 进入；依赖 `roleId` query |
| Primary Pattern | Data / Management |
| Data / API | GET resources / permissions / role permissions；PUT `/rbac/roles/:id/permissions`。queryKey 未改。 |
| Required states | 无 roleId 空态、Loading、Error、勾选脏数据、保存中 |
| Test fixture | `frontend/test/figma-neutral-m7-rbac-permissions.test.cjs` |
| Status | `VERIFYING` |

### `/login`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-26](https://linear.app/yangdi/issue/YAN-26/实施-figma-neutral-m7迁移-login) |
| Route | `/login` |
| Owner / role | 匿名 |
| Primary Pattern | Form / Settings |
| Data / API | `useAuth().login` → POST `/auth/login`。成功后 setup 或首页。 |
| Required states | 错误文案、提交中、密码可见切换 |
| Test fixture | `frontend/test/figma-neutral-m7-login.test.cjs` |
| Status | `VERIFYING` |

### `/devices`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-27](https://linear.app/yangdi/issue/YAN-27/实施-figma-neutral-m7迁移-devices) |
| Route | `/devices` |
| Owner / role | 列表按路由权限；新建需 `device:create` |
| Primary Pattern | Data / Management + preview Drawer |
| Data / API | `GET /devices`；queryKey `['devices']`。筛选在客户端。 |
| Required states | Loading、Empty、筛选无结果、Error、行选中 Drawer |
| Test fixture | `frontend/test/figma-neutral-m7-devices.test.cjs` |
| Status | `VERIFYING` |

### `/devices/new`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-28](https://linear.app/yangdi/issue/YAN-28/实施-figma-neutral-m7迁移-devicesnew) |
| Route | `/devices/new` |
| Primary Pattern | Form / Settings |
| Data / API | `GET /cmdb/instances/:id`；`POST /devices` `{ ciInstanceId, category, description }` |
| Required states | 未选 CI、只读派生字段、创建中、失败 toast |
| Legacy | `CiInstanceSelect` 仍是旧组件 |
| Test fixture | `frontend/test/figma-neutral-m7-devices-new.test.cjs` |
| Status | `VERIFYING` |

### `/devices/[id]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-29](https://linear.app/yangdi/issue/YAN-29/实施-figma-neutral-m7迁移-devicesid) |
| Route | `/devices/[id]` |
| Primary Pattern | Detail / Drawer |
| Data / API | GET/PUT/DELETE `/devices/:id`；credentials CRUD + reveal RSA-OAEP |
| Required states | Loading、403/404、编辑、分组凭据、添加账号、删除确认 |
| Test fixture | `frontend/test/figma-neutral-m7-devices-detail.test.cjs` |
| Status | `VERIFYING` |

### `/ipam`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-30](https://linear.app/yangdi/issue/YAN-30/实施-figma-neutral-m7迁移-ipam) |
| Route | `/ipam` |
| Primary Pattern | Data / Management |
| Data / API | GET `/ip-pools`；POST `/ip-pools`；DELETE `/ip-pools/:id`。queryKey `['ip-pools', keyword, status, page]` |
| Required states | Loading、Empty、Error、创建校验、删除确认、使用率 status |
| Test fixture | `frontend/test/figma-neutral-m7-ipam.test.cjs` |
| Status | `VERIFYING` |

### `/ipam/[id]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-31](https://linear.app/yangdi/issue/YAN-31/实施-figma-neutral-m7迁移-ipamid) |
| Route | `/ipam/[id]` · `frontend/src/app/(dashboard)/ipam/[id]/page.tsx` |
| Owner / role | `ip_pool:read` 可见；`ip_pool:update` 控制编辑、分配、释放。无读权限回首页。 |
| Primary Pattern | Detail / Drawer |
| Supporting components | Page Header、Breadcrumb、Status Badge、Chip、Metric Card、Progress、Table、Dialog、AlertDialog、Field、Input、Loading、Error |
| Data / API | GET `/ip-pools/:id`；PUT `/ip-pools/:id`；POST `/ip-pools/:id/allocate`；POST `/ip-pools/:id/release`。queryKey `['ip-pool', id]` 未改。 |
| Required states | Loading、403/404、编辑、使用率 status、分配空态、分配 Dialog、释放确认 |
| Responsive | 430px Table 卡片替代；指标卡自适应单列 |
| Figma baseline | File `Z8EC6psFOj7KMfXapAFk24`；Detail / Drawer。本切片未重做设计文件。 |
| Test fixture | `frontend/test/figma-neutral-m7-ipam-detail.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-31/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用 `@/components/design-system` 或 `@/components/shared`。`CiInstanceSelect` 仍旧。 |
| Rollback | 丢弃 YAN-31 worktree/branch；API 与权限未改 |
| Status | `VERIFYING` |

### `/files`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-32](https://linear.app/yangdi/issue/YAN-32/实施-figma-neutral-m7迁移-files) |
| Route | `/files` · `frontend/src/app/(dashboard)/files/page.tsx` |
| Owner / role | `shared_file:read` 可见；upload/update/delete/manage/manage_acl 控制上传、重命名、删除、文件夹和 ACL。无读权限回首页。 |
| Primary Pattern | Data / Management |
| Supporting components | Page Header、Filter Bar、Split nav、Table、Pagination、Dialog、AlertDialog、Progress、Search、Select |
| Data / API | GET `/files/folders`；GET `/files?folderId&keyword&page&size`；POST `/files/upload`；PUT `/files/:id`；DELETE `/files/:id`；POST/PATCH/DELETE `/files/folders`。queryKey 未改。 |
| Required states | 无权限回首页、Loading、Empty、上传进度/取消、重命名/移动、删除确认、文件夹 CRUD |
| Responsive | 430px split 单列；Table 卡片替代 |
| Figma baseline | File `Z8EC6psFOj7KMfXapAFk24`。本切片未重做设计文件。 |
| Test fixture | `frontend/test/figma-neutral-m7-files.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-32/`。视觉审计 WAIVED |
| Legacy consumers | 本页与 FolderTreeNode / AuditPanel 不再引用旧 design-system。`ResourceAccessDialog` 仍旧。 |
| Rollback | 丢弃 YAN-32 worktree/branch；API 与权限未改 |
| Status | `VERIFYING` |

### `/files/preview/[id]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-33](https://linear.app/yangdi/issue/YAN-33/实施-figma-neutral-m7迁移-filespreviewid) |
| Route | `/files/preview/[id]` · `frontend/src/app/(dashboard)/files/preview/[id]/page.tsx` |
| Owner / role | `shared_file:read`；无权限回首页 |
| Primary Pattern | Detail / Drawer |
| Supporting components | Page Header、Breadcrumb、Empty、Error、Loading、Button |
| Data / API | GET `/files/:id`；`fetchSharedFileBlob(..., 'preview')`；`downloadSharedFile`。queryKey 未改。 |
| Required states | Loading、403/不存在、PDF/DOCX/XLSX/旧 xls/图片/不支持类型 |
| Test fixture | `frontend/test/figma-neutral-m7-files-preview.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-33/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared |
| Rollback | 丢弃 YAN-33 worktree/branch |
| Status | `VERIFYING` |

### `/notifications`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-34](https://linear.app/yangdi/issue/YAN-34/实施-figma-neutral-m7迁移-notifications) |
| Route | `/notifications` · `frontend/src/app/(dashboard)/notifications/page.tsx` |
| Owner / role | layout `notification:read` |
| Primary Pattern | Data / Management |
| Supporting components | Page Header、Empty、Error、Loading、Status Badge、NotificationItem |
| Data / API | GET `/notifications?page=1&size=50`；POST `/notifications/:id/read`；POST `/notifications/read-all`。queryKey `['notifications']` 未改。 |
| Required states | Loading、Error+Retry、Empty、未读/已读、全部已读、跳转 resolve |
| Test fixture | `frontend/test/figma-neutral-m7-notifications.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-34/`。视觉审计 WAIVED |
| Legacy consumers | 本页与 NotificationItem 不再引用旧 design-system。NotificationBell 仍旧。 |
| Rollback | 丢弃 YAN-34 worktree/branch |
| Status | `VERIFYING` |

### `/notifications/targets/*`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-35](https://linear.app/yangdi/issue/YAN-35/实施-figma-neutral-m7迁移-notificationstargets) |
| Route | `/notifications/targets/resolve/[notificationId]`；`/notifications/targets/[refType]/[refId]` |
| Primary Pattern | Detail / Drawer（Empty / Loading） |
| Data / API | GET `/notifications/:id/target`；change-docs / tasks / cmdb / wiki 校验。queryKey 未改。 |
| Required states | 验证中、跳转中、目标不可用 |
| Test fixture | `frontend/test/figma-neutral-m7-notification-targets.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-35/`。视觉审计 WAIVED |
| Status | `VERIFYING` |

### `/ops-calendar`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-36](https://linear.app/yangdi/issue/YAN-36/实施-figma-neutral-m7迁移-ops-calendar) |
| Route | `/ops-calendar` · `frontend/src/app/(dashboard)/ops-calendar/page.tsx` |
| Owner / role | `task:read` 可见；create 控制新建；`calendar_settings:read` 看到设置入口 |
| Primary Pattern | Data / Management + Dashboard / Feedback |
| Supporting components | Page Header、Filter Bar、Chip、Select、Dropdown、Table、Dialog、Status Badge、Month/Week/List |
| Data / API | `listCalendarWorkItems` GET `/calendar/work-items`；`getCalendarDay` GET `/calendar/day`。queryKey 未改。 |
| Required states | 无权限回首页、月/周/列表、筛选、日 Dialog、新建任务 Dialog |
| Test fixture | `frontend/test/figma-neutral-m7-ops-calendar.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-36/`。视觉审计 WAIVED |
| Legacy consumers | 本页视图不再引用旧 design-system。`OneOffTaskDialog` 与首页卡片仍旧。 |
| Rollback | 丢弃 YAN-36 worktree/branch |
| Status | `VERIFYING` |

### `/ops-calendar/rosters`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-37](https://linear.app/yangdi/issue/YAN-37/实施-figma-neutral-m7迁移-ops-calendarrosters) |
| Route | `/ops-calendar/rosters` |
| Owner / role | `calendar_settings:read`；manage 控制新建/编辑/删除 |
| Primary Pattern | Data / Management |
| Data / API | GET/POST `/calendar-settings/rosters`；PUT/DELETE `/calendar-settings/rosters/:id`；POST check-conflicts。queryKey 未改。 |
| Required states | 无权限回日历、Loading、Empty、缺手机号、冲突检测、删除确认 |
| Test fixture | `frontend/test/figma-neutral-m7-ops-calendar-rosters.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-37/`。视觉审计 WAIVED |
| Status | `VERIFYING` |

### `/ops-calendar/holidays`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-38](https://linear.app/yangdi/issue/YAN-38/实施-figma-neutral-m7迁移-ops-calendarholidays) |
| Route | `/ops-calendar/holidays` |
| Owner / role | `calendar_settings:read`；manage 控制新建/导入/删除 |
| Primary Pattern | Data / Management |
| Data / API | GET/POST `/calendar-settings/holidays`；PUT/DELETE `/calendar-settings/holidays/:id`；POST import-cn。queryKey 未改。 |
| Required states | 无权限回日历、Loading、Empty、启用/停用、导入确认、删除确认 |
| Test fixture | `frontend/test/figma-neutral-m7-ops-calendar-holidays.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-38/`。视觉审计 WAIVED |
| Status | `VERIFYING` |

### `/work`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-39](https://linear.app/yangdi/issue/YAN-39/实施-figma-neutral-m7迁移-work) |
| Route | `/work` · `WorkItemList` + `ApprovalTaskDrawer` |
| Primary Pattern | Data / Management + Detail / Drawer |
| Data / API | GET `/work-items`、`/work-items/counts`；GET/POST approval-task。queryKey 未改。history.pushState 切 tab。 |
| Required states | Loading、Error、Empty、分类计数、逾期/优先级、审批 Drawer 动作 |
| Test fixture | `frontend/test/figma-neutral-m7-work.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-39/`。视觉审计 WAIVED |
| Status | `VERIFYING` |

### `/tasks`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-40](https://linear.app/yangdi/issue/YAN-40/实施-figma-neutral-m7迁移-tasks) |
| Route | `/tasks` · `TaskList` + `OneOffTaskDialog` |
| Primary Pattern | Data / Management |
| Data / API | `listTasks` GET `/tasks`；`createOneOffTask` POST `/tasks/one-off`。queryKey `['tasks', { page, keyword, scope, status }]`、`['one-off-templates']`、`['one-off-users']` 未改。 |
| Required states | Loading、Empty、我的/组、状态筛选、分页、创建 Dialog |
| Test fixture | `frontend/test/figma-neutral-m7-tasks.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-40/`。视觉审计 WAIVED |
| Legacy consumers | 本页与 Dialog 不再引用旧 design-system / shared。日历页继续消费 Neutral Dialog。 |
| Status | `VERIFYING` |

### `/tasks/[taskId]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-41](https://linear.app/yangdi/issue/YAN-41/实施-figma-neutral-m7迁移-taskstaskid) |
| Route | `/tasks/[taskId]` · `TaskDetail` + `DynamicTaskForm` + `SubmissionHistoryCard` |
| Primary Pattern | Detail / Drawer |
| Data / API | `getTask` `['task', taskId]`；`previewAggregateReferences` `['task', taskId, 'aggregate-references']`；`listTaskApprovalRounds` `['task-approval-rounds', taskId]`；`listTaskSubmissions` `['task-submissions', taskId]`。start/remind/save/validate/submit/attachment 语义未改。autosave 1500ms。 |
| Required states | Loading、Error、只读、可编辑、退回原因、校验失败、逾期/审批状态 |
| Test fixture | `frontend/test/figma-neutral-m7-task-detail.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-41/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。plans / templates 未改。 |
| Status | `VERIFYING` |

### `/tasks/plans`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-43](https://linear.app/yangdi/issue/YAN-43/实施-figma-neutral-m7迁移-tasksplans) |
| Route | `/tasks/plans` · `TaskPlanList` |
| Primary Pattern | Data / Management |
| Data / API | `listTaskPlans` queryKey `['task-plans', keyword, status]`；`changeTaskPlanStatus` activate/pause。未改。 |
| Required states | Loading、Empty、Error、状态筛选、激活/暂停权限 |
| Test fixture | `frontend/test/figma-neutral-m7-task-plans.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-43/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。new / [planId] 未改。 |
| Status | `VERIFYING` |

### `/tasks/plans/new`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-44](https://linear.app/yangdi/issue/YAN-44/实施-figma-neutral-m7迁移-tasksplansnew) |
| Route | `/tasks/plans/new` · `TaskPlanEditor` + `CiScopeSelector` |
| Primary Pattern | Form / Settings |
| Data / API | `createTaskPlan`；queryKey `['task-plan-template-options']`、`['task-plan-approval-options']`、`['task-plan-user-options']`、`['task-plan-group-options']`、CI preview keys 未改。 |
| Required states | Loading、Error、四步向导、只读/可编辑、预览警告 |
| Test fixture | `frontend/test/figma-neutral-m7-task-plans-new.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-44/`。视觉审计 WAIVED |
| Legacy consumers | 本页与共享编辑器不再引用旧 design-system / shared。 |
| Status | `VERIFYING` |

### `/tasks/plans/[planId]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-44](https://linear.app/yangdi/issue/YAN-44/实施-figma-neutral-m7迁移-tasksplansnew) |
| Route | `/tasks/plans/[planId]` · 同一 `TaskPlanEditor` |
| Primary Pattern | Form / Settings |
| Data / API | `getTaskPlan` `['task-plan', planId]`；`updateTaskPlan`。未改。 |
| Required states | Loading、Error、草稿/暂停可编辑、生效只读 |
| Test fixture | 与新建页共享编辑器测试 |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-44/`。视觉审计 WAIVED |
| Status | `VERIFYING` |

### `/tasks/templates`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-45](https://linear.app/yangdi/issue/YAN-45/实施-figma-neutral-m7迁移-taskstemplates) |
| Route | `/tasks/templates` · `TaskTemplateList` |
| Primary Pattern | Data / Management |
| Data / API | `listTaskTemplates` queryKey `['task-templates', { keyword, status }]`；`deleteTaskTemplate`。未改。 |
| Required states | Loading、Empty、Error、状态筛选、删除确认 |
| Test fixture | `frontend/test/figma-neutral-m7-task-templates.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-45/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。[templateId] 已迁，设计器未改。 |
| Status | `VERIFYING` |

### `/tasks/templates/[templateId]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-48](https://linear.app/yangdi/issue/YAN-48/实施-figma-neutral-m7迁移-taskstemplatestemplateid) |
| Route | `/tasks/templates/[templateId]` · `TaskTemplateDetail` |
| Primary Pattern | Detail / Drawer |
| Data / API | `getTaskTemplate` queryKey `['task-template', templateId]`；`createTaskTemplateDraft`。未改。 |
| Required states | Loading、Error、内置只读 Alert、已有草稿继续设计、创建下一草稿 |
| Test fixture | `frontend/test/figma-neutral-m7-task-template-detail.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-48/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。版本设计器已迁。 |
| Status | `VERIFYING` |

### `/tasks/templates/[templateId]/versions/[versionId]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-49](https://linear.app/yangdi/issue/YAN-49/实施-figma-neutral-m7迁移-taskstemplatestemplateidversionsversionid) |
| Route | `/tasks/templates/[templateId]/versions/[versionId]` · `TaskTemplateDesigner` |
| Primary Pattern | Form / Settings + 三栏 Workspace |
| Data / API | `getTaskTemplateVersion` `['task-template-version', versionId]`；`listTaskFieldTypes` `['task-field-types']`；`updateTaskTemplateVersion` / `validateTaskTemplateVersion` / `publishTaskTemplateVersion` / `previewTaskTemplateVersion`。未改。 |
| Required states | Loading、Error、草稿可编辑、已发布只读、校验问题、预览 Dialog |
| Test fixture | `frontend/test/figma-neutral-m7-task-template-version.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-49/`。视觉审计 WAIVED |
| Legacy consumers | 设计器及 FieldLibrary / FormCanvas / FieldPropertyPanel / TemplatePreviewDialog 不再引用旧 design-system / shared。 |
| Status | `VERIFYING` |

### `/tasks/analytics`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-50](https://linear.app/yangdi/issue/YAN-50/实施-figma-neutral-m7迁移-tasksanalytics) |
| Route | `/tasks/analytics` · `TaskAnalyticsWorkbench` |
| Primary Pattern | Data / Management |
| Data / API | `['task-analytics-templates']` `listTaskTemplates`；`['task-analytics-fields', versionId]`；`['task-analytics-dimensions']`；`['task-analytics-query', request]`；`['task-analytics-dashboards']`；`createAnalyticsDashboard` / `addAnalyticsWidget` / `exportTaskAnalytics`。未改。 |
| Required states | 配置 Loading/Error、未运行、查询中、空结果、导出、保存看板 |
| Test fixture | `frontend/test/figma-neutral-m7-task-analytics.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-50/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。dashboard 详情已迁。 |
| Status | `VERIFYING` |

### `/tasks/analytics/[dashboardId]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-51](https://linear.app/yangdi/issue/YAN-51/实施-figma-neutral-m7迁移-tasksanalyticsdashboardid) |
| Route | `/tasks/analytics/[dashboardId]` · `TaskAnalyticsDashboard` + `DashboardSubscriptions` |
| Primary Pattern | Dashboard / Feedback |
| Data / API | `['task-analytics-dashboard', dashboardId]`；widget query；`shareAnalyticsDashboard` / `deleteAnalyticsDashboard` / `deleteAnalyticsWidget`；`['task-analytics-subscriptions', dashboardId]`。未改。 |
| Required states | Loading、Error、空组件、图表/列表、下钻、订阅 CRUD |
| Test fixture | `frontend/test/figma-neutral-m7-task-analytics-dashboard.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-51/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。automations 已迁，metrics 未改。 |
| Status | `VERIFYING` |

### `/tasks/automations`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-53](https://linear.app/yangdi/issue/YAN-53/实施-figma-neutral-m7迁移-tasksautomations) |
| Route | `/tasks/automations` · `TaskAutomationsManager` |
| Primary Pattern | Data / Management |
| Data / API | `['task-automations']`；`['task-automation-templates']`；`['task-automation-users']`；`['task-automation-executions', selectedId]`；create/update/preview/lifecycle/retry。未改。 |
| Required states | Loading、Error、无权限、空列表、选中详情、预演命中/未命中 |
| Test fixture | `frontend/test/figma-neutral-m7-task-automations.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-53/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。metrics 已迁。 |
| Status | `VERIFYING` |

### `/tasks/metrics`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-54](https://linear.app/yangdi/issue/YAN-54/实施-figma-neutral-m7迁移-tasksmetrics) |
| Route | `/tasks/metrics` · `TaskMetricsManager` |
| Primary Pattern | Data / Management |
| Data / API | `['task-metrics']`；`['task-metric-goals']`；`['task-metric-templates']`；create/update/bind/preview。未改。 |
| Required states | Loading、Error、空指标、选中详情、绑定、目标、预览 |
| Test fixture | `frontend/test/figma-neutral-m7-task-metrics.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-54/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。任务域其余页已迁。 |
| Status | `VERIFYING` |

### `/admin/config`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-56](https://linear.app/yangdi/issue/YAN-56/实施-figma-neutral-m7迁移-adminconfig) |
| Route | `/admin/config` · `AdminConfigPage` |
| Primary Pattern | Form / Settings |
| Data / API | `['admin-config']` GET `/admin/config`；PUT `/admin/config/smtp` `/watermark` `/prometheus`。未改。 |
| Required states | 权限不足跳转、SMTP、监控、水印预览 |
| Test fixture | `frontend/test/figma-neutral-m7-admin-config.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-56/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。AI 页已迁。 |
| Status | `VERIFYING` |

### `/admin/ai`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-57](https://linear.app/yangdi/issue/YAN-57/实施-figma-neutral-m7迁移-adminai) |
| Route | `/admin/ai` · `AdminAiPage` |
| Primary Pattern | Form / Settings |
| Data / API | `['ai-providers']` GET `/admin/ai/providers`；PUT `/admin/ai/providers/:id`；POST test。未改。 |
| Required states | 无读权限跳转、Loading、Error、只读、保存/测试 |
| Test fixture | `frontend/test/figma-neutral-m7-admin-ai.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-57/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。backup 已迁。audit/templates 未改。 |
| Status | `VERIFYING` |

### `/admin/backup`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-58](https://linear.app/yangdi/issue/YAN-58/实施-figma-neutral-m7迁移-adminbackup) |
| Route | `/admin/backup` · `BackupPage` |
| Owner / role | `backup` read/create/restore/delete。无 read 跳转 `/` |
| Primary Pattern | Data / Management |
| Supporting components | DataManagementPage、PageHeader、Table、Pagination、StatusBadge、NeutralAlertDialog、NeutralDialog、EmptyState、ErrorState、LoadingState |
| Data / API | `['backups', page]` GET `/backups`；POST `/backups`；POST `/backups/:id/restore`；DELETE `/backups/:id`；POST `/backups/upload`；GET `/backups/:id/download`。未改。 |
| Required states | 权限不足跳转、Loading、Empty、Error、running/success/failed、恢复确认/完成 |
| Test fixture | `frontend/test/figma-neutral-m7-admin-backup.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-58/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。audit 已迁。change-doc-templates 未改。 |
| Status | `VERIFYING` |

### `/admin/audit`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-59](https://linear.app/yangdi/issue/YAN-59/实施-figma-neutral-m7迁移-adminaudit) |
| Route | `/admin/audit` · `AuditLogPage` |
| Owner / role | `audit` read。无 read 跳转 `/` |
| Primary Pattern | Data / Management |
| Supporting components | DataManagementPage、PageHeader、FilterBar、Field、Select、Input、Table、Pagination、StatusBadge、EmptyState、ErrorState、LoadingState |
| Data / API | `['audit-logs', module, action, operatorId, keyword, startDate, endDate, page]` GET `/audit-logs`。未改。 |
| Required states | 权限不足跳转、Loading、Empty、Error、筛选、分页 |
| Test fixture | `frontend/test/figma-neutral-m7-admin-audit.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-59/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。模板列表已迁。详情页未改。 |
| Status | `VERIFYING` |

### `/admin/change-doc-templates`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-60](https://linear.app/yangdi/issue/YAN-60/实施-figma-neutral-m7迁移-adminchange-doc-templates) |
| Route | `/admin/change-doc-templates` · `ChangeDocTemplatesPage` |
| Owner / role | `change_doc_template` read/write。无 read 跳转 `/` |
| Primary Pattern | Data / Management |
| Supporting components | DataManagementPage、PageHeader、Chip、Card、Field、Input、Select、StatusBadge、Badge、EmptyState、LoadingState |
| Data / API | `['change-doc-templates']` GET/POST `/admin/change-doc-templates`；PUT `/:id/active`；POST `/:id/upload`；POST `/:id/parse-bookmarks`。未改。 |
| Required states | 权限不足跳转、Loading、Empty、筛选、创建、上传、启用/禁用 |
| Test fixture | `frontend/test/figma-neutral-m7-admin-change-doc-templates.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-60/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。详情页已迁。 |
| Status | `VERIFYING` |

### `/admin/change-doc-templates/[id]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-61](https://linear.app/yangdi/issue/YAN-61/实施-figma-neutral-m7迁移-adminchange-doc-templatesid) |
| Route | `/admin/change-doc-templates/[id]` · `TemplateFieldsPage` |
| Owner / role | 模板字段配置。本页原无独立 permission guard，未新增。 |
| Primary Pattern | Form / Settings |
| Supporting components | FormSettingsPage、PageHeader、Card、Field、Input、Select、Textarea、Checkbox、Alert、Badge、TableConfigEditor |
| Data / API | `['change-doc-template', id]` GET/PUT `/admin/change-doc-templates/:id`；PUT `/:id/fields`；DELETE `/:id/fields/:fieldId`。未改。 |
| Required states | Loading、无 docx 警告、dirty 保存、空字段、表格列配置 |
| Test fixture | `frontend/test/figma-neutral-m7-admin-change-doc-template-detail.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-61/`。视觉审计 WAIVED |
| Legacy consumers | 本页和 `TableConfigEditor` 不再引用旧 design-system。`/change-docs` 列表已迁。 |
| Status | `VERIFYING` |

### `/change-docs`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-62](https://linear.app/yangdi/issue/YAN-62/实施-figma-neutral-m7迁移-change-docs) |
| Route | `/change-docs` · `ChangeDocsPage` |
| Owner / role | `change_doc` read/create。无 read 跳转 `/` |
| Primary Pattern | Data / Management |
| Supporting components | DataManagementPage、FilterBar、SearchInput、Chip、Table、Pagination、NeutralDrawer、StatusBadge |
| Data / API | `['change-docs', statusFilter, keyword, page]` GET `/change-docs`。未改。 |
| Required states | 权限不足、Loading、Empty、Error、筛选、分页、行点击抽屉 |
| Test fixture | `frontend/test/figma-neutral-m7-change-docs.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-62/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。new 已迁。[id] 未改 chrome。 |
| Status | `VERIFYING` |

### `/change-docs/new`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-63](https://linear.app/yangdi/issue/YAN-63/实施-figma-neutral-m7迁移-change-docsnew) |
| Route | `/change-docs/new` · `NewChangeDocPage` |
| Owner / role | `change_doc` create。无 create 跳转 `/` |
| Primary Pattern | Form / Settings |
| Supporting components | FormSettingsPage、TemplateSelector、FieldList、TableFieldEditor、CiSelectorModal、Card、Field、NeutralDialog |
| Data / API | `['change-doc-templates-active']` GET `/admin/change-doc-templates`；POST `/change-docs`；POST `/change-docs/ai-generate-new`；GET `/cmdb/instances/search`。未改。 |
| Required states | 权限不足、选模板、填表、必填校验、AI 生成、CI 选择、提交中 |
| Test fixture | `frontend/test/figma-neutral-m7-change-docs-new.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-63/`。视觉审计 WAIVED |
| Legacy consumers | 本页及 FieldList/TableFieldEditor 不再引用旧 design-system。详情页已迁 chrome。 |
| Status | `VERIFYING` |

### `/change-docs/[id]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-64](https://linear.app/yangdi/issue/YAN-64/实施-figma-neutral-m7迁移-change-docsid) |
| Route | `/change-docs/[id]` · `ChangeDocDetailPage` |
| Owner / role | `change_doc` read/update/approve。无 read 跳转 `/` |
| Primary Pattern | Form / Settings |
| Supporting components | FormSettingsPage、DocActionBar、PlanTemplatePicker、FieldList、StatusBadge、Card |
| Data / API | `['change-doc', id]` GET/PUT `/change-docs/:id`；POST submit/submit-plan/approve/ai-generate；CI links；export。未改。 |
| Required states | Loading、缺失、草稿/待审批/待补方案/通过/拒绝、保存、审批、导出 |
| Test fixture | `frontend/test/figma-neutral-m7-change-docs-detail.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-64/`。视觉审计 WAIVED |
| Legacy consumers | 本页 chrome 不再引用旧 design-system / shared。`CiLinkSelector` 仍用旧原语。wiki 列表已迁。 |
| Status | `VERIFYING` |

### `/wiki`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-65](https://linear.app/yangdi/issue/YAN-65/实施-figma-neutral-m7迁移-wiki) |
| Route | `/wiki` · `WikiSpacesPage` |
| Owner / role | `wiki` read/create/update/delete；`group` read。无 read 跳转 `/` |
| Primary Pattern | Data / Management |
| Supporting components | DataManagementPage、Card 布局、NeutralDialog、NeutralAlertDialog、ResourceAccessDialog |
| Data / API | `['wiki-spaces']` GET/POST `/wiki/spaces`；PUT/DELETE `/wiki/spaces/:id`；`['authorization-groups']`。未改。 |
| Required states | 权限不足、Loading、Empty、Error、官方手册、团队排序、创建/编辑/删除、授权 |
| Test fixture | `frontend/test/figma-neutral-m7-wiki.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-65/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。空间首页已迁。其余 wiki 页未改。 |
| Status | `VERIFYING` |

### `/wiki/[spaceId]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-66](https://linear.app/yangdi/issue/YAN-66/实施-figma-neutral-m7迁移-wikispaceid) |
| Route | `/wiki/[spaceId]` · `WikiSpaceHomePage` |
| Owner / role | 空间可见性由 `wiki-spaces` / tree 接口决定 |
| Primary Pattern | Data / Management |
| Supporting components | DataManagementPage、Card、StatusBadge、layout 外壳、WikiTreeSidebar |
| Data / API | `['wiki-spaces']`；`['wiki-tree', sid]` GET `/wiki/spaces/:id/tree`；exportSpace。未改。 |
| Required states | 空间不存在、空页面、最近更新、图谱入口 |
| Test fixture | `frontend/test/figma-neutral-m7-wiki-space.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-66/`。视觉审计 WAIVED |
| Legacy consumers | 本页和 layout 不再引用旧 v2 色。`WikiTreeSidebar` 仍用旧原语。阅读页已迁。 |
| Status | `VERIFYING` |

### `/wiki/[spaceId]/[pageId]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-67](https://linear.app/yangdi/issue/YAN-67/实施-figma-neutral-m7迁移-wikispaceidpageid) |
| Route | `/wiki/[spaceId]/[pageId]` · `WikiPageReader` |
| Owner / role | `canWrite` / `canPublish` / `canManageAcl` 来自页面接口 |
| Primary Pattern | Detail / Drawer |
| Supporting components | DetailDrawerPage、WikiMarkdown、WikiBacklinksPanel、WikiVersionsPanel、WikiCommentsDrawer |
| Data / API | `['wiki-page', pid]` get/submit/publish/export；comments count；backlinks；versions。未改。 |
| Required states | Loading、缺失、草稿/审核/已发布、编辑、评论、版本 |
| Test fixture | `frontend/test/figma-neutral-m7-wiki-page.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-67/`。视觉审计 WAIVED |
| Legacy consumers | 本页与评论/版本/反向链接不再引用旧 design-system。编辑页已迁外壳。 |
| Status | `VERIFYING` |

### `/wiki/[spaceId]/[pageId]/edit`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-68](https://linear.app/yangdi/issue/YAN-68/实施-figma-neutral-m7迁移-wikispaceidpageidedit) |
| Route | `/wiki/[spaceId]/[pageId]/edit` · `WikiEditorPage` |
| Owner / role | `canWrite === false` 回阅读页 |
| Primary Pattern | Form / Settings |
| Supporting components | PageHeader、Input、MDEditor、wikiMarkdownComponents |
| Data / API | `['wiki-page', pid]` get/save；search；uploadAttachment。未改。 |
| Required states | 无权/缺失、标题、保存、自动保存、预览、图片、wiki 链接补全 |
| Test fixture | `frontend/test/figma-neutral-m7-wiki-edit.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-68/`。视觉审计 WAIVED |
| Legacy consumers | 本页外壳不再引用旧 design-system / shared。图谱页已迁。search 未改。 |
| Status | `VERIFYING` |

### `/wiki/[spaceId]/graph`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-69](https://linear.app/yangdi/issue/YAN-69/实施-figma-neutral-m7迁移-wikispaceidgraph) |
| Route | `/wiki/[spaceId]/graph` · `WikiGraphPage` |
| Owner / role | `wiki` read。无 read 跳转 `/` |
| Primary Pattern | Dashboard / Feedback |
| Supporting components | DashboardFeedbackPage、ReactFlow、LoadingState、EmptyState |
| Data / API | `['wiki-graph', sid]` GET `/wiki/spaces/:id/graph`；`['wiki-spaces']`。未改。 |
| Required states | 权限不足、Loading、空图、节点点击跳转 |
| Test fixture | `frontend/test/figma-neutral-m7-wiki-graph.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-69/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 shared / v2 色。search 已迁。 |
| Status | `VERIFYING` |

### `/wiki/search`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-70](https://linear.app/yangdi/issue/YAN-70/实施-figma-neutral-m7迁移-wikisearch) |
| Route | `/wiki/search` · `WikiSearchPage` |
| Owner / role | 知识库搜索 |
| Primary Pattern | Data / Management |
| Supporting components | DataManagementPage、SearchInput、Pagination、EmptyState |
| Data / API | `['wiki-search', debouncedKw, page]` wikiApi.search。未改。 |
| Required states | 空关键词、搜索中、无结果、结果列表、分页、URL 同步 |
| Test fixture | `frontend/test/figma-neutral-m7-wiki-search.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-70/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。workflow 未改。 |
| Status | `VERIFYING` |

### `/tasks/templates/new`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-46](https://linear.app/yangdi/issue/YAN-46/实施-figma-neutral-m7迁移-taskstemplatesnew) |
| Route | `/tasks/templates/new` · `TaskTemplateCreate` |
| Primary Pattern | Form / Settings |
| Data / API | `createTaskTemplate`，默认 layout `main` + 空 fields。成功后跳草稿版本设计器。 |
| Required states | 编码校验、名称必填、提交中、创建失败 toast |
| Test fixture | `frontend/test/figma-neutral-m7-task-templates-new.test.cjs` |
| Evidence | `docs/migration/figma-neutral-frontend/evidence/YAN-46/`。视觉审计 WAIVED |
| Legacy consumers | 本页不再引用旧 design-system / shared。设计器未改。 |
| Status | `VERIFYING` |


### `/workflow/design`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-71](https://linear.app/yangdi/issue/YAN-71/实施-figma-neutral-m7迁移-workflowdesign) |
| Route | `/workflow/design` · 新建流程画布，不是列表 |
| Primary Pattern | Form / Settings |
| Data / API | POST `/workflow/definitions`；XML process id 替换；BpmnEditor |
| Test fixture | `frontend/test/figma-neutral-m7-workflow-design.test.cjs` |
| Status | `VERIFYING` |

### `/workflow/design/[id]`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-72](https://linear.app/yangdi/issue/YAN-72/实施-figma-neutral-m7迁移-workflowdesignid) |
| Route | `/workflow/design/[id]` |
| Primary Pattern | Form / Settings |
| Data / API | GET definitions / PUT `/workflow/definitions/key/:key/update` |
| Test fixture | `frontend/test/figma-neutral-m7-workflow-design-id.test.cjs` |
| Status | `VERIFYING` |

### `/workflow/admin`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-73](https://linear.app/yangdi/issue/YAN-73/实施-figma-neutral-m7迁移-workflowadmin) |
| Route | `/workflow/admin` |
| Primary Pattern | Data / Management |
| Data / API | `['process-definitions', page]` |
| Test fixture | `frontend/test/figma-neutral-m7-workflow-admin.test.cjs` |
| Status | `VERIFYING` |

### `/workflow/instances`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-74](https://linear.app/yangdi/issue/YAN-74/实施-figma-neutral-m7迁移-workflowinstances) |
| Status | `VERIFYING` |

### `/workflow/templates`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-75](https://linear.app/yangdi/issue/YAN-75/实施-figma-neutral-m7迁移-workflowtemplates) |
| Status | `VERIFYING` |

### `/workflow/bindings`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-76](https://linear.app/yangdi/issue/YAN-76/实施-figma-neutral-m7迁移-workflowbindings) |
| Status | `VERIFYING` |

### `/workflow/stats`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-77](https://linear.app/yangdi/issue/YAN-77/实施-figma-neutral-m7迁移-workflowstats) |
| Status | `VERIFYING` |

### `/`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-83](https://linear.app/yangdi/issue/YAN-83) |
| Route | `/` · `frontend/src/app/(dashboard)/page.tsx` |
| Primary Pattern | Dashboard / Feedback |
| Test fixture | `frontend/test/figma-neutral-m7-home.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb`

| 字段 | 内容 |
|---|---|
| Linear Issue | [YAN-78](https://linear.app/yangdi/issue/YAN-78) |
| Route | `/cmdb` · `frontend/src/app/(dashboard)/cmdb/page.tsx` |
| Primary Pattern | Dashboard / Feedback |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/admin`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/admin` · `frontend/src/app/(dashboard)/cmdb/admin/page.tsx` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-admin.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/admin/models/[modelCode]`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/admin/models/[modelCode]` |
| Primary Pattern | Form / Settings |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-model-detail.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/alerts`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/alerts` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-alerts.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/changes`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/changes` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-changes.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/changes/stats`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/changes/stats` |
| Primary Pattern | Dashboard / Feedback |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-changes-stats.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/impact/[instanceId]`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/impact/[instanceId]` |
| Primary Pattern | Detail / Drawer |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-impact.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/instances`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/instances` · `frontend/src/app/(dashboard)/cmdb/instances/page.tsx` |
| Status | `EXCLUDED` · redirect 到 `/cmdb`，无独立视觉表面 |

### `/cmdb/models`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/models` |
| Status | `EXCLUDED` · redirect 到 `/cmdb/admin`，无独立视觉表面 |

### `/cmdb/associations`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/associations` |
| Status | `EXCLUDED` · redirect 到 `/cmdb/admin`，无独立视觉表面 |

### `/cmdb/instances/2d-view`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/instances/2d-view` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-2d-view.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/instances/by-model/[modelCode]`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/instances/by-model/[modelCode]` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-instance-list.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/instances/by-model/[modelCode]/new`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/instances/by-model/[modelCode]/new` |
| Primary Pattern | Form / Settings |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-instance-new.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/instances/by-model/[modelCode]/[id]`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/instances/by-model/[modelCode]/[id]` |
| Primary Pattern | Detail / Drawer |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-instance-detail.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/instances/by-model/[modelCode]/[id]/associations`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/instances/by-model/[modelCode]/[id]/associations` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-instance-associations.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/instances/by-model/[modelCode]/[id]/associations/new`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/instances/by-model/[modelCode]/[id]/associations/new` |
| Primary Pattern | Form / Settings |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-instance-associations-new.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/spatial`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/spatial` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-spatial.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/spatial/rooms/[roomId]`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/spatial/rooms/[roomId]` |
| Primary Pattern | Detail / Drawer |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-spatial-rooms.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/spatial/rooms/[roomId]/edit`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/spatial/rooms/[roomId]/edit` |
| Primary Pattern | Form / Settings |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-spatial-rooms.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/spatial/rooms/[roomId]/versions`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/spatial/rooms/[roomId]/versions` |
| Primary Pattern | Data / Management |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-spatial-rooms.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/spatial/spike`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/spatial/spike` |
| Primary Pattern | Dashboard / Feedback |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-spatial-rooms.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED；spike 仅内部） |

### `/cmdb/topology/[instanceId]`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/topology/[instanceId]` |
| Primary Pattern | Detail / Drawer |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-topology.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |

### `/cmdb/topology/[instanceId]/compare`

| 字段 | 内容 |
|---|---|
| Route | `/cmdb/topology/[instanceId]/compare` |
| Primary Pattern | Detail / Drawer |
| Test fixture | `frontend/test/figma-neutral-m7-cmdb-topology-compare.test.cjs` |
| Status | `VERIFYING`（视觉审计 WAIVED） |
