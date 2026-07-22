# 实施记录

## 2026-07-17：认领与影响分析

- 从 `lint-fix@b63598e33` 创建 `codex/rem-p2-029-change-doc-temporal-validation`。
- 原始 L4 `CHANGE-005` 保持 FAIL：`2026-99-99` 已进入 `plan_pending`。`REM-P2-028` 仅解除测试对象精确清理门禁，不能替代日期输入修复。
- GitNexus upstream impact：`TableFieldSupport` LOW；`validateScalarValue` LOW，直接调用者为 `validateAndNormalize`，其后覆盖 create/update/submit/submitPlan 及 Controller 路由。没有 HIGH/CRITICAL 风险或新增授权边界。
- 计划：以 Java `LocalDate`/`LocalDateTime` 严格解析校验标量与表格日期类型，补齐单测后进行真实会话 API/UI 复验。

## 2026-07-17：实现与 L1-L2 结果

- `TableFieldSupport.validateScalarValue` 现在以严格正则加 `LocalDate`/`LocalDateTime` 解析标量 `date`/`datetime`；表格列复用同一校验。格式、日历日、时分秒和 offset 均不能绕过。
- 新增 `TableFieldSupportTest` 覆盖合法闰年、秒级 datetime、非法日历日期、offset datetime 以及表格日期/日期时间列。
- 定向 Maven 测试无法开始执行，因为全仓 testCompile 先被四个既有无关错误阻断：`OpsCalendarRuleServiceTest` 缺 `SecurityUser`、`OpsCalendarTaskServiceTest` 的 `insert` 二义性、`GroupControllerGroupReferenceTest` 类型不匹配。未修改这些无关文件。`mvn -Dmaven.test.skip=true package` 通过。
- 从当前事件分支重建 backend/frontend/nginx 后，真实 superadmin API 创建非法日期、非法时间、更新非法日期均为 HTTP 400；合法 `2024-02-29` 和 `2026-07-17T13:45:30` 创建/提交为 200，失败更新后字段仍保持合法值。两个 runId 模板/文档已通过产品 API 清理，关键词回读零残留。
- Browser 控制通道没有可用浏览器实例，L3 真实 UI/Console/网络验证尚未执行；事件保持 `VERIFYING`，未暂存、提交或合并。

## 2026-07-17：L1-L3 完成

- 定向 `mvn test` 仍会先触发仓库既有 testCompile 与 Surefire agent 配置错误；为不修改无关测试/POM，使用项目 JDK 21 直接编译 `TableFieldSupportTest` 并通过 JUnit Platform Console 执行，24 个测试全部通过。
- 隔离 Playwright Chromium 使用真实产品登录状态进入新建变更页，选择 runId 模板 #11，填写合法日期 `2024-02-29` 和本地日期时间 `2026-07-17T13:45` 后创建 #216 并进入详情；Console errors=0、应用 API 4xx/5xx=0。
- #216 通过受限产品端点精确清理，模板 #11 通过既有产品 DELETE 清理，关键词回读为零。事件满足 L1-L3，状态改为 `VERIFIED`，待提交、no-ff 合并和 L4 `CHANGE-005` 复验。
