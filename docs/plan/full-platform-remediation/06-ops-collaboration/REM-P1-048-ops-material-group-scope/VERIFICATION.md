# REM-P1-048 验证与证据矩阵

| AC | caseId | 层级 | 证据 | 结果 |
|---|---|---|---|---|
| `AC-001` | `OPS-017` materials group scope | L1/L2 | Controller 4/4 + 真实 group identity：省略/伪造组均返回本人组 | `PASS` |
| `AC-002` | `OPS-017` XLSX group scope | L1/L2/L3 | 省略/伪造组的工作簿均只含本组标题；真实 UI 下载同样隔离 | `PASS` |
| `AC-003` | tenant/platform compatibility | L1/L2 | tenant 全量工作簿含两组，显式 B 组只含 B；platform null 参数保持 | `PASS` |
| `AC-004` | list/stats/material/export parity | L2/L3 | 两组任务、组长真实素材页/下载只含本组，Console/API failures=0 | `PASS` |
| `AC-005` | module/runtime/cleanup | L3 | Java 21、生产 build、当前 backend healthy、Playwright 3/3、manifest/活动对象=0 | `PASS` |
| `AC-006` | same-run `OPS-017` | L4 | no-ff 合并后受影响复验 | `PENDING` |

原始失败证据保留在 L4 run `FQA_20260718_2050_remp1038` 的 commit `de9b693b` 和 `/tmp/fqa-2050-ops-scope-export-rerun`。失败批次中的两组任务、三个 assignment、三个用户和三个角色均已通过产品 API 清理，manifest `objects=[]`、`cleanupFailures=0`。

PASS 要求 group scope 的列表、统计、素材 JSON 和 XLSX 均不包含其他组任务；tenant/platform 兼容不退化；无未解释 5xx/Console error；测试数据精确清理。任何跨组素材、残留或部分覆盖均为 FAIL。

## 2026-07-19 L1-L3 复验

- L1：Java 21 独立 target 执行 `OpsCalendarMaterialControllerTest`，4/4 PASS；覆盖 collect/export 的 group 强制和 tenant/platform null/显式组兼容。
- Build：`docker compose -f docker-compose.dev.yml build backend` PASS，生成镜像 `sha256:5c28ebc3fc8ba3df1e8bcbd889ac57b1814b2d5fd09df866782d88c36e8194ff`；仅替换 backend，容器内 actuator 为 `UP` 且 Docker health 为 `healthy`。Java 21 `mvn -q -DskipTests compile` 复验 PASS。
- L2/L3：`test/rem-p1-048-ops-material-group-scope.spec.js` 增强后 3/3 PASS，输出 `/tmp/rem-p1-048-runtime-final-r3`。no-export UI/API、tenant 全量/逐组/空范围、group 列表/统计/素材/伪造组、四种 XLSX 内容和组长真实页面下载全部通过；拒绝页仅出现与预期 stats 403 对应的一条已解释 Console 记录，组长流程 Console/API failures=0。
- 清理：事件 manifest `objects=[]`、`cleanupFailures=0`；产品 API 查询 runId 任务/用户/角色均为 0；backend 近 15 分钟无 ERROR、异常或数据完整性错误。
- 模块聚类：Controller 4/4 PASS；MaterialExport 的 workbook/HTTP 实质断言此前已执行，但整类仍因未触及的 `OpsCalendarMaterialExportTest:45` 冗余 Mockito stub 在 `afterEach` 报 `UnnecessaryStubbingException`。该既有债务已在 REM-P1-047 记录，本事件不修改无关测试；本次真实 XLSX API/UI 解析覆盖受影响合同。
