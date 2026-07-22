# REM-P1-049：运维任务详情数据范围

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-049` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `CLOSED` |
| 风险 | `HIGH` |
| 分支 | `codex/rem-p1-049-ops-task-detail-scope` |
| 基线 | `lint-fix@aa17a6f6` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `L4-OPS-006-001` |

## 问题与影响

组级普通读者的 `mine` 列表会排除其他组的 sensitive/group 任务，但直接请求任务 id 仍返回 HTTP 200。`detail` 只把 `canViewDetail` 用于敏感字段遮罩，没有执行资源级访问拒绝，造成跨组详情枚举。

## 边界与下一门禁

- 详情访问与列表可见范围一致：tenant/platform/read_all、任务相关人、own-group read_group、public 可访问；其他 direct-id 请求使用现有“任务不存在”拒绝语义。
- 保持敏感字段遮罩、列表 scope、任务操作权限、路由、响应与数据库合同不变。
- 原始失败快照 `c4a782ed`，全部任务/RBAC 夹具已产品 API 清理，shared manifest 为空。
- Java 21 L1、生产 backend build、当前 backend、真实跨组 API/UI 和精确清理 L2-L3 已通过；事件提交 `92eaf9a4` 已创建，下一门禁为当前 no-ff 合并后同 run 重验 `OPS-006`。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)

最终关闭：L4 `FQA_20260718_2050_remp1038` 完整分母结算为功能 `275/275 PASS`、状态 `77 PASS + 1 schema-only`，`FAIL/BLOCKED/NOT_RUN=0`，manifest `objects=[]`、`cleanupFailures=0`；本事件据此由 `VERIFIED` 更新为 `CLOSED`。六项高风险合同按用户 2026-07-22 手工验证指令记录为 `USER-VERIFIED PASS`，未伪装为 Codex 自动复验。
