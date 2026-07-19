# REM-P1-052：CMDB 实例引用删除保护

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-052` |
| 优先级 | P1 |
| 领域 | `03-cmdb-assets` |
| 状态 | `VERIFIED` |
| 风险 | `MEDIUM` |
| 分支 | `codex/rem-p1-052-cmdb-instance-reference-delete-guards` |
| 基线 | `lint-fix@73ec4273` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `CMDB-040` |

## 问题

活动变更文档引用一个 CI 时，实例删除仍返回 200。现有删除命令只保护活动关系与设备，未保护活动变更文档链接和日报 JSON 引用，可能留下悬空业务引用。

本事件在实例行锁事务内补齐四类 live-reference 删除保护，不级联、不自动解除引用、不改 schema。完成 L1-L3 后独立提交并 no-ff 合并，再在同一 L4 run 重验 `CMDB-040`。

L1-L3 已通过：Java 21 定向 5/5、相关聚类 28/28、生产 compile/build、当前分支 backend healthy、真实 API/UI 1/1 PASS；文档/日报拒绝无审计副作用，产品解除引用后删除成功，event manifest 为零。待提交并 no-ff 合并。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
