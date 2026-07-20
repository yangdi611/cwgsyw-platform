# REM-P1-057 实施记录

## 2026-07-20：认领与根因确认

- 基线 `lint-fix@6559358f`；分支 `codex/rem-p1-057-wiki-child-owner-group-inheritance`；failure snapshot `50332f17`；事件 runId `REM_P1_057_20260720`。
- L4 通过产品 API 创建空间、根页、子页及 tenant-scope `wiki:read` 身份。父默认 named-user `r--` 已复制到子页，但正向 GET 返回 403。
- 短生命周期诊断只读核对显示：父页 owner group 正常，子页 `owner_group_id=NULL`，其 named-user `r--` 与 tenant assignment 均存在；全部夹具随后通过产品 API 逆序清理，manifest 为零。
- 根因是平台 superadmin 主组为空；`initializeCreatedResource` 仅在父 setgid 时继承父组，否则用创建者空组覆盖子资源。统一授权因此在 ACL/祖先判定前返回 `RESOURCE_NOT_MIGRATED`。
- GitNexus：`initializeCreatedResource` HIGH，8 direct / 33 affected / 4 creation flows / Wiki+Sharedfile+Authorization；`createdResourceParent` HIGH，1 direct / 25 affected / 3 flows。已向用户明确告警。事件不改变授权边界，仅增加父资源存在时的空组兜底。

## 2026-07-20：实现与 L1-L3

- `initializeCreatedResource` 在传入 `ownerGroupId` 为空且父 descriptor 存在时使用父 owner group；后续 setgid 条件仍无条件覆盖显式组。根资源、显式组、default ACL copy、活动组锁和资源 UPDATE 顺序保持不变。
- 新增独立 `AuthorizationResourceMigrationOwnerGroupTest`：空组继承、非 setgid 显式组保留、setgid 强制父组 3/3 PASS；既有根资源组校验 1/1 PASS。
- Authorization/Wiki/Sharedfile 直接调用者与判定聚类 96/96 PASS，无 failure/error/skip；backend compile PASS。
- 当前事件分支构建 backend image `sha256:55f0d3918120549cfae835ea7105912122938d3f5a67fbc4c2845d6dbd806ced`，只替换 backend；PostgreSQL、Redis、MinIO、frontend、nginx 容器 ID 未变。backend healthy，actuator `UP`。
- 真实 Wiki `/tmp/rem-p1-057-wiki024-r2` 1/1（2.5s）PASS：子页 API ownerGroupId 与父页一致，named-user `r--` 正向读取 200；移除父页 `x` 后读取 403，响应不含唯一标题或内容。
- 共享文件 `/tmp/rem-p1-057-shared-folder-r1` 1/1（837ms）PASS：显式组根目录、空组子目录、重命名、非空删除保护和逆序清理正常。
- 事件 manifest `objects=[]`、`cleanupFailures=0`；users/roles/spaces runId 搜索均为 0；授权仍 enforced；backend 日志无匹配 ERROR/5xx。正式 Wiki workflow policy 未变化。
