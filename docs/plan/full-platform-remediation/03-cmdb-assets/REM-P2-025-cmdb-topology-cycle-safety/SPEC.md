# REM-P2-025 实施合同

## 目标

`GET /api/cmdb/topology/{instanceId}?depth=N` 对含双向或循环关系的有效实例稳定返回拓扑结果，绝不因递归回走产生 HTTP 500。`CiTopologyCompareService` 复用相同拓扑读取时也必须保持可用。

## 根因与影响

`CiInstanceRelMapper.findTopologyEdges` 的递归步可从 `src` 走到 `dst` 后立即沿同一条关系反向走回 `src`。`UNION ALL` 会持续生成新的递归行直到深度上限；在实际循环图中会放大中间集并造成数据库/请求失败。

GitNexus upstream impact（2026-07-17）：

- `findTopologyEdges`：direct caller=1（`CiTopologyService.getTopology`），总受影响符号=4，风险 `LOW`。
- `getTopology`：direct callers=2（读取 Controller、`CiTopologyCompareService.reconstructTopology`）；compare 再经 Controller 公开，风险 `LOW`。

## 实施边界

1. 在递归 CTE 中保存当前路径已访问实例 ID；仅展开尚未存在于该路径的相邻实例。
2. 保留现有根节点校验、`depth` 的 `1..10` 钳制、租户与软删除过滤、边去重和响应 DTO。
3. 不改变 API 路径、权限、关联方向语义或数据库结构。

## 验收

- AC-001：含双向关系的拓扑 API 在 `depth=1`、`depth=2` 返回 HTTP 200，节点与边可 JSON 解析。
- AC-002：循环图不会重访同一路径的实例；深度增大不产生 500 或无限递归。
- AC-003：compare 读取复用拓扑服务时仍可执行。
- AC-004：真实浏览器拓扑页显示可用图谱，无 Console error、4xx 或 5xx。

## 回滚

回滚本事件提交即可恢复原始查询；无迁移、无配置、无测试数据写入。
