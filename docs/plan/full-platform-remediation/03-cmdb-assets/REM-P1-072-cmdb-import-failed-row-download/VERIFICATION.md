# REM-P1-072 验证记录

## L1 定向层

- `CsvImportServiceTest`：Java 21，5/5 PASS。
- 覆盖执行结果保存、preview batch tenant owner、跨租户执行/下载拒绝、空结果表头、CSV 行输出及公式/特殊字符转义。

## L2 根因聚类层

- `test/l4-cmdb-import-failed-rows-current-run.spec.js` 覆盖预览、目标实例删除、执行失败行、下载内容和产品 API 清理。
- 事件实现保留预览键删除合同，并将失败结果单独设置 600 秒 TTL。

## L3 模块与运行时层

- 状态：`PASS`。
- Java 21 `mvn -q -DskipTests package` PASS；Docker 当前分支 backend 镜像构建成功，仅替换 backend 容器后 healthy，Java 21.0.11、Flyway V79。
- `test/l4-cmdb-import-failed-rows-current-run.spec.js` 最终 `1/1` PASS，1.0 秒，证据 `/tmp/rem-p1-072-xl-export-004-final3`。
- 真实链路：预览一条 update、产品删除目标实例、execute 返回一条失败行、post-execute CSV HTTP 200 并含原始 marker/失败原因；全部 CMDB fixture 通过产品 API 逆序清理。
- 最终 manifest `objects=[]`、`cleanupFailures=0`；backend 无相关 ERROR/Exception。

## 证据

- 原始失败：`/tmp/fqa-2050-xl-export-004-failure`。
- 失败快照：`d43e8637`。
- 事件 run：`REM_P1_072_20260721`。
- L3 最终证据：`/tmp/rem-p1-072-xl-export-004-final3`。
