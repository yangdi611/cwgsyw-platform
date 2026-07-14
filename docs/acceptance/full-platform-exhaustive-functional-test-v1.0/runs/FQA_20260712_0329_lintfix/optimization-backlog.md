# 优化待办

| 优先级 | 缺陷 | 根因类别 | 建议独立整改范围 |
|---|---|---|---|
| P1 | BUG-FQA-006 | 认证失败审计事务 | `REM-P1-004` 已完成失败登录和 validation 分支的可靠审计写入与脱敏回归；待最终全量 FQA 复验。 |
| P1 | BUG-FQA-008 | 权限 guard 漂移 | 通知 API/UI/路由统一改为 `notification:read`，补所有已读操作反向验证 |
| P1 | BUG-FQA-011 | 写操作审计缺失 | IPAM create/update/delete/allocate/release 全链路审计 |
| P1 | BUG-FQA-012 | Workflow 入口实现分叉 | 旧日报待办、任务页与统一流程中心共用候选组解析与审批动作 |
| P1 | BUG-FQA-013 | permission seed/consumer 脱节 | 清理或实现 `group:delete`、`shared_file:update`，并处理 CMDB guard drift |
| P1 | BUG-FQA-014 | 枚举/数据库约束漂移 | 运维日历 priority 的前端、DTO、Service 与 schema 枚举统一；非法值返回 400 |
| P1 | BUG-FQA-056 | 未分配组双向互斥校验缺失 | 在 membership 服务实现未分配组与业务组的双向原子互斥，明确迁组合同并覆盖 UI/API 两种顺序 |
| P2 | BUG-FQA-057 | Wiki 标题校验缺失 | 对页面创建/保存统一 trim、长度与同级唯一校验，将数据库异常转换为 400，并补 API/UI 并发回归 |
| P1 | BUG-FQA-058 | Wiki 子页创建授权错误 | 修复页面父节点的 create/write action 映射和默认 ACL 继承，覆盖 own/assigned parent 的层级创建与移动回归 |
| P1 | BUG-FQA-059 | 变更模板 DTO 与新建路由响应合同漂移 | 对齐 TemplateVO 字段映射和创建返回类型，前端以数值 id 跳转并对非法 ID 返回明确错误 |
| P2 | BUG-FQA-060 | 日报 DTO 输入异常未映射 | 对日期与工时做 Bean Validation，统一转换异常为 400，并补零持久化回归 |
| P1 | BUG-FQA-061 | CMDB 删除引用完整性缺失 | 按 `onDelete` 实现 restrict/cascade/none 事务语义，纳入设备/变更单/日报/关系引用保护并消除孤儿 ID |
| P1 | BUG-FQA-062 | 共享文件夹 CRUD 操作缺失 | 实现受 `shared_file:manage` 保护的重命名与移动 API/UI，校验目标父级权限、防环、树刷新、审计与失败无副作用 |
| P2 | BUG-FQA-063 | 共享文件夹名称校验缺失 | 对创建/重命名统一 trim、长度、同级唯一与路径分隔符策略；将数据库长度异常映射为 400 并无残留 |
| P1 | BUG-FQA-064 | IPAM group scope 数据范围失效 | 为地址池/分配引入明确属组与迁移策略，在列表/详情/利用率/分配 API 应用统一范围裁决，并防止跨组元数据泄露 |
| P2 | BUG-FQA-065 | 共享文件零字节上传未校验 | 在上传入口拒绝空文件并实现存储/数据库失败补偿，覆盖取消、错误类型、中文名与无半成品回归 |
| P1 | BUG-FQA-067 | Wiki 管理员主组/创建作用域合同漂移 | 对齐 superadmin 的默认归属组选项与后端 `canUseOwnerGroup`/创建 scope 裁决，补 UI 生命周期回归 |
| P2 | BUG-FQA-068 | 上传中断生命周期缺失 | 建立前端可取消上传与后端临时对象/补偿删除协议，覆盖进度、刷新和 MinIO 零残留回归 |
| P2 | BUG-FQA-071 | Wiki 搜索入口和历史状态缺失 | 在 Wiki 首页提供可发现搜索入口；将关键词/分页 URL 状态改为可回溯策略，并回归 debounce、back/forward、焦点与空态 |
| P1 | BUG-FQA-072 | IPAM 网关/DNS与可分配地址校验缺失 | 统一 CIDR 主机范围校验，禁止 network/broadcast 分配，并明确 /31-/32 合同及自动/指定分配回归 |
| P1 | BUG-FQA-073 | IPAM CIDR 重复/重叠未检测 | 创建/编辑时规范化 CIDR 并做同租户区间排他校验，迁移存量冲突后补并发与跨租户回归 |
| P1 | BUG-FQA-074 | 资源管理父导航权限门控漂移 | Sidebar 父组按任一可见子项显示，覆盖 device/ip_pool/shared_file 最小角色导航与 API 一致性回归 |
| P1 | BUG-FQA-075 | IPAM 后退/前进重提交重复创建 | 为创建流程加提交幂等与历史恢复策略，服务端强制同 CIDR/overlap 冲突，并覆盖重试/双击/并发回归 |
| P1 | BUG-FQA-076 | Wiki 版本回退数据丢失 | 核对版本快照 `content` 写入与回退映射；以两个不同正文的保存、回退、详情、导出和权限拒绝构建集成回归 |
| P1 | BUG-FQA-077 | 文件 write permission 无 consumer | 决定移除孤儿 permission 或提供文件本体 update endpoint；所有 file ACL write precedence、路由语义和 MinIO 补偿必须回归 |
| P2 | BUG-FQA-078 | Wiki 系统手册 seed 缺失 | 修复/补齐可幂等运行的系统空间初始化，回归只读分层、直接 API 拒绝、升级存量与个人排序 |
| P1 | BUG-FQA-079 | CMDB 动态属性 fieldKey 不唯一 | 增加 tenant/model/fieldKey 唯一约束及服务预检，迁移并报告存量冲突，覆盖并发与动态表单/导入回归 |
| P1 | BUG-FQA-080 | 设备长中文输入未校验 | 对 create/update category/description 对齐 DTO、前端与数据库长度，统一 400 合同，补中英文多字节边界和无残留回归 |
| P1 | BUG-FQA-081 | Workflow 删除所有版本合同失效 | 按 key 原子删除全部 deployment 或收窄 endpoint 语义；保护 binding，验证实例/历史清理与 versions 空回读 |
| P1 | BUG-FQA-082 | 运维周期规则边界未校验 | 在 DTO/Service/UI 统一 Cron、提前日和 due 时序校验，失败返回 400，回归预览与实际生成一致性 |
| P1 | BUG-FQA-083 | 变更模板生命周期与字段配置缺口 | 实现模板 copy/delete 与引用保护，补字段 sort/default 合同和 UI，提供可精确清理的生命周期 |
| P1 | BUG-FQA-084 | Workflow BPMN/XML 输入错误 500 | 对 XML/key 做部署前校验并映射 Flowable 解析异常为 400，补设计器字段提示和零 deployment 残留回归 |
| P1 | BUG-FQA-085 | 用户 identifier/email 输入校验漂移 | 统一 DTO、前端和数据库上限/格式，映射约束异常为 400，补并发重复和无残留用户回归 |
| P1 | BUG-FQA-086 | CMDB 自关联未阻止 | 在关系服务与数据库层阻止 source=target，自环清理存量，覆盖图谱/影响分析和错误组合回归 |
| P1 | BUG-FQA-087 | CMDB 实例编辑 UI/API guard 漂移 | 统一动态详情编辑入口与 `cmdb_instance:update` 后端合同，覆盖 update/manage/read 最小角色、scope、编辑取消保存和刷新回读 |
| P1 | BUG-FQA-088 | 设备与 CMDB 实例一对一约束缺失 | 在设备创建服务和数据库约束中阻止同 CI 重复关联，并覆盖顺序/并发创建、删除后重建、凭据与审计回归 |
| P1 | BUG-FQA-089 | Wiki others ACL 裁决遗漏 | 对齐 `ResourceAccessService` 的 owner/named-user/matched-groups/others 优先级；在不命中 named/group 后正确计算 mode others bits，并覆盖空间 traverse、页面 read/write、同属组与跨组 scope 回归 |
| P1 | BUG-FQA-090 | CMDB 属性 defaultValue 更新/回读合同失效 | 对齐更新 DTO、Service、实体/mapper/VO 与编辑 UI 的 defaultValue 映射，覆盖 option 变更、实例默认填充与刷新回读 |
| P1 | BUG-FQA-091 | CMDB fieldKey 超长输入映射为 500 | 补 DTO/前端长度校验与数据库异常 400 映射，覆盖最大/超长、多字节、重复和无残留 |
| P1 | BUG-FQA-092 | 设备凭据缺少编辑合同且错误路由为500 | 提供 `device:update` 保护的凭据更新 API/UI，或明确移除“编辑”产品合同；未知 method/route 应返回 404/405，不得500；覆盖用户名/密码边界、取消、刷新、掩码、审计、scope 和无副作用回归 |
| P1 | BUG-FQA-093 | 已删除角色关联读取未收口 | 对角色详情/permissions/assignment 读路径统一 soft-delete 存在性校验，并清理或过滤 role-permission 关联，覆盖删除后访问与并发读删 |
| P1 | BUG-FQA-094 | 日报 export permission 无 consumer | 实现日期范围导出 API/UI 并使用 `daily_report:export` guard，或删除孤儿 action；覆盖 allow/deny、范围、文件合同、空态和审计 |
| P2 | BUG-FQA-009 | 不存在对象错误处理 | 文件预览退出 loading，统一不存在/无权 HTTP 与页面提示 |
| P2 | BUG-FQA-010 | 前端 query 未按权限收敛 | CMDB/Wiki/文件低权限初始化请求加权限 enable 条件 |
