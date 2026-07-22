# 可审计用户组生命周期实施 SPEC

## 0. 文档合同

| 属性 | 值 |
|---|---|
| 事件 ID | `REM-P1-001` |
| 版本 | v1.0 |
| 状态 | `READY_FOR_IMPLEMENTATION` |
| 基线 | branch `lint-fix`, commit `5d3c5b6f` + 当前未提交整改变更 |
| 数据库基线 | Flyway V71 |
| 预计迁移 | V72 |
| 关联 PRD | [PRD.md](./PRD.md) |
| 关联前序事件 | `REM-P0-001` |

本 SPEC 是实施合同，不授权立即修改 groups `11..15`。历史组归档必须在代码和 L1-L3 全部通过后，保存 preflight 并再次获得用户明确批准。

## 1. 目标与不变量

### 1.1 实施目标

建立一个统一的用户组 lifecycle boundary，使 group archive、restore、purge 以及所有 group reference writer 在事务和数据库层遵守同一活动组合同，并通过产品 UI/API、审计和自动化测试形成可追溯闭环。

### 1.2 运行时不变量

1. `ActiveGroupReference`：任何会影响当前身份、授权、ACL、资源归属、数据范围或未结束业务的 group reference，只能指向同 tenant、`is_deleted=false`、`group_type='business'` 的 group。
2. `ArchiveAtomicity`：archive 的锁、锁后引用复查、group 软删除和审计必须在同一事务中全成或全回滚。
3. `NoArchiveRace`：archive 提交后不得出现任何新活动引用；引用写入先提交时，archive 必须在锁后看见它并拒绝。
4. `NoCascadeBusinessMutation`：archive 不自动删除、撤销、迁移或重写任何 membership、assignment、ACL、owner、日报、设备、运维对象或 Workflow。
5. `HistoryReadable`：允许保留的历史数据仍能显示 group 名称和“已归档”状态。
6. `RestoreIsNarrow`：restore 只恢复 group 行，不恢复任何历史关系。
7. `PurgeIsIrreversibleAndRare`：purge 只处理已归档、达到保留期、除审计外零历史引用的组。
8. `ProtectedGroups`：built-in group 和 `group_type='unassigned'` 永远不可 archive/purge。
9. `TenantIsolation`：API、引用计数、锁和更新都必须同时约束 tenantId 和 groupId。
10. `AuthorizationInvariant`：不得修改 superadmin、authorization mode、cutover epoch、rollout 或非测试授权。
11. `AuditAtomicity`：成功 audit 插入未影响一行时，业务事务必须回滚；失败操作不得写伪成功审计。
12. `NoSecretEvidence`：reason、日志和证据不得包含密码、token、cookie 或 secret。

## 2. 当前行为与目标行为

| 场景 | 当前行为 | 目标行为 |
|---|---|---|
| UI 删除 | 调用不存在的 `DELETE /groups/{id}`，仅显示“删除失败” | 显示 preflight，确认后调用 archive |
| 空业务组 | 无产品清理入口 | 可审计软归档 |
| 有引用组 | 无统一裁决 | 409 + blockers + 解除建议，零数据变化 |
| 归档组写入 | 没有统一状态 | 应用校验 + DB trigger 双重拒绝 |
| 误归档 | 无恢复 | restore group 本身，不恢复关系 |
| 物理清除 | 无合同 | platform + `group:purge` + 保留期 + 零历史引用 |
| 历史展示 | mapper 逻辑删除可能导致组名缺失 | 只读历史 lookup 可包含 archived group |
| 并发 | preflight 与写入可交错 | group row lock/DB trigger 串行化 |

## 3. 生命周期状态机

| 当前状态 | 操作 | 前置条件 | 目标状态 | 幂等 |
|---|---|---|---|---|
| Active | archive | 非内置 business、同 tenant、active blockers=0 | Archived | 重复调用返回 `changed=false` |
| Active | restore | 不适用 | 无变化，409 `GROUP_NOT_ARCHIVED` | 否 |
| Active | purge | 不适用 | 无变化，409 `GROUP_NOT_ARCHIVED` | 否 |
| Archived | archive | 同 tenant | Archived | 是，不新增成功审计 |
| Archived | restore | code 无活动冲突 | Active | 否；成功后重复 restore 返回 409 `GROUP_NOT_ARCHIVED` |
| Archived | purge | platform、权限、保留期、所有历史引用=0 | Purged | 否 |
| Purged | 任意 | group 不存在 | 404 `GROUP_NOT_FOUND` | 否 |

## 4. 数据模型与 V72

### 4.1 复用字段

`Group extends BaseEntity` 已包含：

- `is_deleted`
- `deleted_at`
- `deleted_by`
- `updated_at`
- `updated_by`

不得新增 `status` 或 `archived` 重复列。API state 从 `is_deleted` 映射为 `active|archived`。

### 4.2 V72 内容

新增：

`backend/src/main/resources/db/migration/V72__auditable_group_lifecycle.sql`

