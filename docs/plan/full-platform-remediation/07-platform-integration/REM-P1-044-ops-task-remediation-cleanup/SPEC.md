# REM-P1-044 实施合同

## 目标

允许 platform superadmin 通过产品 API 精确清理内容中带指定 runId 的单个运维测试任务及其从属记录，并留下清理审计。

## 验收标准

- 仅 platform superadmin 可调用；runId 必须非空。
- 任务 title/content/publicSummary/closeReason/resultSummary 中至少一项包含精确 runId，否则返回 400 且零写入。
- 按依赖逆序清理 links、checklist、participants、task logs、notification logs 后删除任务。
- 写入不含秘密的 `purge_remediation_test` 审计；重复或不存在任务稳定拒绝。
- L4 创建的所有 runId 运维任务均可逐一清理，最终查询为零、manifest 为空。

## 非目标

- 不提供普通业务删除 UI/API，不改变任务状态机、权限、可见性、统计或通知语义。
- 不允许批量 purge、SQL 清理、历史任务清理或非 platform 管理员调用。

## 回滚

移除受限 Controller 端点和 Service 清理方法；无迁移、回填或配置变化。
