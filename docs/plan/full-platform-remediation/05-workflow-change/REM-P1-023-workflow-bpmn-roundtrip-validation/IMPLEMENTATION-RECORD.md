# REM-P1-023 实施记录

## 2026-07-15：规划完成

- 状态：`NOT_STARTED`；基线：`lint-fix@842dc84f`。
- 缺陷：`BUG-FQA-021`、`BUG-FQA-084`、`BUG-FQA-104`、`BUG-FQA-105`；用例：`WORKFLOW-DEFINITION-LIFECYCLE`、`FLOW-007`、`FLOW-008`、`FLOW-009`。
- 根因：SaveProcessDefinitionReq 缺 validation；设计器初始 XML/序列化命名空间与 Flowable deployment 元数据映射未形成可往返合同。
- GitNexus 索引已刷新并完成领域 query；尚未编辑业务符号，逐符号 impact 留给实施。
- 未改代码、数据库、容器或测试对象。
- 下一步：独立分支认领，从 `AC-001` 开始追加实际 impact、diff、测试、证据、清理与回滚。

后续只追加，不覆盖历史。

## 2026-07-15：实施与复验结算

- 认领：基线 `lint-fix@62ce56e`，分支 `codex/rem-p1-023-workflow-bpmn-roundtrip-validation`。GitNexus impact：`createDefinition` LOW（一个 Controller 调用）；`updateDefinition` LOW（两个 Controller 入口，含 `updateByKey` 流程）。
- 根因复现：缺 key、非法 key 与非法 XML 均为未解释 `500`。
- 修复：`SaveProcessDefinitionReq` 增加 name/key/xml 约束；Controller 使用 `@Valid`；服务在部署前安全解析 XML，要求 BPMN definitions、单一 process、start/end event；Flowable 部署异常映射 `BPMN_DEPLOYMENT_INVALID` / `400`。成功部署、版本、权限与历史定义均不改变。
- L3：`REM_P1_023_20260715114734` 证明错误输入均为 `400`，包含 candidate group 和条件流的 BPMN 从创建到详情、更新 v2、再次详情完整往返；测试定义通过 DELETE 产品 API 清理，cleanup failure=0。
- 回滚：还原本事件提交即可恢复旧行为；未执行历史 BPMN 迁移、数据库直改或非测试流程操作。
