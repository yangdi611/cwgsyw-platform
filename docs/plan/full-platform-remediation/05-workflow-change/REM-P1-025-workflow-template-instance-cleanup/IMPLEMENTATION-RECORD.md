# REM-P1-025 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-049`；用例：`FLOW-005`。
- 根因：WorkflowTemplateController/Service 只实现创建与读取，没有引用检查、删除或归档事务。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：L1-L3 实施与复验完成

- 基线：`lint-fix@07b0006`；分支：`codex/rem-p1-025-workflow-template-instance-cleanup`。
- GitNexus：创建链路 impact LOW（控制器为唯一直接调用方）；新增 `deleteInstance` impact MEDIUM，直接影响模板控制器和 4 个定向测试，无执行流影响。既有 `ProcessBindingServiceImpl.bind` impact HIGH（启动器、种子、绑定页），未修改该方法。
- 合同：采用 restrict 删除。启用绑定、运行实例或历史实例任一存在即稳定拒绝；不隐式解绑、不删除业务历史。无引用时非级联删除 Flowable deployment，再软删除模板实例并写审计。
- 修复：补充 `DELETE /api/workflow/templates/instances/{instanceId}`，服务层对实例所属租户、绑定/runtime/history 引用进行检查；前端添加删除按钮和确认对话框。
- L1：Java 21 容器执行 `WorkflowTemplateServiceLifecycleTest,BpmnTemplateGeneratorTest,BpmnValidationServiceTest` 通过。
- L2：真实 API 创建、删除、列表归零、重复/不存在删除 400 均通过；绑定、运行、历史引用的拒绝与零副作用由服务测试覆盖。
- L3：`docker compose -f docker-compose.dev.yml build backend frontend` 通过，容器健康为 UP；隔离 Playwright 完成登录、创建、点击确认删除、列表行消失、API 零残留和控制台零错误复验。
- 清理：所有 `REM_P1_025_*` 测试模板实例均通过模板实例 DELETE API 精确清理，最终可见实例数为 0；未执行直接 SQL、Redis、对象存储或全局会话操作。
- 回滚：回退本事件提交会移除模板实例删除端点和 UI；无 schema 迁移或非测试数据变更。
