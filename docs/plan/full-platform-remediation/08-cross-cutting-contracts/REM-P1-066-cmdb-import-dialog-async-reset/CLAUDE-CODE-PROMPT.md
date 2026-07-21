# REM-P1-066 执行入口

本事件只处理 CMDB 导入对话框关闭后的异步回调污染。先读根 Goal、checkpoint、本目录五件套与当前 run `COMMON-010` 失败证据。

编辑 `CsvImportDialog` 前运行 GitNexus upstream impact。保持导入 API、格式、事务和正常完成路径；只隔离旧 dialog lifecycle 的 preview/execute 回调。使用 route mock 构造 pending 请求，禁止为竞态测试写真实 CMDB 数据。完成 typecheck、目标 lint、生产构建、当前容器 preview/execute 浏览器复验、detect_changes、独立提交和 no-ff 合并后，在同一 L4 run 重验受影响 `COMMON-010` 并继续未执行项。
