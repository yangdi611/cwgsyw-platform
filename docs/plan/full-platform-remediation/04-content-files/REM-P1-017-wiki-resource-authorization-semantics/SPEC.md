# REM-P1-017 实施合同

## 目标与运行时不变量

关闭 `BUG-FQA-045`、`BUG-FQA-058`、`BUG-FQA-067`、`BUG-FQA-089` 的共同根因，交付“Wiki 资源授权、归属组与不存在语义”。

- 不放宽既有权限、租户/group scope 或资源 ACL。
- 失败原子、可解释，DB 与对象存储不得留下半成品。
- 不覆盖原始证据；测试对象带 remediation runId 并经产品 API 精确清理。
- 涉及内容/附件时不得把正文、密码、token 或密钥写入审计。

## 当前与目标

当前：Wiki 对不存在资源先返回空 403，页面 owner 无法在根页创建子页，platform 管理员默认主组创建空间失败，others mode bits 也未正确参与 ACL 裁决。

目标：资源不存在、无权限和合法 owner 操作无法区分，授权矩阵会错误拒绝或掩盖真实状态。对应的用户风险消失，API、服务、存储、UI、权限和审计保持一致。

## 合同、影响与实施

- 根因合同：Wiki resource adapter、统一 ResourceAccessService、ownerGroup 默认值与页面级 action 映射没有共享同一主体分类和存在性顺序。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/authorization/ResourceAccessService.java`、`backend/src/main/java/com/cwgsyw/platform/module/wiki/**`、`frontend/src/app/(dashboard)/wiki/**`
- 范围：先确认资源存在性再执行不泄露的授权映射；明确 owner/named-user/matched-group/others effective bits；修复父页 create 与 ACL 继承；对齐 platform 管理员 ownerGroup 选择和后端裁决。
- 兼容：保留成功响应、路由、query key 和已有 ACL；明确修正项除外。
- GitNexus：规划索引已刷新；编辑每个符号前必须 upstream `impact`。

步骤：复现/确认 → 固定合同 → 最小根因改动 → L1/L2/L3 → `detect_changes` → 产品清理与回滚。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-045 原始路径通过。 |
| `AC-002` | BUG-FQA-058、BUG-FQA-067、BUG-FQA-089 分别有独立 PASS。 |
| `AC-003` | 正常、边界、无权/不存在、并发和失败零副作用通过。 |
| `AC-004` | 存在/不存在/无权限 reasonCode；owner/group/others 位矩阵；根页子页创建与 ACL 继承；platform/tenant/group 创建空间。 |
| `AC-005` | impact/detect、清理、审计和回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

出现跨租户影响、不可逆内容/对象删除、非测试对象修改、未解释 5xx 或影响超界时停止并标记 `BLOCKED`。回滚以本事件独立提交为单位；存储/DB 双写必须附补偿验证。
