# REM-P1-057 实施合同

## 目标

- 已迁移父资源下创建子资源时，不因创建者没有主组而产生空 `owner_group_id`。
- Wiki 子页正向读取可在自身 named-user `r--` 和完整祖先 `x` 下通过；移除任一祖先 `x` 后拒绝且不泄露内容。

## 范围

- `AuthorizationResourceMigrationService.initializeCreatedResource` 的 owner-group 解析。
- 资源初始化单测、Wiki 创建/授权聚类、共享文件创建回归和真实 WIKI-024 API 复验。

## Non-goals

- 不修改授权模式、break-glass、角色 scope、ACL 优先级、setgid 位或 default ACL copy。
- 不回填历史资源，不修改迁移脚本、非测试对象或正式 Wiki 审批策略。
- 不把任何其他 L4 `NOT_RUN` 用例提前标 PASS。

## 影响分析

- `initializeCreatedResource`：HIGH；8 个直接调用，33 个受影响符号，4 类创建流程，覆盖 Wiki、Sharedfile、Authorization。
- `createdResourceParent`：HIGH；1 个直接调用，25 个受影响符号，3 类创建流程。
- 风险收敛：仅新增 `ownerGroupId == null && parent != null` 的父组兜底；原 setgid 覆盖顺序保持不变。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | 创建者 owner group 为空且父资源已迁移时，子资源继承父 owner group。 |
| `AC-002` | 非 setgid 父资源下的显式 owner group 保持不变；setgid 父资源仍强制使用父组。 |
| `AC-003` | 根资源初始化、default ACL copy、活动组校验与共享文件创建行为无回归。 |
| `AC-004` | 真实 Wiki 两级页面先以祖先 `r-x` + 子页 `r--` 读取成功，再移除父页 `x` 后返回 403 且响应不含子页标题/内容。 |
| `AC-005` | L1-L3、当前事件分支 backend 容器、日志、精确清理和 manifest 全部通过。 |

## 回滚

撤销 owner-group 空值兜底条件。无迁移、配置恢复、数据回填或外部系统动作。
