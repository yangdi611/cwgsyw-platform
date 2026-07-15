# REM-P1-010 验证与证据矩阵

| AC | caseId | 层级 | 修复后证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | CMDB-029 | L1 | `ImpactAnalysisServiceTest`：参数、方向、错误合同 | `PASS` |
| `AC-002` | CMDB-030 / CMDB-031 / CMDB-032 | L2 | 真实 API create/update/delete/relation 时间点比较 | `PASS` |
| `AC-003` | 边界 / deny / 并发 / 零副作用 | L2 | 方向/深度、环路、错误合同、产品 API 清理 | `PASS` |
| `AC-004` | 受影响模块 | L3 | Java 21 回归、当前分支 Docker、真实 API/UI | `PASS` |
| `AC-005` | impact/detect/cleanup/rollback | L3 | impact/detect、runId 逆序清理与不存在核对 | `PASS` |
| `AC-006` | 全平台 `275+78` | L4 | 新候选 run | `PENDING` |

原始证据：`defects.md` 的 `BUG-FQA-050`、`BUG-FQA-101` 和对应 test-results。PASS 要求行为、持久化、权限、审计、清理全部一致；FAIL 包括残留、未解释 5xx/Console error；BLOCKED 必须注明解除条件。禁止覆盖历史证据。

## 2026-07-16 当前证据

- GitNexus upstream impact：`ImpactAnalysisService.analyzeWithCte/buildCteSql`、`CiTopologyCompareService.reconstructTopology/reverseApplyInstanceChange/reverseApplyRelationChange` 和 `AuditLogMapper.queryChangesList` 均为 `LOW`，各有一个直接服务入口、未命中额外流程。
- `ImpactAnalysisServiceTest`、`CiTopologyCompareServiceTest` 在 Java 21 容器通过。前者覆盖 CTE 参数绑定、方向、错误不再伪装为 root-only 成功；后者覆盖新增、删除、修改、未变四类节点逆放。
- 当前分支后端镜像运行时创建唯一 runId 的 root → middle → leaf 图。`downstream depth=2` 与 `bidirectional depth=2` 均返回三层、两条边、`truncated=false`；upstream 从 root 返回 root-only 空影响范围。CTE 初次复验发现层级重复和双向回环，已补 node_id/path 去重并复验通过。
- runId 关系、实例和关联定义均经产品 API 逆序清理；最终读取 root 返回不存在错误。历史时间点完整 API/UI 生命周期仍待执行，事件保持 `IN_PROGRESS`。

## 2026-07-16 历史 API/UI 复验

- 真实 API 生命周期：在 from 时间点后创建 root→peer 关系、更新 peer 为 maintenance、创建 added 与第二条关系。compare 返回 `added=added`、`modified=peer`、`unchanged=root`，两条关系均为新增。
- 删除 added 及其关系后，第二次 compare 返回 `removed=added`、removed edge，root/peer 均为 unchanged。所有实例、关系和关联定义按逆序通过产品 API 删除，root 读取返回不存在错误。
- 真实浏览器：通过开发 Nginx 登录，创建同样的 runId 生命周期后在对比页以精确 datetime-local 起止时间发起比较；图例显示新增 1、修改 1、未变 1、删除 0，与 API 分类一致。
- 对比页改为秒级时间输入并原样传给 API，避免同日生命周期被强制扩展至整天而无法表达精确快照。前端生产构建通过。
