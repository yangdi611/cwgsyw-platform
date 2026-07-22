# 实施记录

## 2026-07-21：认领与影响分析

- 来源为同 run L4 的 `XL-EXPORT-004`。执行后失败行接口返回 HTTP 400，原因是预览键被删除且下载实现没有失败数据行。
- 分支从 `lint-fix@ea1a6531` 创建，事件运行 `REM_P1_072_20260721`。
- GitNexus upstream impact：`CsvImportService.execute` LOW，2 个直接影响点（Controller、定向单测）；`downloadFailedRows` LOW，1 个直接影响点（Controller）；无已登记 execution flow。

## 2026-07-21：实现与 L1-L2

- `preview` 将 batch owner tenant 写入同 TTL 的独立键；`execute` 在业务写入前校验 owner，并在完成后删除 preview/owner 键。
- `execute` 将 `{tenantId, failedRows}` 写入独立 `cmdb:import:failed:{batchId}` 键，TTL 600 秒。
- `downloadFailedRows` 读取并校验租户后生成 UTF-8 CSV；输出原始字段、行号和失败原因，过滤内部字段，CSV 单元格处理逗号/引号/换行及公式前缀。
- 定向 Java 21 单测 5/5 PASS；未使用直接 Redis/SQL/对象存储清理。

## 2026-07-21：L3 与回滚

- Java 21 package 与 Docker 生产 backend 镜像构建成功；仅替换 backend 后 healthy，Flyway V79，无会话清空。
- 最终 Playwright `/tmp/rem-p1-072-xl-export-004-final3` 1/1 PASS；执行失败行下载、UTF-8 内容和产品 API 清理通过，manifest 0/0，backend 无相关 ERROR/Exception。
- 首轮事件运行因该分支缺少 ignored 的当前-run manifest 文件在 finally 报 ENOENT；从已提交失败快照恢复权威空 manifest 后重跑。该问题属于测试证据文件可见性，不是产品失败，且清理请求已在写 manifest 前执行。
- 回滚方式为回退本事件提交并重新构建 backend；不涉及迁移、全局配置或数据回填。