迁移必须：

1. 为归档列表增加部分索引：

   ```sql
   CREATE INDEX idx_sys_group_tenant_archived
       ON sys_group(tenant_id, deleted_at DESC, id)
       WHERE is_deleted;
   ```

2. 扩展 group resource action，新增 `purge`，插入 `group:purge` permission。
3. 只把 `group:purge` 赋给数据库中受保护的 built-in platform management role；运行时仍必须验证有效 permission + platform scope，不按角色名直接放行。
4. 创建 `require_active_business_group(p_tenant_id varchar, p_group_id bigint)` 数据库函数：
   - `SELECT ... FROM sys_group WHERE tenant_id=? AND id=? AND NOT is_deleted AND group_type='business' FOR UPDATE`；
   - 未找到时抛固定 SQLSTATE/消息，可稳定转换为 `GROUP_REFERENCE_INACTIVE`；
   - `p_group_id IS NULL` 时由调用方决定是否跳过。
5. 为直接、逻辑和 JSON group reference writer 创建 BEFORE INSERT/UPDATE trigger，写入前锁定并验证目标 group。
6. trigger 和函数命名稳定、可重复检查，但迁移只前进，不在应用启动时动态创建。

### 4.3 必须受保护的引用写入

| 表/来源 | group 字段或规则 | 触发条件 |
|---|---|---|
| `sys_user` | `group_id` | 非 NULL 且新值变化 |
| `sys_user_group_membership` | `group_id` | active row insert/restore/change |
| `sys_role_assignment` | `scope_id` | `scope_type='group'` 且 active |
| `daily_report` | `group_id` | active row insert/change |
| `device` | `group_id` | active row insert/change |
| `device_credential` | `group_id` | active row insert/change |
| `ops_schedule_task` | `group_id` | active row insert/change |
| `ops_duty_roster` | `group_id` | active row insert/change |
| `wiki_space` | `owner_group_id` | active row insert/change |
| `wiki_page` | `owner_group_id` | active row insert/change |
| `shared_folder` | `owner_group_id` | active row insert/change |
| `shared_file` | `owner_group_id` | active row insert/change |
| `resource_acl_entry` | `subject_id` | active + `subject_type='group'` |
| `wiki_page_acl` | `subject_id` | active + `subject_type='group'` |
| `wiki_space_acl` | `subject_id` | active + `subject_type='group'` |
| `shared_folder_acl` | `subject_id` | active + `subject_type='group'` |
| `shared_file` | `visible_groups` JSONB | active row，每个 groupId |
| `ops_schedule_rule` | `assignee_rule/recipient_rule/escalation_rule` JSON | enabled active rule 中每个 `groupId` |

JSON groupId 必须兼容 JSON number 和数字字符串；非数字值按现有字段校验合同返回 400，不允许 trigger 静默忽略。

### 4.4 Flowable 引用

Flowable 相关引用包括 `act_ru_identitylink.group_id_`、`act_hi_identitylink.group_id_`、`act_id_membership.group_id_` 和 `act_id_priv_mapping.group_id_`。其中 identity link 使用 `<id>` 或 `group_<id>` token；Flowable 表由 Flowable 管理，V72 不直接给这些表安装跨生命周期 trigger。保护合同为：

1. 业务在生成 group token 前调用统一 ActiveGroup validator 并持有 group lifecycle transaction lock。
2. archive preflight 统计 `act_ru_identitylink` 中 `<id>` 和 `group_<id>` 两种 token。
3. 运行中的 Flowable group link 阻止 archive。
4. `act_hi_identitylink` 只作为 purge blocker 和历史证据，不阻止 archive。
5. `act_id_membership` 和 `act_id_priv_mapping` 是活动身份/权限配置，存在匹配 group token 时阻止 archive，并始终阻止 purge。
6. Phase A 必须审计 Flowable identity/privilege writer；当前应用没有 writer 时以源码 registry 断言固化，未来出现 writer 但未登记 validator 时判 inventory drift。

### 4.5 数据库并发序列

触发器使用 group row `FOR UPDATE` 锁。archive service 同样先锁 group row，再读取引用。

#### Writer 先执行

1. Writer trigger 锁住 Active group。
2. Writer 插入引用并提交。
3. Archive 等待后获得锁。
4. Archive 锁后 preflight 看见引用，返回 409。

#### Archive 先执行

1. Archive 锁住 group，确认 blockers=0。
2. Archive 设置 `is_deleted=true` 并提交。
3. Writer 获得执行机会后无法通过 Active group 查询，事务失败。

不得采用“先 preflight、释放锁、再 update”的分段实现。

## 5. Reference Inventory

### 5.1 服务

新增 `GroupReferenceInventoryService`，作为 preflight、archive 和 purge 的唯一引用分母来源。禁止 Controller 拼 SQL 或 archive/purge 分别维护不同清单。

建议返回：

```java
record GroupReferenceSnapshot(
    Map<String, Long> activeCounts,
    Map<String, Long> historicalCounts,
    List<GroupLifecycleBlocker> blockers,
    String snapshotHash
) {}
```

