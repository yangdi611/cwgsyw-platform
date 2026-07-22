# REM-P1-055 验证矩阵

| AC | 层级 | 结果 | 证据 |
|---|---|---|---|
| `AC-001` | L1 | PASS | `CiModelServiceContractTest`：公开 `getByCode` true/false 保真 |
| `AC-002` | L1 | PASS | `CiModelServiceContractTest` + `CmdbVoSerializationTest`：camelCase `isDrawerShow` |
| `AC-003` | L1-L2 | PASS | Java 21 聚类 33/33、0 failure/error；compile PASS |
| `AC-004` | L3 | PASS | 当前镜像 `sha256:6b103a6a...`、backend healthy/UP；`/tmp/rem-p1-055-cmdb-drawer-r2` 1/1 PASS |
| `AC-005` | L3 | PASS | 十字段 label/value、pageerror/5xx=0；manifest `objects=[]`、`cleanupFailures=0`，模型关键词读回 0 |

原始失败：L4 snapshot `c6f77028`；`/tmp/fqa-2050-cmdb-types-after-rem-p1-008-r7`。模型详情响应中的十个属性均缺失 `isDrawerShow`，真实抽屉无 `关键属性`。

运行时复验前后授权均保持 configured/effective/cutover `enforced`、epoch 32。两次额外只读诊断误用了不存在的 cutover URL和不支持 GET 的 break-glass 路由，各产生一个已解释 500；它们不属于产品 AC，未改变授权状态，正确 cutover 只读端点随后核对通过。
