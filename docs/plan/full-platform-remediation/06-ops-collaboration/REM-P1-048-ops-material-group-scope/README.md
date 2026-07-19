# REM-P1-048：运维素材组级范围约束

| 项目 | 内容 |
|---|---|
| 事件 ID | `REM-P1-048` |
| 优先级 | P1 |
| 领域 | `06-ops-collaboration` |
| 状态 | `VERIFIED` |
| 风险 | `LOW` |
| 分支 | `codex/rem-p1-048-ops-material-group-scope` |
| 基线 | `lint-fix@00f342a5` |
| 来源 | L4 `FQA_20260718_2050_remp1038` / `L4-OPS-017-001` |

## 问题与影响

组级运维负责人访问任务列表和统计时会被强制收敛到本组，但素材归集与 XLSX 导出直接信任请求 `groupId`。不传组时可读取全租户，伪造其他组时可读取该组，违反 `OPS-017` 的本组范围合同。

## 边界与下一门禁

- 只修复 `OpsCalendarMaterialController.collect/export` 的有效组计算，并补 Controller 与真实 API/UI 测试。
- 组级会话始终使用认证用户 `groupId`；tenant/platform 会话保持现有全租户或显式组筛选能力。
- 不修改 Service 聚合、SQL、权限码、任务可见性、数据库、审计、现有组或非测试数据。
- 原始失败快照：L4 commit `de9b693b`；失败夹具已通过产品 API 逆序清理，manifest 为空。
- Controller 定向测试、生产 build、当前分支 backend、真实 group/tenant/no-export API、组长素材页、两种 XLSX 请求和产品 API 精确清理均已通过 L1-L3。
- 事件提交 `3e7667a3` 已进入 `lint-fix` 的 no-ff 合并门禁；下一门禁是在同一 L4 run 重验 `OPS-017`，保留未受影响 PASS。

[SPEC](./SPEC.md) / [验证](./VERIFICATION.md) / [记录](./IMPLEMENTATION-RECORD.md) / [Prompt](./CLAUDE-CODE-PROMPT.md)
