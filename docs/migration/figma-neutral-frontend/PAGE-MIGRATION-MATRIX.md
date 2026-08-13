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
| `/login` | 1 | Form / Settings | 登录错误、提交中、密码可见性、键盘、匿名态 | NOT_STARTED |
| `/account/*` | 3 | Form / Settings | profile/setup/password、校验、dirty、成功/失败 | NOT_STARTED |
| `/admin/*` | 6 | Form / Settings; Data / Management; Overlay / Destructive | AI/config/backup/audit/templates、管理员权限、危险操作 | NOT_STARTED |
| `/change-docs/*` | 3 | Data / Management; Form / Settings; Detail / Drawer | 列表、新建、详情、动态字段、审批状态 | NOT_STARTED |
| `/cmdb/*` | 23 | 全五类 Pattern | 模型、实例、关联、空间、拓扑、变更、告警、复杂 Drawer/Dialog | NOT_STARTED |
| `/` dashboard | 1 | Dashboard / Feedback | 指标、部分数据、Loading/Empty/Error、导航入口 | NOT_STARTED |
| `/devices/*` | 3 | Data / Management; Form / Settings; Detail / Drawer | 列表、新建、详情、凭据和权限 | NOT_STARTED |
| `/files/*` | 2 | Data / Management; Detail / Drawer | 上传、列表、预览、错误文件、权限 | NOT_STARTED |
| `/groups` | 1 | Data / Management; Overlay / Destructive | 成员、生命周期、Dialog、权限 | NOT_STARTED |
| `/ipam/*` | 2 | Data / Management; Detail / Drawer | 地址列表、详情、状态与冲突 | NOT_STARTED |
| `/notifications/*` | 3 | Data / Management; Detail / Drawer | 未读/已读、目标解析、空态、跳转 | NOT_STARTED |
| `/ops-calendar/*` | 3 | Dashboard / Feedback; Data / Management; Overlay / Destructive | 月/周/列表、排班、节假日、日期和 Dialog | NOT_STARTED |
| `/rbac/*` | 2 | Data / Management; Overlay / Destructive | 角色、权限、禁用/继承/危险变更 | NOT_STARTED |
| `/tasks/*` | 13 | 全五类 Pattern | 列表、详情、计划、模板、分析、指标、自动化、动态表单 | NOT_STARTED |
| `/users` | 1 | Data / Management; Overlay / Destructive | 用户 CRUD、授权、状态和权限 | NOT_STARTED |
| `/wiki/*` | 6 | Data / Management; Detail / Drawer; Form / Settings | 空间、页面、编辑、搜索、图谱、评论/版本 Drawer | NOT_STARTED |
| `/work` | 1 | Data / Management; Detail / Drawer | 待办、审批 Drawer、权限和状态更新 | NOT_STARTED |
| `/workflow/*` | 7 | Data / Management; Form / Settings; Detail / Drawer | 设计、实例、模板、绑定、统计、BPMN 画布 | NOT_STARTED |
| **合计** | **81** |  |  | **NOT_STARTED** |

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
