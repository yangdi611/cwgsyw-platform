# REM-P2-011 实施合同

## 目标与运行时不变量

关闭 `BUG-FQA-025` 的共同根因，交付“通知引用目标跳转合同”。

- 不放宽既有权限、租户/group scope 或资源 ACL。
- 失败原子、可解释，DB 与对象存储不得留下半成品。
- 不覆盖原始证据；测试对象带 remediation runId 并经产品 API 精确清理。
- 涉及内容/附件时不得把正文、密码、token 或密钥写入审计。

## 当前与目标

当前：Wiki 发布通知可以标记已读，但缺少 wiki_page 目标路由映射。

目标：用户无法从通知返回业务对象，只能手工检索。对应的用户风险消失，API、服务、存储、UI、权限和审计保持一致。

## 合同、影响与实施

- 根因合同：通知 producer 的 refType 集合与 NotificationItem.getHref 映射未共享注册表。
- 候选文件 / 符号：`frontend/src/components/notification/NotificationItem.tsx`、`backend/src/main/java/com/cwgsyw/platform/module/notification/**`
- 范围：建立 refType→route 映射；覆盖 Wiki/变更/日报/CI/运维任务；失效目标进入友好错误态；链接与标记已读行为兼容。
- 兼容：保留成功响应、路由、query key 和已有 ACL；明确修正项除外。
- GitNexus：规划索引已刷新；编辑每个符号前必须 upstream `impact`。

步骤：复现/确认 → 固定合同 → 最小根因改动 → L1/L2/L3 → `detect_changes` → 产品清理与回滚。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-025 原始路径通过。 |
| `AC-002` | 全部子路径 分别有独立 PASS。 |
| `AC-003` | 正常、边界、无权/不存在、并发和失败零副作用通过。 |
| `AC-004` | 每种 refType 有效跳转；未知/删除目标；单条已读与链接顺序；无权目标不泄露。 |
| `AC-005` | impact/detect、清理、审计和回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

出现跨租户影响、不可逆内容/对象删除、非测试对象修改、未解释 5xx 或影响超界时停止并标记 `BLOCKED`。回滚以本事件独立提交为单位；存储/DB 双写必须附补偿验证。