### 5.2 Archive active counts

稳定 key：

| Key | 查询合同 | Blocker |
|---|---|---|
| `leaders` | `sys_group.leader_id IS NOT NULL` | 是 |
| `primaryUsers` | active `sys_user.group_id` | 是 |
| `memberships` | active membership | 是 |
| `roleAssignments` | active group assignment | 是 |
| `openDailyReports` | active `DRAFT/SUBMITTED/REJECTED`；REJECTED 可编辑和重提 | 是 |
| `devices` | active device | 是 |
| `deviceCredentials` | active credential | 是 |
| `openOpsTasks` | active `pending_confirm/not_started/in_progress/overdue` | 是 |
| `currentFutureRosters` | active roster 且 `duty_date >= CURRENT_DATE` | 是 |
| `enabledOpsRules` | active enabled JSON rule 引用 | 是 |
| `runningWorkflowLinks` | `act_ru_identitylink` group token | 是 |
| `flowableIdentityMemberships` | `act_id_membership` group token | 是 |
| `flowablePrivilegeMappings` | `act_id_priv_mapping` group token | 是 |
| `wikiSpaceOwners` | active owner group | 是 |
| `wikiPageOwners` | active owner group | 是 |
| `sharedFolderOwners` | active owner group | 是 |
| `sharedFileOwners` | active owner group | 是 |
| `resourceAcls` | active unified group ACL | 是 |
| `wikiPageAcls` | active legacy group ACL | 是 |
| `wikiSpaceAcls` | active legacy group ACL | 是 |
| `sharedFolderAcls` | active legacy group ACL | 是 |
| `sharedFileVisibleGroups` | active `visible_groups` 包含 group | 是 |

如果代码审计发现其他当前业务 group reference，必须先更新本表、PRD 和测试分母，不能只在 SQL 中临时添加。

### 5.3 Versioned reference registry

新增唯一、版本化的 `GroupReferenceRegistry`。每个 descriptor 至少包含：`referenceType`、table/source、column/JSON path/token、tenant rule、active predicate、archive/purge disposition、application writer symbols、trigger/validator coverage 和 stable reasonCode。`GroupReferenceInventoryService`、preflight、purge、trigger 参数化测试和 evidence 分母都从该 registry 读取或对其做一一映射，禁止维护互不关联的手写清单。

漂移检测分两层：

1. 运行时：校验 `pg_constraint`、registry 中表/列/JSON 来源、预期 trigger/function 和 Flowable 表字段存在且匹配；任一差异返回 `GROUP_REFERENCE_INVENTORY_DRIFT`，purge 必须停止。
2. 构建时：扫描/登记所有会写 groupId、owner group、group ACL、JSON groupId 和 Flowable group token 的应用 symbol，与 registry 的 `applicationWriterSymbols` 比较；出现未登记 writer 或已删除 symbol 时测试 FAIL，不能只靠 FK catalog。

新增逻辑/JSON/源码 writer 无法仅靠数据库自动推断，因此必须在同一变更中更新 registry、inventory、validator/trigger、参数化测试和本 SPEC 分母，否则不得合并或 purge。

### 5.4 Historical counts

至少包含：

- 所有软删除 membership/assignment/ACL/资源行；
- APPROVED 日报；REJECTED 因仍可编辑和重新提交，属于 active blocker；
- completed/exception_closed/cancelled 和过往 roster；
- Flowable history group link；
- 所有直接 FK/逻辑引用总数与 active 数差值。

### 5.5 Purge counts

Purge 使用全量引用，不区分 active/history。除 `audit_log` 外任何计数非 0 均阻止物理删除，包括：

- 6 个实时 PostgreSQL FK：`daily_report`、`device`、`sys_user`、`ops_schedule_task`、`ops_duty_roster`、`sys_user_group_membership`；
- 无 FK 的 `device_credential.group_id`、`sys_role_assignment.scope_id`；
- 4 个 owner group；
- unified 和 legacy ACL；
- `shared_file.visible_groups`；
- 运维规则 JSON；
- Flowable runtime/history identity link、identity membership 和 privilege mapping group token；
- 未来 schema 漂移新增的 group reference。

Purge 前必须执行第 5.3 节完整 registry drift 审计，不能只检查 `pg_constraint`。任何 FK、表/列、trigger、Flowable 来源或已登记 writer 覆盖漂移都返回 `GROUP_REFERENCE_INVENTORY_DRIFT`，不得继续。

### 5.6 Blocker DTO

```json
{
  "reasonCode": "GROUP_ACTIVE_MEMBERSHIPS",
  "referenceType": "memberships",
  "count": 2,
  "message": "该组仍有 2 条活动成员关系",
  "resolution": "请在用户组成员管理中逐条移除或迁移成员"
}
```

每类 count 独立返回，禁止只返回总数。

稳定 blocker 合同如下；`message` 中 `{count}` 替换为实际数量，`resolution` 不得为空：

