# 实施记录

## 2026-07-17

- L4 首次失败：实例 #20 双向 depth 3 返回 7 个层节点、仅 5 个唯一 ID；#31/#27 在 depth 1 和 3 重复。
- 根因：CTE SQL 防止单一路径内循环，但 `buildResult` 不跨层去重。
- GitNexus：`ImpactAnalysisService.analyze` upstream 为 LOW，direct caller=1（`ImpactAnalysisController.analyze`），processes=0。
- 实施：`buildResult` 使用 `assignedNodeIds`，仅把 node ID 的首次出现加入 layer；edge 收集不变。
- 验证：`mvn -Dmaven.test.skip=true package` 通过；定向测试被既有 OpsCalendar/GroupController testCompile 错误阻断。当前分支 backend 容器复验 #20 为 5 nodes/5 unique IDs/5 edges；真实 UI 页面加载正常，Console/4xx/5xx=0。无夹具、无清理项。
