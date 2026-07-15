# REM-P1-009 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-061`、`BUG-FQA-086`、`BUG-FQA-088`；用例：`CMDB-028`、`CMDB-040`、`DEVICE-003`。
- 根因：创建/删除事务缺少跨表不变量与数据库约束，onDelete 策略未在命令服务执行。
- GitNexus 已刷新并完成领域 query；未编辑业务符号，逐符号 impact 留给实施门禁。
- 未修改代码、数据库或容器，未创建测试对象。
- 下一步：独立分支认领后，从 `AC-001` 开始并追加实际 impact、diff、测试、证据、清理和回滚。

后续记录只追加，不覆盖历史。

## 2026-07-15：删除语义确认

- 用户确认采用 `restrict`。
- 删除 CI 时，只要存在活跃 CMDB 关系或活跃设备关联即拒绝；系统不自动删除、解绑或迁移关系和设备。
- 拒绝必须零副作用：CI、关系、设备、审计和变更记录均保持不变。
- 删除与设备创建通过同一 CI 行锁串行化，避免并发交错产生孤儿设备引用。

## 2026-07-15：实现与本地验证

- `CiRelationService.create` 在读取或写入前拒绝自环；V73 数据库检查约束对活跃关系做同一保护。
- `DeviceService.create` 拒绝同一租户下的重复活跃设备关联；V73 局部唯一索引处理并发兜底。
- `CiInstanceCommandService.delete` 锁定目标 CI 后检查活跃关系和设备；任一存在即拒绝且不写入任何记录。
- 定向测试、完整后端测试（JDK 21）、开发容器构建、健康检查和迁移约束检查通过。
- runId API 验证完成：自关联、关系 restrict、设备 restrict、重复设备关联和并发设备创建均按合同拒绝；产品 API 逆序清理后按 runId 查询无残留。
- UI 复验：从 `http://localhost` 登录后真实进入 rack 实例列表、点击删除并接受确认弹窗，页面展示关系 restrict 的可读拒绝提示；唯一 console resource error 对应预期 API `400`，无额外 console error。夹具已通过产品 API 精确清理。
- GitNexus 已刷新索引、执行三处 upstream impact 与 `detect_changes`；高风险范围未超出当前事件合同。L1-L3 全部通过，事件进入 `VERIFIED`，等待最终 L4。
