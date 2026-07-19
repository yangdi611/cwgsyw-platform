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
| `BUG-FQA-009` | P2 | [`REM-P2-001`：动态资源不存在与错误态收敛](./08-cross-cutting-contracts/REM-P2-001-dynamic-resource-not-found-states/README.md) | `VERIFIED` | L1-L3 文件不可枚举与中性可恢复预览错误态通过；待最终 L4 |
| `BUG-FQA-010` | P2 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-011` | P1 | [`REM-P1-016`：跨模块写操作审计与快照完整性](./07-platform-integration/REM-P1-016-cross-module-audit-snapshots/README.md) | `VERIFIED` | IPAM CRUD/allocate/release API audit snapshots PASS；待 L4 |
| `BUG-FQA-012` | P1 | [`REM-P1-026`：日报审批待办与统一流程任务收敛](./05-workflow-change/REM-P1-026-daily-workflow-task-convergence/README.md) | `VERIFIED` | L1-L3 旧/统一待办同集、旧审批和 runId 受限清理通过；待最终 L4 |
| `BUG-FQA-013` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-014` | P1 | [`REM-P1-029`：运维日历任务、节假日与周期规则输入合同](./06-ops-collaboration/REM-P1-029-ops-calendar-input-rule-contracts/README.md) | `VERIFIED` | L4 `OPS-011` 发现模板删除未保护规则引用；最小引用保护已完成 L1-L3，待合并后全量 L4 |
| `BUG-FQA-015` | P2 | [`REM-P1-013`：账号与组织输入及显式清空合同](./02-account-organization/REM-P1-013-account-input-null-update-contracts/README.md) | `VERIFIED` | L1-L3 group input 400、有效更新与授权精确清理通过；待 L4 |
| `BUG-FQA-016` | P1 | [`REM-P1-002`：成员列表软删除一致性](./02-account-organization/REM-P1-002-membership-list-soft-delete-consistency/README.md) | `CLOSED` | checkpoint 仍列开放，但整改事件已关闭 |
| `BUG-FQA-017` | P0 | [`REM-P0-001`：membership 移除后 group assignment 失效](./01-security-authorization/REM-P0-001-membership-removal-group-assignment-invalidation/README.md) | `CLOSED` | checkpoint 仍列开放，但整改事件已关闭 |
| `BUG-FQA-018` | P1 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 cross-group API/UI scope and cleanup passed; awaiting L4 |
| `BUG-FQA-019` | P1 | [`REM-P1-016`：跨模块写操作审计与快照完整性](./07-platform-integration/REM-P1-016-cross-module-audit-snapshots/README.md) | `VERIFIED` | CSV 单行运行时 `created=1/failed=0`，afterJson 合法 JSON；待 L4 |
| `BUG-FQA-020` | P1 | [`REM-P1-029`：运维日历任务、节假日与周期规则输入合同](./06-ops-collaboration/REM-P1-029-ops-calendar-input-rule-contracts/README.md) | `VERIFIED` | 原节假日输入合同 L1-L3 保持通过；事件因 L4 `OPS-011` 模板引用完整性回归修复后待全量 L4 |
| `BUG-FQA-021` | P2 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 invalid input 400、BPMN 保存部署重载再保存通过；待最终 L4 |
| `BUG-FQA-022` | P2 | [`REM-P2-006`：通用配置拒绝的 HTTP 与业务码一致性](./07-platform-integration/REM-P2-006-configuration-http-status-contract/README.md) | `VERIFIED` | L1-L3 拒绝 HTTP/body 400、首次 upsert、恢复与仅键名审计通过；等待最终 L4 |
| `BUG-FQA-023` | P1 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `VERIFIED` | L1-L3 审计分页 records/total、真实 API/UI 通过；待 L4 |
| `BUG-FQA-024` | P2 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `VERIFIED` | L1-L3 通知分页 total 与 records 边界通过；待 L4 |
| `BUG-FQA-025` | P2 | [`REM-P2-011`：通知引用目标跳转合同](./06-ops-collaboration/REM-P2-011-notification-reference-navigation/README.md) | `VERIFIED` | L1-L3 Wiki/运维有效跳转、删除/未知目标中性态和零副作用通过；待最终 L4 |
| `BUG-FQA-026` | P2 | [`REM-P2-002`：CMDB 变更查询与统计准确性](./03-cmdb-assets/REM-P2-002-cmdb-change-query-statistics/README.md) | `VERIFIED` | L1-L3 Top10 model/range 聚合与统计页面复验通过；待最终 L4 |
| `BUG-FQA-027` | P2 | [`REM-P2-004`：用户主题切换与偏好持久化](./07-platform-integration/REM-P2-004-user-theme-preference/README.md) | `VERIFIED` | L1-L3 light/dark/system、刷新持久化、报表/Wiki/BPMN 与零 Console error 通过；待最终 L4 |
| `BUG-FQA-028` | P2 | [`REM-P2-013`：Workflow 活动历史与统计读模型 schema](./05-workflow-change/REM-P2-013-workflow-read-model-schema/README.md) | `VERIFIED` | L1-L3 typed camelCase activities/stats API/UI、零残留通过；待 L4 |
| `BUG-FQA-029` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
| `BUG-FQA-030` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
| `BUG-FQA-031` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
| `BUG-FQA-032` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
| `BUG-FQA-033` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
| `BUG-FQA-034` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
| `BUG-FQA-035` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-036` | P2 | [`REM-P2-013`：Workflow 活动历史与统计读模型 schema](./05-workflow-change/REM-P2-013-workflow-read-model-schema/README.md) | `VERIFIED` | L1-L3 typed camelCase activities/stats API/UI、零残留通过；待 L4 |
| `BUG-FQA-037` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
| `BUG-FQA-038` | P2 | [`REM-P2-005`：Wiki 当前页面导出合同](./04-content-files/REM-P2-005-wiki-page-export-contract/README.md) | `VERIFIED` | L4 发现含附件单页导出退化 ZIP；已修复为始终 Markdown，页面/空间导出当前分支 L3 通过，待重新 L4。 |
| `BUG-FQA-107` | P2 | [`REM-P2-020`：Workflow 统计与实例聚合一致性](./05-workflow-change/REM-P2-020-workflow-stats-instance-aggregation/README.md) | `VERIFIED` | L4 发现统计遗漏已删除定义实例；当前/历史汇总、API/UI `4/4/0` 对账通过，待重新 L4。 |
| `BUG-FQA-039` | P2 | [`REM-P1-011`：CMDB 导航、模型路由与查询合同](./03-cmdb-assets/REM-P1-011-cmdb-navigation-query-contracts/README.md) | `VERIFIED` | L1-L3 中文“应用”模板单次编码、200、UTF-8 文件名和零 Console error 通过；待 L4 |
| `BUG-FQA-040` | P2 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `VERIFIED` | L1-L3 action/operatorId/keyword 筛选 API/UI 通过；待 L4 |
| `BUG-FQA-041` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 release/reuse API and cleanup passed; awaiting L4 |
| `BUG-FQA-042` | P2 | [`REM-P2-001`：动态资源不存在与错误态收敛](./08-cross-cutting-contracts/REM-P2-001-dynamic-resource-not-found-states/README.md) | `VERIFIED` | L1-L3 CMDB impact 404 与可恢复页面错误态通过；待最终 L4 |
| `BUG-FQA-043` | P2 | [`REM-P2-001`：动态资源不存在与错误态收敛](./08-cross-cutting-contracts/REM-P2-001-dynamic-resource-not-found-states/README.md) | `VERIFIED` | L1-L3 设备/IPAM 404 与可恢复页面错误态通过；待最终 L4 |
| `BUG-FQA-044` | P2 | [`REM-P1-013`：账号与组织输入及显式清空合同](./02-account-organization/REM-P1-013-account-input-null-update-contracts/README.md) | `VERIFIED` | L1-L3 phone clear null readback and profile completion recalculation passed; 待 L4 |
| `BUG-FQA-045` | P1 | [`REM-P1-017`：Wiki 资源授权、归属组与不存在语义](./04-content-files/REM-P1-017-wiki-resource-authorization-semantics/README.md) | `VERIFIED` | L1-L3 不存在页面/空间 404 与不可操作错误态通过；待最终 L4 |
| `BUG-FQA-046` | P2 | [`REM-P2-008`：Wiki 未知链接友好渲染](./04-content-files/REM-P2-008-wiki-unknown-link-rendering/README.md) | `VERIFIED` | L1-L3 未知链接状态语义、有效/别名链接、无 raw 标签与产品 API 清理通过；待最终 L4 |
| `BUG-FQA-047` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `VERIFIED` | L1-L3 color validation, API/UI revalidation and cleanup passed; awaiting L4 |
| `BUG-FQA-048` | P1 | [`REM-P1-027`：变更模板复制、字段配置与引用保护生命周期](./05-workflow-change/REM-P1-027-change-template-lifecycle/README.md) | `VERIFIED` | L1-L3 copy/字段类型-default-sort/精确清理通过；待最终 L4 |
| `BUG-FQA-049` | P1 | [`REM-P1-025`：Workflow 模板实例可审计清理生命周期](./05-workflow-change/REM-P1-025-workflow-template-instance-cleanup/README.md) | `VERIFIED` | L1-L3 template delete, reference protection, audit and UI confirmation passed; awaiting L4 |
| `BUG-FQA-050` | P1 | [`REM-P1-010`：CMDB 影响分析与历史拓扑重建](./03-cmdb-assets/REM-P1-010-cmdb-impact-history-reconstruction/README.md) | `VERIFIED` | L1-L3 CTE direction/depth/error contract, API and cleanup passed; awaiting L4 |
| `BUG-FQA-051` | P2 | [`REM-P2-002`：CMDB 变更查询与统计准确性](./03-cmdb-assets/REM-P2-002-cmdb-change-query-statistics/README.md) | `VERIFIED` | L1-L3 关键词 SQL/count、API 空结果与页面筛选复验通过；待最终 L4 |
| `BUG-FQA-052` | P2 | [`REM-P2-002`：CMDB 变更查询与统计准确性](./03-cmdb-assets/REM-P2-002-cmdb-change-query-statistics/README.md) | `VERIFIED` | L1-L3 显式范围卡片/趋势/Top10 同口径 API/UI 复验通过；待最终 L4 |
| `BUG-FQA-053` | P1 | [`REM-P1-021`：共享文件与 Wiki 附件存储回收](./04-content-files/REM-P1-021-stored-object-delete-compensation/README.md) | `VERIFIED` | L1-L3 存储失败补偿、附件独立删除和页面级联回收 API 通过；待最终 L4 |
| `BUG-FQA-054` | P2 | [`REM-P1-015`：分页基础设施与审计筛选合同](./07-platform-integration/REM-P1-015-query-pagination-audit-filters/README.md) | `VERIFIED` | L1-L3 组合与零结果筛选通过；待 L4 |
| `BUG-FQA-055` | P2 | [`REM-P1-007`：已删除角色关联读取与清理一致性](./01-security-authorization/REM-P1-007-deleted-role-association-lifecycle/README.md) | `VERIFIED` | L1-L3 deleted-role API/UI lifecycle and cleanup passed; awaiting L4 |
| `BUG-FQA-056` | P1 | [`REM-P1-003`：未分配组与业务组双向互斥](./02-account-organization/REM-P1-003-unassigned-business-group-exclusivity/README.md) | `CLOSED` | checkpoint 仍列开放，但整改事件已关闭 |
| `BUG-FQA-057` | P2 | [`REM-P2-003`：Wiki 页面标题规范与同级唯一性](./04-content-files/REM-P2-003-wiki-title-validation/README.md) | `VERIFIED` | L1-L3 trim、400 边界、409 同级/并发冲突、当前分支 API/UI 与零残留通过；待 L4 |
| `BUG-FQA-058` | P1 | [`REM-P1-017`：Wiki 资源授权、归属组与不存在语义](./04-content-files/REM-P1-017-wiki-resource-authorization-semantics/README.md) | `VERIFIED` | L1-L3 root owner 创建子页通过；待最终 L4 |
| `BUG-FQA-059` | P1 | [`REM-P1-028`：变更文档模板加载与创建响应合同](./05-workflow-change/REM-P1-028-change-document-create-contract/README.md) | `VERIFIED` | L1-L3 模板 `fields` 加载、单/双模板 API/UI 创建和详情回读通过；待 L4 |
| `BUG-FQA-060` | P2 | [`REM-P2-012`：日期范围、月份与数值输入统一校验](./08-cross-cutting-contracts/REM-P2-012-temporal-numeric-validation/README.md) | `VERIFIED` | L1-L3 report/ops/date-month-workhours API/UI 复验、零残留通过；待 L4 |
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
| `BUG-FQA-071` | P2 | [`REM-P2-009`：Wiki 搜索入口与历史导航](./04-content-files/REM-P2-009-wiki-search-discovery-history/README.md) | `VERIFIED` | L1-L3 入口、debounce/URL、授权分页、back/forward、焦点、空态与零 Console error 通过；待最终 L4 |
| `BUG-FQA-072` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 IP host boundary API and cleanup passed; awaiting L4 |
| `BUG-FQA-073` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 canonical CIDR overlap and concurrency passed; awaiting L4 |
| `BUG-FQA-074` | P1 | [`REM-P1-006`：权限消费、兼容别名与导航可达性收敛](./01-security-authorization/REM-P1-006-permission-consumer-navigation-parity/README.md) | `VERIFIED` | L1-L3 permission alias、API/UI allow-deny 与清理通过；待最终 L4 |
| `BUG-FQA-075` | P1 | [`REM-P1-014`：IPAM 地址池、分配与范围完整性](./03-cmdb-assets/REM-P1-014-ipam-address-pool-integrity/README.md) | `VERIFIED` | L1-L3 server idempotency and UI submit gate passed; awaiting L4 |
| `BUG-FQA-076` | P1 | [`REM-P1-018`：Wiki 版本快照与回退完整性](./04-content-files/REM-P1-018-wiki-version-revert-integrity/README.md) | `VERIFIED` | L1-L3 版本 `v1/v2/revert(v1)->v3`、详情/导出、空快照拒绝与 API/UI 清理通过；L4 回归补验已使 UI 版本导出精确读取所选快照，待从新集成点完整 L4 |
| `BUG-FQA-077` | P1 | [`REM-P1-022`：共享文件 write 权限运行时消费者](./04-content-files/REM-P1-022-shared-file-update-consumer/README.md) | `VERIFIED` | L1-L3 既有 `PUT /files/{id}`、write ACL、审计及真实 UI 重命名通过；待最终 L4 |
| `BUG-FQA-107` | P1 | [`REM-P1-037`：共享文件移动生命周期](./04-content-files/REM-P1-037-shared-file-move-consumer/README.md) | `VERIFIED` | L4 `FILE-012` 发现文件移动 consumer 缺失；L1-L3 源/目标 manage 检查、目标冲突 409、真实 UI 与产品 API 清理通过；待新的最终 L4 |
| `BUG-FQA-078` | P2 | [`REM-P2-010`：Wiki 系统手册与只读空间种子](./04-content-files/REM-P2-010-wiki-system-space-seed/README.md) | `VERIFIED` | L1-L3 幂等 seed、系统只读 API/UI、个人排序刷新持久与零 Console error 通过；待最终 L4 |
| `BUG-FQA-079` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `VERIFIED` | L1-L3 fieldKey boundary and duplicate/concurrent contract passed; awaiting L4 |
| `BUG-FQA-080` | P1 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 input-boundary validation and cleanup passed; awaiting L4 |
| `BUG-FQA-081` | P1 | [`REM-P1-024`：Workflow 定义版本与实例状态生命周期](./05-workflow-change/REM-P1-024-workflow-definition-instance-lifecycle/README.md) | `VERIFIED` | L1-L3 definition all-version deletion and runtime protection passed; awaiting L4 |
| `BUG-FQA-082` | P1 | [`REM-P1-029`：运维日历任务、节假日与周期规则输入合同](./06-ops-collaboration/REM-P1-029-ops-calendar-input-rule-contracts/README.md) | `VERIFIED` | 原规则输入/preview 合同 L1-L3 保持通过；事件因 L4 `OPS-011` 模板引用完整性回归修复后待全量 L4 |
| `BUG-FQA-083` | P1 | [`REM-P1-027`：变更模板复制、字段配置与引用保护生命周期](./05-workflow-change/REM-P1-027-change-template-lifecycle/README.md) | `VERIFIED` | L1-L3 copy/字段类型-default-sort/精确清理通过；待最终 L4 |
| `BUG-FQA-084` | P1 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 candidate group BPMN 往返通过；待最终 L4 |
| `BUG-FQA-085` | P1 | [`REM-P1-013`：账号与组织输入及显式清空合同](./02-account-organization/REM-P1-013-account-input-null-update-contracts/README.md) | `VERIFIED` | L1-L3 invalid email/overlength username 400 and zero persistence passed; 待 L4 |
| `BUG-FQA-086` | P1 | [`REM-P1-009`：CMDB 关系与实例删除引用完整性](./03-cmdb-assets/REM-P1-009-cmdb-relation-integrity/README.md) | `VERIFIED` | L1-L3 自环 API/UI 拒绝、清理与 impact 通过；待最终 L4 |
| `BUG-FQA-087` | P1 | [`REM-P1-011`：CMDB 导航、模型路由与查询合同](./03-cmdb-assets/REM-P1-011-cmdb-navigation-query-contracts/README.md) | `VERIFIED` | L1-L3 update-only UI/API allow、deny 403 和精确清理通过；待 L4 |
| `BUG-FQA-088` | P1 | [`REM-P1-009`：CMDB 关系与实例删除引用完整性](./03-cmdb-assets/REM-P1-009-cmdb-relation-integrity/README.md) | `VERIFIED` | L1-L3 重复/并发设备 API、清理与 impact 通过；待最终 L4 |
| `BUG-FQA-089` | P1 | [`REM-P1-017`：Wiki 资源授权、归属组与不存在语义](./04-content-files/REM-P1-017-wiki-resource-authorization-semantics/README.md) | `VERIFIED` | L1-L3 ownerGroup 与 others mode bits 主体分类回退通过；待最终 L4 |
| `BUG-FQA-090` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `VERIFIED` | L1-L3 defaultValue API/UI create-update-refresh passed; awaiting L4 |
| `BUG-FQA-091` | P1 | [`REM-P1-008`：CMDB 模型与动态属性合同收敛](./03-cmdb-assets/REM-P1-008-cmdb-model-attribute-contracts/README.md) | `VERIFIED` | L1-L3 mapper readback and model-detail contract passed; awaiting L4 |
| `BUG-FQA-092` | P1 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 credential editing, masking, audit and UI persistence passed; awaiting L4 |
| `BUG-FQA-093` | P1 | [`REM-P1-007`：已删除角色关联读取与清理一致性](./01-security-authorization/REM-P1-007-deleted-role-association-lifecycle/README.md) | `VERIFIED` | L1-L3 deleted-role API/UI lifecycle and cleanup passed; awaiting L4 |
| `BUG-FQA-094` | P1 | [`REM-P1-030`：日报导出权限运行时消费者](./06-ops-collaboration/REM-P1-030-daily-report-export-consumer/README.md) | `VERIFIED` | L1-L3 API scope/export-only/deny/audit/cleanup、真实导航与 XLSX 下载通过；等待最终 L4 |
| `BUG-FQA-095` | P1 | [`REM-P1-011`：CMDB 导航、模型路由与查询合同](./03-cmdb-assets/REM-P1-011-cmdb-navigation-query-contracts/README.md) | `VERIFIED` | L1-L3 rack 目录、2D 选择、动态详情路由、机柜视图和精确清理通过；待 L4 |
| `BUG-FQA-096` | P1 | [`REM-P1-016`：跨模块写操作审计与快照完整性](./07-platform-integration/REM-P1-016-cross-module-audit-snapshots/README.md) | `VERIFIED` | Audit API/UI exposes redacted before/after snapshots; IPAM/shared-file/ops-rule writers covered; 待 L4 |
| `BUG-FQA-097` | P2 | [`REM-P2-014`：周期规则删除与确认入口](./06-ops-collaboration/REM-P2-014-ops-rule-delete-ui/README.md) | `VERIFIED` | L1-L3 管理页面确认/取消/刷新、403、删除后 400、审计与精确清理通过；待最终 L4 |
| `BUG-FQA-098` | P1 | [`REM-P1-027`：变更模板复制、字段配置与引用保护生命周期](./05-workflow-change/REM-P1-027-change-template-lifecycle/README.md) | `VERIFIED` | L1-L3 引用保护拒绝、删除审计和精确清理通过；待最终 L4 |
| `BUG-FQA-099` | P1 | [`REM-P1-024`：Workflow 定义版本与实例状态生命周期](./05-workflow-change/REM-P1-024-workflow-definition-instance-lifecycle/README.md) | `VERIFIED` | L1-L3 suspended start and instance termination lifecycle passed; awaiting L4 |
| `BUG-FQA-100` | P1 | [`REM-P1-019`：共享文件上传状态、冲突与可取消生命周期](./04-content-files/REM-P1-019-shared-file-upload-lifecycle/README.md) | `VERIFIED` | L1-L3 删除时主对象与衍生 Markdown 回收已实现并验证；待最终 L4 |
| `BUG-FQA-101` | P1 | [`REM-P1-010`：CMDB 影响分析与历史拓扑重建](./03-cmdb-assets/REM-P1-010-cmdb-impact-history-reconstruction/README.md) | `VERIFIED` | L1-L3 create/update/delete/relation API/UI comparison and cleanup passed; awaiting L4 |
| `BUG-FQA-102` | P1 | [`REM-P1-028`：变更文档模板加载与创建响应合同](./05-workflow-change/REM-P1-028-change-document-create-contract/README.md) | `VERIFIED` | L1-L3 创建响应 numeric ID、详情路由和精确清理通过；待 L4 |
| `BUG-FQA-103` | P2 | [`REM-P1-012`：设备、凭据与范围合同](./03-cmdb-assets/REM-P1-012-device-credential-input-contracts/README.md) | `VERIFIED` | L1-L3 copy feedback and browser crypto compatibility passed; awaiting L4 |
| `BUG-FQA-104` | P1 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 条件流命名空间与表达式往返通过；待最终 L4 |
| `BUG-FQA-105` | P1 | [`REM-P1-023`：Workflow BPMN 输入校验与设计往返完整性](./05-workflow-change/REM-P1-023-workflow-bpmn-roundtrip-validation/README.md) | `VERIFIED` | L1-L3 名称、分类、描述、XML 和版本往返通过；待最终 L4 |
| `BUG-FQA-106` | P2 | [`REM-P2-007`：运维材料导出文件与摘要合同](./06-ops-collaboration/REM-P2-007-ops-material-export-contract/README.md) | `VERIFIED` | L1-L3 UTF-8 下载头、XLSX 摘要、空范围/400/403 与真实页面下载通过；待最终 L4 |

## 规则

- 主映射唯一；若一个缺陷需要多个事件，只有一个为主事件，其他只可作为显式依赖。
- `CLOSED/VERIFIED/VERIFYING` 不改写原始 FQA 失败，只在新证据中追加结论。
- 新发现缺陷先写入源 run 的缺陷台账，再分配 REM；禁止只改 checkpoint 数组。
- 每次事件状态变化必须同步本矩阵、事件卡和 `INDEX.md`。

## L4 新发现

| L4 发现 | 主整改事件 | 状态 | 结论 |
|---|---|---|---|
| `L4-ST-AUTHZ-020-001`：已 enforced 的重复 Enforce 返回 200 并重复增加 epoch | [`REM-P0-007`](./01-security-authorization/REM-P0-007-authorization-cutover-idempotency/README.md) | `VERIFIED` | 根因是 `AuthorizationCutoverService.enforce` 无条件 upsert。独立分支以事务内状态锁定拒绝重复切换；Java 21 L1 与当前分支 backend L3 证明 409 且状态对象不变，待合并后完整 L4。 |
| `L4-AUTHZ-002-001`：非 platform 已认证迁移读取 API 返回 `400` 而非授权拒绝 `403` | [`REM-P0-006`](./01-security-authorization/REM-P0-006-migration-platform-scope-forbidden/README.md) | `VERIFIED` | Controller scope guard 已切至标准 `AccessDeniedException`；四个读取端点、platform allow、cutover 不变及当前分支容器/Playwright API L1-L3 通过，待完整 L4。 |
| `L4-ST-WIKI-001-001`：Wiki 页面提交审批调用失效 `wiki_publish` key，返回 HTTP `500` | [`REM-P1-038`](./04-content-files/REM-P1-038-wiki-publish-workflow-binding/README.md) | `VERIFIED` | 提交切换至统一 runtime/binding；L1、完整 reject/resubmit/approve L2-L3 和 Wiki content/comments/export 回归通过。用户批准 `wiki_page -> remp1038wiki`（指定 superadmin 审批）为正式租户策略；待从合并基线完整 L4。 |
| `L4-BACKUP-003-001`：初始浏览器复验把 API `/backups` 误作页面路由 | [`REM-P1-039`](./07-platform-integration/REM-P1-039-backup-route-authorization-parity/README.md) | `VERIFIED` | 独立 L1-L3 使用真实 `/admin/backup` 路由，在未改产品代码的当前容器中确认零权限用户回退 `/`、相关 API 均 `403`、夹具零残留；原记录结算为测试路径误报。 |
| `L4-FLOW-007-001`：v2 元数据仍返回 v1 值 | [`REM-P1-040`](./05-workflow-change/REM-P1-040-workflow-definition-metadata-roundtrip/README.md) | `VERIFIED` | `BUG-FQA-104` 主映射仍为 REM-P1-023；本后继事件修复 L4 回归，L1-L3 真实 API/UI 与精确清理通过。 |
| `REM-P1-033` L1 基线：三处无关测试源码阻断 Maven testCompile | [`REM-P2-031`](./08-cross-cutting-contracts/REM-P2-031-backend-test-compile-baseline/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 唯一主映射；Java 21 容器中三处目标测试与变更文档定向测试均通过。 |
| `L4-CHANGE-008-001`：组级 member 可修改其他创建者的同租户变更文档 | [`REM-P1-033`](./05-workflow-change/REM-P1-033-change-doc-edit-scope/README.md) | `VERIFIED` | 已确认成员/组长/tenant-platform 范围；Java 21 L1 通过，当前分支真实 member 对五个跨创建者入口均为 404 且无写入，runId 夹具已清理。 |
| `L4-AUTHZ-PLATFORM-ACL-001`：有效 platform super_admin 被 Wiki/共享文件 ACL 拒绝 | [`REM-P0-005`](./01-security-authorization/REM-P0-005-platform-superadmin-resource-acl-bypass/README.md) | `VERIFIED` | 用户确认仅有效 platform super_admin 在具备功能权限前提下绕过 Wiki、shared_file/shared_folder ACL；L1 定向测试与编译、Shadow 后端 API/UI 和严格预检均通过，待最终 L4。 |
| `L4-PROMETHEUS-CONFIG-001`：前端保存请求缺后端 mapping，HTTP 500 | [`REM-P2-016`](./07-platform-integration/REM-P2-016-prometheus-config-api-contract/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；L1-L3 已通过，等待最终 L4 配置/外部集成范围复验。 |
| `L4-EXTERNAL-FIXTURES-001`：外部 SMTP、Prometheus、AI 缺隔离且可恢复的验证环境 | [`REM-P2-017`](./07-platform-integration/REM-P2-017-isolated-external-validation-fixtures/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；内部 mock、显式清钥、产品 API 恢复和 L1-L3 已通过，待最终 L4 重跑。 |
| `L4-WIKI-022-001`：不存在 Wiki space/page 永久加载并产生 404 Console error | [`REM-P2-018`](./04-content-files/REM-P2-018-wiki-missing-resource-loading/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；阅读页与目录侧栏均已避免无效资源请求，L1-L3 通过，待最终 L4 重跑。 |
| `L4-WIKI-022-002`：不存在 Wiki 空间首页仍请求 tree 并产生 404 Console error | [`REM-P2-019`](./04-content-files/REM-P2-019-wiki-space-home-missing-resource/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；空间首页仅对可访问 space 读取 tree，L1-L3 通过，待最终 L4 重跑。 |
| `L4-FLOW-004-001`：流程实例的 `daily_report:<id>` 业务键无详情跳转 | [`REM-P2-021`](./05-workflow-change/REM-P2-021-workflow-instance-business-navigation/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；当前分支 L1-L3 的严格链接、非日报回退和真实 UI 已通过，待受影响 L4 重跑。 |
| `L4-CMDB-031-001`：影响分析循环路径跨层重复节点 | [`REM-P2-022`](./03-cmdb-assets/REM-P2-022-cmdb-impact-cycle-deduplication/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；当前分支 L1-L3 保留最短层级、边集和真实 UI 已通过，待受影响 L4 重跑。 |
| `L4-REPORT-002-001`：日报 XLSX 导出缺少 UTF-8 Content-Disposition | [`REM-P2-023`](./07-platform-integration/REM-P2-023-daily-report-export-content-disposition/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；当前分支 L1-L3 下载头、字节和真实浏览器文件名通过，待受影响 L4 重跑。 |
| `L4-CMDB-039-001`：影响分析加载态返回实例使用 `_` 占位路由 | [`REM-P2-024`](./03-cmdb-assets/REM-P2-024-cmdb-impact-return-route/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；当前分支仅在 root model 就绪时呈现真实链接，L1-L3 UI 通过，待受影响 L4 重跑。 |
| `L4-CMDB-029-001`：拓扑循环关系的 depth 读取返回 HTTP 500 | [`REM-P2-025`](./03-cmdb-assets/REM-P2-025-cmdb-topology-cycle-safety/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；递归查询已加入路径访问保护，当前分支 L1-L3 API/UI 通过，待受影响 L4 重跑。 |
| `L4-CHANGE-001-001`：变更文档列表缺关键词搜索与服务端分页 | [`REM-P2-026`](./05-workflow-change/REM-P2-026-change-doc-list-query-contract/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；当前分支 L1-L3 的 API 查询、真实页面搜索/筛选/分页/详情和精确清理均通过，待受影响 L4 重跑。 |
| `L4-CHANGE-002-001`：新建变更文档忽略已选 CI | [`REM-P2-027`](./05-workflow-change/REM-P2-027-change-doc-create-ci-link-contract/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；当前分支 L1-L3 的创建事务、真实页面 CI 回读、非法 CI 回滚和精确清理均通过，待受影响 L4 重跑。 |
| `L4-CHANGE-005-001`：终态测试变更文档不能通过产品 API 精确清理 | [`REM-P2-028`](./05-workflow-change/REM-P2-028-change-doc-remediation-terminal-cleanup/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；受 `change_doc:delete`、tenant、runId 和 approved 终态限制的清理端点已通过 L1-L2，待受影响 L4 重跑。 |
| `L4-CHANGE-005-002`：动态 date/datetime 未校验 ISO 格式与实际日历日期 | [`REM-P2-029`](./05-workflow-change/REM-P2-029-change-doc-temporal-validation/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；L1 标量/表格定向测试、L2 API、L3 真实页面与产品 API 精确清理通过，待受影响 L4 重跑。 |
| `L4-CHANGE-006-001`：动态固定表格的导出路径无法证明行顺序和内容一致 | [`REM-P2-030`](./05-workflow-change/REM-P2-030-change-doc-dynamic-table-export-consistency/README.md) | `VERIFIED` | 不改变历史 `BUG-FQA-*` 的唯一主映射；模板填充和程序化 fallback 都已覆盖行/列/checkbox，L2 API DOCX 内容、L3 浏览器下载和精确清理通过；待受影响 L4 重跑。 |
| `L4-DASHBOARD-001`：变更文档分页响应回填后首页调用 `.filter` 崩溃 | [`REM-P2-032`](./07-platform-integration/REM-P2-032-dashboard-change-doc-list-contract/README.md) | `VERIFIED` | 原始 B1 page error 为 `_.filter is not a function`；事件分支 L1 typecheck/lint、L3 当前分支生产容器 Playwright 登录-首页-登出已通过，待提交合并后重新最终 L4。 |
| `L4-DAILY-001-admin-own-draft-submit`：审批权限管理员在全部日报视图不能提交本人草稿 | [`REM-P1-034`](./06-ops-collaboration/REM-P1-034-daily-own-draft-submit/README.md) | `VERIFIED` | 以 `reporterId === currentUserId` 区分本人；当前分支真实 UI 创建、提交至 `SUBMITTED` 和 runId 受限清理通过。审批待办可见性不在本事件范围。 |
| `L4-DAILY-002-platform-approval-task-visibility`：tenant/platform 审批人看不到本租户其他组日报候选任务 | [`REM-P1-035`](./05-workflow-change/REM-P1-035-daily-platform-approval-task-visibility/README.md) | `VERIFIED` | tenant/platform 会话解析本租户所有活动 group token，组级与角色 token 合同不变；Java 21 L1、当前分支完整 UI 审批和 runId 受限清理通过。 |
| `L4-AUTH-003-LOGIN-ERROR-RESET`：登录错误凭据 401 重载页面，错误反馈不可见 | [`REM-P1-036`](./02-account-organization/REM-P1-036-login-error-feedback/README.md) | `VERIFIED` | 登录端点 401 仅保留给页面错误处理；其他 API 401 保持登出。当前分支 L1-L3、真实 Nginx Playwright、成功登录与失效 token 回归通过，待全新完整 L4。 |
| `L4-COMMON-009-001`：文件夹对话框关闭后保留未提交草稿 | [`REM-P1-041`](./04-content-files/REM-P1-041-file-dialog-draft-reset/README.md) | `VERIFIED` | 原始 L4 FAIL 保留；事件分支四种关闭路径、零创建请求、成功创建/删除、当前容器真实 UI 和 runId 零残留均通过，待合并后重验 `COMMON-009`。 |
| `L4-DAILY-009-001`：并发提交重复启动日报流程 | [`REM-P1-042`](./06-ops-collaboration/REM-P1-042-daily-submit-idempotency/README.md) | `VERIFIED` | 原始 L4 两次 200 保留；事件分支事务行锁、单测、当前容器真实并发、唯一待办和精确清理通过，待合并后重验。 |
| `L4-CONFIG-002-001`：SMTP 配置接受非法 host | [`REM-P1-043`](./07-platform-integration/REM-P1-043-smtp-config-input-validation/README.md) | `VERIFIED` | 原始 L4 200/persist 失败保留；DTO/Controller、7 个 API 边界、真实 UI、Mailpit 正向发送与原配置恢复 L1-L3 通过，待合并后重验。 |
