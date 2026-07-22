# REM-P2-025 验证矩阵

| AC | 层级 | 检查 | 结果 | 证据 |
|---|---|---|---|---|
| AC-001 | L1 | 递归 SQL 路径保护与深度参数静态回归 | PASS | `CiInstanceRelMapperTopologySqlTest` 已新增；全量 testCompile 被 4 个既有无关错误阻断，生产编译与 `mvn -Dmaven.test.skip=true package` 通过 |
| AC-002 | L2 | 双向/循环关系的深度 1、2 API 读取 | PASS | 当前分支容器真实会话：depth=1、2 均 HTTP 200，均为 5 nodes / 5 edges |
| AC-003 | L2 | compare 拓扑重建读取 | PASS | 当前分支容器真实会话：depth=2 compare HTTP 200，added=0、removed=2、modified=0、unchanged=5 |
| AC-004 | L3 | 真实登录、拓扑页、网络和 Console | PASS | Playwright 登录 `superadmin` 后打开 `/cmdb/topology/20`，深度 2→1 两次请求均 200，图谱可见、5 nodes / 5 edges、Console error=0 |

已知无关阻塞：Maven 定向测试目前可能被既有的 `OpsCalendarRuleServiceTest`、`OpsCalendarTaskServiceTest`、`GroupControllerGroupReferenceTest` testCompile 问题阻断；需记录实际输出，并以 `mvn -Dmaven.test.skip=true package` 与 L3 补充验证。

当前分支容器已由 `codex/rem-p2-025-cmdb-topology-cycle-safety` 源码构建并仅替换 backend 服务；未清空数据库、Redis 或会话，健康检查为 `healthy`。
