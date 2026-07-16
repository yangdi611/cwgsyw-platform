# REM-P2-025 执行入口

继续唯一事件 `REM-P2-025`。只修复 `CiInstanceRelMapper.findTopologyEdges` 的递归路径回环：对已在当前路径访问过的实例禁止再次展开。编辑符号前必须运行 GitNexus upstream impact；不得修改权限、实例、关联、数据库结构或非测试数据。完成定向验证、当前分支容器 API/UI 复验、证据回写、`detect_changes` 与 no-ff 合并后，从新集成点恢复 L4 `CMDB-029`。
