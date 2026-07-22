# REM-P1-040 实施合同

## 目标

修复工作流定义创建/更新时请求元数据与 BPMN XML/Flowable 元数据不一致，确保 name、category、description 和完整画布属性在 v2 保存、API 回读与 UI 重载后保持。

## 不变量

- 保持 key、权限、租户、版本、审计、绑定和运行实例语义。
- 不迁移历史定义，不修改正式 Wiki binding，不触及授权模式。
- runId 定义仅经产品 API 创建和删除，清理失败即 BLOCKED。

## 验收

| AC | 条件 |
|---|---|
| AC-001 | 元数据安全写入 XML，特殊字符转义且画布结构保持。 |
| AC-002 | 真实 UI 保存 v2 后 name/category/description 正确回读和重载。 |
| AC-003 | assignee、candidateGroups、conditionExpression 同步保持。 |
| AC-004 | Java 21 构建、健康、清理和 impact/detect 通过。 |
| AC-005 | 合并后 L4 `FLOW-007/008` 通过。 |
