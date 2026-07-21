# 实施记录

## 2026-07-21：发现与认领

- L4 RBAC 串行矩阵在 fixture-only 分页、marker 长度和不存在详情路由修正后，真实证明非主组 owner-mode Wiki 空间不可见；失败证据 `/tmp/fqa-2050-rbac-remaining-after-rem-p1-068-r4`，快照 `bcdaaf57`。
- 两个有效成员关系与两条 `wiki:read` group-scope assignment 均存在；组 B 为主组时仅组 B 空间可见，组 A 在删除成员关系前已缺失。
- `ScopedPermissionMapper.findAssignments` 会返回两条 assignment，不是 SQL 去重问题。`AuthorizationService.resourcePermissions` 对显式 group ACL 使用完整 `groupIds`，但 owner-group mode 只比较 `user.getGroupId()`。
- GitNexus upstream impact HIGH：2 个直接调用者、38 个上游符号、4 个模块和 SharedFile 列表流程。未修改 CRITICAL 的 assignment mapper；最小修复限定为已计算有效组集合的包含判断。
- 分支从 `lint-fix@962bd234` 创建；事件 run `REM_P1_069_20260721`。原失败尝试均已通过产品 API 清理，shared manifest `objects=[]`、`cleanupFailures=0`。

## 2026-07-21：实现与 L1-L3

- `resourcePermissions` 的 owner-group mode 判定改为 `groupIds.contains(ownerGroupId)`；assignment scope、显式 ACL 和权限位计算顺序未变。
- 新增非主组有效成员 allow 与主组字段残留/有效成员为空 deny 单测。Java 21 `AuthorizationServiceTest` 31/31 PASS。
- Authorization persistence、Wiki controller/space/page、SharedFile/folder 聚类共 89/89 PASS；与 L1 合计 120/120。持久化测试使用宿主 Java 21 和独立 Testcontainers PostgreSQL，迁移到 V79 后 21/21 PASS；临时容器已回收。
- 当前分支生产 backend 编译 552 source，镜像 `sha256:012e01cc...`；仅替换 backend，health `UP`，产品数据库保持 V79，启动无 ERROR。
- 专用真实 API Playwright `1/1` 在 2.9 秒通过：两个有效业务组与对应 assignment 同时可见；移除非主组成员关系后，旧会话和新会话均不再看见该组空间且保留主组空间。
- `/tmp/rem-p1-069-runtime-r2/manifest.json` 为 `objects=[]`、`cleanupFailures=0`；活动用户、角色、Wiki marker 均为 0，backend 无 ERROR/未处理 5xx。