| referenceType | reasonCode | message | resolution |
|---|---|---|---|
| `leaders` | `GROUP_ACTIVE_LEADER` | 该组仍配置组长 | 先在组管理中移除或迁移组长 |
| `primaryUsers` | `GROUP_ACTIVE_PRIMARY_USERS` | 该组仍是 {count} 个用户的主组 | 先通过组管理或迁移工作台调整主组 |
| `memberships` | `GROUP_ACTIVE_MEMBERSHIPS` | 该组仍有 {count} 条活动成员关系 | 先在组成员管理中移除或迁移成员 |
| `roleAssignments` | `GROUP_ACTIVE_ROLE_ASSIGNMENTS` | 该组仍有 {count} 条活动作用域授权 | 先通过授权产品入口撤销 assignment |
| `openDailyReports` | `GROUP_OPEN_DAILY_REPORTS` | 该组仍有 {count} 份可处理日报 | 先完成或迁移 DRAFT、SUBMITTED、REJECTED 日报 |
| `devices` | `GROUP_ACTIVE_DEVICES` | 该组仍关联 {count} 个活动设备 | 先通过设备管理解除或迁移组引用 |
| `deviceCredentials` | `GROUP_ACTIVE_DEVICE_CREDENTIALS` | 该组仍关联 {count} 条活动凭据 | 先通过凭据管理解除或迁移组引用 |
| `openOpsTasks` | `GROUP_OPEN_OPS_TASKS` | 该组仍有 {count} 个未结束运维任务 | 先完成、取消或迁移任务 |
| `currentFutureRosters` | `GROUP_CURRENT_FUTURE_ROSTERS` | 该组仍有 {count} 条当前或未来排班 | 先删除或迁移相关排班 |
| `enabledOpsRules` | `GROUP_ENABLED_OPS_RULES` | 该组仍被 {count} 条启用规则引用 | 先停用或修改运维规则 |
| `runningWorkflowLinks` | `GROUP_RUNNING_WORKFLOW_LINKS` | 该组仍有 {count} 条运行中流程候选关系 | 先完成流程或迁移候选组 |
| `flowableIdentityMemberships` | `GROUP_FLOWABLE_IDENTITY_MEMBERSHIPS` | 该组仍有 {count} 条 Flowable 身份成员关系 | 先通过受控身份入口解除关系 |
| `flowablePrivilegeMappings` | `GROUP_FLOWABLE_PRIVILEGE_MAPPINGS` | 该组仍有 {count} 条 Flowable 权限映射 | 先通过受控权限入口解除映射 |
| `wikiSpaceOwners` | `GROUP_ACTIVE_WIKI_SPACE_OWNERS` | 该组仍拥有 {count} 个 Wiki 空间 | 先迁移 Wiki 空间 owner group |
| `wikiPageOwners` | `GROUP_ACTIVE_WIKI_PAGE_OWNERS` | 该组仍拥有 {count} 个 Wiki 页面 | 先迁移 Wiki 页面 owner group |
| `sharedFolderOwners` | `GROUP_ACTIVE_SHARED_FOLDER_OWNERS` | 该组仍拥有 {count} 个共享目录 | 先迁移共享目录 owner group |
| `sharedFileOwners` | `GROUP_ACTIVE_SHARED_FILE_OWNERS` | 该组仍拥有 {count} 个共享文件 | 先迁移共享文件 owner group |
| `resourceAcls` | `GROUP_ACTIVE_RESOURCE_ACLS` | 该组仍被 {count} 条资源 ACL 引用 | 先通过资源授权入口移除 ACL |
| `wikiPageAcls` | `GROUP_ACTIVE_WIKI_PAGE_ACLS` | 该组仍被 {count} 条 Wiki 页面 ACL 引用 | 先通过 Wiki 授权入口移除 ACL |
| `wikiSpaceAcls` | `GROUP_ACTIVE_WIKI_SPACE_ACLS` | 该组仍被 {count} 条 Wiki 空间 ACL 引用 | 先通过 Wiki 授权入口移除 ACL |
| `sharedFolderAcls` | `GROUP_ACTIVE_SHARED_FOLDER_ACLS` | 该组仍被 {count} 条共享目录 ACL 引用 | 先通过共享文件授权入口移除 ACL |
| `sharedFileVisibleGroups` | `GROUP_ACTIVE_SHARED_FILE_VISIBLE_GROUPS` | 该组仍被 {count} 个共享文件可见组配置引用 | 先通过共享文件入口移除可见组引用 |

## 6. API 合同

### 6.1 List

`GET /api/groups?state=active|archived`

- 默认 `state=active`。
- `active` 保持 `group:read` 的既有数据范围。
- `archived` 要求 `group:read` 且有效 scope 为 tenant/platform。
- 返回组基本信息和：
  - `state`
  - `archivedAt`
  - `archivedBy`
  - `archivedByName`
  - `updatedAt`
- archived 查询使用显式 SQL 绕过 TableLogic；其他默认 mapper 查询仍过滤逻辑删除。

