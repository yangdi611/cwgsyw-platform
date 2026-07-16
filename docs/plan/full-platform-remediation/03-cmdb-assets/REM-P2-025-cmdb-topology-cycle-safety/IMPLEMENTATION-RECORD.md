# 实施记录

## 2026-07-17：事件认领与根因确认

- L4 发现：对现有实例 `#20` 发起 `GET /api/cmdb/topology/20?depth=1` 与 `depth=2` 均收到 HTTP 500。
- 读取代码确认：`CiInstanceRelMapper.findTopologyEdges` 使用无路径访问集的双向递归 `UNION ALL`；双向关系可在相邻实例之间反复回走。
- GitNexus：编辑前已对 `findTopologyEdges` 与 `CiTopologyService.getTopology` 做 upstream impact；均为 `LOW`，总范围为拓扑读取和 compare 重建链。
- 测试数据：尚未创建、修改或清理任何产品对象。
- 实施：递归行新增 `current_id` 与 `visited_ids`；每一步只从当前节点走向未在本路径中出现的邻居，阻止同一关系的立即反向回走及更长环路。
- L1：新增 `CiInstanceRelMapperTopologySqlTest`。定向 Maven 因 4 个既有无关 testCompile 错误停止，未执行测试；`mvn -Dmaven.test.skip=true package` 通过。
- L2：在开发 PostgreSQL 对 #20 执行等价只读递归查询，depth=2 返回 7 行、5 条唯一边、最大深度 2，确认查询有限收敛；未写入任何数据。
- L3：当前分支 backend 镜像构建并仅替换 backend 容器，健康检查通过。通过运行时环境变量完成真实会话 API 读取：depth=1/2 均 HTTP 200、5 nodes/5 edges；compare HTTP 200。Playwright 登录后加载 `/cmdb/topology/20` 并切换深度，两个网络请求均 200、图谱可见、Console error=0。
- 清理：本事件仅读取既有实例与拓扑；未创建、修改或清理产品数据，无残留。
- 结论：L1-L3 已通过；定向测试的 testCompile 阻断为既有无关债务，未掩盖当前分支生产构建与真实 API/UI 结果。
