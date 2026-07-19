# REM-P1-048 实施合同

## 目标与不变量

关闭 `L4-OPS-017-001`，使素材归集和 XLSX 导出与运维任务统计遵循相同的认证范围。

- `group` scope：忽略请求 `groupId`，始终使用认证用户 `groupId`。
- `tenant` / `platform` scope：未传 `groupId` 保持全租户；显式 `groupId` 保持按组筛选。
- 素材归集与导出必须使用相同的有效组。
- 保持 `ops_calendar:export` 权限、URL、参数、响应、文件名、工作簿、Service/SQL、租户过滤和审计合同不变。
- 不修改现有组、角色或非测试任务；测试身份和任务必须带 runId 并通过产品 API 精确清理。

## 实施范围

- `OpsCalendarMaterialController.collect`
- `OpsCalendarMaterialController.export`
- Controller 定向测试
- `OPS-017` 真实 group/tenant API 与 UI/下载复验

## GitNexus 影响

- `collect` upstream impact：LOW，0 个直接调用者、0 个执行流。
- `export` upstream impact：LOW，1 个直接测试调用者、0 个执行流，仅 Service 模块。
- 无 HIGH/CRITICAL 风险；不修改 Service 或共享授权符号。

## 验收条件

| AC | 条件 |
|---|---|
| `AC-001` | group scope 素材归集不传或伪造其他组时均只返回认证用户本组。 |
| `AC-002` | group scope XLSX 导出不传或伪造其他组时均只包含认证用户本组。 |
| `AC-003` | tenant/platform 未传组仍为全租户，显式组筛选仍生效。 |
| `AC-004` | 任务列表、统计、素材归集和导出在真实组长身份下范围一致。 |
| `AC-005` | L1-L3、当前分支 backend、真实 API/UI/下载、精确清理和 detect_changes 全部通过。 |
| `AC-006` | 同一 L4 run 的 `OPS-017` 受影响范围复验 PASS，未受影响 PASS 不重跑。 |

## 回滚与停止

回滚仅移除 Controller 有效组收敛与对应测试，不涉及 schema、迁移或数据恢复。若真实产品合同要求组级用户跨组导出、需要修改权限模型或无法精确清理夹具，停止并请求用户决定。