### 6.2 Preflight

`GET /api/groups/{id}/lifecycle-preflight?action=archive|restore|purge`

成功：HTTP 200。

```json
{
  "code": 200,
  "data": {
    "action": "archive",
    "eligible": true,
    "group": {
      "id": 15,
      "tenantId": "default",
      "code": "group_xxx",
      "name": "REM_P0_001_...",
      "state": "active",
      "groupType": "business",
      "builtin": false,
      "updatedAt": "2026-07-14T00:05:00"
    },
    "activeCounts": {},
    "historicalCounts": {},
    "blockers": [],
    "purgeEligibleAt": null,
    "snapshotHash": "sha256:..."
  }
}
```

Preflight 不锁住资源跨请求，不保证后续执行；`snapshotHash` 仅用于 UI 提示和证据，不替代执行时重检。

### 6.3 Archive

`POST /api/groups/{id}/archive`

Body：

```json
{
  "reason": "REM-P1-001 清理已确认属于整改运行的空测试组",
  "confirmationName": "REM_P0_001_20260714_0005_lintfix_g",
  "expectedUpdatedAt": "2026-07-14T00:05:00"
}
```

规则：

- `reason` trim 后 10–500 字；
- `confirmationName` 必须 Unicode 精确匹配当前名称，不忽略大小写或空格；
- `expectedUpdatedAt` 必填；不一致返回 409；
- 成功 HTTP 200，`data={groupId,state:"archived",changed:true,auditId}`；
- 已归档且同 tenant 返回 HTTP 200、`changed=false`，不新增成功审计；
- blockers 返回 HTTP 409，`errorCode=GROUP_ARCHIVE_BLOCKED_REFERENCES`，并在 data 中返回最新 preflight；若当前 `R<Void>` 不支持错误 data，新增专用响应异常/结果类型，不得丢失 blockers。

### 6.4 Restore

`POST /api/groups/{id}/restore`

Body 与 archive 相同，reason 说明恢复原因。

- 要求 `group:update` + tenant/platform scope；
- 当前已是 Active 时返回 409 `GROUP_NOT_ARCHIVED`；Restore 不提供跨状态幂等成功。
- 检查活动 `(tenant_id,code)` 冲突；
- 成功清空 `is_deleted/deleted_at/deleted_by`，更新 `updated_at/updated_by`；
- 返回 `restoredRelations=false`；
- 不恢复 leader/membership/assignment/ACL/owner。

### 6.5 Purge

`POST /api/groups/{id}/purge`

Body 与 archive 相同，额外可带 `expectedArchivedAt`。

- 要求 `group:purge` + platform scope；
- group 必须 archived；
- `deleted_at + retentionDays <= now`；默认 `retentionDays=30`；
- inventory drift=0，所有非 audit 历史引用=0；
- 物理删除必须用显式 SQL `DELETE ... WHERE tenant_id=? AND id=? AND is_deleted=true`，严格检查影响一行；
- FK/约束异常必须转换为 409 `GROUP_PURGE_BLOCKED_REFERENCES`，不得成为 HTTP 500；
- audit_log 不随 group 删除，targetId 和 before snapshot 保留。

### 6.6 错误合同

| HTTP | errorCode | 场景 |
|---:|---|---|
| 400 | `GROUP_LIFECYCLE_REASON_INVALID` | reason 空或不在 10–500 |
| 400 | `GROUP_CONFIRMATION_MISMATCH` | 名称确认不匹配 |
| 400 | `GROUP_LIFECYCLE_ACTION_INVALID` | action 非法 |
| 403 | 通用 AccessDenied | 缺 permission |
| 403 | `GROUP_LIFECYCLE_SCOPE_DENIED` | permission 有效但 scope 不足 |
| 404 | `GROUP_NOT_FOUND` | 不存在或跨 tenant，不泄露存在性 |
| 409 | `GROUP_BUILTIN_PROTECTED` | built-in |
| 409 | `GROUP_UNASSIGNED_PROTECTED` | unassigned |
| 409 | `GROUP_VERSION_CONFLICT` | updatedAt 漂移 |
| 409 | `GROUP_ARCHIVE_BLOCKED_REFERENCES` | active blocker 非 0 |
| 409 | `GROUP_NOT_ARCHIVED` | restore/purge 状态不符 |
| 409 | `GROUP_RESTORE_CODE_CONFLICT` | active code 冲突 |
| 409 | `GROUP_PURGE_RETENTION_NOT_MET` | 未达保留期 |
| 409 | `GROUP_PURGE_BLOCKED_REFERENCES` | 任一历史引用非 0或 FK 拒绝 |
| 409 | `GROUP_REFERENCE_INVENTORY_DRIFT` | schema 新引用未登记 |
| 409/400 | `GROUP_REFERENCE_INACTIVE` | writer 指向 archived/missing/cross-tenant/non-business group |

401 不得代替 403 权限验证。

## 7. 服务与 Mapper 设计

