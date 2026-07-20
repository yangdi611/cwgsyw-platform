# 实施记录

## 2026-07-20：认领、影响与根因

- 从 `lint-fix@2f19e1f4b` 创建 `codex/rem-p1-061-change-doc-approval-notification`。
- 原始 L4 `/tmp/fqa-2050-change011012-r9` 证明直接同组审批和 1024 字符 Unicode 意见持久化通过，但申请人通知列表为空；清理零残留。
- `ChangeDocService.approve` 没有通知调用，workflow adapter 则在 service 回写后单独通知，导致两个入口合同漂移。
- GitNexus 对三个拟改方法和 service 构造依赖均为 LOW，无已索引流程。

## 2026-07-20：实现

- 将申请人通知集中到 `ChangeDocService` 的有效终态事务，直接审批和 workflow 回调共同调用。
- workflow adapter 删除原来的二次投递，重复 workflow 完成因既有非 pending 幂等检查不新增通知。
- 新增 `ChangeDocApprovalNotificationTest` 覆盖直接通过/拒绝、长/空意见、引用、重复回调和无申请人分支。

## 2026-07-20：验证与清理

- Java 21 L1 4/4；Changedoc/Workflow 受影响 L2 42/42；生产 backend 构建和 `/api/health`=UP。
- `/tmp/rem-p1-061-l3-r1` 真实 Playwright 1/1 PASS：同组审批通知、1024 字符 Unicode、空意见拒绝、跨组拒绝及产品 API 清理通过。
- 事件 manifest `objects=[]`、`cleanupFailures=0`；backend 无未解释 ERROR/5xx。未使用 SQL 写入、restore、对象存储直接删除、Redis、卷清空或授权切换。
- 当前工作区保留用户既有 `test-results` 删除和四个测试文件改动，事件提交不得暂存这些路径。
