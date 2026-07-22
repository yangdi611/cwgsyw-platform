# VERIFICATION：REM-P1-076

## L1 定向层

- Controller 方法安全测试：canonical allow、旧 guard-only deny、缺 canonical deny。
- 每个 action 的合法 payload/目标；拒绝前发生，业务服务不被调用。

## L2 根因聚类层

- CSV template/progress/failed-row 与 preview/execute。
- JSON/NDJSON preview/execute。
- impact 与 topology/compare。
- CMDB attribute canonical guards、instance CRUD/export/import、route/sidebar 权限回归。

## L3 模块与运行时层

- Java 21 相关测试和 backend package。
- 从事件分支重建 backend；健康检查通过。
- Playwright canonical-only/legacy-only API 与真实 UI 差分。
- Console/5xx=0；manifest 和 runId readback=0。

## 当前结果

`VERIFIED`。

- L1：Homebrew Java 21 下 `CmdbCanonicalPermissionConsumerAuthorizationTest` 与 `CiAttributeControllerAuthorizationTest` 共 `3/3 PASS`。
- L2：12 个 CMDB authorization/import/impact/topology/metadata/serialization 测试类共 `55/55 PASS`；frontend typecheck PASS，8 个触及文件 ESLint `0 error`（4 条既有 warning）。
- L3：backend package、backend/frontend production image build PASS；镜像 `b1c552a4` / `32cc690c` 仅替换两个应用容器，backend healthy、gateway `200`、Redis session epoch 未递增。
- 运行时：`/tmp/rem-p1-076-runtime-r4/result.json`，Playwright `1/1 PASS`；canonical API/UI allow、legacy API 403/UI hidden，CSV/JSON、progress、failed rows、impact、topology/compare 全覆盖，Console/pageerror/5xx `0/0/0`。
- 清理：首轮清理资产遗漏后已通过产品 API 精确删除并修正按 model 枚举；最终 manifest `objects=[]`、`cleanupFailures=0`，最终 runId model instances 回读为 0。