### 7.1 新增组件

- `GroupLifecycleService`
- `GroupReferenceInventoryService`
- `GroupLifecycleMapper` 或扩展后的 `GroupMapper`
- `GroupLifecyclePreflightVO`
- `GroupLifecycleBlocker`
- `GroupLifecycleActionRequest`
- `GroupLifecycleResult`
- `GroupLifecycleErrorCode`
- `ActiveGroupReferenceValidator`
- 前端 `GroupLifecycleDialog`

Controller 只负责鉴权注解、DTO 校验和传递 `SecurityUser`；不直接执行 mapper update 或拼装审计。

### 7.2 Mapper 原子方法

至少提供：

```java
Group lockByTenantAndIdIncludingDeleted(String tenantId, Long groupId);
Group findByTenantAndIdIncludingDeleted(String tenantId, Long groupId);
List<Group> listArchived(String tenantId);
int archiveActive(... expectedUpdatedAt ...);
int restoreArchived(... expectedUpdatedAt ...);
int hardDeleteArchived(... expectedUpdatedAt ...);
List<Group> findIncludingDeletedByIds(String tenantId, Collection<Long> ids);
```

所有写方法包含 tenant、id、当前 is_deleted 状态和 expectedUpdatedAt 条件，影响行数必须为 1。

### 7.3 Archive 事务顺序

1. 验证 reason 基础格式。
2. `SELECT ... FOR UPDATE` 读取同 tenant group，包含 archived。
3. 处理不存在、protected、幂等和确认名称。
4. 检查 expectedUpdatedAt。
5. 调用唯一 `GroupReferenceInventoryService.snapshotForArchive`。
6. blockers 非空：抛 409，事务无写入。
7. 条件 archive update，断言 1。
8. 写 `group_archive` audit，断言 1。
9. 返回结果并提交。

### 7.4 Restore 事务顺序

1. 锁 archived group。
2. 权限/scope/tenant/确认/版本检查。
3. 检查 protected 和活动 code 冲突。
4. 条件 restore update，断言 1。
5. 写 `group_restore` audit，明确 `restoredRelations=false`。
6. 提交。

### 7.5 Purge 事务顺序

1. 锁 archived group。
2. platform + permission + tenant + 确认 + 版本检查。
3. 检查保留期。
4. catalog drift 审计。
5. 调用全量 purge snapshot。
6. blockers 非空返回 409。
7. 构造 immutable before snapshot。
8. 条件 hard delete，断言 1；捕获 FK/约束冲突并转换 409。
9. 写 `group_purge` audit，断言 1。
10. 提交。

## 8. 权限合同

### 8.1 功能权限

- archive/preflight archive：`group:delete`
- restore/preflight restore：`group:update`
- purge/preflight purge：`group:purge`
- archived list：`group:read`

### 8.2 Scope

- archive/restore：有效最高 scope 必须为 tenant/platform；group scope 即使有 permission 也返回 403。
- purge：必须为 platform。
- assignment 必须未过期且符合当前 authorization mode。
- 不得用 `admin`/`super_admin` role name 作为运行时判断。

### 8.3 Break-glass

本事件不新增 break-glass bypass。即使现有 break-glass 允许通过功能/作用域门禁，也不得绕过：

- built-in/unassigned protection；
- tenant isolation；
- reference blockers；
- retention；
- inventory drift；
- confirmation/version checks。

## 9. 审计合同

### 9.1 通用字段

| 字段 | 值 |
|---|---|
| `module` | `group` |
| `action` | `group_archive` / `group_restore` / `group_purge` |
| `target_type` | `group` |
| `target_id` | groupId |
| `operator_id` | 当前有效 session userId |
| `remark` | 有界摘要 + reason，不超过 512 |

### 9.2 before_json

```json
{
  "group": {
    "id": 15,
    "tenantId": "default",
    "code": "group_xxx",
    "name": "...",
    "groupType": "business",
    "builtin": false,
    "leaderId": null,
    "isDeleted": false,
    "updatedAt": "..."
  },
  "referenceSnapshot": {
    "activeCounts": {},
    "historicalCounts": {},
    "snapshotHash": "sha256:..."
  },
  "reason": "..."
}
```

### 9.3 after_json

- Archive：state archived、deletedAt/deletedBy、`relationsChanged=false`。
- Restore：state active、`restoredRelations=false`。
- Purge：state purged、`groupRowExists=false`。

审计 JSON 不存原始请求 header、token、cookie、密码、资源内容或用户敏感字段。

## 10. 历史读取与选择器

### 10.1 Active-only

以下入口必须继续或改为只返回 Active business group：

- 用户组活动列表；
- user primary group 和 membership 选择器；
- role assignment group scope 选择器；
- Wiki/共享文件 owner/ACL 选择器；
- 设备、凭据、日报、运维任务和排班 group 选择器；
- migration/cutover 业务组选择器。

### 10.2 Include archived for history

仅历史展示调用 `findIncludingDeletedByIds`：

