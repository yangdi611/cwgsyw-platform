# REM-P2-031 实施合同

## 目标

恢复 Maven 测试源码编译，使后端定向测试可执行，而不改变任何生产行为。

## 变更合同

- `OpsCalendarRuleServiceTest` 导入现有生产类型 `SecurityUser`。
- `OpsCalendarTaskServiceTest` 的 Mockito matcher 明确为 `OpsScheduleTask`，匹配现有 `BaseMapper.insert(T)` 调用。
- `GroupControllerGroupReferenceTest` 使用控制器当前的 `GroupRequest` 请求 DTO。
- 不增加生产代码改动，不改变测试覆盖的行为性断言。

## 影响分析

三个测试方法 upstream impact 均为 `LOW`：无直接调用者、无受影响执行流或模块。仅修改测试源码。

## 验收条件

| ID | 条件 |
|---|---|
| AC-001 | 三个指定测试源码可完成 testCompile |
| AC-002 | 三个指定测试均通过，且没有修改生产源码 |
| AC-003 | `REM-P1-033` 相关定向测试可启动，不再被本事件的三处编译错误阻断 |
