# FQA 缺陷覆盖矩阵

更新时间：2026-07-15
来源：`FQA_20260712_0329_lintfix`

## 对账结论

- `defects.md` 共有 **100** 个 `BUG-FQA-*` 章节。
- `checkpoint.openDefects` 有 **93** 项：漏记 `BUG-FQA-082..086`、`BUG-FQA-098`，并已因前序整改移除 `BUG-FQA-006`。
- checkpoint 仍把 `BUG-FQA-016/017/056` 列为开放，但对应 REM 已关闭。
- 本矩阵以缺陷章节为分母：**100/100 恰好映射到一个主整改事件，无遗漏、无重复**。
- 一个事件可聚合共享根因，但每个缺陷在 `VERIFICATION.md` 中必须保留独立验收证据。

## 映射

| 缺陷 | 原严重度 | 主整改事件 | 事件状态 | 来源对账 |
|---|---|---|---|---|
| `BUG-FQA-006` | P1 | [`REM-P1-004`：失败登录审计](./02-account-organization/REM-P1-004-failed-login-audit/README.md) | `VERIFIED` | 历史失败；checkpoint 已移除，事件已定向验证 |
| `BUG-FQA-008` | P1 | [`REM-P1-005`：通知读取权限收敛](./01-security-authorization/REM-P1-005-notification-read-authorization/README.md) | `VERIFIED` | L1-L3 API/UI allow-deny 与精确清理通过；待最终 L4 |
| `BUG-FQA-009` | P2 | [`REM-P2-001`：动态资源不存在与错误态收敛](./08-cross-cutting-contracts/REM-P2-001-dynamic-resource-not-found-states/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-010` | P2 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-011` | P1 | [`REM-P1-016`：跨模块写操作审计与快照完整性](./07-platform-integration/REM-P1-016-cross-module-audit-snapshots/README.md) | `VERIFIED` | IPAM CRUD/allocate/release API audit snapshots PASS；待 L4 |
| `BUG-FQA-012` | P1 | [`REM-P1-026`：日报审批待办与统一流程任务收敛](./05-workflow-change/REM-P1-026-daily-workflow-task-convergence/README.md) | `VERIFIED` | L1-L3 旧/统一待办同集、旧审批和 runId 受限清理通过；待最终 L4 |
| `BUG-FQA-013` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-014` | P1 | [`REM-P1-029`：运维日历任务、节假日与周期规则输入合同](./06-ops-collaboration/REM-P1-029-ops-calendar-input-rule-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-015` | P2 | [`REM-P1-013`：账号与组织输入及显式清空合同](./02-account-organization/REM-P1-013-account-input-null-update-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-016` | P1 | [`REM-P1-002`：成员列表软删除一致性](./02-account-organization/REM-P1-002-membership-list-soft-delete-consistency/README.md) | `CLOSED` | checkpoint 仍列开放，但整改事件已关闭 |
| `BUG-FQA-017` | P0 | [`REM-P0-001`：membership 移除后 group assignment 失效](./01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/README.md) | `CLOSED` | checkpoint 仍列开放，但整改事件已关闭 |
| `BUG-FQA-018` | P1 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 cross-group API/UI scope and cleanup passed; awaiting L4 |
| `BUG-FQA-019` | P1 | [`REM-P1-016`：跨模块写操作审计与快照完整性](./07-platform-integration/REM-P1-016-cross-module-audit-snapshots/README.md) | `VERIFIED` | CSV 单行运行时 `created=1/failed=0`，afterJson 合法 JSON；待 L4 |
| `BUG-FQA-020` | P1 | [`REM-P1-029`：运维日历任务、节假日与周期规则输入合同](./06-ops-collaboration/REM-P1-029-ops-calendar-input-rule-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-021` | P2 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 invalid input 400、BPMN 保存部署重载再保存通过；待最终 L4 |
| `BUG-FQA-022` | P2 | [`REM-P2-006`：通用配置拒绝的 HTTP 与业务码一致性](./07-platform-integration/REM-P2-006-configuration-http-status-contract/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-023` | P1 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-024` | P2 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-025` | P2 | [`REM-P2-011`：通知引用目标跳转合同](./06-ops-collaboration/REM-P2-011-notification-reference-navigation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-026` | P2 | [`REM-P2-002`：CMDB 变更查询与统计准确性](./03-cmdb-assets/REM-P2-002-cmdb-change-query-statistics/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-027` | P2 | [`REM-P2-004`：用户主题切换与偏好持久化](./07-platform-integration/REM-P2-004-user-theme-preference/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-028` | P2 | [`REM-P2-013`：Workflow 活动历史与统计读模型 schema](./05-workflow-change/REM-P2-013-workflow-read-model-schema/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-029` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-030` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-031` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-032` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-033` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-034` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-035` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-036` | P2 | [`REM-P2-013`：Workflow 活动历史与统计读模型 schema](./05-workflow-change/REM-P2-013-workflow-read-model-schema/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-037` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-038` | P2 | [`REM-P2-005`：Wiki 当前页面导出合同](./04-content-files/REM-P2-005-wiki-page-export-contract/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-039` | P2 | [`REM-P1-011`：CMDB 导航、模型路由与查询合同](./03-cmdb-assets/REM-P1-011-cmdb-navigation-query-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-040` | P2 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-041` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 release/reuse API and cleanup passed; awaiting L4 |
| `BUG-FQA-042` | P2 | [`REM-P2-001`：动态资源不存在与错误态收敛](./08-cross-cutting-contracts/REM-P2-001-dynamic-resource-not-found-states/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-043` | P2 | [`REM-P2-001`：动态资源不存在与错误态收敛](./08-cross-cutting-contracts/REM-P2-001-dynamic-resource-not-found-states/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-044` | P2 | [`REM-P1-013`：账号与组织输入及显式清空合同](./02-account-organization/REM-P1-013-account-input-null-update-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-045` | P1 | [`REM-P1-017`：Wiki 资源授权、归属组与不存在语义](./04-content-files/REM-P1-017-wiki-resource-authorization-semantics/README.md) | `VERIFIED` | L1-L3 不存在页面/空间 404 与不可操作错误态通过；待最终 L4 |
| `BUG-FQA-046` | P2 | [`REM-P2-008`：Wiki 未知链接友好渲染](./04-content-files/REM-P2-008-wiki-unknown-link-rendering/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-047` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-048` | P1 | [`REM-P1-027`：变更模板复制、字段配置与引用保护生命周期](./05-workflow-change/REM-P1-027-change-template-lifecycle/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-049` | P1 | [`REM-P1-025`：Workflow 模板实例可审计清理生命周期](./05-workflow-change/REM-P1-025-workflow-template-instance-cleanup/README.md) | `VERIFIED` | L1-L3 template delete, reference protection, audit and UI confirmation passed; awaiting L4 |
| `BUG-FQA-050` | P1 | [`REM-P1-010`：CMDB 影响分析与历史拓扑重建](./03-cmdb-assets/REM-P1-010-cmdb-impact-history-reconstruction/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-051` | P2 | [`REM-P2-002`：CMDB 变更查询与统计准确性](./03-cmdb-assets/REM-P2-002-cmdb-change-query-statistics/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-052` | P2 | [`REM-P2-002`：CMDB 变更查询与统计准确性](./03-cmdb-assets/REM-P2-002-cmdb-change-query-statistics/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-053` | P1 | [`REM-P1-021`：共享文件与 Wiki 附件存储回收](./04-content-files/REM-P1-021-stored-object-delete-compensation/README.md) | `VERIFIED` | L1-L3 存储失败补偿、附件独立删除和页面级联回收 API 通过；待最终 L4 |
| `BUG-FQA-054` | P2 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-055` | P2 | [`REM-P1-007`：已删除角色关联读取与清理一致性](./01-security-authorization/REM-P1-007-deleted-role-association-lifecycle/README.md) | `VERIFIED` | L1-L3 deleted-role API/UI lifecycle and cleanup passed; awaiting L4 |
| `BUG-FQA-056` | P1 | [`REM-P1-003`：未分配组与业务组双向互斥](./02-account-organization/REM-P1-003-unassigned-business-group-exclusivity/README.md) | `CLOSED` | checkpoint 仍列开放，但整改事件已关闭 |
| `BUG-FQA-057` | P2 | [`REM-P2-003`：Wiki 页面标题规范与同级唯一性](./04-content-files/REM-P2-003-wiki-title-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-058` | P1 | [`REM-P1-017`：Wiki 资源授权、归属组与不存在语义](./04-content-files/REM-P1-017-wiki-resource-authorization-semantics/README.md) | `VERIFIED` | L1-L3 root owner 创建子页通过；待最终 L4 |
| `BUG-FQA-059` | P1 | [`REM-P1-028`：变更文档模板加载与创建响应合同](./05-workflow-change/REM-P1-028-change-document-create-contract/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-060` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-061` | P1 | [`REM-P1-009`：CMDB 关系与实例删除引用完整性](./03-cmdb-assets/REM-P1-009-cmdb-relation-integrity/README.md) | `VERIFIED` | L1-L3 自环 API/UI 拒绝、清理与 impact 通过；待最终 L4 |
| `BUG-FQA-062` | P1 | [`REM-P1-020`：共享文件夹重命名、移动与名称合同](./04-content-files/REM-P1-020-shared-folder-crud-validation/README.md) | `VERIFIED` | L1-L3 rename/move、源/目标权限与 UI 树刷新通过；待最终 L4 |
| `BUG-FQA-063` | P2 | [`REM-P1-020`：共享文件夹重命名、移动与名称合同](./04-content-files/REM-P1-020-shared-folder-crud-validation/README.md) | `VERIFIED` | L1-L3 空白/路径/超长、规范名冲突与局部唯一约束通过；待最终 L4 |
| `BUG-FQA-064` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 group range API/UI and cleanup passed; awaiting L4 |
| `BUG-FQA-065` | P2 | [`REM-P1-019`：共享文件上传状态、冲突与可取消生命周期](./04-content-files/REM-P1-019-shared-file-upload-lifecycle/README.md) | `VERIFIED` | L1-L3 上传进度、当前列表刷新和取消实现完成；待最终 L4 |
| `BUG-FQA-066` | P1 | [`REM-P1-019`：共享文件上传状态、冲突与可取消生命周期](./04-content-files/REM-P1-019-shared-file-upload-lifecycle/README.md) | `VERIFIED` | L1-L3 白名单、20MB、规范名冲突与 API/UI 复验通过；待最终 L4 |
| `BUG-FQA-067` | P1 | [`REM-P1-017`：Wiki 资源授权、归属组与不存在语义](./04-content-files/REM-P1-017-wiki-resource-authorization-semantics/README.md) | `VERIFIED` | L1-L3 管理员显式选组、组级用户固定本组通过；待最终 L4 |
| `BUG-FQA-068` | P2 | [`REM-P1-019`：共享文件上传状态、冲突与可取消生命周期](./04-content-files/REM-P1-019-shared-file-upload-lifecycle/README.md) | `VERIFIED` | L1-L3 上传中断与数据库失败均精确回收新建对象；待最终 L4 |
| `BUG-FQA-069` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-070` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-071` | P2 | [`REM-P2-009`：Wiki 搜索入口与历史导航](./04-content-files/REM-P2-009-wiki-search-discovery-history/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-072` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 IP host boundary API and cleanup passed; awaiting L4 |
| `BUG-FQA-073` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 canonical CIDR overlap and concurrency passed; awaiting L4 |
| `BUG-FQA-074` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-075` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 server idempotency and UI submit gate passed; awaiting L4 |
| `BUG-FQA-076` | P1 | [`REM-P1-018`：Wiki 版本快照与回退完整性](./04-content-files/REM-P1-018-wiki-version-revert-integrity/README.md) | `VERIFIED` | L1-L3 版本 `v1/v2/revert(v1)->v3`、详情/导出、空快照拒绝与 API/UI 清理通过；待最终 L4 |
| `BUG-FQA-077` | P1 | [`REM-P1-022`：共享文件 write 权限运行时消费者](./04-content-files/REM-P1-022-shared-file-update-consumer/README.md) | `VERIFIED` | L1-L3 既有 `PUT /files/{id}`、write ACL、审计及真实 UI 重命名通过；待最终 L4 |
| `BUG-FQA-078` | P2 | [`REM-P2-010`：Wiki 系统手册与只读空间种子](./04-content-files/REM-P2-010-wiki-system-space-seed/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-079` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-080` | P1 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 input-boundary validation and cleanup passed; awaiting L4 |
| `BUG-FQA-081` | P1 | [`REM-P1-024`：Workflow 定义版本与实例状态生命周期](./05-workflow-change/REM-P1-024-workflow-definition-instance-lifecycle/README.md) | `VERIFIED` | L1-L3 definition all-version deletion and runtime protection passed; awaiting L4 |
| `BUG-FQA-082` | P1 | [`REM-P1-029`：运维日历任务、节假日与周期规则输入合同](./06-ops-collaboration/REM-P1-029-ops-calendar-input-rule-contracts/README.md) | `NOT_STARTED` | defects.md 已登记，checkpoint.openDefects 漏记 |
| `BUG-FQA-083` | P1 | [`REM-P1-027`：变更模板复制、字段配置与引用保护生命周期](./05-workflow-change/REM-P1-027-change-template-lifecycle/README.md) | `NOT_STARTED` | defects.md 已登记，checkpoint.openDefects 漏记 |
| `BUG-FQA-084` | P1 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 candidate group BPMN 往返通过；待最终 L4 |
| `BUG-FQA-085` | P1 | [`REM-P1-013`：账号与组织输入及显式清空合同](./02-account-organization/REM-P1-013-account-input-null-update-contracts/README.md) | `NOT_STARTED` | defects.md 已登记，checkpoint.openDefects 漏记 |
| `BUG-FQA-086` | P1 | [`REM-P1-009`：CMDB 关系与实例删除引用完整性](./03-cmdb-assets/REM-P1-009-cmdb-relation-integrity/README.md) | `VERIFIED` | L1-L3 自环 API/UI 拒绝、清理与 impact 通过；待最终 L4 |
| `BUG-FQA-087` | P1 | [`REM-P1-011`：CMDB 导航、模型路由与查询合同](./03-cmdb-assets/REM-P1-011-cmdb-navigation-query-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-088` | P1 | [`REM-P1-009`：CMDB 关系与实例删除引用完整性](./03-cmdb-assets/REM-P1-009-cmdb-relation-integrity/README.md) | `VERIFIED` | L1-L3 重复/并发设备 API、清理与 impact 通过；待最终 L4 |
| `BUG-FQA-089` | P1 | [`REM-P1-017`：Wiki 资源授权、归属组与不存在语义](./04-content-files/REM-P1-017-wiki-resource-authorization-semantics/README.md) | `VERIFIED` | L1-L3 ownerGroup 与 others mode bits 主体分类回退通过；待最终 L4 |
| `BUG-FQA-090` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-091` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-092` | P1 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 credential editing, masking, audit and UI persistence passed; awaiting L4 |
| `BUG-FQA-093` | P1 | [`REM-P1-007`：已删除角色关联读取与清理一致性](./01-security-authorization/REM-P1-007-deleted-role-association-lifecycle/README.md) | `VERIFIED` | L1-L3 deleted-role API/UI lifecycle and cleanup passed; awaiting L4 |
| `BUG-FQA-094` | P1 | [`REM-P1-030`：日报导出权限运行时消费者](./06-ops-collaboration/REM-P1-030-daily-report-export-consumer/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-095` | P1 | [`REM-P1-011`：CMDB 导航、模型路由与查询合同](./03-cmdb-assets/REM-P1-011-cmdb-navigation-query-contracts/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-096` | P1 | [`REM-P1-016`：跨模块写操作审计与快照完整性](./07-platform-integration/REM-P1-016-cross-module-audit-snapshots/README.md) | `VERIFIED` | Audit API/UI exposes redacted before/after snapshots; IPAM/shared-file/ops-rule writers covered; 待 L4 |
| `BUG-FQA-097` | P2 | [`REM-P2-014`：周期规则删除与确认入口](./06-ops-collaboration/REM-P2-014-ops-rule-delete-ui/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-098` | P1 | [`REM-P1-027`：变更模板复制、字段配置与引用保护生命周期](./05-workflow-change/REM-P1-027-change-template-lifecycle/README.md) | `NOT_STARTED` | defects.md 已登记，checkpoint.openDefects 漏记 |
| `BUG-FQA-099` | P1 | [`REM-P1-024`：Workflow 定义版本与实例状态生命周期](./05-workflow-change/REM-P1-024-workflow-definition-instance-lifecycle/README.md) | `VERIFIED` | L1-L3 suspended start and instance termination lifecycle passed; awaiting L4 |
| `BUG-FQA-100` | P1 | [`REM-P1-019`：共享文件上传状态、冲突与可取消生命周期](./04-content-files/REM-P1-019-shared-file-upload-lifecycle/README.md) | `VERIFIED` | L1-L3 删除时主对象与衍生 Markdown 回收已实现并验证；待最终 L4 |
| `BUG-FQA-101` | P1 | [`REM-P1-010`：CMDB 影响分析与历史拓扑重建](./03-cmdb-assets/REM-P1-010-cmdb-impact-history-reconstruction/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-102` | P1 | [`REM-P1-028`：变更文档模板加载与创建响应合同](./05-workflow-change/REM-P1-028-change-document-create-contract/README.md) | `NOT_STARTED` | checkpoint.openDefects |
| `BUG-FQA-103` | P2 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 copy feedback and browser crypto compatibility passed; awaiting L4 |
| `BUG-FQA-104` | P1 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 条件流命名空间与表达式往返通过；待最终 L4 |
| `BUG-FQA-105` | P1 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 名称、分类、描述、XML 和版本往返通过；待最终 L4 |
| `BUG-FQA-106` | P2 | [`REM-P2-007`：运维材料导出文件与摘要合同](./06-ops-collaboration/REM-P2-007-ops-material-export-contract/README.md) | `NOT_STARTED` | checkpoint.openDefects |

## 规则

- 主映射唯一；若一个缺陷需要多个事件，只有一个为主事件，其他只可作为显式依赖。
- `CLOSED/VERIFIED/VERIFYING` 不改写原始 FQA 失败，只在新证据中追加结论。
- 新发现缺陷先写入源 run 的缺陷台账，再分配 REM；禁止只改 checkpoint 数组。
- 每次事件状态变化必须同步本矩阵、事件卡和 `INDEX.md`。
