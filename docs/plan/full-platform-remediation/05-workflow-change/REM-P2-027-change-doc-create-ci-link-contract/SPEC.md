# REM-P2-027 实施合同

## 目标

变更文档新建页选中的 CI 必须随草稿创建在同一事务内持久化；详情 `GET /api/change-docs/{id}/ci-links` 必须回读关联。

## 当前与目标行为

- 当前：前端提交 `ciSnapshots`，但 `CreateChangeDocRequest` 未声明该字段，Jackson 忽略它；`ChangeDocService.create` 只写文档、快照和审计。
- 目标：DTO 接收 CI 项的 `instanceId`/可选 `impactLevel`；文档插入后复用受 tenant 校验的 `ChangeDocLinkService.linkCiInstances` 创建链接。任一不存在、跨 tenant 或链接写入错误均使创建事务回滚。

## 不变量

1. 创建权限仍为 `change_doc:create`；链接不授予任何 CI 读取越权。
2. 只接受同租户、未删除 CI；重复 CI 仅保留一条关联。
3. 不传 CI、空数组和既有独立 `POST /ci-links` 行为保持不变。
4. 创建、关联、快照与审计属于同一事务；失败不能留下草稿。

## GitNexus 影响

- `CreateChangeDocRequest`：upstream direct callers=0，风险 `LOW`。
- `ChangeDocService.create`：direct caller=1（`ChangeDocController.create`），风险 `LOW`。
- `ChangeDocLinkService.linkCiInstances`：upstream direct callers=0，风险 `LOW`。

## 验收

- AC-001 / `CHANGE-002` / L1：DTO 接收 CI 项，创建服务在事务内委托链接服务，空数组兼容。
- AC-002 / `CHANGE-002` / L2：真实会话创建带 CI 草稿后链接回读为 1；无 CI 保持 0；非法/跨租户 CI 拒绝且无草稿残留。
- AC-003 / `CHANGE-002` / L3：当前分支容器真实页面选择模板、动态字段和 CI 后创建，数值详情路由、关联显示、Console/API 错误为零；runId 草稿通过产品 DELETE 清理。

## 回滚

回滚本事件提交即可恢复原创建合同；无迁移、配置或历史数据改写。
