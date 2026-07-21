# SPEC：CMDB canonical 权限消费一致性

## 范围

- CSV/JSON import 读取端点消费 `cmdb_import:read`。
- CSV/JSON import preview/execute 消费 `cmdb_import:execute`。
- impact 分析端点消费 `cmdb_impact:read`。
- topology/compare 端点消费 `cmdb_topology:read`。
- 前端相应入口、按钮和路由使用同一 canonical action。

## 验收标准

1. canonical-only 最小角色可调用对应合法请求并得到真实业务结果。
2. 只有旧 `cmdb_instance:*` guard 的角色得到 HTTP 403，且无写入或状态变化。
3. import template/progress/failed-row download 都使用 `cmdb_import:read`；preview/execute 都使用 `cmdb_import:execute`。
4. impact/topology 仍保留原有资源存在、tenant、scope、ACL 和输入校验；本事件只替换功能 action 门禁。
5. UI 只对拥有对应 canonical action 的会话展示入口或操作；直接路由/API 与 UI 一致。
6. 所有 runId 角色、用户、assignment、CMDB 对象和 import 批次精确清理，manifest `objects=[]`、`cleanupFailures=0`。

## 非目标

- 不修改 permission 目录、角色模型、数据范围、资源 ACL 或 authorization mode。
- 不处理 `wiki:publish`、`notification:read` 或完整 `RBAC-013` 99-action矩阵的其他行。
- 不执行 restore、SQL 写、Redis 清理或非测试对象修改。

## 回滚

回滚本事件提交即可恢复旧 guard；无迁移或持久化数据结构变化。
