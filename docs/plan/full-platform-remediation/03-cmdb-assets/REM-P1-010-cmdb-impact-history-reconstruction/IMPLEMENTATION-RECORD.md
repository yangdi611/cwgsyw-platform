# REM-P1-010 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-050`、`BUG-FQA-101`；用例：`CMDB-029`、`CMDB-030`、`CMDB-031`、`CMDB-032`。
- 根因：CTE 占位符绑定错误；拓扑逆放依赖的快照字段、关系标识和时间边界不一致。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-16：事件认领与只读根因确认

- 分支：`codex/rem-p1-010-cmdb-impact-history-reconstruction`；基线：`lint-fix@074964f`；状态：`IN_PROGRESS`。
- `BUG-FQA-050`：`ImpactAnalysisService.buildCteSql` 有五个 JDBC 参数，而 `analyzeWithCte` 仅绑定四个；异常被捕获后返回 root-only、`truncated=true` 的伪成功结果。
- `BUG-FQA-101`：`CiTopologyCompareService` 从当前拓扑逆放审计记录，需核对 create/update/delete 实例与关系的快照字段、标识和时间边界，避免新增/删除/修改/未变全部误分类。
- 尚未修改业务符号、数据库或容器，尚未创建测试对象。下一步：逐符号 GitNexus upstream impact。

## 2026-07-16：CTE 修复与运行时 L3 部分通过

- impact 结论均为 `LOW`，未出现需要用户决策的授权或不可逆数据风险。
- 修复 `ImpactAnalysisService`：按方向绑定全部 CTE 参数、使用到达节点构建层级、路径数组阻止双向回环；查询故障改为明确 `409` 合同，不再返回 `200 + root-only + truncated=true` 的伪成功。
- 新增 `ImpactAnalysisServiceTest` 和 `CiTopologyCompareServiceTest`；Java 21 定向 Maven 测试通过。构建当前分支后端镜像、替换 backend 容器，健康检查通过。
- 真实 API：runId root → middle → leaf 图中，downstream/bidirectional depth 2 返回三层两条边且不截断，upstream root-only；全部 runId 对象通过产品 API 清理。首次清理遗漏首条关系时，产品 API 的引用保护拒绝删除，随后通过关系列表定位并删除，最终对象数为 0。
- 历史快照重建尚需用完整 create/update/delete/relation 时间点生命周期复验；事件未提交、未合并。

## 2026-07-16：历史复验与 UI L3 通过

- 真实 API 生命周期验证了 before→after 的新增/修改/未变及删除后的 removed 节点、removed relation；每个 runId 模型、实例、关系和关联定义均由产品 API 精确清理。
- 真实 UI 复验首次发现日期控件会把同日时间点静默扩展到全天，无法表达短生命周期快照。对 `TopologyComparePage` 的 GitNexus upstream impact 为 `LOW`，改为 `datetime-local` 秒级输入并原样发送；未改变 API、路由或权限。
- Playwright 经开发 Nginx 入口完成登录、导航、输入精确时间、发起对比，图例新增 1、修改 1、未变 1、删除 0 与 API 一致。
- 最终 Java 21 回归：`ImpactAnalysisServiceTest`、`CiTopologyCompareServiceTest`、`Ci2DViewServiceTest`、`CmdbVoSerializationTest` 通过；前端生产构建、后端当前分支构建与健康检查通过。GitNexus `detect-changes` 为 `MEDIUM`，仅命中预期的拓扑对比前端流程和相关 CMDB 服务。
- L1-L3 全部 PASS，状态更新为 `VERIFIED`；等待最终 L4。
