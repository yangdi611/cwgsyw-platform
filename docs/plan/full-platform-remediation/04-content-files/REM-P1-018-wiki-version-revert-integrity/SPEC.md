# REM-P1-018 实施合同

## 目标与运行时不变量

关闭 `BUG-FQA-076` 的共同根因，交付“Wiki 版本快照与回退完整性”。

- 不放宽既有权限、租户/group scope 或资源 ACL。
- 失败原子、可解释，DB 与对象存储不得留下半成品。
- 不覆盖原始证据；测试对象带 remediation runId 并经产品 API 精确清理。
- 涉及内容/附件时不得把正文、密码、token 或密钥写入审计。

## 当前与目标

当前：Wiki 版本回退返回成功，但正文被清空。

目标：用户执行恢复操作会丢失内容，历史版本不再可信。对应的用户风险消失，API、服务、存储、UI、权限和审计保持一致。

## 合同、影响与实施

- 根因合同：WikiPageVersion 快照写入/读取与 revert→savePage 映射未保证正文、标题和版本元数据完整。
- 候选文件 / 符号：`backend/src/main/java/com/cwgsyw/platform/module/wiki/WikiPageService.java`、`backend/src/main/java/com/cwgsyw/platform/module/wiki/entity/WikiPageVersion.java`、`frontend/src/app/(dashboard)/wiki/**`
- 范围：固定版本快照 schema；修复回退事务与新版本生成；保证正文、标题、附件引用和审计一致；对空/旧格式快照提供受控失败。
- 兼容：保留成功响应、路由、query key 和已有 ACL；明确修正项除外。
- GitNexus：规划索引已刷新；编辑每个符号前必须 upstream `impact`。

步骤：复现/确认 → 固定合同 → 最小根因改动 → L1/L2/L3 → `detect_changes` → 产品清理与回滚。

## 验收

| AC | 条件 |
|---|---|
| `AC-001` | BUG-FQA-076 原始路径通过。 |
| `AC-002` | 全部子路径 分别有独立 PASS。 |
| `AC-003` | 正常、边界、无权/不存在、并发和失败零副作用通过。 |
| `AC-004` | 两版不同正文回退；回退后详情/刷新/导出；空快照受控拒绝；权限 deny 与审计。 |
| `AC-005` | impact/detect、清理、审计和回滚记录完整。 |
| `AC-006` | L4 全量 FQA 通过；此前最多 `VERIFYING`。 |

## 停止与回滚

出现跨租户影响、不可逆内容/对象删除、非测试对象修改、未解释 5xx 或影响超界时停止并标记 `BLOCKED`。回滚以本事件独立提交为单位；存储/DB 双写必须附补偿验证。