- APPROVED 日报详情和导出；REJECTED 仍可编辑/重提，所以会阻止 archive；
- completed/exception_closed/cancelled 运维任务；
- 过往 roster；
- group lifecycle/audit 页面。

返回：原名称 + `archived=true`。不得把 archived group 放回当前用户的 permission、highest scope 或 ACL membership 集合。

## 11. 前端合同

### 11.1 页面变更

文件：`frontend/src/app/(dashboard)/groups/page.tsx`

- “删除”改为“归档”，图标可保留但 aria-label/data-testid 必须为 archive。
- 增加 `active|archived` 页签。
- 错误消息使用 `getApiErrorMessage`，不得吞掉服务端 blockers。
- 归档后 invalidate `['groups']` 及所有 group option query keys；不得全局刷新 session。

### 11.2 Dialog

新增或提取 `GroupLifecycleDialog`：

- 打开即请求 preflight；
- loading/error/eligible/blocked 四态；
- blockers 表格；
- reason 计数和 10–500 校验；
- confirmationName 精确匹配；
- 409 后刷新 preflight并保留输入；
- restore 明示“不恢复历史成员和权限”；
- purge 二次不可逆确认，仅有权限时渲染。

稳定测试标识至少包括：

- `group-archive-{id}`
- `group-lifecycle-preflight`
- `group-lifecycle-blocker-{referenceType}`
- `group-lifecycle-reason`
- `group-lifecycle-confirmation`
- `group-lifecycle-submit`
- `group-restore-{id}`
- `group-purge-{id}`

## 12. 实施步骤

### Phase A：冻结与影响分析

1. 记录 branch/commit/git status，保留现有未提交变更。
2. 重建/确认 GitNexus 索引。
3. 对每个拟修改生产 symbol 运行 upstream impact；`GroupMapper` 当前为 HIGH（15 direct / 23 upstream）。
4. 重新提取 schema group reference inventory，与第 5 节比较。
5. 保存 groups `11..15` 和非测试 group/authorization 前快照，不修改数据。

### Phase B：V72 数据保护

1. 新增 permission/index/function/triggers。
2. Testcontainers 验证所有 trigger matrix。
3. 验证 migration 可从 V71 升级且不改现有 group 数据。

### Phase C：后端 lifecycle

1. 引用 inventory。
2. mapper atomic methods。
3. service transaction/action/error/audit。
4. Controller/DTO/list state。
5. group writer 应用层 active validation 和历史 lookup。

### Phase D：前端

1. 归档替换删除。
2. preflight dialog/blockers。
3. archived tab/restore/purge。
4. 稳定 testId 和错误展示。

### Phase E：测试与发布验证

1. L1 定向测试。
2. L2 group reference 根因矩阵。
3. L3 受影响模块回归。
4. GitNexus detect_changes。
5. 构建并仅替换 backend/frontend，非依赖容器不重启。
6. 使用全新 runId 做真实 UI/API/DB 测试并清理新夹具。

### Phase F：历史组受控归档

仅 L1-L3 全 PASS 后：

1. 产品 preflight groups `11..15`。
2. 保存结果并请求明确授权。
3. 经批准，使用产品 API archive，不直接 SQL。
4. 每成功一个立即写 manifest/evidence。
5. 核对历史 relationship 数量不变。
6. 只重新执行 `REM-P0-001 / AC-012`；其余 P0 用例不重跑，但必须复核既有 PASS 证据和其他关闭门禁仍有效，再由 P0 文档独立形成关闭结论。

## 13. 验证分层

### L1：事件定向门禁

- archive/restore/purge 状态机；
- permission/scope/tenant/protected group；
- 每个 active blocker 独立；
- audit success/rollback；
- trigger 全表参数化矩阵；
- writer-first/archive-first 并发；
- UI preflight/取消/确认/409 刷新；
- 新 runId 夹具清理。

### L2：根因聚类

- primary/membership/assignment；
- Wiki/SharedFile owner、ACL、visibleGroups；
- daily/device/credential；
- ops task/roster/rule；
- Workflow runtime/history；
- restore 不恢复；
- Purge 全历史引用和 catalog drift。

### L3：模块回归

- Groups/User/RBAC/Authorization；
- Wiki/SharedFile；
- Daily/Workflow；
- Device；
- Ops Calendar；
- Audit；
- 历史名称展示和 active-only 选择器。

### L4：发布候选版

实时全量主功能 `275` + 状态/跨模块 `78`，按实时分母执行。本事件关闭不伪称已经完成 L4。

## 14. 可观测性

- 成功日志：action、tenantId、groupId、operatorId、auditId、snapshotHash；不输出 reason 全文。
- 阻塞日志：reasonCode 和非零 counts，不输出业务内容。
- trigger reject 统一映射并统计 `GROUP_REFERENCE_INACTIVE`。
- 指标建议：archive success/blocked/conflict、restore、purge blocked、inventory drift。
- 未解释 HTTP 5xx、Console error 和 backend exception 必须为 0。

