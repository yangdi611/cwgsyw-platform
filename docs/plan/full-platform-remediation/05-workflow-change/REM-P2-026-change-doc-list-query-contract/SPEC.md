# REM-P2-026 实施合同

## 目标

变更文档列表通过 `GET /api/change-docs` 提供 tenant 隔离的 status、keyword、page、size 查询，返回 `PageResult<ChangeDocVO>`；页面可按状态和关键词筛选、分页并打开既有详情抽屉。

## 影响

GitNexus upstream impact（2026-07-17）：

- `ChangeDocController.list`：direct callers=0，风险 `LOW`。
- `ChangeDocService.list`：direct caller=1（Controller），风险 `LOW`。
- `ChangeDocsPage`：direct callers=0，风险 `LOW`。

## 合同

1. `status`、`keyword` 为可选参数；`page` 默认 1、`size` 默认 20，范围 1..100。
2. keyword 匹配标题或变更单号；status 与 keyword 组合为交集；查询始终 tenant 隔离并按创建时间倒序。
3. 返回 records、total、page、size；空集返回 total=0 与空 records，不得 5xx。
4. 页面改变 status/keyword 时重置到第 1 页；关键词输入采用页面现有直接查询模式；详情抽屉不回归。

## 验收

- AC-001：无筛选、status、keyword、组合、空关键词和分页的 API records/total/page/size 正确。
- AC-002：关键词不匹配返回稳定空页，不泄漏其他 tenant 数据。
- AC-003：真实页面搜索、状态筛选、分页和详情抽屉正确，Console/4xx/5xx 为零。

## 回滚

回滚事件提交即可恢复原列表行为；无迁移、无配置和无业务数据写入。
