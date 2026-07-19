# REM-P1-048 实施记录

## 2026-07-19：认领与影响分析

- 状态：`IN_PROGRESS`；分支：`codex/rem-p1-048-ops-material-group-scope`；基线：`lint-fix@00f342a5`。
- 来源：L4 `FQA_20260718_2050_remp1038` 的 `L4-OPS-017-001`；失败快照 `de9b693b`。真实 group-scope 组长的任务列表和统计正确收敛本组，但素材归集未传组时返回全租户、伪造其他组时返回该组。
- 同批 `OPS-018/019` PASS；所有任务、角色、用户和 assignment 已通过产品 API 逆序清理，shared manifest 为空。
- GitNexus MCP upstream impact：`OpsCalendarMaterialController.collect` LOW（0 direct、0 flow）；`export` LOW（1 direct test、0 flow、Service 模块）。无 HIGH/CRITICAL。
- 合同：复用 `OpsCalendarStatsController` 的有效组语义；group 强制认证组，tenant/platform 保持全租户/显式组筛选。
- runId：`REM_P1_048_20260719`。下一门禁：实现 Controller 收敛和定向测试。

## 2026-07-19：实现与 L1-L3 通过

- 实现：`collect/export` 使用与统计一致的 effective group 计算；group scope 固定认证用户组，tenant/platform 原样保留请求筛选。未修改 Service、SQL、权限、响应或文件格式。
- L1：Java 21 独立 target 的 `OpsCalendarMaterialControllerTest` 4/4 PASS；生产 backend build PASS。
- L2/L3：当前事件镜像只替换 backend 后 healthy；事件 Playwright 3/3 PASS，覆盖真实 group/tenant/read-no-export 身份、两组任务、伪造组、素材 JSON、组级省略/伪造组、租户全量/显式组四种 XLSX 内容和组长素材页真实下载。拒绝页只有与预期 stats 403 对应的一条已解释 Console 记录；组长流程 Console/API failures=0。
- 清理：两轮事件夹具均按任务→assignment→user→role 逆序经产品 API 清理；manifest、runId 任务/用户/角色和 cleanup failure 均为 0，backend 无 ERROR。
- 模块测试：Controller 4/4 PASS；未触及的 `OpsCalendarMaterialExportTest:45` 仍因既有冗余 Mockito stub 在 afterEach 报错，真实 XLSX runtime 已通过。本事件不混入无关测试清理。
- 状态：L1-L3 全部通过，提升为 `VERIFIED`；下一门禁为 detect、精确暂存、事件提交和 no-ff 合并。
