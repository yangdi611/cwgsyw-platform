# REM-P1-045 实施合同

## 目标

允许 platform 管理员通过产品 API 精确清理 remark 中带指定 runId 的单条运维测试排班，并留下审计。

## 验收标准

- Controller 要求 `ops_calendar:manage`；Service 要求 platform scope、非空 runId 和同租户。
- 排班 remark 必须包含指定 runId；普通排班、空/错 runId、跨租户和重复请求拒绝且零写入。
- 正确请求仅删除目标排班并写 `purge_remediation_test` 审计。
- L4 排班 CRUD、主备人员、电话和反向时间验证后可精确清理，manifest 为空。

## 非目标

- 不增加普通业务删除 UI/API，不改变排班冲突、范围、时间或权限语义。
- 不允许批量清理、SQL 删除或清理无法证明属于当前 runId 的排班。

## 回滚

移除受限 Controller 端点与 Service 方法；无迁移或数据回填。
