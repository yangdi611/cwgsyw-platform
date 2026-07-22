# REM-P2-029 实施合同

## 目标

拒绝变更文档动态字段中格式错误或不存在的日历日期/本地日期时间，防止无效时间进入任意可持久化状态。

## 合同

- `date` 必须是严格 ISO 本地日期 `yyyy-MM-dd`，并能由 `LocalDate` 解析。
- `datetime` 必须是严格 ISO 本地日期时间 `yyyy-MM-dd'T'HH:mm` 或带秒的等价本地 ISO 表达，并能由 `LocalDateTime` 解析；不接受时区偏移或任意文本。
- 空值由既有 required 合同处理：可选字段允许空，必填字段仍在提交阶段返回原有“不能为空”。
- 标量字段与表格列采用相同校验；创建、更新、submit、submitPlan 均不能绕过。
- 错误返回既有 `IllegalArgumentException` → HTTP 400，信息说明字段不是有效日期/日期时间；不写入文档、快照或审计副作用。

## 影响与回滚

GitNexus upstream impact：`validateScalarValue` 为 LOW，直接调用 `validateAndNormalize`，间接覆盖 create/update/submit/submitPlan 及对应 Controller 路由。修改限制在 `TableFieldSupport` 与其单测。

回滚本事件提交即可恢复原行为；无迁移或配置变更。

## 验收

| ID | 合同 |
|---|---|
| AC-001 | 有效 `date` 与 `datetime`（含闰年合法日期）可在标量与表格字段通过。 |
| AC-002 | 非法月份、日期、格式、时间和时区偏移在创建/更新/提交入口返回 400，且无持久化副作用。 |
| AC-003 | 空值、required、number、enum、普通文本及既有状态机行为保持兼容。 |
| AC-004 | 当前分支容器的真实 UI/API 复验通过，runId 对象仅通过产品 API 精确清理。 |
