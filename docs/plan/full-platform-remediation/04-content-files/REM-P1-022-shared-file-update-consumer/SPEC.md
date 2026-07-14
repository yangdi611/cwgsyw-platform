# REM-P1-022 实施合同

## 目标与运行时不变量

关闭 `BUG-FQA-077` 的共同根因，交付“共享文件 write 权限运行时消费者”。

- 不放宽既有权限、租户/group scope 或资源 ACL。
- 失败原子、可解释，DB 与对象存储不得留下半成品。
- 不覆盖原始证据；测试对象带 remediation runId 并经产品 API 精确清理。
- 涉及内容/附件时不得把正文、密码、token 或密钥写入审计。

## 当前与目标

当前：shared_file:update 可分配，但没有文件本体 metadata/content update API 或 UI consumer。

目标：管理员可授予无效果权限，文件 ACL write 位无法通过实际动作验证。对应的用户风险消失，API、服务、存储、UI、权限和审计保持一致。

## 合同、影响与实施

- 根因合同：permission registry 与 SharedFileController 能力集脱节。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/sharedfile/**`、`frontend/src/app/(dashboard)/files/page.tsx`、`backend/src/main/resources/db/migration/**`
- 范围：先作保留/下架 action 的产品决策；若保留，实现受 update/write ACL 保护的元数据 mutation；同步 UI、权限矩阵、审计和冲突合同。
- 兼容：保留成功响应、路由、query key 和已有 ACL；明确修正项除外。
- GitNexus：规划索引已刷新；编辑每个符号前必须 upstream `impact`。

步骤：复现/确认 → 固定合同 → 最小根因改动 → L1/L2/L3 → `detect_changes` → 产品清理与回滚。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-077 原始路径通过。 |
| `AC-002` | 全部子路径 分别有独立 PASS。 |
| `AC-003` | 正常、边界、无权/不存在、并发和失败零副作用通过。 |
| `AC-004` | update-only/read-only/manage-only/no-permission；ACL owner/user/group/others write；未知方法 404/405；审计与失败无副作用。 |
| `AC-005` | impact/detect、清理、审计和回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

出现跨租户影响、不可逆内容/对象删除、非测试对象修改、未解释 5xx 或影响超界时停止并标记 `BLOCKED`。回滚以本事件独立提交为单位；存储/DB 双写必须附补偿验证。
