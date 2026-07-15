# REM-P1-020 实施合同

## 目标与运行时不变量

关闭 `BUG-FQA-062`、`BUG-FQA-063` 的共同根因，交付“共享文件夹重命名、移动与名称合同”。

- 不放宽既有权限、租户/group scope 或资源 ACL。
- 失败原子、可解释，DB 与对象存储不得留下半成品。
- 不覆盖原始证据；测试对象带 remediation runId 并经产品 API 精确清理。
- 涉及内容/附件时不得把正文、密码、token 或密钥写入审计。

## 当前与目标

当前：文件夹只有创建/删除，缺少重命名和移动；名称又未 trim、限长、限制分隔符或同级唯一。

目标：用户无法维护目录结构，非法或超长名称会触发 500。对应的用户风险消失，API、服务、存储、UI、权限和审计保持一致。

## 合同、影响与实施

- 根因合同：Folder DTO/Controller/Service 生命周期不完整，树结构不变量与名称规范没有服务/数据库兜底。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFolderService.java`、`backend/src/main/java/com/cwgsyw/platform/module/sharedfile/SharedFileController.java`、`frontend/src/app/(dashboard)/files/page.tsx`、`backend/src/main/resources/db/migration/**`
- 范围：实现 rename/move API 与 UI；校验目标 parent 权限、防环和根目录规则；统一名称规范和同级唯一；审计并刷新树。
- 兼容：保留成功响应、路由、query key 和已有 ACL；明确修正项除外。
- GitNexus：规划索引已刷新；编辑每个符号前必须 upstream `impact`。
- 已确认权限与 ACL：重命名使用 `shared_file:update`；移动同时要求源目录与目标父目录的 `shared_file:manage`。移动不变更 owner、ACL 行或 `aclInherited`；继承型目录改由新父级动态生效。

步骤：复现/确认 → 固定合同 → 最小根因改动 → L1/L2/L3 → `detect_changes` → 产品清理与回滚。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-062 原始路径通过。 |
| `AC-002` | BUG-FQA-063 分别有独立 PASS。 |
| `AC-003` | 正常、边界、无权/不存在、并发和失败零副作用通过。 |
| `AC-004` | 重命名/移动/取消；自环/后代环/跨无权父级；空白/最大/超长/重复名称；树刷新与审计。 |
| `AC-005` | impact/detect、清理、审计和回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

出现跨租户影响、不可逆内容/对象删除、非测试对象修改、未解释 5xx 或影响超界时停止并标记 `BLOCKED`。回滚以本事件独立提交为单位；存储/DB 双写必须附补偿验证。
