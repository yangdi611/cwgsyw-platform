# REM-P2-007 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-106`；用例：`XL-EXPORT-005`。
- 根因：需要核对 Controller/proxy 下载头传递和 exportExcel 工作表结构。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-16：认领与影响分析

- 状态：`IN_PROGRESS`；分支：`codex/rem-p2-007-ops-material-export-contract`；基线：`lint-fix@1b81e9fb`。
- 根因复核：历史导出已返回 XLSX MIME 与非空字节，但代理路径响应缺少可观察下载头，工作簿未包含“统计周期”“统计概览”“状态汇总”“任务明细”标题。
- GitNexus：`OpsCalendarMaterialController.export` upstream LOW、零直接调用者；`OpsCalendarMaterialService.exportExcel` upstream LOW、1 个直接调用者；前端 `exportExcel` upstream LOW、零直接调用者；`collect` upstream LOW、2 个直接调用者。无 HIGH/CRITICAL 风险。
- 预计范围：保持 `ops_calendar:export` 与原查询范围，补全工作簿结构、下载文件名消费和定向测试；不创建或变更运维任务。

## 2026-07-16：实现与 L1-L3 验证完成

- 状态：`VERIFIED`。根因确认：原 Controller 将含中文的普通 `filename` 写入 HTTP header，Tomcat 因非 Latin-1 字符删除整个 `Content-Disposition`；服务仅检查日期非空，反向范围会落入空查询并误返回 200。
- 实现：Controller 改用 `ContentDisposition.filename(filename, UTF_8)`，产生标准 `filename*`；服务边界拒绝 `startDate > endDate`。概览工作表补齐“统计周期”“统计概览”“状态汇总”，明细工作表增加“任务明细”标题；前端下载优先消费服务端 `filename*` 或 `filename`，保留稳定回退名。
- 自动化：新增 `OpsCalendarMaterialExportTest`，断言标题、状态汇总、明细行、attachment/MIME 和反向日期。在现有历史 testCompile 债务解除前，测试源不会编译到本事件测试；生产 compile 与 Docker package 已通过。
- 运行时：当前分支 backend/frontend 容器重建且 backend health UP。真实管理员会话下正常导出、空范围、反向日期、未认证均符合合同；Playwright 通过真实登录→管理→素材归集→归集→下载，下载中文文件名正确、Console 0 error。全部为 GET，无测试数据、审计或清理残留。
- 回滚：回退本事件提交即可恢复旧导出布局、文件名编码和日期行为；无迁移、无数据回滚。