## 15. 回滚

### 15.1 应用回滚

- 前后端可回滚到部署前镜像；V72 trigger 继续阻止写入 inactive group，不改变合法写入合同。
- 已 archive 的测试 group 可通过 restore API 恢复；不得直接改 `is_deleted`。
- 不回滚已产生的 audit_log。

### 15.2 数据库回滚

V72 为前进迁移，不自动 down。只有 trigger 错误阻塞合法写入且应用回滚仍无法恢复时，才由明确授权的 DBA 脚本按逆序：

1. drop V72 triggers；
2. drop helper functions；
3. 保留 `group:purge` permission 和索引不影响旧应用；如需移除须另审计；
4. 不修改已归档 group 或审计。

### 15.3 Purge

Purge 不可回滚，所以 groups `11..15` 和本事件普通测试都不依赖 purge 成功清理；Purge 仅使用独立零引用测试夹具。

## 16. 停止条件

遇到以下任一情况必须停止并报告：

1. GitNexus 影响扩大到本 SPEC 未列出的核心模块。
2. schema 发现未登记的 group FK/逻辑引用。
3. 需要自动修改非测试业务数据才能归档。
4. 需要直接 SQL 修改 groups `11..15`。
5. 需要全租户授权切换、restore 或全局 session 清理。
6. archive/purge 产生未解释 5xx、死锁、孤儿引用或审计缺失。
7. groups `11..15` preflight 不再为 active blockers=0。
8. 用户未明确批准历史组 archive。

## 17. 验收条件

| ID | 验收条件 |
|---|---|
| `AC-001` | active 空业务组 preflight eligible，archive 后软删除三字段和 updated 字段真实落库。 |
| `AC-002` | built-in/unassigned/cross-tenant archive 均拒绝且数据库无变化。 |
| `AC-003` | permission 缺失、scope 不足和 assignment 过期分别返回真实 403。 |
| `AC-004` | 第 5.2 节每个 active blocker 独立返回非零 count 和稳定 reasonCode。 |
| `AC-005` | archive 不级联修改任何引用；阻塞时 group/audit 均无成功写入。 |
| `AC-006` | archive 与直接 FK writer 两种交错都不产生 archived group 活动引用。 |
| `AC-007` | archive 与 membership/assignment writer 两种交错保持授权关系一致。 |
| `AC-008` | archive 与 owner/ACL/JSON writer 两种交错保持资源引用一致。 |
| `AC-009` | audit 成功包含 before/after/reference hash；audit insert 失败整体回滚。 |
| `AC-010` | 重复 archive 幂等 `changed=false`，不重复成功审计。 |
| `AC-011` | restore 只恢复 group；Active 重复 restore、code 冲突和版本冲突分别返回 409，不恢复历史关系。 |
| `AC-012` | archived group 不出现在活动列表/选择器，不参与 permission/scope/ACL。 |
| `AC-013` | 历史日报、已结束任务和审计仍显示 archived group 名称。 |
| `AC-014` | archived group 的所有应用写入口和 DB trigger 返回 `GROUP_REFERENCE_INACTIVE`。 |
| `AC-015` | Purge 缺 permission/scope、未达保留期、任一历史引用、inventory drift 均拒绝。 |
| `AC-016` | 独立零引用 purge 夹具物理删除成功，audit 保留且不可 restore。 |
| `AC-017` | UI 覆盖 preflight loading/blocker/cancel/confirm/409 refresh/archive/restore。 |
| `AC-018` | 新 runId 活动用户/组/关系/session/MinIO 对象为 0；archive/restore 软删除夹具全部登记且活动引用为 0，独立 purge 夹具物理行=0，非测试状态不变。 |
| `AC-019` | 经用户批准，groups `11..15` 通过产品 archive；历史 membership/assignment 数量不变。 |
| `AC-020` | `REM-P0-001 / AC-012` 单项复跑 PASS；复核 P0 其余既有 PASS 证据和关闭门禁仍有效后，在 P0 文档中独立批准从 BLOCKED 更新 CLOSED。 |
| `AC-021` | GitNexus detect_changes 仅含预期流程，未解释 5xx/Console/backend exception=0。 |

## 18. 关闭门禁

`REM-P1-001` 只有以下条件全部满足才能 `CLOSED`：

1. `AC-001..021` 无 FAIL/BLOCKED；
2. V72 和 PostgreSQL 并发矩阵 PASS；
3. L1/L2/L3 PASS；
4. groups `11..15` archive 获得明确授权并完成；
5. `REM-P0-001 / AC-012` PASS；
6. 所有新 runId 活动对象/session/MinIO 为 0，软删除组全部登记且零活动引用，purge 夹具物理行=0；
7. superadmin、authorization mode/epoch、非测试授权和 ACL 未变化；
8. 实施记录、验证矩阵、事件卡和总 INDEX 已更新；
9. `git diff --check` 和 GitNexus detect_changes 通过；
10. 未解释 5xx、Console error、backend exception 为 0。
